import { useEffect, useRef, useState } from 'react';

export function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Failed to read ${key} from localStorage:`, err);
      return initialValue;
    }
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (err) {
      console.error(`Failed to write ${key} to localStorage:`, err);
    }
  }, [key, value]);

  return [value, setValue];
}
