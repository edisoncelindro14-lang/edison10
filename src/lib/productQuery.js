// Strip characters that would break a PostgREST `or`/`ilike` filter.
const cleanSearch = s => String(s || "").replace(/[%_,()*\\]/g, " ").trim();

export function buildProductQuery(sb, { category = "all", network = "all", query = "", activeOnly = true } = {}, { head = false } = {}) {
  let q = sb.from("products").select("*", { count: "exact", head });
  if (activeOnly) q = q.neq("is_active", false);
  if (category && category !== "all") q = q.eq("category", category);
  if (network && network !== "all") q = q.eq("network", network);
  const term = cleanSearch(query);
  if (term) q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%,network.ilike.%${term}%`);
  return q;
}

