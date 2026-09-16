import { useCallback, useEffect, useRef } from 'react';

export function useScrollToBottom(deps, { enabled = true } = {}) {
  const endRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (enabled) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { endRef, scrollToBottom };
}
