/**
 * True when a failed request failed because the device could not reach the
 * server, as opposed to the server rejecting it. Only these failures are safe
 * to queue and retry later; a rejection would fail again on every retry.
 *
 * No native network-status module is used, so the app stays updatable over
 * the air; the failed request itself is the signal.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && (navigator as { onLine?: boolean }).onLine === false) return true;
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  return /network request failed|failed to fetch|fetch failed|networkerror|network error|load failed|internet connection|timed? ?out|aborted/i.test(message);
}

/** RFC 4122 v4 id, generated on the device so an offline record keeps one id forever. */
export function uuid(): string {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export const OFFLINE_MESSAGE = "You're offline. Connect to the internet to change this.";
