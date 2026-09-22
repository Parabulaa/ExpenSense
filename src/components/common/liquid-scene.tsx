import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { assets } from '@/constants/theme';

type Scene = 'splash' | 'onboarding';

export function LiquidScene({ scene }: { scene: Scene }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // Independent drivers for organic shapes — different durations for desynchronized motion
  const shape1Motion = useSharedValue(0);
  const shape2Motion = useSharedValue(0);
  const accentMotion = useSharedValue(0);
  const mascotMotion = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      shape1Motion.value = 0;
      shape2Motion.value = 0;
      accentMotion.value = 0.5;
      mascotMotion.value = 0.5;
      return;
    }
    const smooth = Easing.inOut(Easing.sin);
    // Different durations so shapes move independently
    shape1Motion.value = withRepeat(withTiming(1, { duration: 2600, easing: smooth }), -1, true);
    shape2Motion.value = withDelay(240, withRepeat(withTiming(1, { duration: 3400, easing: smooth }), -1, true));
    accentMotion.value = withDelay(420, withRepeat(withTiming(1, { duration: 2200, easing: smooth }), -1, true));
    mascotMotion.value = withRepeat(withTiming(1, { duration: 2800, easing: smooth }), -1, true);
  }, [accentMotion, mascotMotion, shape1Motion, shape2Motion, reducedMotion]);

  // Organic shape animations — subtle drift, rotation, breathing
  const liquidLeft = useAnimatedStyle(() => ({
    transform: [
      { translateX: -28 + shape1Motion.value * 56 },
      { translateY: (shape1Motion.value - 0.5) * -16 },
      { scaleX: 1.06 + shape1Motion.value * 0.08 },
      { scaleY: 0.98 + shape1Motion.value * 0.04 },
      { rotate: `${-2 + shape1Motion.value * 4}deg` },
    ],
  }));

  const liquidRight = useAnimatedStyle(() => ({
    transform: [
      { translateX: 24 - shape2Motion.value * 48 },
      { translateY: (shape2Motion.value - 0.5) * 14 },
      { scaleX: 1.04 + (1 - shape2Motion.value) * 0.09 },
      { scaleY: 1 + shape2Motion.value * 0.035 },
      { rotate: `${3 - shape2Motion.value * 5}deg` },
    ],
    opacity: 0.7,
  }));

  const topAccent = useAnimatedStyle(() => ({
    transform: [
      { translateX: (accentMotion.value - 0.5) * 34 },
      { translateY: (accentMotion.value - 0.5) * 22 },
      { rotate: `${-18 + accentMotion.value * 7}deg` },
      { scale: 0.98 + accentMotion.value * 0.06 },
    ],
  }));

  const bottomAccent = useAnimatedStyle(() => ({
    transform: [
      { translateX: (0.5 - accentMotion.value) * 30 },
      { translateY: (accentMotion.value - 0.5) * -24 },
      { rotate: `${156 + accentMotion.value * 8}deg` },
      { scale: 0.97 + (1 - accentMotion.value) * 0.07 },
    ],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (mascotMotion.value - 0.5) * -10 },
      { rotate: `${(mascotMotion.value - 0.5) * 1.8}deg` },
      { scale: 0.99 + mascotMotion.value * 0.025 },
    ],
  }));

  const scale = Math.min(Math.max(width / 390, 0.82), 1.08);

  const heroTop = scene === 'splash' ? height * 0.39 : scene === 'onboarding' ? 70 : height * 0.38;
  const heroHeight = scene === 'splash' ? height * 0.39 : scene === 'onboarding' ? 220 : 300;
  const mascotTop = scene === 'splash' ? height * 0.43 : scene === 'onboarding' ? 105 : height * 0.405;
  const mascotSize = scene === 'splash' ? 294 : scene === 'onboarding' ? 224 : 215;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {scene === 'splash' && <Animated.Image source={assets.shape3} resizeMode="contain" style={[styles.topSplash, { width: width * 0.8, height: height * 0.25 }, topAccent]} />}
      {scene === 'onboarding' && <Image source={assets.shape1} contentFit="contain" style={styles.topOnboarding} />}

      <Animated.Image source={assets.shape4} resizeMode="stretch" style={[styles.liquid, { top: heroTop, width: width * 1.7, height: heroHeight }, liquidRight]} />
      <Animated.Image source={assets.shape4} resizeMode="stretch" style={[styles.liquid, { top: heroTop + 28, width: width * 1.7, height: heroHeight }, liquidLeft]} />

      {/* Mascot: STATIC — no bobbing, no rotation */}
      <Animated.View style={[styles.mascot, { top: mascotTop, width: mascotSize * scale, height: mascotSize * scale, marginLeft: -(mascotSize * scale) / 2 }, mascotStyle]}>
        <Image source={assets.mascotNeutral} contentFit="contain" style={styles.fill} />
      </Animated.View>

      {scene === 'splash' && <Animated.Image source={assets.shape1} resizeMode="contain" style={[styles.bottomSplash, bottomAccent]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  liquid: { position: 'absolute', left: '-35%' },
  mascot: { position: 'absolute', left: '50%' },
  topSplash: { position: 'absolute', left: '-23%', top: '-8%' },
  bottomSplash: { position: 'absolute', width: 230, height: 190, right: -95, bottom: -75 },
  topOnboarding: { position: 'absolute', width: 170, height: 140, left: -65, top: -53, transform: [{ rotate: '30deg' }] },
});
