import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-user copy of the last data loaded from the server. It lets every screen
 * open instantly and keep working without a connection, and it is what lets
 * the app skip a refetch when the data is still fresh.
 */
const VERSION = 'v1';
const key = (userId: string, name: string) => `expensense:cache:${VERSION}:${userId}:${name}`;
// The web build pre-renders in Node, where AsyncStorage's web backend has no window.
const available = typeof window !== 'undefined';

export async function readCache<T>(userId: string, name: string): Promise<T | null> {
  if (!available) return null;
  try {
    const raw = await AsyncStorage.getItem(key(userId, name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(userId: string, name: string, data: unknown) {
  if (!available) return;
  // Fire-and-forget: a failed cache write must never block or break the UI.
  AsyncStorage.setItem(key(userId, name), JSON.stringify(data)).catch(() => undefined);
}

export async function clearUserCache(userId: string) {
  if (!available) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((item) => item.startsWith(`expensense:cache:${VERSION}:${userId}:`)));
  } catch {
    // Nothing to clean up.
  }
}

/** Data older than this is refetched when a screen comes into view; newer data is reused. */
export const STALE_AFTER_MS = 30_000;
