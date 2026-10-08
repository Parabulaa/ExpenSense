import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** Saved on the account so the choice follows the user to every device. */
export type BudgetSetupStatus = 'done' | 'later';

// Covers the moments before the account update lands (or when offline), so
// choosing "Set later" never bounces the user straight back to setup.
const settledThisSession = new Set<string>();

export function budgetSetupSettled(user: User) {
  return settledThisSession.has(user.id) || user.user_metadata?.budget_setup != null;
}

export function markBudgetSetup(userId: string, status: BudgetSetupStatus) {
  settledThisSession.add(userId);
  void supabase.auth.updateUser({ data: { budget_setup: status } }).catch(() => undefined);
}
