import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { AppText } from '@/components/common/ui';
import { radii, spacing } from '@/constants/theme';
import { ADVISER_PERSONAS, type AdviserPersona, type AdviserPersonaId } from '@/features/adviser/personas';
import { PersonaMascot } from '@/features/adviser/PersonaMascot';
import { makeStyles, useAdaptiveColor, useColors } from '@/features/settings/ThemeProvider';

/** Long enough to see the new choice light up before the panel closes. */
const CLOSE_DELAY_MS = 320;

/**
 * The panel for switching advisers. The current one is marked; tapping
 * another springs it up, lights its border, then closes the panel.
 */
export function PersonaPickerSheet({ visible, value, onChange, onClose }: { visible: boolean; value: AdviserPersonaId; onChange: (persona: AdviserPersona) => void; onClose: () => void }) {
  const s = useStyles();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const choose = (persona: AdviserPersona) => {
    if (persona.id === value) { onClose(); return; }
    onChange(persona);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, CLOSE_DELAY_MS);
  };

  return (
    <DraggableBottomSheet visible={visible} onClose={onClose}>
      <View style={s.head}>
        <AppText variant="h2">Choose your adviser</AppText>
        <AppText variant="small" style={s.muted}>Same numbers, different attitude.</AppText>
      </View>
      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false} accessibilityRole="radiogroup">
        {visible ? ADVISER_PERSONAS.map((persona, index) => (
          <Animated.View key={persona.id} entering={FadeInDown.delay(index * 45).duration(260)}>
            <PersonaOption persona={persona} selected={persona.id === value} onPress={() => choose(persona)} />
          </Animated.View>
        )) : null}
      </ScrollView>
    </DraggableBottomSheet>
  );
}

function PersonaOption({ persona, selected, onPress }: { persona: AdviserPersona; selected: boolean; onPress: () => void }) {
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
  const rowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(active.value, [0, 1], [line, ring]),
    // Only shrink on press: growing the selected card pushed its edge past the list and clipped it.
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + active.value * 0.1 }, { rotate: `${active.value * -5}deg` }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: active.value, transform: [{ scale: 0.5 + active.value * 0.5 }] }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${persona.name}. ${persona.tagline}`}
      onPress={onPress}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: 160 }); }}
    >
      <Animated.View style={[s.option, rowStyle]}>
        <View style={[s.portrait, { backgroundColor: tint(persona.accent) }]}>
          <Animated.View style={mascotStyle}>
            <PersonaMascot persona={persona.id} mood="tip" size={72} />
          </Animated.View>
        </View>
        <View style={s.copy}>
          <View style={s.titleRow}>
            <AppText variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{persona.name}</AppText>
            <Animated.View style={[s.check, checkStyle]}>
              <AppText variant="small" style={s.checkText}>Current</AppText>
            </Animated.View>
          </View>
          <AppText variant="small" style={s.muted} numberOfLines={1}>{persona.tagline}</AppText>
          <AppText variant="small" style={s.sample} numberOfLines={2}>“{persona.sample}”</AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  head: { gap: 2, marginBottom: spacing.md },
  muted: { color: colors.muted },
  list: { maxHeight: 520 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, borderWidth: 2, backgroundColor: colors.surface },
  portrait: { width: 80, height: 80, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  copy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { borderRadius: radii.pill, backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 2 },
  checkText: { color: colors.white, fontFamily: 'JakartaBold', fontSize: 10, lineHeight: 14 },
  sample: { color: colors.forest, fontStyle: 'italic' },
}));
