-- Luo101 referral program setup
-- Run this after supabase/profiles.sql and supabase/payments.sql.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'signed_up',
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  constraint referrals_no_self_referral check (referrer_user_id <> referred_user_id),
  constraint referrals_one_referrer_per_user unique (referred_user_id)
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete cascade,
  amount_kes integer not null default 200,
  status text not null default 'pending',
  payout_schedule text not null default 'Manual M-Pesa payout on Tuesday or Friday',
  payout_phone text,
  payout_reference text,
  payout_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint referral_commissions_one_per_payment unique (payment_attempt_id)
);

create index if not exists referral_codes_code_idx on public.referral_codes(code);
create index if not exists referrals_referrer_created_idx on public.referrals(referrer_user_id, created_at desc);
create index if not exists referrals_referred_idx on public.referrals(referred_user_id);
create index if not exists referral_commissions_referrer_status_idx on public.referral_commissions(referrer_user_id, status);

drop trigger if exists referral_codes_set_updated_at on public.referral_codes;
create trigger referral_codes_set_updated_at
before update on public.referral_codes
for each row execute function public.set_updated_at();

drop trigger if exists referral_commissions_set_updated_at on public.referral_commissions;
create trigger referral_commissions_set_updated_at
before update on public.referral_commissions
for each row execute function public.set_updated_at();

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

drop policy if exists "Authenticated users can read referral codes" on public.referral_codes;
create policy "Authenticated users can read referral codes"
on public.referral_codes for select
to authenticated
using (true);

drop policy if exists "Users can create own referral code" on public.referral_codes;
create policy "Users can create own referral code"
on public.referral_codes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own referral code" on public.referral_codes;
create policy "Users can update own referral code"
on public.referral_codes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read involved referrals" on public.referrals;
create policy "Users can read involved referrals"
on public.referrals for select
to authenticated
using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

drop policy if exists "Referred users can attach first referral" on public.referrals;
create policy "Referred users can attach first referral"
on public.referrals for insert
to authenticated
with check (auth.uid() = referred_user_id and auth.uid() <> referrer_user_id);

drop policy if exists "Referrers can read own commissions" on public.referral_commissions;
create policy "Referrers can read own commissions"
on public.referral_commissions for select
to authenticated
using (auth.uid() = referrer_user_id);

-- Commission inserts/updates are performed by Supabase Edge Functions using the service role key.
