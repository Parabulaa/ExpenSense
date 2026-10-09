import type { PropsWithChildren } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Every interactive surface dips on touch and springs back. One component so
// the timing is identical across buttons, tiles, chips and nav items. Passing
// `selected` adds a small pop whenever the item becomes the chosen one.
const RELEASE_SPRING = { damping: 13, stiffness: 320, mass: 0.6 };

export function PressableScale({
  children,
  style,
  scaleTo = 0.95,
  selected,
  ...props
}: PropsWithChildren<PressableProps & { style?: ViewStyle | ViewStyle[]; scaleTo?: number; selected?: boolean }>) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (selected === wasSelected.current) return;
    wasSelected.current = selected;
    if (selected && !reduced) scale.value = withSequence(withTiming(1.06, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, RELEASE_SPRING));
  }, [reduced, scale, selected]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        // Shared values are mutable by design; the compiler's immutability
        // rule doesn't model Reanimated's UI-thread store.
        // eslint-disable-next-line react-hooks/immutability
        if (!reduced) scale.value = withTiming(scaleTo, { duration: 90, easing: Easing.out(Easing.quad) });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability
        if (!reduced) scale.value = withSpring(1, RELEASE_SPRING);
        props.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Slides its content in whenever `index` changes: from the right when the
 * index grows (next month, next step), from the left when it shrinks. The
 * caller swaps the content; this only animates its arrival.
 */
export function SlideSwap({
  index,
  children,
  style,
  distance = 44,
  duration = 300,
}: PropsWithChildren<{ index: number; style?: ViewStyle | ViewStyle[]; distance?: number; duration?: number }>) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const previous = useRef(index);

  // A layout effect, so the offset is set before the new content is painted.
  // The view itself stays mounted and in normal layout, which keeps its parent
  // sized correctly on every platform.
  useLayoutEffect(() => {
    if (index === previous.current) return;
    const direction = index > previous.current ? 1 : -1;
    previous.current = index;
    if (reduced) return;
    offset.value = direction * distance;
    opacity.value = 0;
    offset.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: duration * 0.8, easing: Easing.out(Easing.quad) });
  }, [distance, duration, index, offset, opacity, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: offset.value }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// Screen-entry primitive. `delay` is explicit (ms) so a screen can script its
// own sequence; `index` remains for simple uniform cascades.
export function FadeSlideIn({
  children,
  index = 0,
  delay,
  duration = 380,
  style,
  distance = 10,
}: PropsWithChildren<{
  index?: number;
  delay?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
  distance?: number;
}>) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  const startDelay = delay ?? index * 60;

  useEffect(() => {
    if (reduced) {
      // Reduced motion still reveals content, just without travel.
      progress.value = 1;
      return;
    }
    progress.value = withDelay(startDelay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [duration, progress, reduced, startDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// Ambient drift for decorative background shapes only. `x`/`y` are the TOTAL
// travel in px (the shape moves +/- half of each), matching how the onboarding
// scenery expresses its values. Each caller passes a different duration and
// delay so no two shapes ever move in lockstep.
export function useDrift({
  x = 3,
  y = 6,
  rotate = 1,
  scale = 0.01,
  duration = 8000,
  delay = 0,
  invert = false,
  baseRotate = 0,
}: {
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  duration?: number;
  delay?: number;
  invert?: boolean;
  baseRotate?: number;
} = {}) {
  // Matches the onboarding scenery's driver: progress oscillates 0->1 and back,
  // and each shape reads it as a centred -0.5..0.5 offset. So `x` is the total
  // travel in px (the shape moves +/- x/2), which is how the onboarding
  // composition's values are expressed.
  const t = useSharedValue(0.5);
  const reduced = useReducedMotion();

  useEffect(() => {
    // Reduced motion: shapes hold their mid-point rather than drifting.
    if (reduced) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    return () => cancelAnimation(t);
  }, [delay, duration, reduced, t]);

  const dir = invert ? -1 : 1;

  return useAnimatedStyle(() => {
    const centered = t.value - 0.5;
    return {
      transform: [
        { translateX: centered * x * dir },
        { translateY: centered * y },
        { rotate: `${baseRotate + centered * rotate * dir}deg` },
        { scale: 1 + centered * scale },
      ],
    };
  });
}

export { Animated };
