import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import awsService from '../services/awsService';
import { usePersistedState } from '../hooks/usePersistedState';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * The signed-in person's nickname and picture, for the header and the
 * Account page.
 *
 * Loaded once per sign-in and cached in local storage so the header does
 * not flash empty on every page. The cache key is in PERSONAL_LOCAL_KEYS
 * (App.js) so it is wiped on sign-out and never shown to the next person
 * on a shared device.
 */

const ProfileContext = createContext({
  profile: null,
  setProfile: () => {},
  reload: () => Promise.resolve(),
});

export function ProfileProvider({ enabled, children }) {
  const [profile, setProfile] = usePersistedState(STORAGE_KEYS.profile, null);

  const reload = useCallback(async () => {
    try {
      const next = await awsService.getProfile();
      setProfile(next);
      return next;
    } catch (err) {
      // A missing profile is not worth an error anywhere; the header just
      // shows the initial. Region-blocked and offline both land here too.
      console.warn('Profile could not be loaded:', err.message);
      return null;
    }
  }, [setProfile]);

  useEffect(() => {
    if (!enabled) return;
    if (profile === null) reload();
    // Only on sign-in: a cached profile is kept until something changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const value = useMemo(() => ({ profile, setProfile, reload }), [profile, setProfile, reload]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
