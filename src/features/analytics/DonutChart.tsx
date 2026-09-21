import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/constants/theme';
import type { CategorySlice } from './analytics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 232;
const STROKE = 32;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = Math.PI * 2 * RADIUS;

function Segment({ slice, offset, refreshKey }: { slice: CategorySlice; offset: number; refreshKey: string }) {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 650 });
  }, [refreshKey, reveal]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${CIRCUMFERENCE * (slice.percentage / 100) * reveal.value} ${CIRCUMFERENCE}`,
  }));
  return <AnimatedCircle animatedProps={animatedProps} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={slice.color} strokeWidth={STROKE} strokeDashoffset={-CIRCUMFERENCE * offset / 100} strokeLinecap="butt" />;
}

export function DonutChart({ slices, children, refreshKey }: { slices: CategorySlice[]; children: React.ReactNode; refreshKey: string }) {
  const segments = slices.map((slice, index) => ({ slice, offset: slices.slice(0, index).reduce((sum, item) => sum + item.percentage, 0) }));
  return <View style={styles.wrap}><Svg width={SIZE} height={SIZE} style={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`}><Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={colors.pale} strokeWidth={STROKE} />{segments.map(({ slice, offset }) => <Segment key={slice.id} slice={slice} offset={offset} refreshKey={refreshKey} />)}</Svg><View style={styles.center}>{children}</View></View>;
}

const styles = StyleSheet.create({ wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }, svg: { transform: [{ rotate: '-90deg' }] }, center: { position: 'absolute', left: 38, right: 38, alignItems: 'center' } });
