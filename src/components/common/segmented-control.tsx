import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/common/motion';
import { AppIcon } from '@/components/common/ui';
import { radii, type as typeScale } from '@/constants/theme';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { selectionFeedback } from '@/lib/haptics';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

const SLIDE_SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const PADDING = 4;

/**
 * Equal-width toggle whose highlight pill slides to the chosen option, with
 * label colours crossfading as it passes. Used for every period / mode switch
 * so they all move the same way.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  shape = 'pill',
  accessibilityLabel,
  style,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'pill' | 'rounded';
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    position.value = reduced ? activeIndex : withSpring(activeIndex, SLIDE_SPRING);
  }, [activeIndex, position, reduced]);

  const segmentWidth = width > 0 ? (width - PADDING * 2) / options.length : 0;
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * segmentWidth }] }));
  const height = size === 'sm' ? 34 : size === 'lg' ? 48 : 42;
  const radius = shape === 'pill' ? radii.pill : radii.sm;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { borderRadius: shape === 'pill' ? radii.pill : radii.md }, style]}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.indicator, { width: segmentWidth, height, borderRadius: radius }, indicatorStyle]} />
      ) : null}
      {options.map((option, index) => (
        <PressableScale
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: index === activeIndex }}
          scaleTo={0.94}
          onPress={() => {
            if (option.value === value) return;
            selectionFeedback();
            onChange(option.value);
          }}
          style={[styles.option, { height, borderRadius: radius }]}
        >
          <SegmentLabel option={option} index={index} position={position} size={size} />
        </PressableScale>
      ))}
    </View>
  );
}

function SegmentLabel<T extends string>({ option, index, position, size }: { option: SegmentOption<T>; index: number; position: SharedValue<number>; size: 'sm' | 'md' | 'lg' }) {
  const colors = useColors();
  const styles = useStyles();
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(position.value - index)), [0, 1], [colors.surface, colors.text]),
  }));
  const font: TextStyle = size === 'sm' ? { fontSize: 12, lineHeight: 16 } : size === 'lg' ? typeScale.h3 : { fontSize: 14, lineHeight: 19 };
  return (
    <View style={styles.labelRow}>
      {option.icon ? <AppIcon name={option.icon} size={size === 'sm' ? 15 : 18} color={colors.muted} /> : null}
      <Animated.Text numberOfLines={1} style={[styles.label, font, textStyle]}>{option.label}</Animated.Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: { flexDirection: 'row', padding: PADDING, backgroundColor: colors.pale },
  indicator: { position: 'absolute', top: PADDING, left: PADDING, backgroundColor: colors.deepForest },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'JakartaSemiBold' },
}));
