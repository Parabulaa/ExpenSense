import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FadeSlideIn, PressableScale, SlideSwap } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, Card, PrimaryButton, SecondaryButton } from '@/components/common/ui';
import { assets, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { markBudgetSetup } from '@/features/budget/setup-status';
import { parseBudgetAmount } from '@/features/budget/validation';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { todayLocalDate } from '@/features/expenses/validation';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { formatPeso } from '@/lib/format';
import { selectionFeedback } from '@/lib/haptics';

type Period = 'Week' | 'Month';
type Step = 0 | 1 | 2 | 3;

/** Budgets are stored per month, so a weekly amount is scaled to the month. */
const WEEKS_PER_MONTH = 52 / 12;
const toMonthlyCents = (cents: number, period: Period) => period === 'Week' ? Math.round(cents * WEEKS_PER_MONTH) : cents;
/** The budget steps; the goal prompt after them is a bonus, not counted. */
const BUDGET_STEPS = 3;
const STARTER_CATEGORIES = ['food', 'transport'];

const PERIOD_CHOICES = [
  { value: 'Week' as const, icon: 'calendar-week' as const, title: 'Every week', description: 'I get an allowance or pay weekly.' },
  { value: 'Month' as const, icon: 'calendar-month' as const, title: 'Every month', description: 'I get money once a month.' },
];

/**
 * Guided first-run budget setup. Signed-in users without a budget are routed
 * here until they save one or choose "Set later" (see useAuthGuard). Three
 * short steps — how often money comes in, what it goes to, how much each —
 * then an optional nudge towards a first savings goal.
 */
export function BudgetSetupScreen() {
  const colors = useColors();
  const s = useStyles();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { saveCategoryBudget } = useBudgets();
  const [step, setStep] = useState<Step>(0);
  const [period, setPeriod] = useState<Period>('Month');
  const [picked, setPicked] = useState<string[]>(() => STARTER_CATEGORIES);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = categories.filter((category) => picked.includes(category.id));
  const parsed = chosen.map((category) => ({ category, raw: (amounts[category.id] ?? '').trim() })).map((entry) => ({ ...entry, cents: entry.raw ? parseBudgetAmount(entry.raw) : null }));
  const totalCents = parsed.reduce((sum, entry) => sum + (entry.cents ?? 0), 0);

  const goTo = (next: Step) => { Keyboard.dismiss(); setError(null); setStep(next); };
  const setLater = () => {
    if (user) markBudgetSetup(user.id, 'later');
    router.replace('/home');
  };

  // Hardware back walks back through the steps; it never skips setup, which
  // only "Set later" does.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 3) router.replace('/home');
      else if (step > 0) goTo((step - 1) as Step);
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  const togglePick = (id: string) => {
    selectionFeedback();
    setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const save = async () => {
    Keyboard.dismiss();
    const filled = parsed.filter((entry) => entry.raw);
    if (!filled.length) { setError('Enter an amount for at least one category.'); return; }
    const invalid = filled.find((entry) => !entry.cents);
    if (invalid) { setError(`Enter a valid amount for ${invalid.category.fullLabel}.`); return; }
    setError(null);
    setSaving(true);
    const month = todayLocalDate().slice(0, 7);
    // Sequential: the first save creates the month row the others reuse.
    for (const entry of filled) {
      const result = await saveCategoryBudget(month, entry.category.id, toMonthlyCents(entry.cents!, period));
      if (!result.ok) { setSaving(false); showToast(result.message, { tone: 'warning' }); return; }
    }
    setSaving(false);
    if (user) markBudgetSetup(user.id, 'done');
    selectionFeedback();
    goTo(3);
  };

  return (
    <Screen variant={8} bottomInset={48}>
      <View style={s.page}>
        {step < 3 ? (
          <View style={s.topBar}>
            {step > 0 ? (
              <PressableScale accessibilityRole="button" accessibilityLabel="Previous step" hitSlop={10} onPress={() => goTo((step - 1) as Step)} style={s.backButton}>
                <AppIcon name="arrow-left" size={22} />
              </PressableScale>
            ) : <Image accessibilityLabel="ExpenSense" source={assets.logoMark} contentFit="contain" style={s.logoMark} />}
            <View style={s.progressWrap}>
              <AppText variant="small" style={s.muted}>Step {step + 1} of {BUDGET_STEPS}</AppText>
              <StepProgress value={(step + 1) / BUDGET_STEPS} />
            </View>
            <PressableScale accessibilityRole="button" accessibilityLabel="Set up budget later" hitSlop={10} onPress={setLater} style={s.laterButton}>
              <AppText variant="bodyMedium" style={s.laterText}>Set later</AppText>
            </PressableScale>
          </View>
        ) : null}

        <SlideSwap index={step} distance={60} duration={340} style={s.stepBody}>
          {step === 0 ? (
            <>
              <Image source={assets.mascotTip} contentFit="contain" style={s.heroMascot} />
              <AppText variant="title" style={s.center}>Let&apos;s set up your budget</AppText>
              <AppText style={[s.center, s.muted]}>A budget shows you what&apos;s left to spend, so every expense moves you towards your goals instead of away from them. First, how often do you get money?</AppText>
              <View style={s.choiceList}>
                {PERIOD_CHOICES.map((choice) => {
                  const active = period === choice.value;
                  return (
                    <PressableScale
                      key={choice.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      selected={active}
                      onPress={() => { selectionFeedback(); setPeriod(choice.value); }}
                      style={[s.periodCard, active && s.periodCardActive]}
                    >
                      <View style={[s.periodIcon, active && s.periodIconActive]}>
                        <AppIcon name={choice.icon} size={26} color={active ? colors.surface : colors.deepForest} />
                      </View>
                      <View style={s.flex}>
                        <AppText variant="h3">{choice.title}</AppText>
                        <AppText variant="small" style={s.muted}>{choice.description}</AppText>
                      </View>
                      <AppIcon name={active ? 'check-circle' : 'circle-outline'} size={24} color={active ? colors.deepForest : colors.lightGreen} />
                    </PressableScale>
                  );
                })}
              </View>
              <PrimaryButton title="Continue" onPress={() => goTo(1)} />
            </>
          ) : step === 1 ? (
            <>
              <AppText variant="title">What do you usually spend on?</AppText>
              <AppText style={s.muted}>Pick the categories you want to keep an eye on. You can add more later.</AppText>
              <View style={s.chipGrid}>
                {categories.map((category) => {
                  const active = picked.includes(category.id);
                  return (
                    <PressableScale
                      key={category.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={category.fullLabel}
                      accessibilityState={{ checked: active }}
                      selected={active}
                      scaleTo={0.92}
                      onPress={() => togglePick(category.id)}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <AppIcon name={category.icon} size={20} color={active ? colors.surface : colors.deepForest} />
                      <AppText variant="bodyMedium" style={active ? s.chipTextActive : undefined}>{category.fullLabel}</AppText>
                    </PressableScale>
                  );
                })}
              </View>
              <PrimaryButton title={picked.length ? `Continue with ${picked.length}` : 'Pick at least one'} disabled={!picked.length} onPress={() => goTo(2)} />
            </>
          ) : step === 2 ? (
            <>
              <AppText variant="title">How much for each?</AppText>
              <AppText style={s.muted}>Your limit per {period.toLowerCase()} for each category. Leave one blank to skip it.</AppText>
              <Card style={s.list}>
                {chosen.map((category, index) => (
                  <FadeSlideIn key={category.id} index={index} style={index > 0 ? [s.row, s.rowDivider] : s.row}>
                    <View style={s.rowIcon}><AppIcon name={category.icon} size={22} color={colors.deepForest} /></View>
                    <AppText variant="bodyMedium" style={s.flex} numberOfLines={1}>{category.fullLabel}</AppText>
                    <View style={s.inputWrap}>
                      <AppText style={s.muted}>₱</AppText>
                      <TextInput
                        accessibilityLabel={`${category.fullLabel} limit per ${period.toLowerCase()}`}
                        value={amounts[category.id] ?? ''}
                        onChangeText={(text) => setAmounts((current) => ({ ...current, [category.id]: text.replace(/[^\d.]/g, '') }))}
                        keyboardType="decimal-pad"
                        placeholder="Amount"
                        placeholderTextColor={colors.muted}
                        style={s.input}
                      />
                    </View>
                  </FadeSlideIn>
                ))}
              </Card>
              <Card style={s.totalCard}>
                <View style={s.totalRow}>
                  <AppText variant="bodyMedium">Total per {period.toLowerCase()}</AppText>
                  <AppText variant="h2">{formatPeso(totalCents)}</AppText>
                </View>
                {period === 'Week' && totalCents > 0 ? (
                  <AppText variant="small" style={s.muted}>Tracked as about {formatPeso(toMonthlyCents(totalCents, 'Week'))} a month.</AppText>
                ) : null}
              </Card>
              {error ? <AppText variant="small" style={s.error}>{error}</AppText> : null}
              <PrimaryButton title="Save budget" icon="check" loading={saving} loadingTitle="Saving…" onPress={save} />
            </>
          ) : (
            <>
              <Image source={assets.mascotSuccess} contentFit="contain" style={s.heroMascot} />
              <AppText variant="title" style={s.center}>Your budget is set!</AppText>
              <AppText style={[s.center, s.muted]}>
                Got something you&apos;re saving for? A goal shows how every peso you don&apos;t spend moves you closer to it.
              </AppText>
              <View style={s.actions}>
                <PrimaryButton title="Set a savings goal" icon="flag-checkered" onPress={() => router.replace({ pathname: '/goals', params: { new: '1' } } as never)} />
                <SecondaryButton title="Maybe later" onPress={() => router.replace('/home')} />
              </View>
            </>
          )}
        </SlideSwap>
      </View>
    </Screen>
  );
}

function StepProgress({ value }: { value: number }) {
  const s = useStyles();
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.value = withTiming(value, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={s.progressTrack}><Animated.View style={[s.progressFill, fillStyle]} /></View>;
}

const useStyles = makeStyles((colors) => ({
  page: { paddingTop: spacing.lg, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  muted: { color: colors.muted },
  error: { color: colors.danger },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoMark: { width: 40, height: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  progressWrap: { flex: 1, gap: 6 },
  progressTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.pale, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.success },
  laterButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.pale },
  laterText: { color: colors.deepForest },
  stepBody: { gap: spacing.lg },
  heroMascot: { width: 150, height: 150, alignSelf: 'center' },
  choiceList: { gap: spacing.md },
  periodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  periodCardActive: { borderColor: colors.deepForest, backgroundColor: colors.pale },
  periodIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  periodIconActive: { backgroundColor: colors.deepForest },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.deepForest, backgroundColor: colors.deepForest },
  chipTextActive: { color: colors.surface },
  list: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 124, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  input: { flex: 1, minWidth: 0, paddingVertical: 8, color: colors.text, fontFamily: 'JakartaMedium', fontSize: 15, textAlign: 'right' },
  totalCard: { gap: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
}));
