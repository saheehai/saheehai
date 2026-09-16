import { useEffect } from 'react';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Signs the person out after a period with no input.
 *
 * Chat and journal content is health information, and a signed-in tab left
 * open on a shared or lost device shows it to whoever picks the device up
 * next. HIPAA's Security Rule calls this "automatic logoff"
 * (45 CFR 164.312(a)(2)(iii)); it is a sensible default for this kind of
 * site whether or not the rule formally applies.
 *
 * The last-activity time is kept in localStorage so every tab of the site
 * agrees on it: typing in one tab keeps another from timing out.
 */

export const IDLE_MINUTES = 30;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
const CHECK_EVERY_MS = 30 * 1000;

const readLastActive = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEYS.lastActive)) || 0;
  } catch {
    return 0;
  }
};

const writeLastActive = (ts) => {
  try {
    localStorage.setItem(STORAGE_KEYS.lastActive, String(ts));
  } catch {
    /* storage unavailable; the in-memory check still runs */
  }
};

export function useIdleSignOut(enabled, onIdle, minutes = IDLE_MINUTES) {
  useEffect(() => {
    if (!enabled) return undefined;

    const limitMs = minutes * 60 * 1000;
    let lastWrite = 0;

    // Throttled: scroll fires constantly, and storage writes are not free.
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      writeLastActive(now);
    };

    const check = () => {
      const last = readLastActive() || lastWrite;
      if (last && Date.now() - last > limitMs) onIdle();
    };

    touch();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    // A tab coming back from the background checks straight away rather than
    // showing stale content for up to a whole interval.
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, CHECK_EVERY_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, touch));
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, [enabled, onIdle, minutes]);
}
