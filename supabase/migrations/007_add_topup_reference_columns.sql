-- Add reference_number and processed_by columns to conversion_requests
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

ALTER TABLE public.conversion_requests ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.conversion_requests ADD COLUMN IF NOT EXISTS processed_by text;
ALTER TABLE public.conversion_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz;
