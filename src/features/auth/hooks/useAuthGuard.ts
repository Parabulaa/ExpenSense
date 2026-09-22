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
const SIGNED_IN_REDIRECT_ROUTES = new Set(['onboarding', 'sign-in', 'create-account', 'forgot-password']);

export function useAuthGuard() {
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    // Route groups like "(app)" are layout-only and never appear in the URL,
    // so skip them to get the segment the route is actually named after.
    const currentRoute = segments.find((segment) => !segment.startsWith('(')) ?? 'index';
    const isPublicRoute = PUBLIC_ROUTES.has(currentRoute);

    if (!session && !isPublicRoute) {
      router.replace('/onboarding');
      return;
    }

    if (session && SIGNED_IN_REDIRECT_ROUTES.has(currentRoute)) {
      router.replace('/home');
    }
  }, [session, initialized, segments, router]);
}
