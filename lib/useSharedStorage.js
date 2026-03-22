import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

const STORAGE_KEY_PREFIX = "prospect_dashboard_";

export function useSharedStorage(key, defaultValue) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const firstLoadRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Load: Supabase first, fallback to localStorage
  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;

    async function load() {
      // 1. Try Supabase
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from("dashboard_store")
            .select("data")
            .eq("key", key)
            .single();

          if (!error && row && row.data) {
            setData(row.data);
            // Sync to localStorage as cache
            try { localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(row.data)); } catch(e) {}
            setLoaded(true);
            return;
          }
        } catch (e) {
          console.warn("[useSharedStorage] Supabase load failed, falling back to localStorage:", e);
        }
      }

      // 2. Fallback to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
          if (stored) {
            const parsed = JSON.parse(stored);
            setData(parsed);
            // Migrate localStorage data to Supabase if available
            if (supabase) {
              supabase.from("dashboard_store").upsert({ key, data: parsed, updated_at: new Date().toISOString() }).then(() => {});
            }
            setLoaded(true);
            return;
          }
        }
      } catch (e) {
        console.error("localStorage load error:", e);
      }

      // 3. Use default
      setData(defaultValue);
      setLoaded(true);
    }

    load();
  }, [key, defaultValue]);

  // Save: Supabase + localStorage (debounced for Supabase)
  const save = useCallback((newData) => {
    setData(newData);

    // Immediate localStorage save (fast, offline-safe)
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(newData));
      }
    } catch (e) {
      console.error("localStorage save error:", e);
    }

    // Debounced Supabase save (500ms) to avoid spamming on rapid edits
    if (supabase) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from("dashboard_store")
            .upsert({ key, data: newData, updated_at: new Date().toISOString() });
          if (error) console.error("[useSharedStorage] Supabase save error:", error);
        } catch (e) {
          console.error("[useSharedStorage] Supabase save failed:", e);
        }
      }, 500);
    }
  }, [key]);

  return { data: data || defaultValue, save, loaded };
}
