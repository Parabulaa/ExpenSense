import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii, shadow, spacing } from '@/constants/theme';

const VISIBLE_MS = 2800;
const ANIMATION_MS = 220;

type ToastTone = 'neutral' | 'warning';

type ToastOptions = { tone?: ToastTone; icon?: Parameters<typeof AppIcon>[0]['name'] };

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastState = {
  /** Bumped on every call so repeating the same message re-triggers the timer. */
  key: number;
  message: string;
  tone: ToastTone;
  icon?: Parameters<typeof AppIcon>[0]['name'];
};

/**
 * App-wide transient feedback. Sits above the router so any screen can reach it
 * through `useToast()` without threading state down, and renders as a banner
 * rather than a modal so it never blocks what the user was doing.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    counter.current += 1;
    setToast({
      key: counter.current,
      message,
      tone: options?.tone ?? 'neutral',
      icon: options?.icon,
    });
  }, []);

  // Stable identity: the banner's dismiss timers key off this, so an unrelated
  // re-render of the tree below must not restart them.
  const dismiss = useCallback((key: number) => {
    setToast((current) => (current?.key === key ? null : current));
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastBanner key={toast.key} toast={toast} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: ToastState; onDismiss: (key: number) => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const key = toast.key;

  useEffect(() => {
    if (!reduced) {
      progress.value = withTiming(1, { duration: ANIMATION_MS, easing: Easing.out(Easing.cubic) });
    }

    const hideAt = setTimeout(() => {
      if (reduced) {
        onDismiss(key);
        return;
      }
      progress.value = withTiming(0, { duration: ANIMATION_MS, easing: Easing.in(Easing.cubic) });
    }, VISIBLE_MS);

    // Unmount after the exit animation has had time to play.
    const removeAt = setTimeout(() => onDismiss(key), VISIBLE_MS + ANIMATION_MS);

    return () => {
      clearTimeout(hideAt);
      clearTimeout(removeAt);
    };
  }, [key, onDismiss, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -14 }],
  }));

  const warning = toast.tone === 'warning';

  return (
    <View
      // box-none so the banner never swallows touches meant for the screen.
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + spacing.sm }]}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, warning && styles.toastWarning, animatedStyle]}
      >
        <AppIcon
          name={toast.icon ?? (warning ? 'alert-circle-outline' : 'information-outline')}
          size={20}
          color={warning ? colors.warning : colors.deepForest}
        />
        <AppText style={styles.message}>{toast.message}</AppText>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  toast: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  toastWarning: {
    borderColor: '#E7CE8F',
    backgroundColor: colors.warningSoft,
  },
  message: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: 'JakartaMedium',
    fontSize: 13.5,
    lineHeight: 19,
  },
});
