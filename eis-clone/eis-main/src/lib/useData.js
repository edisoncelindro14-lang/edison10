import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { getSessionMemberId } from "./auth";

// Generic data fetcher hook (replaces React Query for simplicity)
export function useTable(tableName, options = {}) {
  const { filter = null, order = null, limit = null, enabled = true } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(enabled);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
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
  return { data, isLoading, refetch: fetchData };
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

// Mutation helper
export async function createRecord(tableName, data) {
  return supabase.from(tableName).insert(data).select().single();
}

export async function updateRecord(tableName, id, data) {
  return supabase.from(tableName).update(data).eq("id", id).select().single();
}

export async function deleteRecord(tableName, id) {
  return supabase.from(tableName).delete().eq("id", id);
}
