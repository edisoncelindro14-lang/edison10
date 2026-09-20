-- Add 'staff' role for the staff promotion system
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

-- 1. Add 'staff' to the members role check constraint
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check
  CHECK (role IN ('member','sub_admin','admin','super_admin','reseller','staff'));

-- 2. Fix is_admin() to also recognise super_admin (not just admin)
--    Without this, a super_admin cannot update other members' roles via RLS,
--    because the "admins manage members" policy calls is_admin() which only
--    checked role='admin'.  This blocked ALL role changes — including staff promotion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid()
      AND m.role IN ('admin','super_admin')
      AND m.status = 'approved'
  );
$$;
