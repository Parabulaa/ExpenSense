import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { clearUserCache } from '@/lib/offline/cache';
import { supabase } from '@/lib/supabase';
import * as authService from './auth-service';
import type { AuthResult } from './types';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
  signOut: () => Promise<AuthResult<null>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initialized,
      // Delegates to the service so callers can surface a failure instead of
      // assuming sign-out always succeeds. The onAuthStateChange listener
      // above clears the session, so no manual state reset is needed here.
      // The saved copy of this user's data is removed on sign-out; changes still
      // waiting to sync are kept and upload the next time they sign in.
      signOut: async () => {
        const userId = session?.user.id;
        const result = await authService.signOut();
        if (result.ok && userId) await clearUserCache(userId);
        return result;
      },
    }),
    [session, initialized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
