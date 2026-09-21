import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import * as profileService from './profile-service';
import type { Profile, ProfileResult } from './types';

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  loadError: string | null;
  /** Display name with the email-derived fallback already applied. */
  displayName: string;
  initials: string;
  email: string;
  refresh: () => Promise<void>;
  updateFullName: (fullName: string) => Promise<ProfileResult<Profile>>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * One cache of the signed-in user's profile. The Profile screen and the
 * dashboard greeting both read from here, so editing a name updates everywhere
 * at once instead of each screen holding its own copy.
 */
export function ProfileProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loadedUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      loadedUserId.current = null;
      setProfile(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      setProfile(null);
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    const result = await profileService.getProfile();
    if (currentRequest !== requestId.current) return;

    if (result.ok) {
      setProfile(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!initialized) return;
    // Synchronises this cache with Supabase whenever the auth identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [initialized, refresh]);

  const updateFullName = useCallback(async (fullName: string) => {
    const result = await profileService.updateFullName(fullName);
    if (result.ok) {
      setProfile(result.data);
      setLoadError(null);
    }
    return result;
  }, []);

  const value = useMemo<ProfileContextValue>(() => {
    const email = profile?.email ?? user?.email ?? '';
    const rawName = profile?.fullName ?? (user?.user_metadata?.full_name as string | undefined) ?? null;
    const trimmed = rawName?.trim() ?? '';
    const localPart = email.split('@')[0]?.trim() ?? '';

    let initials = '?';
    if (trimmed) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      initials = parts.length === 1
        ? parts[0].charAt(0).toLocaleUpperCase()
        : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toLocaleUpperCase();
    } else if (localPart) {
      initials = localPart.charAt(0).toLocaleUpperCase();
    }

    return {
      profile,
      loading,
      loadError,
      displayName: trimmed || localPart || 'Your account',
      initials,
      email,
      refresh,
      updateFullName,
    };
  }, [loadError, loading, profile, refresh, updateFullName, user]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}
