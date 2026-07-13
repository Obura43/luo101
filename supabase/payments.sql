-- Luo101 payment and entitlement setup
-- Run this in Supabase SQL Editor after supabase/profiles.sql.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  package_name text not null,
  amount_kes integer not null,
  provider text not null default 'payhero',
  status text not null default 'initiated',
  external_reference text not null unique,
  checkout_request_id text,
  provider_reference text,
  mpesa_receipt_number text,
  phone_number text,
  customer_name text,
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'none',
  package_id text,
  source_payment_id uuid references public.payment_attempts(id) on delete set null,
  live_consultation_included boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_user_created_idx on public.payment_attempts(user_id, created_at desc);
create index if not exists payment_attempts_external_reference_idx on public.payment_attempts(external_reference);
create index if not exists payment_attempts_checkout_request_idx on public.payment_attempts(checkout_request_id);

drop trigger if exists payment_attempts_set_updated_at on public.payment_attempts;
create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row execute function public.set_updated_at();

drop trigger if exists user_entitlements_set_updated_at on public.user_entitlements;
create trigger user_entitlements_set_updated_at
before update on public.user_entitlements
for each row execute function public.set_updated_at();

alter table public.payment_attempts enable row level security;
alter table public.user_entitlements enable row level security;

drop policy if exists "Users can read own payment attempts" on public.payment_attempts;
create policy "Users can read own payment attempts"
on public.payment_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own entitlement" on public.user_entitlements;
create policy "Users can read own entitlement"
on public.user_entitlements for select
to authenticated
using (auth.uid() = user_id);

-- Inserts/updates are intentionally performed by Supabase Edge Functions using the service role key.
