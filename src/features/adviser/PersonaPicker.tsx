import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/common/ui';
import { radii, spacing } from '@/constants/theme';
import { ADVISER_PERSONAS, type AdviserPersona, type AdviserPersonaId } from '@/features/adviser/personas';
import { PersonaMascot } from '@/features/adviser/PersonaMascot';
import { makeStyles, useAdaptiveColor, useColors } from '@/features/settings/ThemeProvider';

const CARD_WIDTH = 150;
const GAP = spacing.md;

/**
 * Horizontal persona picker for the top of the Adviser screen. The chosen
 * card springs up and lights its border; the row scrolls it into view.
 */
export function PersonaPicker({ value, onChange }: { value: AdviserPersonaId; onChange: (persona: AdviserPersona) => void }) {
  const s = useStyles();
  const scroller = useRef<ScrollView>(null);
  const index = ADVISER_PERSONAS.findIndex((item) => item.id === value);

  useEffect(() => {
    scroller.current?.scrollTo({ x: Math.max(0, index * (CARD_WIDTH + GAP) - CARD_WIDTH / 2), animated: true });
  }, [index]);

  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} accessibilityRole="radiogroup" accessibilityLabel="Choose your adviser">
      {ADVISER_PERSONAS.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} selected={persona.id === value} onPress={() => onChange(persona)} />
      ))}
    </ScrollView>
  );
}

function PersonaCard({ persona, selected, onPress }: { persona: AdviserPersona; selected: boolean; onPress: () => void }) {
  const s = useStyles();
  const colors = useColors();
  const { tint } = useAdaptiveColor();
  const reduced = useReducedMotion();
  const active = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    active.value = reduced ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, { damping: 15, stiffness: 180 });
  }, [active, reduced, selected]);

  const line = colors.line;
  const ring = colors.success;
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(active.value, [0, 1], [line, ring]),
    transform: [{ translateY: active.value * -4 }, { scale: 1 + active.value * 0.03 - pressed.value * 0.04 }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + active.value * 0.12 }, { rotate: `${active.value * -4}deg` }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: active.value, transform: [{ scale: 0.4 + active.value * 0.6 }] }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${persona.name}. ${persona.tagline}`}
      onPress={onPress}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: 160 }); }}
    >
      <Animated.View style={[s.card, cardStyle]}>
        <View style={[s.portrait, { backgroundColor: tint(persona.accent) }]}>
          <Animated.View style={mascotStyle}>
            <PersonaMascot persona={persona.id} mood="tip" size={84} />
          </Animated.View>
          <Animated.View style={[s.check, checkStyle]}>
            <AppText variant="small" style={s.checkText}>Selected</AppText>
          </Animated.View>
        </View>
        <AppText variant="h3" numberOfLines={1}>{persona.name}</AppText>
        <AppText variant="small" style={s.tagline} numberOfLines={2}>{persona.tagline}</AppText>
        <AppText variant="small" style={s.sample} numberOfLines={3}>“{persona.sample}”</AppText>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { gap: GAP, paddingVertical: spacing.sm, paddingHorizontal: 2 },
  card: { width: CARD_WIDTH, minHeight: 236, gap: 4, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, backgroundColor: colors.surface },
  portrait: { height: 96, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 4 },
  check: { position: 'absolute', top: 6, right: 6, borderRadius: radii.pill, backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 2 },
  checkText: { color: colors.white, fontFamily: 'JakartaBold', fontSize: 10, lineHeight: 14 },
  tagline: { color: colors.muted },
  sample: { color: colors.forest, fontStyle: 'italic' },
}));
