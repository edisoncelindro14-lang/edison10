-- Add 'staff' role for the staff promotion system
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

-- Add 'staff' to the members role check constraint
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check
  CHECK (role IN ('member','sub_admin','admin','super_admin','reseller','staff'));
