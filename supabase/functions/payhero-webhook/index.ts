import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tierRank(tier: string | null | undefined) {
  if (tier === 'consultation') return 3;
  if (tier === 'full') return 2;
  if (tier === 'basic') return 1;
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('PAYHERO_WEBHOOK_SECRET') ?? '';
  if (webhookSecret) {
    const url = new URL(req.url);
    const providedSecret = req.headers.get('x-luo101-webhook-secret') ?? url.searchParams.get('secret') ?? '';
    if (providedSecret !== webhookSecret) {
      return jsonResponse({ error: 'Unauthorized webhook.' }, 401);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Webhook service is not configured.' }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400);
  }

  const response = (payload.response ?? {}) as Record<string, unknown>;
  const externalReference = String(response.ExternalReference ?? payload.ExternalReference ?? '').trim();
  const checkoutRequestId = String(response.CheckoutRequestID ?? payload.CheckoutRequestID ?? '').trim();
  const resultCode = Number(response.ResultCode ?? -1);
  const statusText = String(response.Status ?? '').toLowerCase();
  const isPaid = Boolean(payload.status) && resultCode === 0 && statusText === 'success';

  if (!externalReference && !checkoutRequestId) {
    return jsonResponse({ error: 'Webhook payload missing transaction reference.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase.from('payment_attempts').select('*').limit(1);
  query = externalReference ? query.eq('external_reference', externalReference) : query.eq('checkout_request_id', checkoutRequestId);
  const { data: attempts, error: findError } = await query;

  if (findError || !attempts?.length) {
    return jsonResponse({ error: 'Payment attempt not found.' }, 404);
  }

  const attempt = attempts[0] as {
    id: string;
    user_id: string;
    package_id: string;
    status: string;
  };
  const nextStatus = isPaid ? 'paid' : 'failed';

  await supabase
    .from('payment_attempts')
    .update({
      status: nextStatus,
      checkout_request_id: response.CheckoutRequestID ?? checkoutRequestId ?? null,
      mpesa_receipt_number: response.MpesaReceiptNumber ?? null,
      provider_reference: response.MpesaReceiptNumber ?? response.MerchantRequestID ?? null,
      phone_number: response.Phone ?? null,
      raw_response: payload,
    })
    .eq('id', attempt.id);

  if (isPaid) {
    const tier = attempt.package_id === 'consultation' ? 'consultation' : attempt.package_id === 'full' ? 'full' : 'basic';
    const { data: existing } = await supabase
      .from('user_entitlements')
      .select('tier')
      .eq('user_id', attempt.user_id)
      .maybeSingle();

    if (tierRank(tier) >= tierRank(existing?.tier)) {
      await supabase.from('user_entitlements').upsert({
        user_id: attempt.user_id,
        tier,
        package_id: attempt.package_id,
        source_payment_id: attempt.id,
        live_consultation_included: tier === 'consultation',
      });
    }
  }

  return jsonResponse({ ok: true, status: nextStatus });
});
