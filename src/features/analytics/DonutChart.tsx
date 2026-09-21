import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/constants/theme';
import type { CategorySlice } from './analytics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// The ring scales with the card, but stays legible on a small phone and stops
// ballooning on a large one.
const MIN_SIZE = 168;
const MAX_SIZE = 264;
// Ring thickness as a share of the diameter, so the donut keeps its proportions
// at every size rather than turning into a thin hoop or a solid disc.
const STROKE_RATIO = 32 / 232;
// Matches the original 38px inset at the 232px reference size.
const CENTER_INSET_RATIO = 38 / 232;

type Geometry = { size: number; stroke: number; radius: number; circumference: number };

function geometryFor(size: number): Geometry {
  const stroke = size * STROKE_RATIO;
  const radius = (size - stroke) / 2;
  return { size, stroke, radius, circumference: Math.PI * 2 * radius };
}

function Segment({
  slice,
  offset,
  refreshKey,
  geometry,
}: {
  slice: CategorySlice;
  offset: number;
  refreshKey: string;
  geometry: Geometry;
}) {
  const reduced = useReducedMotion();
  const reveal = useSharedValue(reduced ? 1 : 0);
  const { size, stroke, radius, circumference } = geometry;

  useEffect(() => {
    // Reduced motion still shows the full chart, it just doesn't sweep into it.
    if (reduced) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 650 });
  }, [refreshKey, reduced, reveal]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${circumference * (slice.percentage / 100) * reveal.value} ${circumference}`,
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={slice.color}
      strokeWidth={stroke}
      strokeDashoffset={(-circumference * offset) / 100}
      strokeLinecap="butt"
    />
  );
}

export function DonutChart({
  slices,
  children,
  refreshKey,
}: {
  slices: CategorySlice[];
  children: React.ReactNode;
  refreshKey: string;
}) {
  // Measured rather than fixed, so the chart fits whatever width the card gives
  // it instead of overflowing a narrow phone.
  const [available, setAvailable] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setAvailable((current) => (current === width ? current : width));
  };

  const size = Math.min(Math.max(available, MIN_SIZE), MAX_SIZE);
  const geometry = geometryFor(size);
  const inset = size * CENTER_INSET_RATIO;
  const segments = slices.map((slice, index) => ({
    slice,
    offset: slices.slice(0, index).reduce((sum, item) => sum + item.percentage, 0),
  }));

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {available > 0 ? (
          <Svg width={size} height={size} style={styles.svg} viewBox={`0 0 ${size} ${size}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={geometry.radius}
              fill="none"
              stroke={colors.pale}
              strokeWidth={geometry.stroke}
            />
            {segments.map(({ slice, offset }) => (
              <Segment key={slice.id} slice={slice} offset={offset} refreshKey={refreshKey} geometry={geometry} />
            ))}
          </Svg>
        ) : null}
        <View style={[styles.center, { left: inset, right: inset }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  svg: { transform: [{ rotate: '-90deg' }] },
  center: { position: 'absolute', alignItems: 'center' },
});
