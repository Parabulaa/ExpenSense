export type AuthErrorKind =
  | 'invalid_credentials'
  | 'unverified_email'
  | 'signup_conflict'
  | 'rate_limited'
  | 'network_error'
  | 'generic';

export type AuthServiceError = { kind: AuthErrorKind };

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthServiceError };
