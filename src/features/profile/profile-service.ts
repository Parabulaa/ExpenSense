import { supabase } from '@/lib/supabase';
import type { Profile, ProfileResult } from './types';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

const SAFE_LOAD_ERROR = "Couldn't load your profile. Check your connection and try again.";
const SAFE_SAVE_ERROR = "Couldn't save your profile. Check your connection and try again.";

function fromRow(row: ProfileRow): Profile {
  return { id: row.id, email: row.email, fullName: row.full_name, createdAt: row.created_at };
}

export async function getProfile(): Promise<ProfileResult<Profile>> {
  try {
    // RLS restricts this to the caller's own row, so no id filter is needed —
    // but selecting explicit columns keeps auth internals out of the client.
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,created_at')
      .maybeSingle();

    if (error || !data) return { ok: false, message: SAFE_LOAD_ERROR };
    return { ok: true, data: fromRow(data as ProfileRow) };
  } catch {
    return { ok: false, message: SAFE_LOAD_ERROR };
  }
}

/**
 * `profiles.full_name` is the source of truth for the display name. The auth
 * metadata copy written at sign-up is updated alongside it so the two can never
 * drift apart and show different names in different places.
 */
export async function updateFullName(fullName: string): Promise<ProfileResult<Profile>> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: 'Sign in again to update your profile.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', authData.user.id)
      .select('id,email,full_name,created_at')
      .single();

    if (error || !data) return { ok: false, message: SAFE_SAVE_ERROR };

    // Best effort: the profiles row already succeeded, so a metadata hiccup
    // shouldn't present itself to the user as a failed save.
    await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => undefined);

    return { ok: true, data: fromRow(data as ProfileRow) };
  } catch {
    return { ok: false, message: SAFE_SAVE_ERROR };
  }
}
