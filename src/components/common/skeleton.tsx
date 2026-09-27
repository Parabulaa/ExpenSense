import { useEffect } from 'react';
import { type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { radii } from '@/constants/theme';
import { makeStyles } from '@/features/settings/ThemeProvider';

/**
 * A softly pulsing placeholder shown where a value is still loading, so the
 * screen reads as "arriving" instead of showing a dash or static text.
 */
export function Skeleton({ width = '100%', height = 14, radius = radii.sm, style }: { width?: DimensionValue; height?: number; radius?: number; style?: object }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View accessibilityLabel="Loading" style={[styles.base, { width, height, borderRadius: radius }, animated, style]} />;
}

const useStyles = makeStyles((colors) => ({
  base: { backgroundColor: colors.pale },
}));
