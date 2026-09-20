-- Real product tagging/discount columns (replacing the fake hash-based
-- badge/discount placeholders in src/lib/helpers.js) and a remarks column
-- for staff withdrawal rejection reasons.
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Paste -> Run

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS best_seller boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS remarks text;
