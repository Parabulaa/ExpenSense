import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { assets } from '@/constants/theme';

type Scene = 'splash' | 'onboarding';

export function LiquidScene({ scene }: { scene: Scene }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // Independent drivers for organic shapes — different durations for desynchronized motion
  const shape1Motion = useSharedValue(0);
  const shape2Motion = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      shape1Motion.value = 0;
      shape2Motion.value = 0;
      return;
    }
    const smooth = Easing.inOut(Easing.sin);
    // Different durations so shapes move independently
    shape1Motion.value = withRepeat(withTiming(1, { duration: 5800, easing: smooth }), -1, true);
    shape2Motion.value = withRepeat(withTiming(1, { duration: 7400, easing: smooth }), -1, true);
  }, [shape1Motion, shape2Motion, reducedMotion]);

  // Organic shape animations — subtle drift, rotation, breathing
  const liquidLeft = useAnimatedStyle(() => ({
    transform: [
      { translateX: -20 + shape1Motion.value * 40 },
      { translateY: (shape1Motion.value - 0.5) * -8 },
      { scaleX: 1.08 + shape1Motion.value * 0.04 },
      { rotate: `${-1 + shape1Motion.value * 2}deg` },
    ],
  }));

  const liquidRight = useAnimatedStyle(() => ({
    transform: [
      { translateX: 15 - shape2Motion.value * 30 },
      { translateY: (shape2Motion.value - 0.5) * 6 },
      { scaleX: 1.05 + (1 - shape2Motion.value) * 0.05 },
      { rotate: `${2 - shape2Motion.value * 1.5}deg` },
    ],
    opacity: 0.7,
  }));

  const scale = Math.min(Math.max(width / 390, 0.82), 1.08);

  const heroTop = scene === 'splash' ? height * 0.39 : scene === 'onboarding' ? 70 : height * 0.38;
  const heroHeight = scene === 'splash' ? height * 0.39 : scene === 'onboarding' ? 220 : 300;
  const mascotTop = scene === 'splash' ? height * 0.43 : scene === 'onboarding' ? 105 : height * 0.405;
  const mascotSize = scene === 'splash' ? 294 : scene === 'onboarding' ? 224 : 215;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {scene === 'splash' && <Image source={assets.shape3} contentFit="contain" style={[styles.topSplash, { width: width * 0.8, height: height * 0.25 }]} />}
      {scene === 'onboarding' && <Image source={assets.shape1} contentFit="contain" style={styles.topOnboarding} />}

      <Animated.Image source={assets.shape4} resizeMode="stretch" style={[styles.liquid, { top: heroTop, width: width * 1.7, height: heroHeight }, liquidRight]} />
      <Animated.Image source={assets.shape4} resizeMode="stretch" style={[styles.liquid, { top: heroTop + 28, width: width * 1.7, height: heroHeight }, liquidLeft]} />

      {/* Mascot: STATIC — no bobbing, no rotation */}
      <View style={[styles.mascot, { top: mascotTop, width: mascotSize * scale, height: mascotSize * scale, marginLeft: -(mascotSize * scale) / 2 }]}>
        <Image source={assets.mascotNeutral} contentFit="contain" style={styles.fill} />
      </View>

      {scene === 'splash' && <Image source={assets.shape1} contentFit="contain" style={styles.bottomSplash} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  liquid: { position: 'absolute', left: '-35%' },
  mascot: { position: 'absolute', left: '50%' },
  topSplash: { position: 'absolute', left: '-23%', top: '-8%', transform: [{ rotate: '-15deg' }] },
  bottomSplash: { position: 'absolute', width: 230, height: 190, right: -95, bottom: -75, transform: [{ rotate: '160deg' }] },
  topOnboarding: { position: 'absolute', width: 170, height: 140, left: -65, top: -53, transform: [{ rotate: '30deg' }] },
});
