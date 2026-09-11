import { useEffect, useState, useCallback } from "react";
// useCallback is used below for memoizing updateLocalRecord/addLocalRecord
import { supabase } from "./supabase";
import { getSessionMemberId } from "./auth";

// Generic data fetcher hook (replaces React Query for simplicity)
export function useTable(tableName, options = {}) {
  const { filter = null, order = null, limit = null, enabled = true } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(enabled);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(prev => prev || data.length === 0);
    try {
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
      if (!error) setData(result || []);
    } catch (e) {
      console.error(`Error fetching ${tableName}:`, e);
    }
    setIsLoading(false);
  }, [tableName, JSON.stringify(filter), order, limit, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription: refetch when table changes so wallet/orders update instantly
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`realtime_${tableName}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableName, enabled, fetchData]);

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
