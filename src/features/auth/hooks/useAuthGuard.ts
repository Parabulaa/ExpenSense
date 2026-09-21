import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '../AuthProvider';

// Routes reachable without a session. Everything else is treated as protected.
const PUBLIC_ROUTES = new Set([
  'index',
  'onboarding',
  'sign-in',
  'create-account',
  'forgot-password',
  'create-new-password',
]);

// Routes a signed-in user shouldn't be shown (they get bounced to /home instead).
const SIGNED_IN_REDIRECT_ROUTES = new Set(['sign-in', 'create-account']);

export function useAuthGuard() {
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const currentRoute = segments[0] ?? 'index';
    const isPublicRoute = PUBLIC_ROUTES.has(currentRoute);

    if (!session && !isPublicRoute) {
      router.replace('/sign-in');
      return;
    }

    if (session && SIGNED_IN_REDIRECT_ROUTES.has(currentRoute)) {
      router.replace('/home');
    }
  }, [session, initialized, segments, router]);
}
