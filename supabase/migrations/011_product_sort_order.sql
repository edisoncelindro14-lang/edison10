-- Server-side product display order.
-- The drag-and-drop product arrangement is stored here so it is identical
-- across every device (mobile / desktop) and every deployment (a Vercel
-- branch and the merged production build read the same source of truth).
-- Replaces the per-browser localStorage sort (kabaro_product_sort_order)
-- which only ever synced one device.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
