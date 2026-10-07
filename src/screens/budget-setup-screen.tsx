import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, Card, PrimaryButton, SecondaryButton } from '@/components/common/ui';
import { assets, radii, spacing } from '@/constants/theme';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { parseBudgetAmount } from '@/features/budget/validation';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { todayLocalDate } from '@/features/expenses/validation';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { formatPeso } from '@/lib/format';
import { selectionFeedback } from '@/lib/haptics';

type Period = 'Week' | 'Month';

/** Budgets are stored per month, so a weekly amount is scaled to the month. */
const WEEKS_PER_MONTH = 52 / 12;
const toMonthlyCents = (cents: number, period: Period) => period === 'Week' ? Math.round(cents * WEEKS_PER_MONTH) : cents;

/**
 * First-run setup shown right after sign-up: a spending limit per category,
 * then an optional savings goal. Both steps can be skipped; Home keeps
 * prompting until a budget exists.
 */
export function BudgetSetupScreen() {
  const colors = useColors();
  const s = useStyles();
  const { showToast } = useToast();
  const { categories } = useCategories();
  const { saveCategoryBudget } = useBudgets();
  const [step, setStep] = useState<'budget' | 'goal'>('budget');
  const [period, setPeriod] = useState<Period>('Month');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = categories
    .map((category) => ({ category, raw: (amounts[category.id] ?? '').trim() }))
    .filter((entry) => entry.raw.length > 0);
  const parsed = entries.map((entry) => ({ ...entry, cents: parseBudgetAmount(entry.raw) }));
  const totalCents = parsed.reduce((sum, entry) => sum + (entry.cents ?? 0), 0);

  const save = async () => {
    Keyboard.dismiss();
    if (!parsed.length) { setError('Enter a limit for at least one category.'); return; }
    const invalid = parsed.find((entry) => !entry.cents);
    if (invalid) { setError(`Enter a valid amount for ${invalid.category.fullLabel}.`); return; }
    setError(null);
    setSaving(true);
    const month = todayLocalDate().slice(0, 7);
    // Sequential: the first save creates the month row the others reuse.
    for (const entry of parsed) {
      const result = await saveCategoryBudget(month, entry.category.id, toMonthlyCents(entry.cents!, period));
      if (!result.ok) { setSaving(false); showToast(result.message, { tone: 'warning' }); return; }
    }
    setSaving(false);
    selectionFeedback();
    showToast('Budget saved.');
    setStep('goal');
  };

  if (step === 'goal') {
    return (
      <Screen variant={8} bottomInset={48}>
        <View style={s.page}>
          <FadeSlideIn index={0}>
            <Image source={assets.mascotSuccess} contentFit="contain" style={s.mascot} />
            <AppText variant="title" style={s.center}>Got something you&apos;re saving for?</AppText>
            <AppText style={[s.center, s.muted]}>
              A goal shows how every peso you don&apos;t spend moves you closer to what you want.
            </AppText>
          </FadeSlideIn>
          <FadeSlideIn index={1}>
            <View style={s.actions}>
              <PrimaryButton title="Set a savings goal" icon="flag-checkered" onPress={() => router.replace({ pathname: '/goals', params: { new: '1' } } as never)} />
              <SecondaryButton title="Maybe later" onPress={() => router.replace('/home')} />
            </View>
          </FadeSlideIn>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant={8} bottomInset={48}>
      <View style={s.page}>
        <FadeSlideIn index={0}>
          <AppText variant="title">Set your budget</AppText>
          <AppText style={s.muted}>
            How much can you spend on each category? Fill in the ones you use. You can change these anytime.
          </AppText>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <View style={s.toggle} accessibilityRole="tablist">
            {(['Week', 'Month'] as const).map((option) => (
              <PressableScale
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === option }}
                onPress={() => { selectionFeedback(); setPeriod(option); }}
                style={[s.toggleOption, period === option && s.toggleActive]}
              >
                <AppText variant="bodyMedium" style={period === option ? s.toggleActiveText : s.muted}>Per {option.toLowerCase()}</AppText>
              </PressableScale>
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Card style={s.list}>
            {categories.map((category, index) => (
              <View key={category.id} style={[s.row, index > 0 && s.rowDivider]}>
                <View style={s.icon}><AppIcon name={category.icon} size={22} color={colors.deepForest} /></View>
                <AppText variant="bodyMedium" style={s.rowLabel} numberOfLines={1}>{category.fullLabel}</AppText>
                <View style={s.inputWrap}>
                  <AppText style={s.muted}>₱</AppText>
                  <TextInput
                    accessibilityLabel={`${category.fullLabel} limit per ${period.toLowerCase()}`}
                    value={amounts[category.id] ?? ''}
                    onChangeText={(text) => setAmounts((current) => ({ ...current, [category.id]: text.replace(/[^\d.]/g, '') }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    style={s.input}
                  />
                </View>
              </View>
            ))}
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={3}>
          <View style={s.totalRow}>
            <AppText variant="bodyMedium">Total per {period.toLowerCase()}</AppText>
            <AppText variant="h2">{formatPeso(totalCents)}</AppText>
          </View>
          {period === 'Week' && totalCents > 0 ? (
            <AppText variant="small" style={s.muted}>Saved as about {formatPeso(toMonthlyCents(totalCents, 'Week'))} for the month.</AppText>
          ) : null}
          {error ? <AppText variant="small" style={s.error}>{error}</AppText> : null}
          <View style={s.actions}>
            <PrimaryButton title="Save budget" loading={saving} loadingTitle="Saving…" onPress={save} />
            <SecondaryButton title="Set later" disabled={saving} onPress={() => router.replace('/home')} />
          </View>
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { paddingTop: spacing.xl, gap: spacing.lg },
  center: { textAlign: 'center' },
  muted: { color: colors.muted },
  error: { color: colors.danger, marginTop: spacing.sm },
  mascot: { width: 180, height: 180, alignSelf: 'center', marginTop: spacing.xxl, marginBottom: spacing.lg },
  toggle: { flexDirection: 'row', backgroundColor: colors.pale, borderRadius: radii.pill, padding: 4 },
  toggleOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.pill },
  toggleActive: { backgroundColor: colors.deepForest },
  toggleActiveText: { color: colors.cream },
  list: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, minWidth: 0 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 112, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  input: { flex: 1, minWidth: 0, paddingVertical: 8, color: colors.text, fontFamily: 'JakartaMedium', fontSize: 15, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
}));
