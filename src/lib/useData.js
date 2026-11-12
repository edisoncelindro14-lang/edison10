import { useEffect, useState, useCallback } from "react";
// useCallback is used below for memoizing updateLocalRecord/addLocalRecord
import { supabase } from "./supabase";
import { getSessionMemberId } from "./auth";
import { buildProductQuery } from "./productQuery";

// In-flight request deduplication — when multiple components call useTable for the
// same table simultaneously, only one request reaches Supabase and the result is shared.
const inflight = new Map();

function dedupedFetch(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// Generic data fetcher hook (replaces React Query for simplicity)
export function useTable(tableName, options = {}) {
  const { filter = null, order = null, limit = null, enabled = true, realtime = false } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(enabled);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(prev => prev || data.length === 0);
    try {
      const cacheKey = JSON.stringify({ tableName, filter, order, limit });
      const result = await dedupedFetch(cacheKey, async () => {
        let query = supabase.from(tableName).select("*");
        if (filter) {
          for (const [key, value] of Object.entries(filter)) {
            if (key === "$in" && Array.isArray(value)) {
              // Handle $in filter
              for (const [k, v] of Object.entries(value)) {
                query = query.in(k, v);
              }
            } else {
              query = query.eq(key, value);
            }
          }
        }
        if (order) {
          const [col, dir] = order.startsWith("-") ? [order.slice(1), false] : [order, true];
          query = query.order(col, { ascending: dir });
        }
        if (limit) query = query.limit(limit);
        const { data: result, error } = await query;
        if (error) throw error;
        return result || [];
      });
      setData(result);
    } catch (e) {
      console.error(`Error fetching ${tableName}:`, e);
    }
    setIsLoading(false);
  }, [tableName, JSON.stringify(filter), order, limit, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription: only enabled when explicitly requested to reduce Supabase egress
  useEffect(() => {
    if (!enabled || !realtime) return;
    const channel = supabase
      .channel(`realtime_${tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableName, enabled, realtime, fetchData]);

  const updateLocalRecord = useCallback((id, updates) => {
    setData(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...updates } : r));
  }, []);

  const addLocalRecord = useCallback((record) => {
    setData(prev => [...prev, record]);
  }, []);

  return { data, isLoading, refetch: fetchData, updateLocalRecord, addLocalRecord };
}

// Hook to get the current logged-in member
export function useCurrentMember(members = []) {
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getSessionMemberId();
    if (id && members.length > 0) {
      const found = members.find(m => m.id === id);
      if (found) {
        setCurrentMember(found);
        setLoading(false);
        return;
      }
    }
    if (members.length === 0) return;
    setLoading(false);
  }, [members]);

  return { currentMember, loading };
}

// Mutation helpers — throw on Supabase error so callers' catch blocks fire
export async function createRecord(tableName, data) {
  const { data: result, error } = await supabase.from(tableName).insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateRecord(tableName, id, data) {
  const { data: result, error } = await supabase.from(tableName).update(data).eq("id", id).select().single();
  if (error) throw error;
  return result;
}

export async function deleteRecord(tableName, id) {
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) throw error;
}

// ---- Products: server-side paging / search (the catalogue can hold thousands of rows) ----

// Returns one page at a time plus the total match count.
export function useProductPage({ category = "all", network = "all", query = "", activeOnly = true, page = 0, pageSize = 24 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const t = setTimeout(async () => {
      try {
        const from = page * pageSize;
        const { data, count, error } = await buildProductQuery(supabase, { category, network, query, activeOnly })
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (cancelled) return;
        setRows(data || []);
        setTotal(count ?? (data || []).length);
      } catch (e) {
        console.error("Error fetching products:", e);
        if (!cancelled) { setRows([]); setTotal(0); }
      }
      if (!cancelled) setIsLoading(false);
    }, query ? 250 : 0); // debounce typing
    return () => { cancelled = true; clearTimeout(t); };
  }, [category, network, query, activeOnly, page, pageSize, tick]);

  const updateLocalRecord = useCallback((id, updates) => {
    setRows(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...updates } : r));
  }, []);
  const refetch = useCallback(() => setTick(t => t + 1), []);
  return { data: rows, total, isLoading, refetch, updateLocalRecord };
}

// A single product by id (product detail page).
export function useProduct(id) {
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!cancelled) setProduct(data || null);
      } catch (e) {
        console.error("Error fetching product:", e);
        if (!cancelled) setProduct(null);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, tick]);
  const updateLocalRecord = useCallback((_id, updates) => setProduct(p => (p ? { ...p, ...updates } : p)), []);
  return { product, isLoading, refetch: useCallback(() => setTick(t => t + 1), []), updateLocalRecord };
}

// Total number of products (cheap HEAD request, no rows transferred).
export function useProductCount() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from("products").select("id", { count: "exact", head: true })
      .then(({ count: c }) => { if (!cancelled) setCount(c ?? null); });
    return () => { cancelled = true; };
  }, []);
  return count;
}
