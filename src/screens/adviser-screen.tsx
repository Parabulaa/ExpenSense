import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FadeSlideIn, PressableScale, useDrift } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { SegmentedControl } from '@/components/common/segmented-control';
import { AppIcon, AppText, BackButton, Card, ProgressBar } from '@/components/common/ui';
import { radii, spacing } from '@/constants/theme';
import { useAdviser } from '@/features/adviser/AdviserProvider';
import { INTENSITY_OPTIONS, withIntensity } from '@/features/adviser/intensity';
import { adviserSeed, isHarshSituation, type AdviserFacts, type AdviserPersona } from '@/features/adviser/personas';
import { PersonaMascot } from '@/features/adviser/PersonaMascot';
import { PersonaPickerSheet } from '@/features/adviser/PersonaPicker';
import { mascotMood } from '@/features/analytics/mascot-mood';
import { AdviserChat } from '@/features/adviser/AdviserChat';
import type { ChatContext } from '@/features/adviser/chatbot/engine';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useFinance } from '@/features/finance/FinanceProvider';
import { todayLocalDate } from '@/features/expenses/validation';
import { useProfile } from '@/features/profile/ProfileProvider';
import { makeStyles, useAdaptiveColor, useColors } from '@/features/settings/ThemeProvider';
import { formatPeso, percentOf } from '@/lib/format';
import { selectionFeedback } from '@/lib/haptics';

/** How calm the adviser is, 0–100, with a word for it. */
function moodMeter(facts: AdviserFacts): { value: number; label: string } {
  switch (facts.situation) {
    case 'empty': return { value: 70, label: 'Curious' };
    case 'over': return { value: 12, label: 'Furious' };
    case 'jump': return { value: 30, label: 'Worried' };
    case 'near': return { value: 45, label: 'Nervous' };
    case 'improving': return { value: 92, label: 'Proud' };
    default: return facts.budget ? { value: Math.max(50, 100 - facts.budget.usedPercent), label: 'Relaxed' } : { value: 65, label: 'Calm' };
  }
}


export function AdviserScreen() {
  const colors = useColors();
  const s = useStyles();
  const { tint, ink } = useAdaptiveColor();
  const month = todayLocalDate().slice(0, 7);
  const { persona, intensity, facts, current, previous, budget, setPersona, setIntensity } = useAdviser(month);
  const { expenses, loading, revalidate } = useExpenses();
  const { wallets } = useFinance();
  const walletBalanceCents = useMemo(() => (wallets.length ? wallets.reduce((sum, item) => sum + item.balanceCents, 0) : undefined), [wallets]);
  const { allCategories } = useCategories();
  const { revalidate: revalidateBudgets } = useBudgets();
  const { displayName } = useProfile();
  const [seed, setSeed] = useState(() => adviserSeed());
  const [pickerOpen, setPickerOpen] = useState(false);
  const drift = useDrift({ x: 6, y: 8, rotate: 1.5, scale: 0.02, duration: 6400 });

  useFocusEffect(useCallback(() => { void revalidate(); void revalidateBudgets(); }, [revalidate, revalidateBudgets]));

  const mood = mascotMood({ loading: loading && expenses.length === 0, current, previous, budget });
  const meter = moodMeter(facts);
  const line = withIntensity(persona.say(facts, seed), persona.id, intensity, isHarshSituation(facts.situation), seed);
  const challenge = useMemo(() => persona.challenge(expenses, todayLocalDate(), facts), [expenses, facts, persona]);
  const categoryRows = useMemo(() => (budget?.categoryBudgets ?? [])
    .filter((limit) => limit.amountCents > 0)
    .map((limit) => {
      const spent = current.expenses.filter((item) => item.categoryId === limit.categoryId).reduce((sum, item) => sum + item.amountCents, 0);
      return { id: limit.categoryId, label: allCategories.find((item) => item.id === limit.categoryId)?.fullLabel ?? 'Other', spent, limit: limit.amountCents, used: percentOf(spent, limit.amountCents) ?? 0 };
    })
    .sort((a, b) => b.used - a.used), [allCategories, budget, current.expenses]);

  const chatContext = useMemo<ChatContext>(() => ({ expenses, categories: allCategories, budget, current, previous, facts, today: todayLocalDate(), userName: displayName.trim().split(/\s+/)[0] || undefined, walletBalanceCents }), [allCategories, budget, current, displayName, expenses, facts, previous, walletBalanceCents]);

  const choose = (next: AdviserPersona) => {
    if (next.id === persona.id) return;
    selectionFeedback();
    void setPersona(next.id);
  };

  return (
    <Screen bottomInset={48} variant={12}>
      <View style={s.page}>
        <FadeSlideIn index={0}>
          <View style={s.header}>
            <BackButton />
            <View style={{ flex: 1 }}>
              <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Your Adviser</AppText>
              <AppText style={s.muted}>Your money coach, with attitude.</AppText>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Card style={s.hero}>
            {/* Cross-fades whenever a different adviser is picked. */}
            <Animated.View key={persona.id} entering={FadeIn.duration(320)} style={s.heroTop}>
              <PressableScale accessibilityRole="button" accessibilityLabel={`${persona.name}. Tap for another line.`} onPress={() => { selectionFeedback(); setSeed((value) => value + 1); }}>
                <Animated.View style={[s.mascotWrap, drift]}>
                  <PersonaMascot persona={persona.id} mood={mood} size={108} />
                </Animated.View>
              </PressableScale>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.nameRow}>
                  <AppText variant="h2" numberOfLines={1} style={{ flexShrink: 1 }}>{persona.name}</AppText>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Change adviser" onPress={() => { selectionFeedback(); setPickerOpen(true); }} style={s.changeButton}>
                    <AppIcon name="swap-horizontal" size={16} color={colors.deepForest} />
                    <AppText variant="small" style={s.changeText}>Change</AppText>
                  </PressableScale>
                </View>
                <AppText variant="small" style={s.muted}>{persona.tagline}</AppText>
                <View style={s.meterRow}>
                  <AppText variant="small" style={s.meterLabel}>Mood</AppText>
                  <View style={{ flex: 1 }}><ProgressBar value={meter.value} height={8} /></View>
                  <AppText variant="small" style={s.meterLabel}>{meter.label}</AppText>
                </View>
              </View>
            </Animated.View>
            <Animated.View key={`${persona.id}-${seed}`} entering={FadeIn.duration(260)} style={s.speech}>
              <View style={s.speechTail} />
              <AppText variant="bodyMedium" style={s.speechText}>“{line}”</AppText>
            </Animated.View>
            {persona.id === 'classic' ? null : (
              <View style={s.intensity}>
                <View style={s.intensityHead}>
                  <AppText variant="small" style={s.kicker}>Intensity</AppText>
                  <AppText variant="small" style={s.muted}>{intensity === 'low' ? 'Gentle, kind endings' : intensity === 'high' ? 'Savage, extra jabs' : 'As written'}</AppText>
                </View>
                <SegmentedControl size="sm" accessibilityLabel="Adviser intensity" options={INTENSITY_OPTIONS} value={intensity} onChange={(value) => { selectionFeedback(); void setIntensity(value); }} />
              </View>
            )}
          </Card>
        </FadeSlideIn>

        {categoryRows.length ? (
          <FadeSlideIn index={2}>
            <Card style={s.section}>
              <AppText variant="h3">How {persona.id === 'classic' ? 'your budgets look' : `${persona.name} sees your budgets`}</AppText>
              {categoryRows.map((row) => (
                <View key={row.id} style={s.catRow}>
                  <View style={s.catHead}>
                    <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{row.label}</AppText>
                    <AppText variant="small" style={[s.muted, row.used > 100 && { color: colors.danger }]}>{formatPeso(row.spent)} / {formatPeso(row.limit)} · {row.used}%</AppText>
                  </View>
                  <ProgressBar value={row.used} height={8} />
                </View>
              ))}
            </Card>
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn index={3}>
          <Card style={s.challenge}>
            <View style={[s.challengeIcon, { backgroundColor: tint(persona.accent) }]}>
              <AppIcon name={challenge.icon} size={26} color={ink('#173D2B')} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="small" style={s.kicker}>{persona.id === 'classic' ? 'Weekly challenge' : `${persona.name}’s challenge`}</AppText>
              <AppText variant="h3">{challenge.title}</AppText>
              <AppText variant="small" style={s.muted}>{challenge.detail}</AppText>
              <View style={s.dots}>
                {Array.from({ length: challenge.goal }, (_, index) => (
                  <View key={index} style={[s.dot, index < challenge.progress && s.dotDone]} />
                ))}
                <AppText variant="small" style={s.muted}>{challenge.progress >= challenge.goal ? 'Done!' : `${challenge.progress}/${challenge.goal}`}</AppText>
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={4}>
          <Card>
            <AdviserChat key={`${persona.id}-${intensity}`} persona={persona} context={chatContext} intensity={intensity} />
          </Card>
        </FadeSlideIn>

        <AppText variant="small" style={[s.muted, { textAlign: 'center' }]}>All advisers use the same numbers. Only the attitude changes.</AppText>
      </View>
      <PersonaPickerSheet visible={pickerOpen} value={persona.id} onChange={choose} onClose={() => setPickerOpen(false)} />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { gap: spacing.lg, paddingTop: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  muted: { color: colors.muted },
  hero: { gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mascotWrap: { width: 108, height: 108 },
  mascot: { width: 108, height: 108 },
  badge: { position: 'absolute', right: 0, bottom: 4, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  meterLabel: { color: colors.muted, fontFamily: 'JakartaSemiBold' },
  speech: { backgroundColor: colors.pale, borderRadius: radii.md, padding: spacing.lg },
  speechTail: { position: 'absolute', top: -8, left: 44, width: 16, height: 16, backgroundColor: colors.pale, transform: [{ rotate: '45deg' }] },
  speechText: { fontSize: 16, lineHeight: 23, color: colors.text },
  section: { gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  changeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.pale, paddingHorizontal: 10, paddingVertical: 5 },
  changeText: { color: colors.deepForest, fontFamily: 'JakartaBold' },
  intensity: { gap: spacing.sm },
  intensityHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catRow: { gap: 6 },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  challenge: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  challengeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.forest, fontFamily: 'JakartaBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.lightGreen },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
}));
