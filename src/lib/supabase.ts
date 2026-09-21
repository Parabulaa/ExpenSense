import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.');
}

// expo-router's web build statically pre-renders routes in Node, where
// `window` doesn't exist. Supabase's client initializes its auth session
// eagerly on construction, and AsyncStorage's web implementation reaches for
// `window.localStorage` as soon as it's read — which crashes that Node
// render. There's no real persisted session to read on the server anyway, so
// swap in a no-op storage there and use AsyncStorage everywhere else.
const isServer = typeof window === 'undefined';
const authStorage = isServer
  ? {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }
  : AsyncStorage;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Supabase's token auto-refresh timer only runs while this is called; pause it
// when the app is backgrounded so it doesn't keep refreshing needlessly, and
// resume it when the app returns to the foreground. Module-level so it only
// ever registers once, no matter how many times consumers import this file.
if (!isServer) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
