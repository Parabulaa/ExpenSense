export const MAX_FULL_NAME_LENGTH = 80;

/**
 * Display-name rule for the profile editor. Phase 1's sign-up validator only
 * checks for a non-empty name, so this adds the length ceiling the profiles
 * column needs without inventing a competing policy.
 */
export function validateProfileName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your name.';
  if (trimmed.length > MAX_FULL_NAME_LENGTH) return `Use ${MAX_FULL_NAME_LENGTH} characters or fewer.`;
  return null;
}

/**
 * Up to two initials from a display name, falling back to the email's first
 * character. Never falls back to anything derived from the user's id.
 */
export function initialsFor(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toLocaleUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toLocaleUpperCase();
  }

  const local = email?.trim();
  if (local) return local.charAt(0).toLocaleUpperCase();

  return '?';
}

/** What to show when the user hasn't set a name yet. */
export function displayNameFor(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) return name;
  const local = email?.split('@')[0]?.trim();
  return local || 'Your account';
}
