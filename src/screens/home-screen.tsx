import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { Screen } from '@/components/common/screen';
import { AppIcon, AppText, Card, ProgressBar } from '@/components/common/ui';
import { AppHeader } from '@/components/navigation/app-header';
import { BottomNavigation, useBottomNavInset } from '@/components/navigation/bottom-navigation';
import { assets, colors, radii, shadow, spacing } from '@/constants/theme';
import { analyticsForMonth, mascotInsight, previousMonth } from '@/features/analytics/analytics';
import {
  dashboardMonths,
  dashboardPeriods,
  MAX_DASHBOARD_CATEGORIES,
  type DashboardCategory,
  type DashboardPeriod,
} from '@/features/dashboard/dashboard-data';
import { useDashboardCategories } from '@/features/dashboard/DashboardCategoriesProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useToast } from '@/components/common/toast';
import { warningFeedback } from '@/lib/haptics';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useProfile } from '@/features/profile/ProfileProvider';

const PESO = '₱';
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

function formatMoney(value: number) {
  return `${PESO}${value.toLocaleString('en-US')}`;
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
          <AppIcon name={icon} size={23} color={colors.deepForest} />
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

function OptionMenu<T extends string>({
  options,
  selected,
  align = 'left',
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  align?: 'left' | 'right';
  onSelect: (option: T) => void;
}) {
  return (
    <View style={[styles.optionMenu, align === 'right' && styles.optionMenuRight]}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && styles.optionPressed,
            ]}
          >
            <AppText variant="small" style={active && styles.optionTextActive}>
              {option}
            </AppText>
            {active ? <AppIcon name="check" size={15} color={colors.deepForest} /> : null}
          </Pressable>
        );
      })}
    </View>
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
  const { allCategories } = useCategories();
  const { displayName: profileName } = useProfile();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomNavInset();
  const [selectedMonthId, setSelectedMonthId] = useState(dashboardMonths[0].id);
  const [period, setPeriod] = useState<DashboardPeriod>('This Month');
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const {
    categories,
    isFull: atCategoryLimit,
    canRemove: canRemoveCategory,
    addNextAvailable,
    removeCategory,
    swapCategories,
  } = useDashboardCategories();
  const { showToast } = useToast();
  const [editingCategories, setEditingCategories] = useState(false);
  const [drag, setDrag] = useState<{ id: string; target: number } | null>(null);

  // Reads the shared profile cache so editing the name in Settings updates the
  // greeting immediately, with the auth metadata as the fallback.
  const firstName = profileName.trim() ? profileName.trim().split(/\s+/)[0] : resolveFirstName(user);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const baseMonth = dashboardMonths.find((item) => item.id === selectedMonthId) ?? dashboardMonths[0];
  const savedBudget = budgets.find((item) => item.month === selectedMonthId);
  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.transactionDate.startsWith(selectedMonthId)),
    [expenses, selectedMonthId],
  );
  const realSpent = monthExpenses.reduce((total, expense) => total + expense.amountCents, 0) / 100;
  const realBars = useMemo(() => {
    const totals = Array.from({ length: 6 }, () => 0);
    monthExpenses.forEach((expense) => {
      const day = Number(expense.transactionDate.slice(8, 10));
      totals[Math.min(5, Math.floor((day - 1) / 5))] += expense.amountCents;
    });
    const largest = Math.max(...totals, 0);
    return largest === 0 ? totals : totals.map((total) => Math.max(0.12, total / largest));
  }, [monthExpenses]);
  const month = useMemo(() => ({
    ...baseMonth,
    budget: savedBudget ? savedBudget.amountCents / 100 : 0,
    spent: realSpent,
    transactions: monthExpenses.length,
    bars: realBars,
  }), [baseMonth, monthExpenses.length, realBars, realSpent, savedBudget]);
  const usage = month.budget > 0 ? Math.round((month.spent / month.budget) * 100) : 0;
  const remaining = month.budget - month.spent;
  // Shares the Phase 7 analytics pipeline with the Insights screen, so the
  // mascot can never contradict what Analytics reports.
  const insight = useMemo(() => {
    if (expensesLoading || budgetsLoading) return 'Checking your latest spending...';
    // The full library, not the dashboard's eight — an expense in a category
    // that isn't pinned to the grid still has a real name.
    const current = analyticsForMonth(expenses, allCategories, selectedMonthId);
    const prior = analyticsForMonth(expenses, allCategories, previousMonth(selectedMonthId));
    return mascotInsight(current, prior, allCategories, savedBudget);
  }, [allCategories, budgetsLoading, expenses, expensesLoading, savedBudget, selectedMonthId]);
  const mascotDrift = useDrift({ x: 8, y: 10, rotate: 1.5, scale: 0.018, duration: 7200 });

  useFocusEffect(useCallback(() => {
    void refreshExpenses();
    void refreshBudgets();
  }, [refreshBudgets, refreshExpenses]));

  const contentWidth = Math.min(width, 480);
  const compact = contentWidth < 360;
  const dashboardWidth = Math.max(0, contentWidth - 36);
  const columns = compact ? 3 : 4;
  const metricWidth = (dashboardWidth - 20) / 3;
  const gridWidth = dashboardWidth;
  const tileSize = gridWidth > 0 ? (gridWidth - GRID_GAP * (columns - 1)) / columns : 0;

  // The hero reserves real height for the insight row rather than letting the
  // mascot float free, so the summary card can never land on top of it.
  const mascotSize = Math.round(Math.min(Math.max(contentWidth * 0.4, 128), 178));
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

  const addCategory = () => {
    if (addNextAvailable()) {
      setEditingCategories(true);
      return;
    }

    // Only reachable if the selection filled up between render and press.
    warningFeedback();
    showToast(
      `Dashboard category limit reached. Remove one before adding another.`,
      { tone: 'warning' },
    );
  };

  const gridHint = editingCategories
    ? atCategoryLimit
      ? `Showing the maximum of ${MAX_DASHBOARD_CATEGORIES}. Remove one to add another from Categories.`
      : 'Drag onto another tile to swap - tap x to remove'
    : 'Hold a category to customize this grid';

  return (
    <Screen
      bottomInset={bottomInset}
      variant={4}
      padded={false}
      fixed={<BottomNavigation />}
    >
      <View style={[styles.page, { width: dashboardWidth }]}>
        {/* Profile, help and alerts live in the shared header on every panel,
            so the dashboard no longer carries its own avatar. */}
        <AppHeader />

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
              <View style={styles.insightBubble}>
                <AppText style={styles.insightText}>{insight}</AppText>
                <View style={styles.bubbleTail} />
              </View>

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
            <View style={styles.selectorBar}>
              <View style={styles.monthAnchor}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Selected month: ${month.label}`}
                  accessibilityState={{ expanded: monthMenuOpen }}
                  onPress={() => {
                    setMonthMenuOpen((open) => !open);
                    setPeriodMenuOpen(false);
                  }}
                  style={styles.monthButton}
                >
                  <AppText
                    variant="h2"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.monthText, { fontSize: compact ? 17 : 20 }]}
                  >
                    {month.label}
                  </AppText>
                  <AppIcon
                    name={monthMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.muted}
                  />
                </PressableScale>

                {monthMenuOpen ? (
                  <OptionMenu
                    options={dashboardMonths.map((item) => item.label)}
                    selected={month.label}
                    onSelect={(label) => {
                      const next = dashboardMonths.find((item) => item.label === label);
                      if (next) setSelectedMonthId(next.id);
                      setMonthMenuOpen(false);
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.periodAnchor}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Selected period: ${period}`}
                  accessibilityState={{ expanded: periodMenuOpen }}
                  onPress={() => {
                    setPeriodMenuOpen((open) => !open);
                    setMonthMenuOpen(false);
                  }}
                  style={[styles.periodChip, { paddingHorizontal: compact ? 10 : 13 }]}
                >
                  <AppText style={styles.periodText} numberOfLines={1}>
                    {period}
                  </AppText>
                  <AppIcon
                    name={periodMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.deepForest}
                  />
                </PressableScale>

                {periodMenuOpen ? (
                  <OptionMenu
                    options={dashboardPeriods}
                    selected={period}
                    align="right"
                    onSelect={(nextPeriod) => {
                      setPeriod(nextPeriod);
                      setPeriodMenuOpen(false);
                    }}
                  />
                ) : null}
              </View>
            </View>

            <AppText variant="subtitle" style={styles.summaryLabel}>Total Spent</AppText>

            <View style={styles.totalRow}>
              <View style={styles.totalCopy}>
                <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit style={styles.totalAmount}>
                  {expensesLoading ? '—' : formatMoney(month.spent)}
                </AppText>
                <AppText variant="subtitle" style={styles.summaryMuted}>
                  {budgetsLoading ? 'Checking budget…' : month.budget > 0 ? `of ${formatMoney(month.budget)} budget` : 'No monthly budget set'}
                </AppText>
              </View>
              <SparkBars key={month.id} bars={month.bars} />
            </View>

            <View style={styles.progressRow}>
              <ProgressBar value={Math.min(100, usage)} height={14} />
              <AppText variant="h3" style={styles.usageText}>
                {usage}% used
              </AppText>
            </View>
            {loadError ? <AppText variant="small" style={styles.dataError}>Expense data could not be refreshed.</AppText> : null}
          </Card>
        </FadeSlideIn>

        <View style={styles.metricRow}>
          <MetricTile
            icon="chart-pie"
            value={expensesLoading || budgetsLoading ? '—' : month.budget > 0 ? `${usage}%` : 'Not set'}
            label="Budget used"
            index={2}
            width={metricWidth}
            onPress={() => router.push('/budget')}
          />
          <MetricTile
            icon="wallet"
            value={expensesLoading || budgetsLoading ? '—' : month.budget > 0 ? formatMoney(Math.abs(remaining)) : 'Not set'}
            label={remaining < 0 ? 'Over budget' : 'Remaining'}
            index={3}
            width={metricWidth}
            onPress={() => router.push('/budget')}
          />
          <MetricTile
            icon="chart-bar"
            value={expensesLoading ? '—' : String(month.transactions)}
            label="Transactions"
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
                onPress={addCategory}
                style={styles.addTile}
              >
                <AppIcon name="plus" size={34} color={colors.deepForest} />
                <AppText style={styles.categoryLabel} numberOfLines={1} adjustsFontSizeToFit>
                  Add / Edit
                </AppText>
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>
      </View>
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
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    fontFamily: 'JakartaMedium',
  },
  heroName: {
    fontSize: 44,
    lineHeight: 49,
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
    minHeight: 238,
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
  // Takes the leftover width and shrinks first, so the two controls can never
  // run into each other.
  monthAnchor: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    zIndex: 32,
  },
  periodAnchor: {
    position: 'relative',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'flex-end',
    zIndex: 31,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 42,
  },
  monthText: {
    flexShrink: 1,
    lineHeight: 26,
  },
  periodChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.pale,
  },
  periodText: {
    color: colors.text,
    fontFamily: 'JakartaMedium',
    fontSize: 12,
  },
  optionMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: 190,
    borderRadius: 14,
    padding: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 50,
    ...shadow,
  },
  optionMenuRight: {
    left: undefined,
    right: 0,
    width: 158,
  },
  option: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionActive: { backgroundColor: colors.pale },
  optionPressed: { opacity: 0.7 },
  optionTextActive: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  summaryLabel: { color: colors.muted, marginTop: 3 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  totalCopy: { flex: 1, minWidth: 0 },
  totalAmount: {
    fontSize: 43,
    lineHeight: 49,
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
    minHeight: 132,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
});
