import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { costumeXml } from '@/features/adviser/costumes';
import type { AdviserPersonaId } from '@/features/adviser/personas';
import { mascotImage, type MascotMood } from '@/features/analytics/mascot-mood';

/** The mascot in a given mood, wearing the persona's costume on top. */
export function PersonaMascot({ persona, mood, size, style }: { persona: AdviserPersonaId; mood: MascotMood; size: number; style?: StyleProp<ViewStyle> }) {
  const xml = useMemo(() => costumeXml(persona, mood), [mood, persona]);
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Image source={mascotImage[mood]} contentFit="contain" transition={180} style={StyleSheet.absoluteFill} />
      {xml ? <SvgXml xml={xml} width={size} height={size} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}
