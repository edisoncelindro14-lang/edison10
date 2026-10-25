-- Fix: restore the anon-key access the browser client is built on, for the tables
-- 010_fix_rls_allow_all.sql missed.
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

-- Symptom this fixes
--   Admin → Members → "SET ROLE" dropdown fails with:
--   "Failed to update role: Cannot coerce the result to a single JSON object"
--   That message is PostgREST PGRST116 ("The result contains 0 rows"): the UPDATE
--   matched no row, so there was nothing for the client's .single() call to coerce.
--   Member approve/delete/profile saves and the Settings / GCash tabs fail the same way.

-- Cause
--   The app signs users in with its own localStorage session (src/lib/auth.js) and
--   talks to Supabase with the anon key only, so there is never a Supabase Auth
--   session and auth.uid() is always NULL. The strict policies created by
--   001_initial_schema.sql ("members update self", "admins manage members",
--   "admin manages settings", "admin manages gcash", "member creates receipt", ...)
--   are all keyed on auth.uid() / is_admin(), so they deny every write.
--   010_fix_rls_allow_all.sql already restored anon access for transactions and
--   conversion_requests; these four tables were left behind:
--     members          → role changes, approve/delete, profile edits
--     system_settings  → Settings tab, JoyTel screenshot uploads
--     gcash_info       → GCash info save
--     gcash_receipts   → member GCash receipt uploads
--
-- This recreates the same allow-all policies the old database had
-- (setup_supabase.sql / 003_part2_rls.sql). Note the anon key is the app's only
-- credential, so — exactly like the tables already opened by 010 — these become
-- readable and writable by anyone holding it.

-- members
drop policy if exists "members read self or admins" on public.members;
drop policy if exists "members update self" on public.members;
drop policy if exists "admins manage members" on public.members;
drop policy if exists "allow_all_members" on public.members;
create policy "allow_all_members" on public.members for all using (true) with check (true);

-- system_settings
drop policy if exists "read settings" on public.system_settings;
drop policy if exists "admin manages settings" on public.system_settings;
drop policy if exists "allow_all_system_settings" on public.system_settings;
create policy "allow_all_system_settings" on public.system_settings for all using (true) with check (true);

-- gcash_info
drop policy if exists "read active gcash" on public.gcash_info;
drop policy if exists "admin manages gcash" on public.gcash_info;
drop policy if exists "allow_all_gcash_info" on public.gcash_info;
create policy "allow_all_gcash_info" on public.gcash_info for all using (true) with check (true);

-- gcash_receipts
drop policy if exists "member reads own receipts" on public.gcash_receipts;
drop policy if exists "member creates receipt" on public.gcash_receipts;
drop policy if exists "admin manages receipts" on public.gcash_receipts;
drop policy if exists "allow_all_gcash_receipts" on public.gcash_receipts;
create policy "allow_all_gcash_receipts" on public.gcash_receipts for all using (true) with check (true);

-- If a write still returns 0 rows afterwards, another policy on that table is
-- restrictive; check which ones exist with:
--   select tablename, policyname, cmd, permissive, qual, with_check
--   from pg_policies where tablename in ('members','system_settings','gcash_info','gcash_receipts');
