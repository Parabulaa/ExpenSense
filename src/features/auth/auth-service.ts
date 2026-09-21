import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { AuthErrorKind, AuthResult } from './types';

// Classifies a Supabase Auth error into a safe, UI-facing category.
// Never surfaces the raw error message/stack to the user or a log.
function classifyAuthError(error: unknown): AuthErrorKind {
  const err = error as { status?: number; name?: string; message?: string } | null | undefined;
  const message = (err?.message ?? '').toLowerCase();

  if (err?.name === 'AuthRetryableFetchError' || message.includes('network') || message.includes('fetch')) {
    return 'network_error';
  }
  if (err?.status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limited';
  }
  if (message.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }
  if (message.includes('email not confirmed') || message.includes('email is not confirmed')) {
    return 'unverified_email';
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'signup_conflict';
  }
  return 'generic';
}

export async function signUp(params: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthResult<{ session: Session | null; requiresVerification: boolean }>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: params.fullName ? { full_name: params.fullName } : undefined,
        emailRedirectTo: Linking.createURL('sign-in'),
      },
    });

    if (error) return { ok: false, error: { kind: classifyAuthError(error) } };

    // Supabase returns a user with an empty `identities` array (and no error)
    // when the email is already registered — the documented, enumeration-safe
    // way to detect a conflict without querying auth.users directly.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return { ok: false, error: { kind: 'signup_conflict' } };
    }

    return {
      ok: true,
      data: { session: data.session, requiresVerification: !data.session },
    };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

export async function signIn(params: {
  email: string;
  password: string;
}): Promise<AuthResult<{ session: Session }>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword(params);
    if (error) return { ok: false, error: { kind: classifyAuthError(error) } };
    if (!data.session) return { ok: false, error: { kind: 'generic' } };
    return { ok: true, data: { session: data.session } };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

export async function signOut(): Promise<AuthResult<null>> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: { kind: classifyAuthError(error) } };
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

// Always reports success unless the request itself failed to go out
// (rate limit / network), regardless of whether the email is registered.
// This is intentional account-enumeration protection.
export async function sendPasswordReset(email: string): Promise<AuthResult<null>> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('create-new-password'),
    });

    if (error) {
      const kind = classifyAuthError(error);
      if (kind === 'rate_limited' || kind === 'network_error') {
        return { ok: false, error: { kind } };
      }
    }

    return { ok: true, data: null };
  } catch (error) {
    const kind = classifyAuthError(error);
    if (kind === 'rate_limited' || kind === 'network_error') {
      return { ok: false, error: { kind } };
    }
    return { ok: true, data: null };
  }
}

export async function exchangeRecoveryCode(code: string): Promise<AuthResult<{ session: Session }>> {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) return { ok: false, error: { kind: classifyAuthError(error) } };
    return { ok: true, data: { session: data.session } };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResult<null>> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: { kind: classifyAuthError(error) } };
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

export async function resendVerification(email: string): Promise<AuthResult<null>> {
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { ok: false, error: { kind: classifyAuthError(error) } };
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: { kind: classifyAuthError(error) } };
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
