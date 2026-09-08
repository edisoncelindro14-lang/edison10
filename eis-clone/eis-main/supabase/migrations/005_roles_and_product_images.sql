-- Add super_admin and reseller roles
-- Run this in Supabase Dashboard → SQL Editor

-- Update role constraint to include super_admin and reseller
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check 
  check (role in ('member','sub_admin','admin','super_admin','reseller'));

-- Promote the default admin account to super_admin
update public.members set role = 'super_admin' where username = 'admin';

-- Ensure products table has image_url column
alter table public.products add column if not exists image_url text;
