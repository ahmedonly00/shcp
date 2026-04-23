import { useEffect, useRef } from 'react';

const IDLE_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
];

/**
 * Calls `onIdle` after `timeoutMs` milliseconds of user inactivity.
 * Resets whenever the user interacts with the page.
 */
export function useIdleTimeout(onIdle: () => void, timeoutMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onIdle, timeoutMs);
    };

    // Start timer and listen for activity
    reset();
    IDLE_EVENTS.forEach(event => document.addEventListener(event, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach(event => document.removeEventListener(event, reset));
    };
  }, [onIdle, timeoutMs]);
}
