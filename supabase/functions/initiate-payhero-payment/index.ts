import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CoursePackage = {
  id: 'basic' | 'full' | 'consultation';
  name: string;
  amountKes: number;
  tier: 'basic' | 'full' | 'consultation';
};

const PACKAGES: Record<string, CoursePackage> = {
  basic: { id: 'basic', name: 'Luo101 Foundation Course', amountKes: 799, tier: 'basic' },
  full: { id: 'full', name: 'Luo101 Complete Course', amountKes: 1500, tier: 'full' },
  consultation: { id: 'consultation', name: 'Luo101 Complete Course + Live Guidance', amountKes: 6000, tier: 'consultation' },
};

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

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const payheroAuthToken = Deno.env.get('PAYHERO_BASIC_AUTH_TOKEN') ?? '';
  const payheroBaseUrl = Deno.env.get('PAYHERO_BASE_URL') ?? 'https://backend.payhero.co.ke';
  const payheroChannelId = Number(Deno.env.get('PAYHERO_CHANNEL_ID') ?? '10441');
  const callbackUrl = Deno.env.get('PAYHERO_CALLBACK_URL') ?? `${supabaseUrl}/functions/v1/payhero-webhook`;

  if (!supabaseUrl || !serviceRoleKey || !payheroAuthToken || !payheroChannelId) {
    return jsonResponse({ error: 'Payment service is not fully configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace('Bearer ', '').trim();

  if (!accessToken) {
    return jsonResponse({ error: 'Sign in first to start a payment.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return jsonResponse({ error: 'Your session could not be verified. Please sign in again.' }, 401);
  }

  let body: { package_id?: string; phone_number?: string; customer_name?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const selectedPackage = body.package_id ? PACKAGES[body.package_id] : null;
  const phoneNumber = normalizePhone(body.phone_number ?? '');
  const customerName = (body.customer_name ?? userData.user.email ?? 'Luo101 Learner').trim();

  if (!selectedPackage) {
    return jsonResponse({ error: 'Choose a valid Luo101 package.' }, 400);
  }

  if (!phoneNumber) {
    return jsonResponse({ error: 'Enter a valid Safaricom M-Pesa phone number.' }, 400);
  }

  const externalReference = `LUO101-${selectedPackage.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
  const payheroPayload = {
    amount: selectedPackage.amountKes,
    phone_number: phoneNumber,
    channel_id: payheroChannelId,
    provider: 'm-pesa',
    external_reference: externalReference,
    customer_name: customerName,
    callback_url: callbackUrl,
  };

  const { data: attempt, error: insertError } = await supabase
    .from('payment_attempts')
    .insert({
      user_id: userData.user.id,
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      amount_kes: selectedPackage.amountKes,
      provider: 'payhero',
      status: 'initiated',
      external_reference: externalReference,
      phone_number: phoneNumber,
      customer_name: customerName,
      raw_request: payheroPayload,
    })
    .select('id')
    .single();

  if (insertError || !attempt) {
    return jsonResponse({ error: 'Could not create a payment attempt.' }, 500);
  }

  const response = await fetch(`${payheroBaseUrl}/api/v2/payments`, {
    method: 'POST',
    headers: {
      Authorization: payheroAuthToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payheroPayload),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    await supabase
      .from('payment_attempts')
      .update({ status: 'failed_to_queue', raw_response: responseBody })
      .eq('id', attempt.id);

    return jsonResponse({ error: responseBody.error_message ?? 'PayHero could not start the payment.', details: responseBody }, 502);
  }

  await supabase
    .from('payment_attempts')
    .update({
      status: responseBody.status?.toLowerCase?.() === 'queued' ? 'queued' : 'pending',
      checkout_request_id: responseBody.CheckoutRequestID ?? null,
      provider_reference: responseBody.reference ?? null,
      raw_response: responseBody,
    })
    .eq('id', attempt.id);

  return jsonResponse({
    success: true,
    attempt_id: attempt.id,
    external_reference: externalReference,
    checkout_request_id: responseBody.CheckoutRequestID ?? null,
    provider_reference: responseBody.reference ?? null,
    status: responseBody.status ?? 'QUEUED',
    message: 'M-Pesa prompt sent. Complete the payment on your phone.',
  }, 201);
});
