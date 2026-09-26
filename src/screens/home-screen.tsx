import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  LinearTransition,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { FadeSlideIn, PressableScale, useDrift } from '@/components/common/motion';
import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { Screen } from '@/components/common/screen';
import { AppIcon, AppText, Card, ProgressBar } from '@/components/common/ui';
import { useBottomNavInset } from '@/components/navigation/bottom-navigation';
import { assets, colors, radii, shadow, spacing } from '@/constants/theme';
import { analyticsForMonth, mascotInsight, previousMonth } from '@/features/analytics/analytics';
import {
  dashboardPeriods,
  MAX_DASHBOARD_CATEGORIES,
  periodRange,
  type DashboardCategory,
  type DashboardPeriod,
} from '@/features/dashboard/dashboard-data';
import { useDashboardCategories } from '@/features/dashboard/DashboardCategoriesProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useToast } from '@/components/common/toast';
import { selectionFeedback, warningFeedback } from '@/lib/haptics';
import { formatPeso, percentOf } from '@/lib/format';
import { budgetUsage } from '@/features/budget/types';
import { useFinance } from '@/features/finance/FinanceProvider';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { answerBudgetQuestion, type BudgetAssistantMemory } from '@/features/assistant/offline-budget-assistant';
import { consumeSkippedPanelRefresh } from '@/lib/panel-refresh';

const GRID_GAP = 10;
/** Vertical rhythm between the page's stacked sections. */
const PAGE_GAP = 18;

/**
 * Mascot_Tip.png is drawn as a "peeking" character: measured from the asset's
 * alpha bounds, its artwork stops 14.7% above the bottom of its square canvas.
 * contentFit="contain" preserves that transparent strip, so the summary card
 * can rise this far into the mascot's frame before it touches any pixels — which
 * is what lets the two elements overlap without the card ever clipping the
 * mascot's face, chin or lightbulb.
 */
const MASCOT_ART_BOTTOM_INSET = 0.147;

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function resolveFirstName(user: ReturnType<typeof useAuth>['user']) {
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];

  const email = user?.email;
  if (email) {
    const local = email.split('@')[0].split('+')[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return 'there';
}

/** Peso amounts from integer cents, matching the rest of the app. */
function formatCents(cents: number) {
  return formatPeso(cents);
}

/**
 * Grid index a tile would land on for a given drag offset. Runs on the UI
 * thread during the gesture so the drop indicator can update every frame, and
 * the same result is what gets committed on release — one source of truth for
 * where the tile goes.
 */
function targetIndexFor(
  from: number,
  translationX: number,
  translationY: number,
  step: number,
  columns: number,
  count: number,
) {
  'worklet';
  const columnDelta = Math.round(translationX / step);
  const rowDelta = Math.round(translationY / step);
  const to = from + columnDelta + rowDelta * columns;
  return Math.max(0, Math.min(count - 1, to));
}

function SparkBar({
  ratio,
  grow,
  index,
  active,
}: {
  ratio: number;
  grow: SharedValue<number>;
  index: number;
  active: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const staged = Math.max(0, Math.min(1, grow.value * 6 - index));
    return { height: 12 + staged * ratio * 56 };
  });

  return (
    <Animated.View
      style={[
        styles.sparkBar,
        { backgroundColor: active ? colors.softGreen : '#CAD7C3' },
        style,
      ]}
    />
  );
}

function SparkBars({ bars }: { bars: number[] }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    grow.value = reduced
      ? 1
      : withDelay(260, withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
  }, [grow, reduced]);

  return (
    <View style={styles.sparkRow} pointerEvents="none">
      {bars.map((ratio, index) => (
        <SparkBar
          key={`${ratio}-${index}`}
          ratio={ratio}
          grow={grow}
          index={index}
          active={index === bars.length - 2}
        />
      ))}
    </View>
  );
}

function MetricTile({
  icon,
  value,
  label,
  index,
  width,
  onPress,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  value: string;
  label: string;
  index: number;
  width: number;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <FadeSlideIn index={index} style={[styles.metricWrap, { width }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[styles.metric, hovered && styles.metricHovered]}
      >
        <View style={styles.metricBadge}>
          <AppIcon name={icon} size={19} color={colors.deepForest} />
        </View>
        <AppText variant="h2" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        <AppText style={styles.metricLabel} numberOfLines={2}>
          {label}
        </AppText>
      </PressableScale>
    </FadeSlideIn>
  );
}

function CategoryTile({
  category,
  index,
  size,
  step,
  columns,
  count,
  editing,
  dragging,
  dropTarget,
  dimmed,
  removable,
  onEnterEdit,
  onOpen,
  onRemove,
  onDragMove,
  onDragCancel,
  onDrop,
}: {
  category: DashboardCategory;
  index: number;
  size: number;
  step: number;
  columns: number;
  count: number;
  editing: boolean;
  dragging: boolean;
  dropTarget: boolean;
  dimmed: boolean;
  removable: boolean;
  onEnterEdit: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onDragMove: (target: number) => void;
  onDragCancel: () => void;
  onDrop: (id: string, target: number) => void;
}) {
  const reduced = useReducedMotion();
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const lastTarget = useSharedValue(index);
  const [hovered, setHovered] = useState(false);

  const dragStyle = useAnimatedStyle(() => ({
    zIndex: lift.value > 0 ? 20 : 0,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      // Lifted, not launched: enough scale to read as picked up, no rotation.
      { scale: 1 + lift.value * (reduced ? 0 : 0.03) },
    ],
  }));

  const pan = Gesture.Pan()
    .enabled(editing)
    .minDistance(3)
    .onBegin(() => {
      // Reanimated shared values are mutable UI-thread stores.
      // eslint-disable-next-line react-hooks/immutability
      lift.value = withTiming(1, { duration: 110 });
      lastTarget.value = index;
    })
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability
      dragX.value = event.translationX;
      // eslint-disable-next-line react-hooks/immutability
      dragY.value = event.translationY;

      const next = targetIndexFor(index, event.translationX, event.translationY, step, columns, count);
      // Only cross the bridge to JS when the landing slot actually changes.
      if (next !== lastTarget.value) {
        lastTarget.value = next;
        runOnJS(onDragMove)(next);
      }
    })
    .onFinalize((event) => {
      if (Math.abs(event.translationX) + Math.abs(event.translationY) > 8) {
        runOnJS(onDrop)(category.id, lastTarget.value);
      } else {
        runOnJS(onDragCancel)();
      }
      // eslint-disable-next-line react-hooks/immutability
      dragX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      // eslint-disable-next-line react-hooks/immutability
      dragY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      // eslint-disable-next-line react-hooks/immutability
      lift.value = withTiming(0, { duration: 160 });
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        layout={LinearTransition.duration(180)}
        style={[{ width: size, height: size }, dragStyle]}
      >
        {/*
          Plain View, deliberately not pressable. The remove control is a
          SIBLING of the open target rather than a child, because react-native-web
          renders accessibilityRole="button" as a real <button> element and a
          button nested inside a button is invalid DOM.
        */}
        <View style={styles.tileFrame}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={category.fullLabel}
            accessibilityHint={
              editing
                ? 'Drag onto another category to swap their places'
                : 'Opens this category. Long press to customize the grid.'
            }
            onPress={editing ? undefined : onOpen}
            onLongPress={onEnterEdit}
            delayLongPress={360}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            style={[
              styles.categoryTile,
              hovered && !editing && styles.categoryTileHovered,
              editing && styles.categoryTileEditing,
              dimmed && styles.categoryTileDimmed,
              dropTarget && styles.categoryTileDropTarget,
              dragging && styles.categoryTileDragging,
            ]}
          >
            {editing ? (
              <View style={styles.dragHandle} pointerEvents="none">
                <AppIcon name="drag-horizontal-variant" size={15} color={colors.softGreen} />
              </View>
            ) : null}

            <AppIcon name={category.icon} size={30} color={colors.deepForest} />
            <AppText style={styles.categoryLabel} numberOfLines={1} adjustsFontSizeToFit>
              {category.label}
            </AppText>
          </PressableScale>

          {editing && removable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${category.fullLabel} from your dashboard`}
              hitSlop={8}
              onPress={onRemove}
              style={({ pressed }) => [styles.removeCategory, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="close" size={13} color={colors.surface} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function HomeScreen() {
  const { user } = useAuth();
  const { expenses, loading: expensesLoading, loadError, refresh: refreshExpenses } = useExpenses();
  const { budgets, loading: budgetsLoading, refresh: refreshBudgets } = useBudgets();
  const { incomeEntries, loading: financeLoading, refresh: refreshFinance } = useFinance();
  const { allCategories } = useCategories();
  const { displayName: profileName } = useProfile();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomNavInset();
  const [period, setPeriod] = useState<DashboardPeriod>('Month');
  // 0 is the current week/month/year; each arrow tap moves one period.
  const [offset, setOffset] = useState(0);
  const {
    categories,
    isFull: atCategoryLimit,
    canRemove: canRemoveCategory,
    addCategory: addDashboardCategory,
    removeCategory,
    swapCategories,
  } = useDashboardCategories();
  const { showToast } = useToast();
  const [editingCategories, setEditingCategories] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [insightIndex, setInsightIndex] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMemory, setAssistantMemory] = useState<BudgetAssistantMemory>({});
  const [assistantMessages, setAssistantMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Ask me about your spending or budget. I work locally using the data already in ExpenSense.' },
  ]);
  const [drag, setDrag] = useState<{ id: string; target: number } | null>(null);

  // Reads the shared profile cache so editing the name in Settings updates the
  // greeting immediately, with the auth metadata as the fallback.
  const firstName = profileName.trim() ? profileName.trim().split(/\s+/)[0] : resolveFirstName(user);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const range = useMemo(() => periodRange(period, offset), [offset, period]);
  // Insights and the assistant speak in months, so they follow the month the
  // selected period ends in.
  const selectedMonthId = range.month;
  const savedBudget = budgets.find((item) => item.month === selectedMonthId);
  const inRange = useCallback((date: string) => date >= range.start && date <= range.end, [range.end, range.start]);
  const periodExpenses = useMemo(() => expenses.filter((expense) => inRange(expense.transactionDate)), [expenses, inRange]);
  const periodIncomeCents = useMemo(
    () => incomeEntries.filter((entry) => entry.kind === 'income' && inRange(entry.transactionDate)).reduce((sum, entry) => sum + entry.amountCents, 0),
    [inRange, incomeEntries],
  );
  const spentCents = periodExpenses.reduce((total, expense) => total + expense.amountCents, 0);
  const bars = useMemo(() => {
    const totals = range.buckets.map(([from, to]) => periodExpenses
      .filter((expense) => expense.transactionDate >= from && expense.transactionDate <= to)
      .reduce((sum, expense) => sum + expense.amountCents, 0));
    const largest = Math.max(...totals, 0);
    return largest === 0 ? totals : totals.map((total) => Math.max(0.12, total / largest));
  }, [periodExpenses, range.buckets]);
  // Budgets are monthly category limits. A month uses its own; a year adds up
  // each of its months; a week has no budget of its own.
  const budget = useMemo(() => {
    if (period === 'Week') return null;
    const months = period === 'Month' ? [range.month] : Array.from({ length: 12 }, (_, index) => `${range.start.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`);
    return months.reduce((total, monthId) => {
      const usage = budgetUsage(budgets.find((item) => item.month === monthId), periodExpenses.filter((expense) => expense.transactionDate.startsWith(monthId)));
      return { limitCents: total.limitCents + usage.limitCents, spentCents: total.spentCents + usage.spentCents };
    }, { limitCents: 0, spentCents: 0 });
  }, [budgets, period, periodExpenses, range.month, range.start]);
  const hasBudget = Boolean(budget && budget.limitCents > 0);
  const usage = budget && hasBudget ? percentOf(budget.spentCents, budget.limitCents) ?? 0 : 0;
  const remainingCents = budget ? budget.limitCents - budget.spentCents : 0;
  const budgetCaption = budgetsLoading
    ? 'Checking budget…'
    : period === 'Week'
      ? 'Category budgets are tracked monthly'
      : hasBudget && budget
        ? `${formatCents(budget.spentCents)} of ${formatCents(budget.limitCents)} budgeted`
        : 'No category budgets set';
  // Shares the Phase 7 analytics pipeline with the Insights screen, so the
  // mascot can never contradict what Analytics reports.
  const insights = useMemo(() => {
    if (expensesLoading || budgetsLoading) return ['Checking your latest spending...'];
    // The full library, not the dashboard's eight — an expense in a category
    // that isn't pinned to the grid still has a real name.
    const current = analyticsForMonth(expenses, allCategories, selectedMonthId);
    const prior = analyticsForMonth(expenses, allCategories, previousMonth(selectedMonthId));
    const primary = mascotInsight(current, prior, allCategories, savedBudget);
    const messages = [primary];
    if (current.expenses.length) {
      messages.push(`You recorded ${current.expenses.length} expense${current.expenses.length === 1 ? '' : 's'} this month.`);
      const top = current.categorySlices[0];
      if (top) messages.push(`${top.label} is ${Math.round(top.percentage)}% of your spending this month.`);
      if (prior.totalCents > 0) {
        const change = Math.round(((current.totalCents - prior.totalCents) / prior.totalCents) * 100);
        messages.push(change === 0 ? 'Your spending matches last month so far.' : `Your spending is ${Math.abs(change)}% ${change > 0 ? 'higher' : 'lower'} than last month.`);
      }
    }
    return [...new Set(messages)];
  }, [allCategories, budgetsLoading, expenses, expensesLoading, savedBudget, selectedMonthId]);
  const insight = insights[insightIndex % insights.length];
  const assistantContext = useMemo(() => ({
    current: analyticsForMonth(expenses, allCategories, selectedMonthId),
    previous: analyticsForMonth(expenses, allCategories, previousMonth(selectedMonthId)),
    categories: allCategories,
    budget: savedBudget,
  }), [allCategories, expenses, savedBudget, selectedMonthId]);
  const askAssistant = (suggestion?: string) => {
    const question = (suggestion ?? assistantInput).trim();
    if (!question) return;
    const answer = answerBudgetQuestion(question, assistantContext, assistantMemory);
    setAssistantMemory(answer.memory);
    setAssistantMessages((current) => [...current, { role: 'user', text: question }, { role: 'assistant', text: answer.text }]);
    setAssistantInput('');
  };
  const mascotDrift = useDrift({ x: 8, y: 10, rotate: 1.5, scale: 0.018, duration: 7200 });

  useFocusEffect(useCallback(() => {
    if (consumeSkippedPanelRefresh('/home')) return;
    void refreshExpenses();
    void refreshBudgets();
    void refreshFinance();
  }, [refreshBudgets, refreshExpenses, refreshFinance]));

  const contentWidth = Math.min(width, 480);
  const compact = contentWidth < 360;
  const dashboardWidth = Math.max(0, contentWidth - 36);
  const columns = compact ? 3 : 4;
  const metricWidth = (dashboardWidth - 20) / 3;
  const gridWidth = dashboardWidth;
  const tileSize = gridWidth > 0 ? (gridWidth - GRID_GAP * (columns - 1)) / columns : 0;

  // The hero reserves real height for the insight row rather than letting the
  // mascot float free, so the summary card can never land on top of it.
  const mascotSize = Math.round(Math.min(Math.max(contentWidth * 0.34, 112), 150));
  const mascotClearance = Math.round(mascotSize * MASCOT_ART_BOTTOM_INSET);
  // Small, deliberate overlap. Capped at the mascot's transparent bottom strip
  // so the card tucks under the frame without covering a single drawn pixel.
  const summaryOverlap = Math.min(compact ? 12 : 18, mascotClearance);

  const handleDragMove = useCallback((id: string, target: number) => {
    setDrag({ id, target });
  }, []);

  const handleDragCancel = useCallback(() => setDrag(null), []);

  const commitReorder = useCallback(
    (id: string, target: number) => {
      setDrag(null);
      swapCategories(id, target);
    },
    [swapCategories],
  );

  const availableCategories = allCategories.filter(
    (candidate) => !categories.some((selected) => selected.id === candidate.id) && !candidate.archived,
  );

  const chooseCategory = (category: DashboardCategory) => {
    if (!addDashboardCategory(category.id)) {
      warningFeedback();
      showToast('That category is already included or the dashboard is full.', { tone: 'warning' });
      return;
    }
    setCategoryPickerOpen(false);
    setEditingCategories(true);
    showToast(`${category.fullLabel} added to your dashboard.`);
  };

  const gridHint = editingCategories
    ? atCategoryLimit
      ? `Showing the maximum of ${MAX_DASHBOARD_CATEGORIES}. Remove one to add another from Categories.`
      : 'Drag onto another tile to swap - tap x to remove'
    : 'Hold a category to customize this grid';

  return (
    <Screen embedded bottomInset={bottomInset} background={false} padded={false}>
      <View style={[styles.page, { width: dashboardWidth }]}>
        <FadeSlideIn index={0}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <AppText style={styles.greeting}>{greeting}</AppText>
                <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit style={styles.heroName}>
                  {firstName}!
                </AppText>
                <AppText variant="subtitle" style={styles.heroSubtitle}>
                  A clearer view of your spending.
                </AppText>
              </View>
            </View>

            {/*
              Bounded insight region: its height is the mascot's, so the hero
              always reserves the space the mascot occupies. The bubble takes
              the remaining width, which keeps it clear of the greeting above.
            */}
            <View style={[styles.insightArea, { height: mascotSize }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${insight} Open offline budget assistant.`}
                onPress={() => setAssistantOpen(true)}
                style={({ pressed }) => [styles.insightBubble, pressed && { opacity: 0.82 }]}
              >
                <AppText style={styles.insightText}>{insight}</AppText>
                <View style={styles.bubbleTail} />
              </Pressable>

              <Animated.View
                style={[styles.mascotWrap, { width: mascotSize, height: mascotSize }, mascotDrift]}
                pointerEvents="none"
              >
                <Image source={assets.mascotTip} contentFit="contain" style={styles.heroMascot} />
              </Animated.View>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn
          index={1}
          style={[
            styles.summaryWrap,
            // Cancels the page gap, then rises the overlap distance into the
            // mascot's transparent lower frame.
            { width: dashboardWidth, marginTop: -(PAGE_GAP + summaryOverlap) },
          ]}
        >
          <Card style={[styles.summaryCard, { width: dashboardWidth }]}>
            <View style={styles.periodSegments} accessibilityRole="tablist">
              {dashboardPeriods.map((option) => {
                const active = option === period;
                return (
                  <PressableScale
                    key={option}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => { if (!active) { selectionFeedback(); setPeriod(option); setOffset(0); } }}
                    style={[styles.periodSegment, active && styles.periodSegmentActive]}
                  >
                    <AppText style={[styles.periodText, active && styles.periodTextActive]}>{option}</AppText>
                  </PressableScale>
                );
              })}
            </View>

            <View style={styles.selectorBar}>
              <PressableScale accessibilityRole="button" accessibilityLabel={`Previous ${period.toLowerCase()}`} hitSlop={6} onPress={() => { selectionFeedback(); setOffset((value) => value - 1); }} style={styles.arrowButton}>
                <AppIcon name="chevron-left" size={22} color={colors.deepForest} />
              </PressableScale>
              <AppText
                variant="h2"
                numberOfLines={1}
                adjustsFontSizeToFit
                accessibilityLabel={`Showing ${range.label}`}
                style={[styles.monthText, { fontSize: compact ? 17 : 20 }]}
              >
                {range.label}
              </AppText>
              <PressableScale accessibilityRole="button" accessibilityLabel={`Next ${period.toLowerCase()}`} accessibilityState={{ disabled: offset >= 0 }} disabled={offset >= 0} hitSlop={6} onPress={() => { selectionFeedback(); setOffset((value) => Math.min(0, value + 1)); }} style={[styles.arrowButton, offset >= 0 && styles.arrowButtonDisabled]}>
                <AppIcon name="chevron-right" size={22} color={offset >= 0 ? colors.muted : colors.deepForest} />
              </PressableScale>
            </View>

            <AppText variant="subtitle" style={styles.summaryLabel}>Total Spent</AppText>

            <View style={styles.totalRow}>
              <View style={styles.totalCopy}>
                <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit style={styles.totalAmount}>
                  {expensesLoading ? '—' : formatCents(spentCents)}
                </AppText>
                <AppText variant="subtitle" style={styles.summaryMuted}>{budgetCaption}</AppText>
              </View>
              <SparkBars key={`${period}-${offset}`} bars={bars} />
            </View>

            {hasBudget ? (
              <View style={styles.progressRow}>
                <ProgressBar value={Math.min(100, usage)} height={14} />
                <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={[styles.usageText, usage > 100 && { color: colors.danger }]}>
                  {usage > 100 ? `Over by ${formatCents(Math.abs(remainingCents))}` : `${usage}% used`}
                </AppText>
              </View>
            ) : null}
            {loadError ? <AppText variant="small" style={styles.dataError}>Expense data could not be refreshed.</AppText> : null}
          </Card>
        </FadeSlideIn>

        <View style={styles.metricRow}>
          <MetricTile
            icon="cash-plus"
            value={financeLoading && !incomeEntries.length ? '—' : formatCents(periodIncomeCents)}
            label="Income"
            index={2}
            width={metricWidth}
            onPress={() => router.push('/transactions')}
          />
          <MetricTile
            icon="wallet"
            value={expensesLoading || budgetsLoading ? '—' : hasBudget ? formatCents(Math.abs(remainingCents)) : 'Not set'}
            label={hasBudget && remainingCents < 0 ? 'Over budget' : 'Budget left'}
            index={3}
            width={metricWidth}
            onPress={() => router.push('/wallet')}
          />
          <MetricTile
            icon="chart-bar"
            value={expensesLoading ? '—' : String(periodExpenses.length)}
            label="Expenses"
            index={4}
            width={metricWidth}
            onPress={() => router.push('/transactions')}
          />
        </View>

        <FadeSlideIn index={5}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionTitleRow}>
              <AppText variant="h2" style={styles.sectionTitle}>
                Your Budget Categories
              </AppText>
              {editingCategories ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Finish editing categories"
                  onPress={() => {
                    setEditingCategories(false);
                    setDrag(null);
                  }}
                  style={styles.doneButton}
                >
                  <AppText variant="small" style={styles.doneText}>Done</AppText>
                </PressableScale>
              ) : (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="See all categories"
                  hitSlop={8}
                  onPress={() => router.push('/categories')}
                  style={styles.seeAll}
                >
                  <AppText variant="bodyMedium" style={styles.seeAllText}>See all</AppText>
                  <AppIcon name="arrow-right" size={20} color={colors.deepForest} />
                </PressableScale>
              )}
            </View>

            <AppText variant="small" style={styles.editHint}>
              {gridHint}
            </AppText>
          </View>
        </FadeSlideIn>

        <View style={[styles.categoryGrid, { width: dashboardWidth }]}>
          {tileSize > 0
            ? categories.map((category, index) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  index={index}
                  size={tileSize}
                  step={tileSize + GRID_GAP}
                  columns={columns}
                  count={categories.length}
                  editing={editingCategories}
                  dragging={drag?.id === category.id}
                  dropTarget={drag !== null && drag.id !== category.id && drag.target === index}
                  dimmed={drag !== null && drag.id !== category.id}
                  removable={canRemoveCategory}
                  onEnterEdit={() => setEditingCategories(true)}
                  onOpen={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
                  onRemove={() => removeCategory(category.id)}
                  onDragMove={(target) => handleDragMove(category.id, target)}
                  onDragCancel={handleDragCancel}
                  onDrop={commitReorder}
                />
              ))
            : null}

          {/*
            At the limit the grid simply ends after the last category — no
            placeholder, no disabled tile. Adding beyond the limit happens from
            the Categories screen, which explains the rule when it's hit.
          */}
          {tileSize > 0 && !atCategoryLimit ? (
            <Animated.View
              layout={LinearTransition.duration(180)}
              style={{ width: tileSize, height: tileSize }}
            >
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Add a budget category"
                onPress={() => setCategoryPickerOpen(true)}
                style={styles.addTile}
              >
                <AppIcon name="plus" size={34} color={colors.deepForest} />
                <AppText style={styles.categoryLabel} numberOfLines={1} adjustsFontSizeToFit>
                  Add Existing
                </AppText>
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>
      </View>
      <DraggableBottomSheet visible={categoryPickerOpen} onClose={() => setCategoryPickerOpen(false)}>{(dismiss) => <>
        <View style={styles.pickerHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">Add Existing Category</AppText>
            <AppText variant="small" style={styles.editHint}>Choose what appears on your dashboard. Existing choices are hidden.</AppText>
          </View>
          <PressableScale accessibilityLabel="Close category picker" onPress={dismiss} style={styles.pickerClose}>
            <AppIcon name="close" size={20} />
          </PressableScale>
        </View>
        <View style={styles.pickerListContent}>
          {availableCategories.length ? availableCategories.map((category) => (
            <PressableScale key={category.id} accessibilityRole="button" accessibilityLabel={`Add ${category.fullLabel}`} onPress={() => chooseCategory(category)} style={styles.pickerCategory}>
              <View style={[styles.pickerCategoryIcon, { backgroundColor: category.color ? `${category.color}22` : colors.pale }]}>
                <AppIcon name={category.icon} color={category.color ?? colors.deepForest} />
              </View>
              <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{category.fullLabel}</AppText>
              <AppIcon name="plus" color={colors.deepForest} />
            </PressableScale>
          )) : <AppText style={styles.editHint}>Every available category is already included.</AppText>}
        </View>
      </>}</DraggableBottomSheet>
      <DraggableBottomSheet visible={assistantOpen} onClose={() => setAssistantOpen(false)}>
        <View style={styles.assistantHeader}>
          <View style={{ flex: 1 }}><AppText variant="h2">Ask ExpenSense</AppText><AppText variant="small" style={styles.assistantOffline}>Offline · selected month context</AppText></View>
          <PressableScale accessibilityLabel="Show another quick insight" onPress={() => setInsightIndex((current) => current + 1)} style={styles.assistantRefresh}><AppIcon name="refresh" size={20} /></PressableScale>
        </View>
        <ScrollView style={styles.assistantMessages} contentContainerStyle={styles.assistantMessagesContent} keyboardShouldPersistTaps="handled">
          {assistantMessages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.assistantMessage, message.role === 'user' ? styles.assistantUser : styles.assistantReply]}><AppText style={message.role === 'user' ? styles.assistantUserText : undefined}>{message.text}</AppText></View>)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assistantSuggestions}>
          {['How much is left?', 'Top category?', 'Compare last month', 'How can I save?'].map((prompt) => <PressableScale key={prompt} onPress={() => askAssistant(prompt)} style={styles.assistantSuggestion}><AppText variant="small" style={styles.assistantSuggestionText}>{prompt}</AppText></PressableScale>)}
        </ScrollView>
        <View style={styles.assistantComposer}>
          <TextInput accessibilityLabel="Ask about your budget" value={assistantInput} onChangeText={setAssistantInput} onSubmitEditing={() => askAssistant()} returnKeyType="send" placeholder="Ask about your spending…" placeholderTextColor={colors.muted} style={styles.assistantInput} />
          <PressableScale accessibilityRole="button" accessibilityLabel="Send question" onPress={() => askAssistant()} style={styles.assistantSend}><AppIcon name="arrow-up" color={colors.surface} /></PressableScale>
        </View>
      </DraggableBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    alignSelf: 'center',
    maxWidth: 480,
    paddingTop: 4,
    paddingBottom: spacing.lg,
    gap: PAGE_GAP,
  },
  hero: {
    // Below the summary card: the overlap is the card tucking under the
    // mascot's empty lower frame, never the mascot sitting on the card.
    zIndex: 1,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 6,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
    fontFamily: 'JakartaMedium',
  },
  heroName: {
    fontSize: 36,
    lineHeight: 41,
    color: '#07140F',
  },
  heroSubtitle: {
    color: colors.muted,
    marginTop: 5,
  },
  avatar: {
    flexGrow: 0,
    flexShrink: 0,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,253,247,.96)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...shadow,
  },
  avatarText: { color: colors.deepForest },
  insightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  insightBubble: {
    boxSizing: 'border-box',
    flex: 1,
    minWidth: 0,
    marginRight: 14,
    // Lifts the bubble toward the mascot's head and lightbulb.
    marginBottom: 20,
    backgroundColor: 'rgba(255,253,247,.96)',
    borderRadius: 18,
    borderWidth: 1.4,
    borderColor: '#8EAD8D',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  insightText: {
    color: colors.text,
    fontFamily: 'JakartaMedium',
    fontSize: 12.5,
    lineHeight: 17,
  },
  // Points right, at the mascot.
  bubbleTail: {
    position: 'absolute',
    right: -7,
    top: '50%',
    marginTop: -7,
    width: 13,
    height: 13,
    backgroundColor: 'rgba(255,253,247,.96)',
    borderTopWidth: 1.4,
    borderRightWidth: 1.4,
    borderColor: '#8EAD8D',
    transform: [{ rotate: '45deg' }],
  },
  mascotWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  heroMascot: { width: '100%', height: '100%' },

  summaryWrap: {
    zIndex: 5,
  },
  summaryCard: {
    boxSizing: 'border-box',
    minHeight: 200,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 17,
    gap: 9,
    overflow: 'visible',
  },
  selectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 42,
    zIndex: 30,
  },
  // The label takes the leftover width between the arrows and shrinks first,
  // so a long week range can never push an arrow off the card.
  monthText: {
    flex: 1,
    minWidth: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  arrowButtonDisabled: { opacity: 0.45 },
  periodSegments: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.pale,
  },
  periodSegment: {
    flex: 1,
    minHeight: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegmentActive: { backgroundColor: colors.deepForest },
  periodText: {
    color: colors.text,
    fontFamily: 'JakartaMedium',
    fontSize: 12,
  },
  periodTextActive: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  summaryLabel: { color: colors.muted, marginTop: 3 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  totalCopy: { flex: 1, minWidth: 0 },
  totalAmount: {
    fontSize: 34,
    lineHeight: 40,
    color: '#06120D',
  },
  summaryMuted: { color: colors.muted, fontSize: 15 },
  sparkRow: {
    height: 72,
    minWidth: 104,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 7,
    paddingBottom: 3,
  },
  sparkBar: { width: 11, borderRadius: radii.pill },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 7,
  },
  usageText: { color: colors.deepForest, minWidth: 80, textAlign: 'right' },
  dataError: { color: colors.danger },

  metricRow: { flexDirection: 'row', gap: 10 },
  metricWrap: { flexGrow: 0, flexShrink: 0, minWidth: 0 },
  metric: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 108,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 13,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,253,247,.96)',
    ...shadow,
  },
  metricHovered: {
    backgroundColor: '#F2F6EE',
  },
  metricBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E1EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },

  sectionHeading: { gap: 5, marginTop: 2 },
  sectionTitleRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: { flex: 1, fontSize: 21, lineHeight: 27 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  seeAllText: { color: colors.deepForest },
  doneButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.deepForest,
  },
  doneText: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  editHint: { color: colors.muted },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tileFrame: {
    width: '100%',
    height: '100%',
  },
  categoryTile: {
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,253,247,.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 7,
    // Transparent in the resting state so edit mode can add a visible outline
    // without the tile changing size.
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow,
  },
  categoryTileHovered: {
    backgroundColor: '#EEF4E9',
  },
  categoryTileEditing: {
    borderColor: '#9FB79A',
  },
  categoryTileDimmed: {
    opacity: 0.92,
  },
  categoryTileDropTarget: {
    borderColor: colors.forest,
    backgroundColor: '#E6F0E1',
  },
  categoryTileDragging: {
    borderColor: colors.deepForest,
    backgroundColor: colors.surface,
    opacity: 1,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 9,
  },
  dragHandle: {
    position: 'absolute',
    top: 5,
    left: 6,
  },
  categoryLabel: {
    color: colors.text,
    fontFamily: 'JakartaMedium',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  removeCategory: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  addTile: {
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#A9BFA5',
    backgroundColor: 'rgba(255,253,247,.48)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 7,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  categoryPickerSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '72%',
    alignSelf: 'center',
    padding: 22,
    gap: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.surface,
  },
  pickerHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: '#B8B8B0',
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pickerClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  pickerList: { flexGrow: 0 },
  pickerListContent: { gap: 10, paddingBottom: 8 },
  pickerCategory: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#D8E1D3',
    backgroundColor: '#FFFDF7',
  },
  pickerCategoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assistantOffline: { color: colors.forest, marginTop: 2 },
  assistantRefresh: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  assistantMessages: { maxHeight: 330, minHeight: 180 },
  assistantMessagesContent: { gap: 10, paddingVertical: 4 },
  assistantMessage: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  assistantReply: { alignSelf: 'flex-start', backgroundColor: colors.pale, borderBottomLeftRadius: 5 },
  assistantUser: { alignSelf: 'flex-end', backgroundColor: colors.deepForest, borderBottomRightRadius: 5 },
  assistantUserText: { color: colors.surface },
  assistantComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  assistantSuggestions: { gap: 8, paddingRight: 8 },
  assistantSuggestion: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7D8C1', backgroundColor: '#F5F8F1' },
  assistantSuggestionText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  assistantInput: { flex: 1, minHeight: 50, borderRadius: 25, paddingHorizontal: 17, fontFamily: 'JakartaRegular', fontSize: 15, color: colors.text, backgroundColor: '#F0F3EC', borderWidth: 1, borderColor: colors.line },
  assistantSend: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deepForest },
});
