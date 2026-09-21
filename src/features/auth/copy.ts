import type { AuthErrorKind } from './types';

export const authCopy = {
  invalidLogin: {
    title: 'Unable to sign in',
    message: 'The email or password is incorrect.',
  },
  unverifiedLogin: {
    title: 'Verify your email',
    message: 'Please verify your email before signing in.',
  },
  signupConflict: {
    title: 'Unable to create account',
    message: 'An account may already use this email. Try signing in or resetting your password.',
  },
  verifyEmail: {
    title: 'Check your email',
    message: 'We sent a verification link to your email address. Verify your email before signing in.',
  },
  forgotPasswordSent: {
    title: 'Check your email',
    message: 'If an account exists for this email, password reset instructions have been sent.',
  },
  passwordResetSuccess: {
    title: 'Password updated',
    message: 'Your password has been changed successfully.',
  },
  expiredReset: {
    title: 'Reset link expired',
    message: 'This password reset link is no longer valid. Request a new password reset email.',
  },
  logoutConfirm: {
    title: 'Log out?',
    message: 'Are you sure you want to log out of your ExpenSense account?',
  },
  logoutFailure: {
    title: 'Unable to log out',
    message: 'We couldn’t log you out. Please try again.',
  },
  networkFailure: {
    title: 'Connection problem',
    message: 'We couldn’t reach the server. Check your internet connection and try again.',
  },
  rateLimit: {
    title: 'Please wait',
    message: 'Too many requests were made. Wait a moment before trying again.',
  },
  genericFailure: {
    title: 'Something went wrong',
    message: 'We couldn’t complete your request. Please try again.',
  },
} as const;

export function errorCopyForKind(kind: AuthErrorKind): { title: string; message: string } {
  switch (kind) {
    case 'invalid_credentials':
      return authCopy.invalidLogin;
    case 'unverified_email':
      return authCopy.unverifiedLogin;
    case 'rate_limited':
      return authCopy.rateLimit;
    case 'network_error':
      return authCopy.networkFailure;
    case 'signup_conflict':
      return authCopy.signupConflict;
    default:
      return authCopy.genericFailure;
  }
}
