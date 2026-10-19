import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { costumeXml, usesBareHead } from '@/features/adviser/costumes';
import type { AdviserPersonaId } from '@/features/adviser/personas';
import { bareMascotImage, mascotImage, type MascotMood } from '@/features/analytics/mascot-mood';

const SWAP_MS = 180;

/**
 * The mascot in a given mood, wearing the persona's costume on top. Body and
 * costume are one layer that fades as a unit, so a hat or hairdo never shows
 * on the next face before the pig underneath has changed.
 */
export function PersonaMascot({ persona, mood, size, style }: { persona: AdviserPersonaId; mood: MascotMood; size: number; style?: StyleProp<ViewStyle> }) {
  const xml = useMemo(() => costumeXml(persona, mood), [mood, persona]);
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View key={`${persona}-${mood}`} entering={FadeIn.duration(SWAP_MS)} exiting={FadeOut.duration(SWAP_MS)} style={StyleSheet.absoluteFill}>
        <Image source={(usesBareHead(persona) ? bareMascotImage : mascotImage)[mood]} contentFit="contain" style={StyleSheet.absoluteFill} />
        {xml ? <SvgXml xml={xml} width={size} height={size} style={StyleSheet.absoluteFill} /> : null}
      </Animated.View>
    </View>
  );
}
