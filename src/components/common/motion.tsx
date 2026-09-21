import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Every interactive surface dips slightly on touch. One component so the
// timing is identical across buttons, tiles, chips and nav items.
export function PressableScale({
  children,
  style,
  scaleTo = 0.98,
  ...props
}: PropsWithChildren<PressableProps & { style?: ViewStyle | ViewStyle[]; scaleTo?: number }>) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

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
        if (!reduced) scale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
        props.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
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
