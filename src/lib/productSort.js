import { supabase } from "./supabase";

// Server-side product display order.
//
// The product arrangement is stored in the `products.sort_order` column so the
// drag-and-drop layout is identical across every device (mobile / desktop) and
// every deployment (a Vercel branch and the merged production build read the same
// source of truth). This replaces the old per-browser localStorage sort, which
// only ever synced one device.

// Stable client-side sort by `sort_order` (ascending). Products without a
// sort_order (column not yet added, or never reordered) keep their original
// fetch order at the end, so the layout never jumps between renders or devices.
export function sortProductsByOrder(products) {
  return [...products].sort((a, b) => {
    const ao = a.sort_order;
    const bo = b.sort_order;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });
}

// Persist the full display order to the server. `orderedIds` is the complete
// list of product ids in the desired display order; each is assigned an
// incrementing sort_order. Upsert-on-conflict updates only `sort_order` for
// existing rows, leaving every other product field untouched.
export async function persistProductOrder(orderedIds) {
  const updates = orderedIds.map((id, index) => ({ id, sort_order: index }));
  const { error } = await supabase
    .from("products")
    .upsert(updates, { onConflict: "id" });
  if (error) throw error;
}
