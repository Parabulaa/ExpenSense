import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a native-only affordance. Calling into them on web is a no-op in
// expo-haptics, but bailing early keeps the intent obvious at the call site.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** A blocked action: hitting a limit, a rejected input. */
export function warningFeedback() {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** A completed action: something was added, saved or confirmed. */
export function successFeedback() {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A light tick for state changes that aren't success or failure. */
export function selectionFeedback() {
  if (!supported) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
