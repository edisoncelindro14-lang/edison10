-- Fix: Add allow_all RLS policies so the browser (anon key, no Supabase Auth session)
-- can read/write transactions and conversion_requests like on the old database.
-- Run this in Supabase Dashboard → SQL Editor on the NEW database.

-- Drop any existing strict policies that block anon access
drop policy if exists "member reads transactions" on public.transactions;
drop policy if exists "admin manages transactions" on public.transactions;
drop policy if exists "member reads own withdrawals" on public.conversion_requests;
drop policy if exists "member creates own withdrawal" on public.conversion_requests;
drop policy if exists "admin manages withdrawals" on public.conversion_requests;

-- Recreate allow_all policies (matches the old database's migration 003_part2_rls.sql)
drop policy if exists "allow_all_transactions" on public.transactions;
create policy "allow_all_transactions" on public.transactions for all using (true) with check (true);

drop policy if exists "allow_all_conversion_requests" on public.conversion_requests;
create policy "allow_all_conversion_requests" on public.conversion_requests for all using (true) with check (true);
