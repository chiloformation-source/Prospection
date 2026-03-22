import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY_PREFIX = "prospect_dashboard_";

export function useSharedStorage(key, defaultValue) {
  const [data, setData] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoaded(true);
  }, [key]);

  // Save to localStorage
  const save = useCallback((newData) => {
    setData(newData);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(newData));
    } catch (e) {
      console.error("Save error:", e);
    }
  }, [key]);

  return { data, save, loaded };
}
