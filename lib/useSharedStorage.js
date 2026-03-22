import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY_PREFIX = "prospect_dashboard_";

export function useSharedStorage(key, defaultValue) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const firstLoadRef = useRef(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
        if (stored) {
          setData(JSON.parse(stored));
        } else {
          setData(defaultValue);
        }
      } else {
        setData(defaultValue);
      }
    } catch (e) {
      console.error("Load error:", e);
      setData(defaultValue);
    }
    setLoaded(true);
  }, [key, defaultValue]);

  // Save to localStorage
  const save = useCallback((newData) => {
    setData(newData);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(newData));
      }
    } catch (e) {
      console.error("Save error:", e);
    }
  }, [key]);

  return { data: data || defaultValue, save, loaded };
}
