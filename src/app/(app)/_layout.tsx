import { Slot, router, usePathname } from 'expo-router';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrganicBackground } from '@/components/common/organic-background';
import { AppHeader } from '@/components/navigation/app-header';
import { BottomNavigation } from '@/components/navigation/bottom-navigation';
import { colors } from '@/constants/theme';
import { selectionFeedback } from '@/lib/haptics';

/**
 * Horizontal order of the root panels. Scan is deliberately absent: opening the
 * camera is an explicit action, never something a stray swipe can trigger.
 */
const ROOT_ORDER = ['/home', '/transactions', '/analytics', '/budget'] as const;

const TRANSITION_MS = 280;
const EXIT_MS = 150;
/** Share of the canvas that must be dragged before a swipe commits. */
const DISTANCE_RATIO = 0.24;
const VELOCITY_THRESHOLD = 620;
const EASING = Easing.out(Easing.cubic);

function rootIndexFor(pathname: string) {
  return ROOT_ORDER.findIndex((route) => route === pathname);
}

/**
 * The authenticated app shell. Everything that must not move between tabs —
 * the organic background, the utility header and the bottom navigation — is
 * rendered here once. Only <Slot /> (the active root panel) animates, so the
 * chrome stays visually fixed whether the user swipes or taps a tab.
 */
export default function AppShellLayout() {
  const pathname = usePathname();
  const index = rootIndexFor(pathname);

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        {/* One persistent instance: tab changes never restart its animation. */}
        <OrganicBackground variant={14} />

        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <AppHeader />
          </View>

          <SwipeViewport index={index}>
            <Slot />
          </SwipeViewport>
        </SafeAreaView>

        <BottomNavigation />
      </View>
    </View>
  );
}

function SwipeViewport({ index, children }: PropsWithChildren<{ index: number }>) {
  const { width } = useWindowDimensions();
  const canvasWidth = Math.min(width, 480);
  const translateX = useSharedValue(0);
  const reduced = useReducedMotion();
  const previousIndex = useRef(index);

  // Animates the incoming panel in from the side it conceptually came from.
  // Driven by the route index, so a navbar tap and a swipe produce the exact
  // same motion rather than two separate animation systems.
  useEffect(() => {
    if (previousIndex.current === index || index < 0) {
      previousIndex.current = index;
      return;
    }

    const forward = index > previousIndex.current;
    previousIndex.current = index;

    if (reduced) {
      translateX.value = 0;
      return;
    }

    translateX.value = (forward ? 1 : -1) * canvasWidth * 0.3;
    translateX.value = withTiming(0, { duration: TRANSITION_MS, easing: EASING });
  }, [canvasWidth, index, reduced, translateX]);

  const navigate = (target: number) => {
    const route = ROOT_ORDER[target];
    if (!route) return;
    selectionFeedback();
    // replace, not push: root tabs are lateral moves and must not stack up a
    // back-history entry per swipe.
    router.replace(route);
  };

  const pan = Gesture.Pan()
    // Only claims the gesture once it is clearly horizontal, and yields
    // outright to vertical movement so ScrollViews keep working.
    .activeOffsetX([-16, 16])
    .failOffsetY([-14, 14])
    .enabled(index >= 0)
    .onUpdate((event) => {
      const atStart = index <= 0 && event.translationX > 0;
      const atEnd = index >= ROOT_ORDER.length - 1 && event.translationX < 0;
      // Resist at the ends instead of hard-stopping, so the edge is felt.
      const resistance = atStart || atEnd ? 0.22 : 1;
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = event.translationX * resistance;
    })
    .onEnd((event) => {
      const distance = Math.abs(event.translationX);
      const velocity = Math.abs(event.velocityX);
      const forward = event.translationX < 0;
      const target = forward ? index + 1 : index - 1;

      const committed =
        (distance > canvasWidth * DISTANCE_RATIO || velocity > VELOCITY_THRESHOLD) &&
        target >= 0 &&
        target < ROOT_ORDER.length;

      if (!committed) {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withTiming(0, { duration: TRANSITION_MS, easing: EASING });
        return;
      }

      if (reduced) {
        translateX.value = 0;
        runOnJS(navigate)(target);
        return;
      }

      // Carry the panel off-canvas first; the entry animation then brings the
      // new one in, so the swap happens out of sight rather than as a jump.
      translateX.value = withTiming(
        (forward ? -1 : 1) * canvasWidth,
        { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(navigate)(target);
        },
      );
    });

  const animatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(translateX.value) / Math.max(canvasWidth, 1));
    return {
      transform: [{ translateX: translateX.value }],
      // Subtle crossfade so the movement reads as a transition, not a slide.
      opacity: 1 - progress * 0.45,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      {/* Clipped so the outgoing panel never leaks past the canvas edge. */}
      <View style={styles.viewport}>
        <Animated.View style={[styles.page, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#202220',
    overflow: 'hidden',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 2,
    // Above the scenery, below any sheet or modal a screen opens.
    zIndex: 5,
  },
  viewport: { flex: 1, overflow: 'hidden' },
  page: { flex: 1 },
});
