const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim();
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

export function validateFullName(name: string): string | null {
  if (!name.trim()) return 'Full name is required.';
  return null;
}

// Sign-up password: at least 8 characters, at least one letter, at least one number.
// Passwords are never trimmed or altered by validation.
export function validateSignUpPassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Include at least one letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return null;
}

// Sign-in only requires a non-empty password, not the sign-up strength rules.
export function validateSignInPassword(password: string): string | null {
  if (!password) return 'Password is required.';
  return null;
}

export function validatePasswordsMatch(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Confirm your password.';
  if (password !== confirmPassword) return 'Passwords don’t match.';
  return null;
}
