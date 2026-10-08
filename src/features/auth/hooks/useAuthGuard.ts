import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useBudgets } from '@/features/budget/BudgetProvider';
import { budgetSetupSettled } from '@/features/budget/setup-status';

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

// Signed-in routes that stay reachable while budget setup is still pending.
const SETUP_EXEMPT_ROUTES = new Set(['budget-setup', 'create-new-password', 'index']);

export function useAuthGuard() {
  const { session, initialized } = useAuth();
  const { budgets, loadedFor } = useBudgets();
  const segments = useSegments();
  const router = useRouter();

  // A signed-in user with no budget is sent through setup until they finish
  // it or choose "Set later". Waits for this user's budgets to load so an
  // existing user is never bounced while their data is still arriving.
  const user = session?.user ?? null;
  const budgetsReady = Boolean(user && loadedFor === user.id);
  const needsBudgetSetup = Boolean(
    user
      && budgetsReady
      && !budgets.some((budget) => budget.categoryBudgets.some((limit) => limit.amountCents > 0))
      && !budgetSetupSettled(user),
  );

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
      // Hold on the auth screen until we know whether setup comes first.
      if (!budgetsReady) return;
      router.replace(needsBudgetSetup ? '/budget-setup' : '/home');
      return;
    }

    if (needsBudgetSetup && !SETUP_EXEMPT_ROUTES.has(currentRoute)) {
      router.replace('/budget-setup');
    }
  }, [session, initialized, budgetsReady, needsBudgetSetup, segments, router]);
}
