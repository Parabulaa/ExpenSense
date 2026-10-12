import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Covers the moments before the account update lands (or when offline), so
// finishing the tour never brings it straight back on the next Home visit.
const seenThisSession = new Set<string>();

/** Saved on the account so the tour shows once per person, not once per device. */
export function appTourSeen(user: User) {
  return seenThisSession.has(user.id) || user.user_metadata?.app_tour != null;
}

export function markAppTourSeen(userId: string) {
  if (seenThisSession.has(userId)) return;
  seenThisSession.add(userId);
  void supabase.auth.updateUser({ data: { app_tour: 'done' } }).catch(() => undefined);
}
