import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { FadeSlideIn, PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { AmountChips } from '@/components/common/amount-chips';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton, ProgressBar, SecondaryButton, StatusChip } from '@/components/common/ui';
import { BottomNavigation, useBottomNavInset } from '@/components/navigation/bottom-navigation';
import { FloatingRadialMenu } from '@/components/navigation/floating-radial-menu';
import { colors, radii, shadow, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { analyticsForMonth, buildInsights, previousMonth, type AnalyticsInsight } from '@/features/analytics/analytics';
import { detailForInsight, type InsightDetail } from '@/features/analytics/insight-details';
import { InsightDetailSheet } from '@/features/analytics/InsightDetailSheet';
import { mascotImage, mascotMood } from '@/features/analytics/mascot-mood';
import { DonutChart } from '@/features/analytics/DonutChart';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import { authCopy } from '@/features/auth/copy';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { budgetUsage } from '@/features/budget/types';
import { parseBudgetAmount } from '@/features/budget/validation';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { MAX_DASHBOARD_CATEGORIES } from '@/features/dashboard/dashboard-data';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import { useDashboardCategories } from '@/features/dashboard/DashboardCategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useAddExpenseOverlay } from '@/features/expenses/AddExpenseOverlayProvider';
import { useFinance } from '@/features/finance/FinanceProvider';
import { AddWalletCard, HIDDEN_AMOUNT, WalletCardFace } from '@/features/finance/components/WalletCardFace';
import { incomeKindLabels, type IncomeEntry, type Wallet, type WalletTransfer } from '@/features/finance/types';
import { useProfile } from '@/features/profile/ProfileProvider';
import type { Expense, ExpenseFormErrors, ExpenseFormValues } from '@/features/expenses/types';
import { formatDateTime, formatExpenseDate, formatTime, normalizeAmountInput, nowLocalTime, todayLocalDate, validateExpenseForm } from '@/features/expenses/validation';
import { ExpenseDatePicker, WalletPicker } from '@/screens/expense-screens';
import { formatCompactPeso, formatPercent, formatPeso, percentOf } from '@/lib/format';
import { selectionFeedback, warningFeedback } from '@/lib/haptics';
import { consumeSkippedPanelRefresh } from '@/lib/panel-refresh';

const CATEGORY_LIMIT_MESSAGE = 'Dashboard category limit reached. Remove one before adding another.';
const CATEGORY_TONES: Record<string, { background: string; foreground: string }> = {
  food: { background: '#FCE1DC', foreground: '#C92525' }, transport: { background: '#DDEBDD', foreground: '#28704B' },
  shopping: { background: '#FFE8CE', foreground: '#E45C0A' }, bills: { background: '#DCEBFA', foreground: '#3477B8' },
  health: { background: '#FADFE2', foreground: '#DB3545' }, school: { background: '#FFE7CE', foreground: '#E45C0A' },
  entertainment: { background: '#DCEBFA', foreground: '#3477B8' }, groceries: { background: '#DDEBDD', foreground: '#28704B' },
  travel: { background: '#E6E4F3', foreground: '#4B527A' },
};

export { HomeScreen } from './home-screen';

export function TransactionsScreen() {
  const { openAddExpense } = useAddExpenseOverlay();
  const { categories, findCategory } = useCategories();
  const { expenses, loading: expensesLoading, loadError, refresh, revalidate } = useExpenses();
  const { wallets, incomeEntries, transfers, loading: financeLoading, refresh: refreshFinance, revalidate: revalidateFinance } = useFinance();
  const loading = expensesLoading || financeLoading;
  const bottomInset = useBottomNavInset();
  // Analytics insights link here with a `q` so the chevron lands on the rows the
  // insight is about instead of the unfiltered list.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const incomingQuery = Array.isArray(q) ? q[0] : q;
  const [query, setQuery] = useState(incomingQuery ?? '');
  const [searchOpen, setSearchOpen] = useState(Boolean(incomingQuery));

  // Covers the case where this screen is already mounted and the router hands
  // it a new filter rather than pushing a fresh instance. Adjusting during
  // render (rather than in an effect) is React's documented way to react to a
  // changed input without an extra render pass.
  const [appliedQueryParam, setAppliedQueryParam] = useState(incomingQuery);
  if (incomingQuery !== appliedQueryParam) {
    setAppliedQueryParam(incomingQuery);
    if (incomingQuery) {
      setQuery(incomingQuery);
      setSearchOpen(true);
    }
  }
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [calendarMonth, setCalendarMonth] = useState(todayLocalDate().slice(0, 7));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<LedgerEntry | null>(null);

  useFocusEffect(useCallback(() => {
    if (consumeSkippedPanelRefresh('/transactions')) return;
    void revalidate();
    void revalidateFinance();
  }, [revalidate, revalidateFinance]));

  // Every money movement, from the same rows the wallets and budgets use.
  const ledger = useMemo(() => buildLedger({ expenses, incomeEntries, transfers, wallets, findCategory }), [expenses, findCategory, incomeEntries, transfers, wallets]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const today = todayLocalDate();
    const now = new Date(`${today}T12:00:00`);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (dateFilter === 'last7' ? 6 : dateFilter === 'week' ? now.getDay() : 29));
    const cutoffValue = localDateString(cutoff);
    const filtered = ledger.filter((entry) => {
      const matchesQuery = !needle || entry.searchText.includes(needle);
      // A category only applies to expenses, so choosing one shows only spending.
      const matchesType = typeFilter === 'all' || (typeFilter === 'income' ? entry.kind === 'income' || entry.kind === 'cash_in' : entry.kind === typeFilter);
      const matchesCategory = categoryFilter === 'all' || (entry.kind === 'expense' && entry.categoryId === categoryFilter);
      // Relative ranges can cross a month boundary, so only the "whole month"
      // views are tied to the calendar's month.
      const tiedToMonth = dateFilter === 'all' || dateFilter === 'month';
      const matchesDisplayedMonth = !tiedToMonth || entry.date.startsWith(calendarMonth);
      const matchesCalendarDate = !selectedCalendarDate || entry.date === selectedCalendarDate;
      const matchesDate = dateFilter === 'all' || dateFilter === 'month' ||
        (dateFilter === 'today' && entry.date === today) ||
        ((dateFilter === 'week' || dateFilter === 'last7' || dateFilter === 'last30') && entry.date >= cutoffValue && entry.date <= today);
      return matchesDisplayedMonth && matchesQuery && matchesType && matchesCategory && matchesDate && matchesCalendarDate;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return compareLedger(b, a);
      if (sort === 'highest') return b.amountCents - a.amountCents;
      if (sort === 'lowest') return a.amountCents - b.amountCents;
      return compareLedger(a, b);
    });
  }, [calendarMonth, categoryFilter, dateFilter, ledger, query, selectedCalendarDate, sort, typeFilter]);

  const groups = useMemo(() => groupByDate(visibleEntries), [visibleEntries]);
  const activeFilterCount = [typeFilter !== 'all', dateFilter !== 'all' || Boolean(selectedCalendarDate), categoryFilter !== 'all', sort !== 'newest'].filter(Boolean).length;
  const hasFilters = Boolean(query.trim()) || typeFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all' || sort !== 'newest' || Boolean(selectedCalendarDate);
  const clearFilters = () => { setTypeFilter('all'); setQuery(''); setSearchOpen(false); setDateFilter('all'); setCategoryFilter('all'); setSort('newest'); setSelectedCalendarDate(null); };
  const reload = () => { void refresh(); void refreshFinance(); };

  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading && ledger.length > 0} onRefresh={reload}>
      <View style={s.page}>
        <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Transactions</AppText>
        <Animated.View layout={LinearTransition.duration(180)} style={s.transactionToolbar}>
          {searchOpen ? <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={s.searchExpanded}><AppIcon name="magnify" size={21} color={colors.muted} /><TextInput autoFocus accessibilityLabel="Search transactions" placeholder="Search transactions..." placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.searchInput} /><PressableScale accessibilityLabel="Close transaction search" onPress={() => { setQuery(''); setSearchOpen(false); }} style={s.searchClose}><AppIcon name="close" size={19} /></PressableScale></Animated.View> : <><PressableScale accessibilityRole="button" accessibilityLabel="Open transaction search" onPress={() => setSearchOpen(true)} style={s.searchWide}><AppIcon name="magnify" size={20} color={colors.muted} /><AppText style={s.muted}>Search transactions</AppText></PressableScale><FilterPill activeCount={activeFilterCount} onPress={() => setFiltersOpen(true)} /></>}
        </Animated.View>
        <Animated.View key={calendarMonth} entering={FadeIn.duration(180)}><SpendingCalendar expenses={expenses} categories={categories} month={calendarMonth} selectedDate={selectedCalendarDate} onMonthChange={(next) => { setCalendarMonth(next); setDateFilter('all'); setSelectedCalendarDate(null); }} onSelectDate={(date) => { setDateFilter('all'); setSelectedCalendarDate(date); }} /></Animated.View>

        {loading && ledger.length === 0 ? (
          <View style={s.skeletonList}>{[0, 1, 2].map((item) => <View key={item} style={s.skeletonCard}><View style={s.skeletonIcon} /><View style={s.skeletonCopy}><View style={s.skeletonLineWide} /><View style={s.skeletonLine} /></View></View>)}</View>
        ) : loadError && ledger.length === 0 ? (
          <Card style={s.emptyCard}>
            <View style={s.emptyIcon}><AppIcon name="cloud-alert-outline" size={30} /></View>
            <AppText variant="h2">Couldn&apos;t load transactions</AppText>
            <AppText style={[s.muted, s.center]}>{loadError}</AppText>
            <SecondaryButton title="Try Again" onPress={reload} />
          </Card>
        ) : groups.length === 0 ? (
          <Card style={s.emptyCard}>
            <View style={s.emptyIcon}><AppIcon name="receipt-text-outline" size={31} /></View>
            <AppText variant="h2">{hasFilters ? 'No matching transactions' : 'No transactions yet'}</AppText>
            <AppText style={[s.muted, s.center]}>{hasFilters ? 'No transactions match these filters.' : 'Add your first expense to start tracking your spending.'}</AppText>
            {hasFilters ? null : <PrimaryButton title="Add Expense" icon="plus" onPress={openAddExpense} />}
          </Card>
        ) : groups.map((group) => (
          <View key={group.date}>
            <AppText variant="h2" style={s.group}>{group.label}</AppText>
            {group.entries.map((entry) => <LedgerRow key={entry.key} entry={entry} onOpen={() => entry.kind === 'expense' ? router.push(`/transaction/${entry.id}` as never) : setOpenEntry(entry)} />)}
          </View>
        ))}
      </View>
      <FilterSheet visible={filtersOpen} typeFilter={typeFilter} dateFilter={dateFilter} categoryFilter={categoryFilter} sort={sort} resultCount={visibleEntries.length} onType={setTypeFilter} onDate={(value) => { setDateFilter(value); setSelectedCalendarDate(null); if (value !== 'all') setCalendarMonth(todayLocalDate().slice(0, 7)); }} onCategory={setCategoryFilter} onSort={setSort} onClear={clearFilters} onClose={() => setFiltersOpen(false)} />
      <MoneyMovementSheet entry={openEntry} onClose={() => setOpenEntry(null)} />
    </Screen>
  );
}

type DateFilter = 'all' | 'today' | 'week' | 'last7' | 'month' | 'last30';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';
const TYPE_LABELS: Record<TypeFilter, string> = { all: 'All', expense: 'Expenses', income: 'Income', transfer: 'Transfers' };
const DATE_LABELS: Record<DateFilter, string> = { all: 'All Dates', today: 'Today', week: 'This Week', last7: 'Last 7 Days', month: 'This Month', last30: 'Last 30 Days' };
const SORT_LABELS: Record<SortOption, string> = { newest: 'Newest', oldest: 'Oldest', highest: 'Highest', lowest: 'Lowest' };

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
}

const compactCurrency = formatCompactPeso;

const CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(year, monthNumber - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function SpendingCalendar({ expenses, categories, month, selectedDate, onMonthChange, onSelectDate }: { expenses: Expense[]; categories: DashboardCategory[]; month: string; selectedDate: string | null; onMonthChange: (month: string) => void; onSelectDate: (date: string | null) => void }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const leading = new Date(year, monthNumber - 1, 1).getDay();
  const cells: (number | null)[] = [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const monthExpenses = expenses.filter((expense) => expense.transactionDate.startsWith(month));
  const totals = new Map<string, number>();
  const categoryTotals = new Map<string, Map<string, number>>();
  monthExpenses.forEach((expense) => totals.set(expense.transactionDate, (totals.get(expense.transactionDate) ?? 0) + expense.amountCents));
  monthExpenses.forEach((expense) => { const day = categoryTotals.get(expense.transactionDate) ?? new Map<string, number>(); day.set(expense.categoryId, (day.get(expense.categoryId) ?? 0) + expense.amountCents); categoryTotals.set(expense.transactionDate, day); });
  const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const selectedTotal = selectedDate ? totals.get(selectedDate) ?? 0 : 0;

  return <Card style={s.spendingCalendar}>
    <View style={s.calendarHeader}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Previous spending month" onPress={() => onMonthChange(shiftMonth(month, -1))} style={s.calendarNav}><AppIcon name="chevron-left" size={21} /></PressableScale>
      <View style={{ alignItems: 'center' }}><AppText variant="h2">{formatMonth(month)}</AppText><AppText variant="small" style={s.muted}>{monthExpenses.length} expense{monthExpenses.length === 1 ? '' : 's'}</AppText></View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Next spending month" onPress={() => onMonthChange(shiftMonth(month, 1))} style={s.calendarNav}><AppIcon name="chevron-right" size={21} /></PressableScale>
    </View>
    <View style={s.calendarSummary}>
      <View><AppText variant="small" style={s.muted}>Month spent</AppText><AppText variant="h3">{compactCurrency(monthTotal)}</AppText></View>
      <View style={{ alignItems: 'center' }}><AppText variant="small" style={s.muted}>Active days</AppText><AppText variant="h3">{totals.size}</AppText></View>
      <View style={{ alignItems: 'flex-end' }}><AppText variant="small" style={s.muted}>{selectedDate ? 'Selected day' : 'Daily average'}</AppText><AppText variant="h3">{compactCurrency(selectedDate ? selectedTotal : totals.size ? Math.round(monthTotal / totals.size) : 0)}</AppText></View>
    </View>
    <View style={s.calendarWeek}>{CALENDAR_WEEKDAYS.map((label, index) => <View key={`${label}-${index}`} style={s.calendarCell}><AppText variant="small" style={s.calendarWeekday}>{label}</AppText></View>)}</View>
    <View style={s.calendarGrid}>{cells.map((day, index) => {
      if (!day) return <View key={`blank-${index}`} style={s.calendarCell} />;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const total = totals.get(date) ?? 0;
      const selected = date === selectedDate;
      const dominantId = [...(categoryTotals.get(date)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];
      const category = categories.find(item => item.id === dominantId);
      const categoryColor = category?.color ?? CATEGORY_TONES[dominantId ?? '']?.foreground ?? colors.forest;
      const categoryLabel = category?.fullLabel ?? dominantId;
      return <View key={date} style={s.calendarCell}><PressableScale scaleTo={0.92} accessibilityRole="button" accessibilityLabel={`${date}${total ? `, spent ${compactCurrency(total)}${categoryLabel ? `, mostly ${categoryLabel}` : ''}` : ', no spending'}`} accessibilityState={{ selected }} onPress={() => onSelectDate(selected ? null : date)} style={[s.calendarDay, total > 0 && s.calendarDayHasSpending, total > 0 && !selected && { backgroundColor: `${categoryColor}20`, borderColor: `${categoryColor}70` }, selected && s.calendarDaySelected]}><AppText variant="bodyMedium" style={selected ? s.calendarDaySelectedText : undefined}>{day}</AppText>{total > 0 ? <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.calendarAmount, !selected && { color: categoryColor }, selected && s.calendarDaySelectedText]}>{compactCurrency(total)}</AppText> : null}</PressableScale></View>;
    })}</View>
  </Card>;
}

/** Single filter pill: funnel icon plus "All" or how many filters are on. */
function FilterPill({ activeCount, onPress }: { activeCount: number; onPress: () => void }) {
  const active = activeCount > 0;
  return <PressableScale accessibilityRole="button" accessibilityLabel={active ? `Filters, ${activeCount} on` : 'Filters, showing all'} onPress={onPress} style={[s.filterPill, active && s.filterPillActive]}><AppIcon name="filter-variant" size={18} color={active ? colors.surface : colors.deepForest} /><AppText variant="bodyMedium" style={active ? s.filterPillTextActive : s.filterPillText}>{active ? `${activeCount} on` : 'All'}</AppText></PressableScale>;
}

/** One organized filter sheet: type, date, category and sort together, applied live. */
function FilterSheet({ visible, typeFilter, dateFilter, categoryFilter, sort, resultCount, onType, onDate, onCategory, onSort, onClear, onClose }: { visible: boolean; typeFilter: TypeFilter; dateFilter: DateFilter; categoryFilter: string; sort: SortOption; resultCount: number; onType: (value: TypeFilter) => void; onDate: (value: DateFilter) => void; onCategory: (value: string) => void; onSort: (value: SortOption) => void; onClear: () => void; onClose: () => void }) {
  const { categories } = useCategories();
  const pick = (apply: () => void) => { selectionFeedback(); apply(); };
  return (
    <DraggableBottomSheet visible={visible} onClose={onClose}>{(dismiss) => <>
      <View style={s.rowBetween}>
        <AppText variant="h2">Filters</AppText>
        <PressableScale accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={() => pick(onClear)} style={s.filterClear}><AppText variant="small" style={s.sectionLinkText}>Clear all</AppText></PressableScale>
      </View>
      <FilterSection title="Type">{(Object.entries(TYPE_LABELS) as [TypeFilter, string][]).map(([id, label]) => <FilterChip key={id} label={label} selected={typeFilter === id} onPress={() => pick(() => onType(id))} />)}</FilterSection>
      <FilterSection title="Date">{(Object.entries(DATE_LABELS) as [DateFilter, string][]).map(([id, label]) => <FilterChip key={id} label={label} selected={dateFilter === id} onPress={() => pick(() => onDate(id))} />)}</FilterSection>
      <FilterSection title="Category"><FilterChip label="All Categories" selected={categoryFilter === 'all'} onPress={() => pick(() => onCategory('all'))} />{categories.map((item) => <FilterChip key={item.id} label={item.fullLabel} icon={item.icon} selected={categoryFilter === item.id} onPress={() => pick(() => onCategory(item.id))} />)}</FilterSection>
      <FilterSection title="Sort">{(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([id, label]) => <FilterChip key={id} label={label} selected={sort === id} onPress={() => pick(() => onSort(id))} />)}</FilterSection>
      <PrimaryButton title={`Show ${resultCount} transaction${resultCount === 1 ? '' : 's'}`} onPress={dismiss} />
    </>}</DraggableBottomSheet>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.filterSection}><AppText variant="bodyMedium" style={s.muted}>{title}</AppText><View style={s.filterChips}>{children}</View></View>;
}

function FilterChip({ label, icon, selected, onPress }: { label: string; icon?: Parameters<typeof AppIcon>[0]['name']; selected: boolean; onPress: () => void }) {
  return <PressableScale accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.filterChip, selected && s.filterChipSelected]}>{icon ? <AppIcon name={icon} size={16} color={selected ? colors.surface : colors.deepForest} /> : null}<AppText variant="small" numberOfLines={1} style={selected ? s.filterChipTextSelected : s.filterChipText}>{label}</AppText></PressableScale>;
}

type LedgerKind = 'expense' | 'income' | 'cash_in' | 'transfer';

/** One row of the unified history, whatever kind of money movement it is. */
type LedgerEntry = {
  key: string;
  id: string;
  kind: LedgerKind;
  date: string;
  time: string | null;
  createdAt: string;
  amountCents: number;
  feeCents: number;
  title: string;
  subtitle: string;
  icon: Parameters<typeof AppIcon>[0]['name'];
  categoryId: string | null;
  notes: string | null;
  searchText: string;
};

/** Shown on anything saved on this device that has not reached the server yet. */
const SYNC_LABEL = 'Waiting to sync';

const LEDGER_KIND_LABELS: Record<LedgerKind, string> = { expense: 'Expense', income: 'Income', cash_in: 'Cash-in', transfer: 'Transfer' };

function buildLedger({ expenses, incomeEntries, transfers, wallets, findCategory }: { expenses: Expense[]; incomeEntries: IncomeEntry[]; transfers: WalletTransfer[]; wallets: Wallet[]; findCategory: (id: string | undefined) => DashboardCategory | null }): LedgerEntry[] {
  const walletName = (id: string | null) => wallets.find((wallet) => wallet.id === id)?.name ?? null;
  const rows: LedgerEntry[] = [
    ...expenses.map((expense): LedgerEntry => {
      const category = findCategory(expense.categoryId);
      const label = category?.fullLabel ?? 'Expense';
      const wallet = walletName(expense.walletId);
      return { key: `expense-${expense.id}`, id: expense.id, kind: 'expense', date: expense.transactionDate, time: expense.transactionTime, createdAt: expense.createdAt, amountCents: expense.amountCents, feeCents: 0, title: expense.merchant, subtitle: [label, wallet, expense.pending ? SYNC_LABEL : null].filter(Boolean).join(' · '), icon: category?.icon ?? 'receipt-text-outline', categoryId: expense.categoryId, notes: expense.notes, searchText: '' };
    }),
    ...incomeEntries.map((entry): LedgerEntry => ({ key: `income-${entry.id}`, id: entry.id, kind: entry.kind, date: entry.transactionDate, time: entry.transactionTime, createdAt: entry.createdAt, amountCents: entry.amountCents, feeCents: 0, title: entry.source, subtitle: [incomeKindLabels[entry.kind], walletName(entry.walletId), entry.pending ? SYNC_LABEL : null].filter(Boolean).join(' · '), icon: entry.kind === 'cash_in' ? 'cash-plus' : 'cash-multiple', categoryId: null, notes: entry.notes, searchText: '' })),
    ...transfers.map((transfer): LedgerEntry => ({ key: `transfer-${transfer.id}`, id: transfer.id, kind: 'transfer', date: transfer.transactionDate, time: transfer.transactionTime, createdAt: transfer.createdAt, amountCents: transfer.amountCents, feeCents: transfer.feeCents, title: `${walletName(transfer.fromWalletId) ?? 'Wallet'} → ${walletName(transfer.toWalletId) ?? 'Wallet'}`, subtitle: `Transfer${transfer.feeCents ? ` · ${formatPeso(transfer.feeCents)} fee` : ''}${transfer.pending ? ` · ${SYNC_LABEL}` : ''}`, icon: 'swap-horizontal', categoryId: null, notes: transfer.notes, searchText: '' })),
  ];
  return rows.map((row) => ({ ...row, searchText: `${row.title} ${row.subtitle} ${LEDGER_KIND_LABELS[row.kind]} ${row.notes ?? ''}`.toLocaleLowerCase() }));
}

/** Newest first: date, then time of day, then when it was recorded. */
function compareLedger(a: LedgerEntry, b: LedgerEntry) {
  return b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt.localeCompare(a.createdAt);
}

function LedgerRow({ entry, onOpen }: { entry: LedgerEntry; onOpen: () => void }) {
  const incoming = entry.kind === 'income' || entry.kind === 'cash_in';
  const sign = entry.kind === 'expense' ? '−' : incoming ? '+' : '';
  const clock = formatTime(entry.time);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entry.title}, ${entry.subtitle}`} onPress={onOpen} style={({ pressed }) => pressed && { opacity: 0.78 }}>
      <Card style={s.transaction}>
        <View style={[s.roundIcon, incoming && s.roundIconIncoming]}><AppIcon name={entry.icon} size={24} color={incoming ? colors.success : colors.deepForest} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="h3" numberOfLines={2}>{entry.title}</AppText>
          <AppText style={s.muted} numberOfLines={2}>{clock ? `${entry.subtitle} · ${clock}` : entry.subtitle}</AppText>
        </View>
        <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[s.transactionAmount, incoming && { color: colors.success }]}>{sign}{formatCompactPeso(entry.amountCents)}</AppText>
      </Card>
    </Pressable>
  );
}

function groupByDate(entries: LedgerEntry[]) {
  const today = todayLocalDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateString(yesterdayDate);
  const groups = new Map<string, LedgerEntry[]>();
  entries.forEach((entry) => groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]));
  return [...groups.entries()].map(([date, items]) => ({ date, label: date === today ? 'Today' : date === yesterday ? 'Yesterday' : formatExpenseDate(date), entries: items }));
}

/** Details for money that moved between or into wallets; expenses have their own screen. */
function MoneyMovementSheet({ entry, onClose }: { entry: LedgerEntry | null; onClose: () => void }) {
  const { deleteIncome, deleteTransfer } = useFinance();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = () => { setConfirming(false); onClose(); };
  const remove = async () => {
    if (!entry || deleting) return;
    setDeleting(true);
    const result = entry.kind === 'transfer' ? await deleteTransfer(entry.id) : await deleteIncome(entry.id);
    setDeleting(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    warningFeedback();
    showToast(entry.kind === 'transfer' ? 'Transfer deleted. Both wallets were restored.' : `${LEDGER_KIND_LABELS[entry.kind]} deleted. The wallet was adjusted.`);
    close();
  };
  return (
    <>
      <DraggableBottomSheet visible={Boolean(entry) && !confirming} disabled={deleting} onClose={close}>
        {entry ? <>
          <View style={s.rowBetween}><AppText variant="h2" style={{ flex: 1 }} numberOfLines={2}>{entry.title}</AppText><StatusChip>{LEDGER_KIND_LABELS[entry.kind]}</StatusChip></View>
          <View style={{ gap: 12 }}>
            <InfoRow label="Amount" value={formatPeso(entry.amountCents, { alwaysShowDecimals: true })} bold />
            {entry.kind === 'transfer' ? <InfoRow label="Transfer fee" value={formatPeso(entry.feeCents, { alwaysShowDecimals: true })} /> : null}
            <InfoRow label="When" value={formatDateTime(entry.date, entry.time)} />
            <InfoRow label="Details" value={entry.subtitle} />
            {entry.notes ? <InfoRow label="Notes" value={entry.notes} /> : null}
          </View>
          <AppText variant="small" style={s.muted}>{entry.kind === 'transfer' ? 'Transfers move money between wallets. They are not spending or income, and they stay on record so every balance can be traced.' : 'Income raises the wallet balance. It never counts as spending or changes a budget.'}</AppText>
          {entry.kind === 'transfer' ? null : <SecondaryButton title="Delete" icon="delete-outline" onPress={() => setConfirming(true)} />}
        </> : null}
      </DraggableBottomSheet>
      <AuthDialog visible={Boolean(entry) && confirming} title={entry?.kind === 'transfer' ? 'Delete transfer?' : 'Delete this entry?'} message={entry?.kind === 'transfer' ? 'Both wallet balances will be restored.' : 'The amount will be removed from the wallet balance.'} primaryAction={{ label: 'Delete', destructive: true, loading: deleting, onPress: () => void remove() }} secondaryAction={{ label: 'Cancel', onPress: () => setConfirming(false) }} onRequestClose={() => setConfirming(false)} />
    </>
  );
}

export function TransactionDetailsScreen() {
  const { findCategory } = useCategories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, loading, deleteExpense } = useExpenses();
  const { wallets, refresh: refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expense = expenses.find((item) => item.id === id);
  const category = findCategory(expense?.categoryId);
  const wallet = wallets.find((item) => item.id === expense?.walletId);

  const remove = async () => {
    if (!expense || deleting) return;
    setDeleting(true);
    const result = await deleteExpense(expense.id);
    setDeleting(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    // The database returned the amount to its wallet; reload so every screen agrees.
    void refreshFinance();
    warningFeedback();
    showToast(result.queued ? 'Deleted on this device. It will sync when you are back online.' : wallet ? `Transaction deleted. ${wallet.name} was refunded.` : 'Transaction deleted.');
    setConfirmDelete(false);
    router.replace('/transactions');
  };

  if (loading && !expense) {
    return <Screen variant={8}><View style={s.page}><BackButton /><Card style={s.loadingCard}><ActivityIndicator color={colors.deepForest} /><AppText style={s.muted}>Loading expense...</AppText></Card></View></Screen>;
  }

  if (!expense) {
    return <Screen variant={8}><View style={s.page}><BackButton /><Card style={s.emptyCard}><AppText variant="h2">Expense not found</AppText><AppText style={[s.muted, s.center]}>It may have been removed or is no longer available.</AppText></Card></View></Screen>;
  }

  return (
    <Screen variant={8}>
      <View style={s.page}>
        <BackButton />
        <FadeSlideIn style={s.detailHead}>
          <View style={[s.roundIcon, { width: 78, height: 78, borderRadius: 39 }]}>
            <AppIcon name={category?.icon ?? 'receipt-text-outline'} size={35} />
          </View>
          <AppText variant="h2">{expense.merchant}</AppText>
          <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPeso(expense.amountCents, { alwaysShowDecimals: true })}</AppText>
          <AppText style={s.muted}>{formatDateTime(expense.transactionDate, expense.transactionTime)}</AppText>
          {expense.source === 'receipt' ? <StatusChip>Verified</StatusChip> : <StatusChip>Manual entry</StatusChip>}
        </FadeSlideIn>
        <FadeSlideIn delay={80}><Card style={{ gap: 12 }}>
          <InfoRow label="Category" value={category?.fullLabel ?? expense.categoryId} />
          <InfoRow label="Wallet" value={wallet?.name ?? 'No wallet'} />
          <InfoRow label="Source" value={expense.source === 'receipt' ? 'Receipt' : 'Manual'} />
          <View style={s.divider} />
          <InfoRow label="Total" value={formatPeso(expense.amountCents, { alwaysShowDecimals: true })} bold />
          {expense.notes ? <><View style={s.divider} /><AppText style={s.muted}>Notes</AppText><AppText>{expense.notes}</AppText></> : null}
        </Card></FadeSlideIn>
        <FadeSlideIn delay={150} style={s.actions}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Edit transaction" onPress={() => router.push(`/transaction/${expense.id}/edit` as never)} style={s.edit}><AppIcon name="pencil-outline" color={colors.deepForest} /><AppText variant="h3" style={{ color: colors.deepForest }}>Edit</AppText></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Delete transaction" onPress={() => setConfirmDelete(true)} style={s.delete}><AppIcon name="delete-outline" color={colors.danger} /><AppText variant="h3" style={{ color: colors.danger }}>Delete</AppText></PressableScale>
        </FadeSlideIn>
      </View>
      <AuthDialog visible={confirmDelete} title="Delete transaction?" message={wallet ? `This expense will be removed and ${formatPeso(expense.amountCents)} returned to ${wallet.name}.` : 'This transaction will be permanently removed from your expense history.'} primaryAction={{ label: 'Delete', destructive: true, loading: deleting, onPress: () => void remove() }} secondaryAction={{ label: 'Cancel', onPress: () => setConfirmDelete(false) }} onRequestClose={() => setConfirmDelete(false)} />
    </Screen>
  );
}

export function EditTransactionScreen() {
  const { categories } = useCategories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, updateExpense } = useExpenses();
  const { wallets, refresh: refreshFinance } = useFinance();
  const { showToast } = useToast();
  const expense = expenses.find((item) => item.id === id);
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [picker, setPicker] = useState<'wallet' | 'date' | null>(null);
  const [values, setValues] = useState<ExpenseFormValues>(() => expense ? { amount: (expense.amountCents / 100).toFixed(2), merchant: expense.merchant, categoryId: expense.categoryId, walletId: expense.walletId ?? '', transactionDate: expense.transactionDate, transactionTime: expense.transactionTime ?? '12:00', notes: expense.notes ?? '' } : { amount: '', merchant: '', categoryId: '', walletId: '', transactionDate: todayLocalDate(), transactionTime: nowLocalTime(), notes: '' });
  if (!expense) return <Screen variant={8}><View style={s.page}><BackButton /><Card style={s.emptyCard}><AppText variant="h2">Transaction not found</AppText></Card></View></Screen>;
  const update = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const selectedWallet = wallets.find((item) => item.id === values.walletId);
  const save = async () => {
    if (submitting.current) return;
    Keyboard.dismiss();
    const validation = validateExpenseForm(values);
    setErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true; setSaving(true);
    // The database reverses the original wallet effect before applying the new one.
    const result = await updateExpense({ id: expense.id, ...validation.input });
    submitting.current = false; setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    void refreshFinance();
    selectionFeedback(); showToast(result.queued ? 'Updated on this device. It will sync when you are back online.' : 'Transaction updated.'); router.replace(`/transaction/${expense.id}` as never);
  };
  return <Screen variant={8} bottomInset={40}><View style={s.page}><View style={s.editHeader}><BackButton /><View><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Edit Transaction</AppText><AppText style={s.muted}>Update the saved expense.</AppText></View></View><FormInput label="Amount" icon="currency-php" value={values.amount} onChangeText={(value) => update('amount', normalizeAmountInput(value, values.amount))} keyboardType="decimal-pad" error={errors.amount} /><AmountChips value={values.amount} onChange={(amount) => update('amount', amount)} /><FormInput label="Merchant / Description" value={values.merchant} onChangeText={(value) => update('merchant', value)} error={errors.merchant} /><AppText variant="bodyMedium">Category</AppText><View style={s.editCategories}>{categories.map((category) => <PressableScale key={category.id} onPress={() => update('categoryId', category.id)} style={[s.editCategory, values.categoryId === category.id && s.editCategoryActive]}><AppIcon name={category.icon} size={18} color={values.categoryId === category.id ? colors.surface : colors.deepForest} /><AppText variant="small" style={values.categoryId === category.id ? s.editCategoryTextActive : undefined}>{category.fullLabel}</AppText></PressableScale>)}</View>{errors.categoryId ? <AppText variant="small" style={s.errorText}>{errors.categoryId}</AppText> : null}<EditField label="Wallet" value={selectedWallet?.name ?? 'No wallet'} icon="wallet-outline" onPress={() => wallets.length ? setPicker('wallet') : router.push('/wallets' as never)} /><EditField label="Date & Time" value={formatDateTime(values.transactionDate, values.transactionTime)} icon="calendar-clock-outline" error={errors.transactionDate} onPress={() => setPicker('date')} /><FormInput label="Notes (optional)" value={values.notes} onChangeText={(value) => update('notes', value)} multiline style={s.editNotes} error={errors.notes} /><PrimaryButton title={saving ? 'Saving Changes…' : 'Save Changes'} disabled={saving} onPress={() => void save()} /></View>
    <WalletPicker visible={picker === 'wallet'} selectedId={values.walletId} onClose={() => setPicker(null)} onSelect={(walletId) => { update('walletId', walletId); setPicker(null); }} />
    {picker === 'date' ? <ExpenseDatePicker value={values.transactionDate} time={values.transactionTime} onClose={() => setPicker(null)} onSelect={(transactionDate, transactionTime) => { setValues((current) => ({ ...current, transactionDate, transactionTime })); setErrors((current) => ({ ...current, transactionDate: undefined })); setPicker(null); }} /> : null}
  </Screen>;
}

function EditField({ label, value, icon, error, onPress }: { label: string; value: string; icon: Parameters<typeof AppIcon>[0]['name']; error?: string; onPress: () => void }) {
  return (
    <View style={{ gap: 7 }}>
      <AppText variant="bodyMedium">{label}</AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={error ? [s.editField, s.editFieldError] : s.editField}>
        <AppIcon name={icon} size={21} color={error ? colors.danger : colors.forest} />
        <AppText numberOfLines={1} style={s.editFieldText}>{value}</AppText>
        <AppIcon name="chevron-down" size={20} color={colors.muted} />
      </PressableScale>
      {error ? <AppText variant="small" style={s.errorText}>{error}</AppText> : null}
    </View>
  );
}

function InfoRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.rowBetween}>
      <AppText variant={bold ? 'h3' : 'body'} style={s.muted}>{label}</AppText>
      <AppText variant={bold ? 'h3' : 'body'} style={s.infoValue}>{value}</AppText>
    </View>
  );
}

/** Previous / next arrows around a period label — the one way dates are stepped through in the app. */
function PeriodStepper({ label, onPrevious, onNext, nextDisabled = false, subject }: { label: string; onPrevious: () => void; onNext: () => void; nextDisabled?: boolean; subject: string }) {
  return (
    <View style={s.stepper}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Previous ${subject}`} hitSlop={6} onPress={() => { selectionFeedback(); onPrevious(); }} style={s.stepperButton}><AppIcon name="chevron-left" size={22} /></PressableScale>
      <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={s.stepperLabel}>{label}</AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Next ${subject}`} accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled} hitSlop={6} onPress={() => { selectionFeedback(); onNext(); }} style={[s.stepperButton, nextDisabled && s.stepperButtonDisabled]}><AppIcon name="chevron-right" size={22} color={nextDisabled ? colors.muted : colors.deepForest} /></PressableScale>
    </View>
  );
}

export function WalletScreen() {
  const { categories } = useCategories();
  const bottomInset = useBottomNavInset();
  const { expenses } = useExpenses();
  const { wallets, goals, loading: walletsLoading, refresh: refreshFinance, revalidate: revalidateFinance } = useFinance();
  const { budgets: monthlyBudgets, loading, error, refresh, revalidate: revalidateBudgets, saveCategoryBudget, removeCategoryBudget } = useBudgets();
  const { showToast } = useToast();
  const currentMonth = todayLocalDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Balances are the one thing on this panel someone may not want read over
  // their shoulder, so one toggle blanks every wallet-derived figure at once.
  const [balancesHidden, setBalancesHidden] = useState(false);
  const budget = monthlyBudgets.find((item) => item.month === month);
  const monthExpenses = expenses.filter((item) => item.transactionDate.startsWith(month));
  const usage = budgetUsage(budget, monthExpenses);
  const currency = (cents: number) => formatPeso(Math.abs(cents), { alwaysShowDecimals: true });
  const compact = (cents: number) => formatCompactPeso(Math.abs(cents), { alwaysShowDecimals: false });
  const monthLabel = formatMonth(month);
  const walletTotalCents = wallets.reduce((sum, item) => sum + item.balanceCents, 0);
  const savedCents = goals.reduce((sum, item) => sum + item.currentCents, 0);
  const secret = (value: string) => (balancesHidden ? HIDDEN_AMOUNT : value);
  const editingLabel = categories.find((item) => item.id === editingCategory)?.fullLabel ?? 'Category';
  const editingLimit = budget?.categoryBudgets.find((item) => item.categoryId === editingCategory);

  useFocusEffect(useCallback(() => { if (!consumeSkippedPanelRefresh('/wallet')) { void revalidateFinance(); void revalidateBudgets(); } }, [revalidateBudgets, revalidateFinance]));

  const openCategory = (categoryId: string) => { const limit = budget?.categoryBudgets.find((item) => item.categoryId === categoryId); setAmount(limit ? (limit.amountCents / 100).toFixed(2) : ''); setAmountError(null); setEditingCategory(categoryId); };
  // Every wallet action lands on the same manage screen; the params only decide
  // which sheet it opens with, so there is one place that edits a wallet.
  const openWallets = (params: { wallet?: string; new?: '1'; add?: '1'; transfer?: '1' } = {}) => router.push({ pathname: '/wallets', params } as never);
  const save = async () => {
    if (!editingCategory || saving) return;
    const cents = parseBudgetAmount(amount);
    if (!cents) { setAmountError('Enter a valid amount greater than zero.'); return; }
    setSaving(true);
    const result = await saveCategoryBudget(month, editingCategory, cents);
    setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    selectionFeedback(); showToast(`${editingLabel} budget saved for ${monthLabel}.`); setEditingCategory(null);
  };
  const removeLimit = async () => {
    if (!budget || !editingLimit) return;
    setSaving(true); const result = await removeCategoryBudget(budget.id, editingLimit.id); setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    showToast(`${editingLabel} budget removed.`); setEditingCategory(null);
  };
  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading} onRefresh={() => { void refresh(); void refreshFinance(); }}>
      <View style={s.page}>
        <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Wallet</AppText>

        <View style={s.balanceCard}>
          <View style={s.rowBetween}>
            <AppText style={s.balanceCaption}>TOTAL BALANCE</AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={balancesHidden ? 'Show balances' : 'Hide balances'}
              hitSlop={8}
              onPress={() => setBalancesHidden((value) => !value)}
              style={s.balanceEye}
            >
              <AppIcon name={balancesHidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.white} />
            </PressableScale>
          </View>
          <AppText adjustsFontSizeToFit numberOfLines={1} style={s.balanceValue}>{secret(currency(walletTotalCents))}</AppText>
          <View style={s.balanceMetrics}>
            <View style={s.balanceMetric}>
              <AppText style={s.balanceCaption}>WALLETS</AppText>
              <AppText numberOfLines={1} style={s.balanceMetricValue}>{wallets.length}</AppText>
            </View>
            <View style={s.balanceMetric}>
              <AppText style={s.balanceCaption}>SAVED</AppText>
              <AppText numberOfLines={1} style={s.balanceMetricValue}>{secret(compact(savedCents))}</AppText>
            </View>
          </View>
        </View>

        {/* Goals come first: they are what the money in these wallets is for. */}
        <View style={s.sectionHead}>
          <AppText variant="h2">Savings Goals</AppText>
          <PressableScale accessibilityRole="button" accessibilityLabel="Manage savings goals" onPress={() => router.push('/goals' as never)} style={s.sectionLink}>
            <AppText variant="small" style={s.sectionLinkText}>Manage{goals.length ? ` (${goals.length})` : ''}</AppText>
            <AppIcon name="chevron-right" size={16} color={colors.forest} />
          </PressableScale>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Open savings goals" onPress={() => router.push('/goals' as never)} style={s.goalsRow}>
          <View style={s.goalsIcon}><AppIcon name="target" size={22} /></View>
          <View style={s.budgetInfo}>
            <AppText variant="h3">{goals.length ? `${goals.length} active goal${goals.length === 1 ? '' : 's'}` : 'No goals yet'}</AppText>
            <AppText variant="small" style={s.muted}>{goals.length ? `${secret(compact(savedCents))} saved so far` : 'Create your first savings goal'}</AppText>
          </View>
          <AppIcon name="chevron-right" size={20} color={colors.muted} />
        </PressableScale>

        <View style={s.sectionHead}>
          <AppText variant="h2">My Wallets</AppText>
          <PressableScale accessibilityRole="button" accessibilityLabel="Manage wallets" onPress={() => openWallets()} style={s.sectionLink}>
            <AppText variant="small" style={s.sectionLinkText}>Manage{wallets.length ? ` (${wallets.length})` : ''}</AppText>
            <AppIcon name="chevron-right" size={16} color={colors.forest} />
          </PressableScale>
        </View>
        {walletsLoading && wallets.length === 0 ? (
          <View style={s.walletGrid}>
            <View style={s.walletCell}><View style={s.walletSkeleton} /></View>
            <View style={s.walletCell}><View style={s.walletSkeleton} /></View>
          </View>
        ) : (
          <View style={s.walletGrid}>
            {wallets.map((wallet, index) => (
              <View key={wallet.id} style={s.walletCell}>
                <WalletCardFace
                  wallet={wallet}
                  index={index}
                  hidden={balancesHidden}
                  onPress={() => router.push({ pathname: '/wallet-detail/[id]', params: { id: wallet.id } } as never)}
                  onMore={() => openWallets({ wallet: wallet.id, add: '1' })}
                  moreLabel={`Add income to ${wallet.name}`}
                />
              </View>
            ))}
            <View style={s.walletCell}><AddWalletCard onPress={() => openWallets({ new: '1' })} /></View>
          </View>
        )}
        {wallets.length ? (
          <View style={s.walletActions}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Add income" onPress={() => openWallets({ add: '1' })} style={s.addMoneyRow}>
              <AppIcon name="cash-plus" size={20} color={colors.forest} />
              <AppText variant="bodyMedium" style={s.sectionLinkText}>Add income</AppText>
            </PressableScale>
            {wallets.length > 1 ? (
              <PressableScale accessibilityRole="button" accessibilityLabel="Transfer between wallets" onPress={() => openWallets({ transfer: '1' })} style={s.addMoneyRow}>
                <AppIcon name="swap-horizontal" size={20} color={colors.forest} />
                <AppText variant="bodyMedium" style={s.sectionLinkText}>Transfer</AppText>
              </PressableScale>
            ) : null}
          </View>
        ) : (
          <AppText style={s.muted}>Add a wallet to keep each source of money visible here.</AppText>
        )}

        <View style={s.sectionHead}>
          <AppText variant="h2">Category Budgets</AppText>
          <PressableScale accessibilityRole="button" accessibilityLabel="Manage categories" onPress={() => router.push('/categories')} style={s.sectionLink}>
            <AppText variant="small" style={s.sectionLinkText}>Manage categories</AppText>
            <AppIcon name="chevron-right" size={16} color={colors.forest} />
          </PressableScale>
        </View>
        <PeriodStepper subject="budget month" label={monthLabel} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />
        {loading && monthlyBudgets.length === 0 ? <View style={s.skeletonCard} /> : error && monthlyBudgets.length === 0 ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load budgets</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : usage.hasBudget ? (
          <Card style={s.budgetTotals}>
            <View style={s.rowBetween}>
              <AppText variant="small" style={s.muted}>{compact(usage.spentCents)} spent of {compact(usage.limitCents)}</AppText>
              <AppText variant="small" style={{ color: usage.remainingCents < 0 ? colors.danger : colors.deepForest }}>{compact(usage.remainingCents)} {usage.remainingCents < 0 ? 'over' : 'left'}</AppText>
            </View>
            <ProgressBar value={Math.min(100, percentOf(usage.spentCents, usage.limitCents) ?? 0)} height={9} />
          </Card>
        ) : <AppText style={s.muted}>No category budgets for {monthLabel} yet. Tap a category to set one.</AppText>}
        {categories.map((category) => {
          const limit = budget?.categoryBudgets.find((item) => item.categoryId === category.id);
          const categorySpent = monthExpenses.filter((item) => item.categoryId === category.id).reduce((sum, item) => sum + item.amountCents, 0);
          const categoryPercent = percentOf(categorySpent, limit?.amountCents) ?? 0;
          const categoryRemaining = limit ? limit.amountCents - categorySpent : null;
          return (
          <PressableScale
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`${limit ? 'Edit' : 'Set'} ${category.fullLabel} budget`}
            accessibilityHint="Opens the category budget editor"
            hitSlop={4}
            onPress={() => openCategory(category.id)}
            style={s.budgetRow}
          >
            <View style={[s.budgetIcon, { backgroundColor: category.color ? `${category.color}22` : CATEGORY_TONES[category.id]?.background ?? colors.pale }]}>
              <AppIcon name={category.icon} size={22} color={category.color ?? CATEGORY_TONES[category.id]?.foreground ?? colors.deepForest} />
            </View>
            <View style={s.budgetInfo}>
              <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{category.fullLabel}</AppText>
              <ProgressBar value={Math.min(100, categoryPercent)} height={9} />
            </View>
            <View style={s.budgetValues}>
              <AppText variant="h3">{limit ? compact(limit.amountCents) : 'Set budget'}</AppText>
              <AppText variant="small" style={{ color: categoryPercent >= 100 ? colors.danger : colors.deepForest }}>{compact(categorySpent)} spent</AppText>
              {categoryRemaining !== null ? <AppText variant="small" style={{ color: categoryRemaining < 0 ? colors.danger : colors.muted }}>{compact(categoryRemaining)} {categoryRemaining < 0 ? 'over' : 'left'}</AppText> : null}
            </View>
            <AppIcon name="chevron-right" size={20} color={colors.muted} />
          </PressableScale>);
        })}
      </View>
      <DraggableBottomSheet visible={editingCategory !== null} disabled={saving} onClose={() => setEditingCategory(null)}>
        <AppText variant="h2">{editingLabel} Budget</AppText>
        <AppText style={s.muted}>{monthLabel}</AppText>
        <FormInput label="Budget amount" icon="currency-php" placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(normalizeAmountInput(value, amount)); setAmountError(null); }} keyboardType="decimal-pad" error={amountError ?? undefined} />
        <AmountChips value={amount} onChange={(value) => { setAmount(value); setAmountError(null); }} />
        <PrimaryButton title={saving ? 'Saving…' : 'Save Budget'} disabled={saving} onPress={() => void save()} />
        {editingLimit ? <SecondaryButton title="Remove Budget" disabled={saving} onPress={() => void removeLimit()} /> : null}
      </DraggableBottomSheet>
    </Screen>
  );
}

export function AnalyticsScreen() {
  const { openAddExpense } = useAddExpenseOverlay();
  const { expenses, loading, loadError, refresh, revalidate } = useExpenses();
  const { incomeEntries } = useFinance();
  const { allCategories } = useCategories();
  const bottomInset = useBottomNavInset();
  const [month, setMonth] = useState(todayLocalDate().slice(0, 7));
  const monthIncomeCents = incomeEntries.filter((entry) => entry.kind === 'income' && entry.transactionDate.startsWith(month)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const [mode, setMode] = useState<'spending' | 'trends'>('spending');
  useFocusEffect(useCallback(() => { if (!consumeSkippedPanelRefresh('/analytics')) void revalidate(); }, [revalidate]));
  const analytics = useMemo(() => analyticsForMonth(expenses, allCategories, month), [allCategories, expenses, month]);
  const priorMonth = previousMonth(month);
  const previous = useMemo(() => analyticsForMonth(expenses, allCategories, priorMonth), [allCategories, expenses, priorMonth]);
  const monthLabel = formatMonth(month);
  const maxDay = Math.max(...analytics.dailyTotals.map((item) => item.amountCents), 1);
  const change = previous.totalCents ? Math.round(((analytics.totalCents - previous.totalCents) / previous.totalCents) * 100) : null;
  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading && expenses.length > 0} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <AppText variant="hero" numberOfLines={1}>Analytics</AppText>
        <PeriodStepper subject="analytics month" label={monthLabel} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} nextDisabled={month >= todayLocalDate().slice(0, 7)} />
        <View style={s.segment}>
          <PressableScale onPress={() => setMode('spending')} style={[s.segmentHalf, mode === 'spending' && s.segmentActive]}><AppText variant="h3" style={mode === 'spending' ? s.segmentActiveText : s.muted}>Spending</AppText></PressableScale>
          <PressableScale onPress={() => setMode('trends')} style={[s.segmentHalf, mode === 'trends' && s.segmentActive]}><AppText variant="h3" style={mode === 'trends' ? s.segmentActiveText : s.muted}>Trends</AppText></PressableScale>
        </View>
        {loading && expenses.length === 0 ? <Card style={s.analyticsLoading}><ActivityIndicator color={colors.deepForest} /><View style={s.analyticsSkeletonCircle} /><View style={s.skeletonLineWide} /></Card> : loadError ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load analytics.</AppText><AppText style={[s.muted, s.center]}>Check your connection and try again.</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : mode === 'spending' ? <Card style={s.analyticsCard}>{/* Overview and expense structure share one card: what came in, what went out, and where it went. */}<View style={s.overview}><AppText variant="h2">Overview</AppText><View style={s.rowBetween}><AppText>Income</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={[s.overviewValue, { color: colors.success }]}>{formatPeso(monthIncomeCents)}</AppText></View><View style={s.rowBetween}><AppText>Expense</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={[s.overviewValue, { color: colors.danger }]}>{formatPeso(analytics.totalCents)}</AppText></View><View style={s.divider} /><View style={s.rowBetween}><AppText variant="h3">Total</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={s.overviewValue}>{monthIncomeCents - analytics.totalCents < 0 ? '−' : ''}{formatPeso(Math.abs(monthIncomeCents - analytics.totalCents))}</AppText></View></View><View style={s.divider} /><AppText variant="h2" style={s.structureTitle}>Expense Structure</AppText>{analytics.expenses.length === 0 ? <View style={s.structureEmpty}><AppText style={[s.muted, s.center]}>No spending in {monthLabel} yet.</AppText><PrimaryButton title="Add Expense" onPress={openAddExpense} /></View> : <View style={s.structureRow}><View style={s.structureChart}><DonutChart slices={analytics.categorySlices} refreshKey={month} minSize={120} maxSize={170}><AppText variant="h3" adjustsFontSizeToFit numberOfLines={1}>{compactCurrency(analytics.totalCents)}</AppText><AppText variant="small" style={s.muted}>Spent</AppText></DonutChart></View><View style={s.structureLegend}>{analytics.categorySlices.map((slice) => <View style={s.legend} key={slice.id}><View style={[s.legendDot, { backgroundColor: slice.color }]} /><AppText style={[s.muted, s.legendLabel]} numberOfLines={1}>{slice.label}</AppText><AppText style={[s.muted, s.legendValue]}>{formatPercent(slice.percentage)}</AppText></View>)}</View></View>}</Card> : analytics.expenses.length === 0 ? <Card style={s.emptyCard}><View style={s.emptyIcon}><AppIcon name="chart-donut" size={30} /></View><AppText variant="h2">No spending data yet</AppText><AppText style={[s.muted, s.center]}>Add expenses to start seeing your spending patterns.</AppText><PrimaryButton title="Add Expense" onPress={openAddExpense} /></Card> : <Card style={s.trendsCard}><View style={s.rowBetween}><View><AppText style={s.muted}>This month</AppText><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{compactCurrency(analytics.totalCents)}</AppText></View><View style={s.trendChange}><AppIcon name={change !== null && change > 0 ? 'trending-up' : 'trending-down'} size={20} color={change !== null && change > 0 ? colors.danger : colors.success} /><AppText variant="h3" style={{ color: change !== null && change > 0 ? colors.danger : colors.success }}>{change === null ? 'No comparison' : `${change > 0 ? '+' : ''}${change}%`}</AppText></View></View>{previous.totalCents === 0 || analytics.expenses.length < 2 ? <View style={s.trendEmpty}><AppText variant="h2">Not enough history yet</AppText><AppText style={[s.muted, s.center]}>Keep tracking expenses and your trends will appear here.</AppText></View> : <><View style={s.barChart}>{analytics.dailyTotals.map((item) => <View key={item.day} style={s.barColumn}><View style={[s.bar, { height: Math.max(8, Math.round((item.amountCents / maxDay) * 130)) }]} /><AppText variant="small" style={s.muted}>{item.day}</AppText></View>)}</View><View style={s.trendMetrics}><TrendMetric label={`${formatMonth(priorMonth)} total`} value={compactCurrency(previous.totalCents)} /><TrendMetric label="Daily average" value={compactCurrency(analytics.averageDailyCents)} /><TrendMetric label="Highest-spend day" value={analytics.highestDay ? `${monthLabel.split(' ')[0]} ${analytics.highestDay.day} · ${compactCurrency(analytics.highestDay.amountCents)}` : '—'} /></View></>}</Card>}
        {analytics.expenses.length > 0 ? <InsightsLink month={month} /> : null}
      </View>
    </Screen>
  );
}

/**
 * Sits directly under the analytics card as a sibling inside the shared page
 * frame, so it inherits the same horizontal padding as the title, month
 * selector and card rather than aligning itself independently. `flex-start`
 * keeps the row hugging its text, which is what keeps the arrow beside the
 * label instead of pinned to the far edge of the screen.
 */
function InsightsLink({ month }: { month: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="View spending insights"
      onPress={() => router.push(`/insights?month=${month}` as never)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={hovered ? [s.insightsLink, s.insightsLinkHovered] : s.insightsLink}
    >
      <AppText style={s.insightsLinkText}>View Spending Insights</AppText>
      <AppIcon name="arrow-right" size={18} color={colors.deepForest} />
    </PressableScale>
  );
}

export function InsightsScreen() {
  const { openAddExpense } = useAddExpenseOverlay();
  const params = useLocalSearchParams<{ month?: string }>();
  const { expenses, loading, loadError, refresh, revalidate } = useExpenses();
  const { allCategories } = useCategories();
  const { budgets } = useBudgets();
  const bottomInset = useBottomNavInset();
  const month = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : todayLocalDate().slice(0, 7);
  useFocusEffect(useCallback(() => { void revalidate(); }, [revalidate]));
  const current = useMemo(() => analyticsForMonth(expenses, allCategories, month), [allCategories, expenses, month]);
  const previous = useMemo(() => analyticsForMonth(expenses, allCategories, previousMonth(month)), [allCategories, expenses, month]);
  const monthBudget = budgets.find((item) => item.month === month);
  const insights = useMemo(() => buildInsights(current, previous, allCategories, monthBudget), [allCategories, current, monthBudget, previous]);
  const [detail, setDetail] = useState<InsightDetail | null>(null);
  const openInsight = (insight: AnalyticsInsight) => setDetail(detailForInsight(insight, { expenses, current, previous, categories: allCategories, budget: monthBudget, month, today: todayLocalDate() }));
  return (
    <Screen bottomInset={bottomInset} variant={12} fixed={<BottomNavigation />} refreshing={loading && expenses.length > 0} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <View style={s.insightHero}>
          <View style={{ flex: 1 }}>
            <AppText variant="hero" numberOfLines={2} style={s.insightTitle}>Spending Insights</AppText>
          </View>
          <Image source={mascotImage[mascotMood({ loading: loading && expenses.length === 0, current, previous, budget: monthBudget })]} contentFit="contain" transition={180} style={s.insightMascot} />
        </View>
        {loading && expenses.length === 0 ? <Card style={s.analyticsLoading}><ActivityIndicator color={colors.deepForest} /><View style={s.skeletonLineWide} /><View style={s.skeletonLine} /></Card> : loadError ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load insights.</AppText><AppText style={[s.muted, s.center]}>Check your connection and try again.</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : insights.length === 0 ? <Card style={s.emptyCard}><View style={s.emptyIcon}><AppIcon name="lightbulb-outline" size={30} /></View><AppText variant="h2">No insights yet</AppText><AppText style={[s.muted, s.center]}>Add expenses for {formatMonth(month)} to reveal useful spending patterns.</AppText><PrimaryButton title="Add Expense" onPress={openAddExpense} /></Card> : insights.map((insight) => <PressableScale key={insight.id} accessibilityRole="button" accessibilityHint="Shows what this means and what you can do" onPress={() => openInsight(insight)}><Card style={s.insightCard}><View style={s.insightIcon}><AppIcon name={insight.icon} size={32} color={colors.deepForest} /></View><View style={{ flex: 1 }}><AppText style={s.muted}>{insight.label}</AppText><AppText variant="h2">{insight.title}</AppText><AppText style={s.muted}>{insight.detail}</AppText></View><AppIcon name="chevron-right" size={24} color={colors.deepForest} /></Card></PressableScale>)}
      </View>
      <InsightDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}

function TrendMetric({ label, value }: { label: string; value: string }) {
  return <View style={s.trendMetric}><AppText style={s.muted}>{label}</AppText><AppText variant="h3">{value}</AppText></View>;
}

export function CategoriesScreen() {
  const { categories, hiddenCategories, loading: categoriesLoading, error: categoriesError, refresh: refreshCategories, createCategory, updateCategory, hideCategory, restoreCategory } = useCategories();
  const { categories: dashboardCategories, isFull, isOnDashboard, addCategory, removeCategory } =
    useDashboardCategories();
  const { showToast } = useToast();
  const bottomInset = useBottomNavInset();
  const [editor, setEditor] = useState<{ id?: string } | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<Parameters<typeof AppIcon>[0]['name']>('shape-outline');
  const [color, setColor] = useState('#315F43');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hideId, setHideId] = useState<string | null>(null);
  const iconChoices = ['shape-outline', 'coffee-outline', 'home-outline', 'paw-outline', 'music-note-outline', 'briefcase-outline'] as const;
  const colorChoices = ['#315F43', '#C92525', '#E45C0A', '#3477B8', '#7057A3', '#28704B'] as const;
  const hiding = categories.find((item) => item.id === hideId);

  const openCreate = () => { setName(''); setIcon('shape-outline'); setColor('#315F43'); setFormError(null); setEditor({}); };
  const openEdit = (id: string) => { const category = categories.find((item) => item.id === id); if (!category?.custom) return; setName(category.fullLabel); setIcon(category.icon); setColor(category.color ?? '#315F43'); setFormError(null); setEditor({ id }); };
  const saveCategory = async () => {
    if (!editor || saving) return;
    const cleanName = name.trim();
    if (!cleanName) { setFormError('Enter a category name.'); return; }
    if (cleanName.length > 40) { setFormError('Use 40 characters or fewer.'); return; }
    if ([...categories, ...hiddenCategories].some((item) => item.id !== editor.id && item.fullLabel.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) { setFormError('A category with this name already exists.'); return; }
    setSaving(true);
    const input = { name: cleanName, icon: icon as (typeof categories)[number]['icon'], color };
    const result = editor.id ? await updateCategory(editor.id, input) : await createCategory(input);
    setSaving(false);
    if (!result.ok) { setFormError(result.message); return; }
    selectionFeedback(); showToast(editor.id ? 'Category updated.' : 'Category added.'); setEditor(null);
  };
  const hide = async () => {
    if (!hiding || saving) return;
    if (categories.length <= 1) { showToast('Keep at least one category visible.', { tone: 'warning' }); setHideId(null); return; }
    setSaving(true); const result = await hideCategory(hiding.id); setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    removeCategory(hiding.id); showToast(`${hiding.fullLabel} hidden. Past transactions keep it.`); setHideId(null); setEditor(null);
  };
  const restore = async (id: string, label: string) => {
    const result = await restoreCategory(id);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    selectionFeedback(); showToast(`${label} is visible again.`);
  };

  const reportLimit = () => {
    warningFeedback();
    showToast(CATEGORY_LIMIT_MESSAGE, { tone: 'warning' });
  };

  const toggleDashboard = (id: string, label: string) => {
    if (isOnDashboard(id)) {
      removeCategory(id);
      selectionFeedback();
      showToast(`${label} removed from your dashboard.`);
      return;
    }

    if (addCategory(id)) {
      selectionFeedback();
      showToast(`${label} added to your dashboard.`);
      return;
    }

    reportLimit();
  };

  return (
    <Screen bottomInset={bottomInset} variant={10} fixed={<><FloatingRadialMenu /><BottomNavigation /></>}>
      <View style={s.page}>
        <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Categories</AppText>
        <AppText style={s.muted}>Organize your spending, your way.</AppText>
        <AppText variant="small" style={s.muted}>
          {dashboardCategories.length} of {MAX_DASHBOARD_CATEGORIES} shown on your dashboard
        </AppText>
        {categoriesLoading ? <View style={s.categoryLoading}><ActivityIndicator color={colors.deepForest} /><AppText style={s.muted}>Loading your categories…</AppText></View> : null}
        {categoriesError ? <Card style={s.categoryError}><AppText style={s.muted}>Your categories couldn&apos;t be loaded.</AppText><SecondaryButton title="Try Again" onPress={() => void refreshCategories()} /></Card> : null}

        {categories.map(category => {
          const onDashboard = isOnDashboard(category.id);
          return (
            /*
              Plain container with sibling press targets. Nesting a toggle
              inside the row's pressable would render a <button> inside a
              <button> on web.
            */
            <Card key={category.id} style={s.categoryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${category.fullLabel}`}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
                style={({ pressed }) => [s.categoryMain, pressed && { opacity: 0.7 }]}
              >
                <View style={[s.categoryIcon, { backgroundColor: category.color ? `${category.color}22` : CATEGORY_TONES[category.id]?.background ?? '#E1EBDD' }]}>
                  <AppIcon name={category.icon} color={category.color ?? CATEGORY_TONES[category.id]?.foreground ?? colors.deepForest} />
                </View>
                <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {category.fullLabel}
                </AppText>
                <AppIcon name="chevron-right" color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  onDashboard
                    ? `Remove ${category.fullLabel} from dashboard`
                    : `Add ${category.fullLabel} to dashboard`
                }
                accessibilityState={{ selected: onDashboard }}
                hitSlop={6}
                onPress={() => toggleDashboard(category.id, category.fullLabel)}
                style={({ pressed }) => [
                  s.dashboardToggle,
                  onDashboard && s.dashboardToggleOn,
                  !onDashboard && isFull && s.dashboardToggleBlocked,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <AppIcon
                  name={onDashboard ? 'check' : 'plus'}
                  size={17}
                  color={onDashboard ? colors.surface : isFull ? colors.muted : colors.deepForest}
                />
              </Pressable>
              {category.custom
                ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${category.fullLabel}`} hitSlop={6} onPress={() => openEdit(category.id)} style={({ pressed }) => [s.categoryEdit, pressed && { opacity: 0.7 }]}><AppIcon name="pencil-outline" size={18} /></Pressable>
                : <Pressable accessibilityRole="button" accessibilityLabel={`Hide ${category.fullLabel}`} hitSlop={6} onPress={() => setHideId(category.id)} style={({ pressed }) => [s.categoryEdit, pressed && { opacity: 0.7 }]}><AppIcon name="eye-off-outline" size={18} /></Pressable>}
            </Card>
          );
        })}

        <PrimaryButton
          title="Add Custom Category"
          icon="plus"
          onPress={openCreate}
        />

        {hiddenCategories.length ? <>
          <AppText variant="h2">Hidden Categories</AppText>
          <AppText variant="small" style={s.muted}>Hidden categories stay on past transactions but aren&apos;t offered for new ones.</AppText>
          {hiddenCategories.map((category) => (
            <Card key={category.id} style={s.categoryRow}>
              <View style={[s.categoryMain, s.categoryHidden]}>
                <View style={[s.categoryIcon, { backgroundColor: '#E6E8E2' }]}><AppIcon name={category.icon} color={colors.muted} /></View>
                <AppText variant="h3" style={{ flex: 1, color: colors.muted }} numberOfLines={1}>{category.fullLabel}</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Show ${category.fullLabel} again`} hitSlop={6} onPress={() => void restore(category.id, category.fullLabel)} style={({ pressed }) => [s.categoryRestore, pressed && { opacity: 0.7 }]}>
                <AppIcon name="eye-outline" size={17} />
                <AppText variant="small" style={s.sectionLinkText}>Show</AppText>
              </Pressable>
            </Card>
          ))}
        </> : null}
      </View>
      <DraggableBottomSheet visible={Boolean(editor)} disabled={saving} onClose={() => setEditor(null)}><AppText variant="h2">{editor?.id ? 'Edit Category' : 'Add Category'}</AppText><FormInput label="Category name" placeholder="e.g. Pets" value={name} onChangeText={(value) => { setName(value); setFormError(null); }} maxLength={40} error={formError ?? undefined} /><AppText variant="bodyMedium">Icon</AppText><View style={s.choiceRow}>{iconChoices.map((value) => <PressableScale key={value} accessibilityLabel={`Use ${value} icon`} accessibilityState={{ selected: icon === value }} onPress={() => setIcon(value)} style={[s.choiceCircle, icon === value && s.choiceCircleActive]}><AppIcon name={value} color={icon === value ? colors.surface : colors.deepForest} /></PressableScale>)}</View><AppText variant="bodyMedium">Color</AppText><View style={s.choiceRow}>{colorChoices.map((value) => <PressableScale key={value} accessibilityLabel={`Use color ${value}`} accessibilityState={{ selected: color === value }} onPress={() => setColor(value)} style={[s.colorChoice, { backgroundColor: value }, color === value && s.colorChoiceActive]}>{color === value ? <AppIcon name="check" size={17} color={colors.surface} /> : null}</PressableScale>)}</View><PrimaryButton title={saving ? 'Saving…' : editor?.id ? 'Save Changes' : 'Add Category'} disabled={saving} onPress={() => void saveCategory()} />{editor?.id ? <SecondaryButton title="Hide Category" disabled={saving} onPress={() => setHideId(editor.id ?? null)} /> : null}</DraggableBottomSheet>
      <AuthDialog visible={Boolean(hiding)} title={`Hide ${hiding?.fullLabel ?? 'category'}?`} message="It won't be offered for new expenses or budgets. Past transactions keep it, and you can show it again from Hidden Categories." primaryAction={{ label: 'Hide', destructive: true, loading: saving, onPress: () => void hide() }} secondaryAction={{ label: 'Cancel', onPress: () => setHideId(null) }} onRequestClose={() => setHideId(null)} />
    </Screen>
  );
}

const SETTINGS_ROWS = [
  { icon: 'account-outline', label: 'Account Information', route: '/settings/account' },
  { icon: 'lock-outline', label: 'Change Password', route: '/settings/change-password' },
  { icon: 'bell-outline', label: 'Notifications', route: '/settings/notifications' },
  { icon: 'palette-outline', label: 'Appearance', route: '/settings/appearance' },
  { icon: 'shield-check-outline', label: 'Privacy & Data', route: '/settings/privacy' },
  { icon: 'help-circle-outline', label: 'Help & Support', route: '/settings/help' },
  { icon: 'information-outline', label: 'About', route: '/settings/about' },
] as const;

function SettingsRow({ icon, label, route, index }: { icon: Parameters<typeof AppIcon>[0]['name']; label: string; route: string; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <FadeSlideIn index={index}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={`Opens ${label}`}
        onPress={() => router.push(route as never)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        scaleTo={0.985}
        style={hovered ? [s.settingsRow, s.settingsRowHovered] : s.settingsRow}
      >
        <View style={s.settingsRowIcon}><AppIcon name={icon} size={22} color={colors.deepForest} /></View>
        <AppText variant="h3" style={s.settingsRowLabel} numberOfLines={1}>{label}</AppText>
        <AppIcon name="chevron-right" size={24} color={colors.muted} />
      </PressableScale>
    </FadeSlideIn>
  );
}

export function ProfileScreen() {
  const { signOut } = useAuth();
  const { displayName, initials, email, loading, loadError, refresh } = useProfile();

  // Local state rather than useAuthDialog so the confirm dialog's loading flag
  // stays live while sign-out is in flight (a stored config would be stale).
  const [logoutDialog, setLogoutDialog] = useState<'confirm' | 'error' | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const handleConfirmLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);

    // Clears only the Supabase auth session. No local data is touched.
    const result = await signOut();
    setSigningOut(false);

    if (!result.ok) {
      setLogoutDialog('error');
      return;
    }

    // Replace the protected route so Back cannot reveal authenticated content
    // after the Supabase session has been cleared.
    setLogoutDialog(null);
    router.replace('/onboarding');
  };

  // Profile is a drill-down from the header avatar, not a tab — so it carries a
  // back arrow and no bottom navbar, matching its own settings sub-pages.
  return (
    <Screen bottomInset={48} variant={13}>
      <View style={s.page}>
        <View style={s.profileHeader}>
          <BackButton />
          <View style={s.profileHeaderCopy}>
            <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Profile &amp; Settings</AppText>
            <AppText style={s.muted}>Manage your account and preferences.</AppText>
          </View>
        </View>

        <FadeSlideIn index={0}>
          <Card style={s.profileCard}>
            {loading && !email ? (
              // Skeleton rather than placeholder names, so no fake identity
              // ever flashes on screen while the profile loads.
              <>
                <View style={[s.profileAvatar, s.profileAvatarSkeleton]} />
                <View style={s.profileSkeletonName} />
                <View style={s.profileSkeletonEmail} />
              </>
            ) : (
              <>
                <View style={s.profileAvatar}>
                  <AppText variant="hero" style={s.profileInitials} accessibilityLabel={`Profile initials ${initials}`}>{initials}</AppText>
                </View>
                <AppText variant="h2" style={s.center} numberOfLines={2}>{displayName}</AppText>
                <AppText style={[s.muted, s.center]} numberOfLines={1} ellipsizeMode="middle">{email}</AppText>
                {loadError ? (
                  <PressableScale accessibilityRole="button" accessibilityLabel="Retry loading profile" onPress={() => void refresh()} style={s.profileRetry}>
                    <AppIcon name="refresh" size={16} color={colors.deepForest} />
                    <AppText variant="small" style={s.profileRetryText}>Couldn&apos;t refresh — tap to retry</AppText>
                  </PressableScale>
                ) : null}
              </>
            )}
          </Card>
        </FadeSlideIn>

        {SETTINGS_ROWS.map((row, index) => (
          <SettingsRow key={row.label} icon={row.icon} label={row.label} route={row.route} index={index + 1} />
        ))}

        <FadeSlideIn index={SETTINGS_ROWS.length + 1}>
          <PressableScale
            onPress={() => setLogoutDialog('confirm')}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            scaleTo={0.985}
            style={s.logoutCard}
          >
            <AppIcon name="logout" size={22} color={colors.danger} />
            <AppText variant="h3" style={s.logoutText}>Logout</AppText>
          </PressableScale>
        </FadeSlideIn>
      </View>

      {logoutDialog === 'confirm' && (
        <AuthDialog
          visible
          title={authCopy.logoutConfirm.title}
          message={authCopy.logoutConfirm.message}
          primaryAction={{
            label: 'Log Out',
            destructive: true,
            loading: signingOut,
            onPress: handleConfirmLogout,
          }}
          secondaryAction={{ label: 'Cancel', onPress: () => setLogoutDialog(null) }}
          onRequestClose={() => setLogoutDialog(null)}
        />
      )}

      {logoutDialog === 'error' && (
        <AuthDialog
          visible
          title={authCopy.logoutFailure.title}
          message={authCopy.logoutFailure.message}
          primaryAction={{ label: 'OK', onPress: () => setLogoutDialog(null) }}
          onRequestClose={() => setLogoutDialog(null)}
        />
      )}

    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 16, gap: 16 },
  muted: { color: colors.muted },
  center: { textAlign: 'center' },
  avatar: { position: 'absolute', right: 26, top: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 38 },
  heroMascot: { width: 150, height: 130 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, padding: 12, minHeight: 112, justifyContent: 'space-between' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryTile: { width: '31%', alignItems: 'center', gap: 6, padding: 12 },
  addTile: { width: '31%', minHeight: 91, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lightGreen, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  transactionToolbar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchCompact: { width: 46, height: 48, flexShrink: 0, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.92)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  searchExpanded: { flex: 1, height: 50, minWidth: 0, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.92)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 7, gap: 8 },
  searchClose: { width: 34, height: 34, flexShrink: 0, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  spendingCalendar: { gap: 10, padding: 14 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calendarNav: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  calendarWeek: { flexDirection: 'row' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, minHeight: 52, padding: 2 },
  calendarWeekday: { color: colors.muted, textAlign: 'center', paddingTop: 6 },
  calendarDay: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1, borderWidth: 1, borderColor: 'transparent' },
  calendarDayHasSpending: { backgroundColor: '#EDF4E9', borderColor: '#D8E6D2' },
  calendarDaySelected: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  calendarDaySelectedText: { color: colors.surface },
  calendarAmount: { width: '100%', paddingHorizontal: 1, textAlign: 'center', color: colors.forest, fontFamily: 'JakartaSemiBold', fontSize: 9, lineHeight: 12 },
  calendarSummary: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12 },
  calendarSelection: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.pale },
  calendarSelectionText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  search: { height: 54, backgroundColor: 'rgba(232,238,227,.88)', borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontFamily: 'JakartaRegular', fontSize: 15, color: colors.text },
  filters: { flexDirection: 'row', gap: 8 },
  // Tighter internal padding buys label width before any font scaling does.
  filter: { minWidth: 0, height: 48, paddingHorizontal: 8, gap: 3, flexDirection: 'row', borderRadius: radii.md, backgroundColor: 'rgba(255,253,247,.96)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
  filterActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  filterActiveText: { color: colors.surface },
  clearFilters: { alignSelf: 'flex-end', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  clearFiltersText: { color: colors.deepForest, fontFamily: 'JakartaBold' },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAmount: { flexGrow: 1, minWidth: '21%', minHeight: 42, paddingHorizontal: 9, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lightGreen, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  quickAmountSelected: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  quickAmountText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  quickAmountTextSelected: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  filterSheet: { width: '100%', maxWidth: 480, maxHeight: '82%', alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, gap: 16 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF', alignSelf: 'center' },
  pickerOptions: { gap: 7 },
  monthDatePicker: { alignItems: 'center', justifyContent: 'center', minHeight: 74 },
  selectedMonthPreview: { color: colors.muted, textAlign: 'center' },
  pickerOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radii.md, paddingHorizontal: 12, borderWidth: 1, borderColor: 'transparent' },
  pickerOptionSelected: { backgroundColor: colors.pale, borderColor: colors.lightGreen },
  pickerOptionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE8D8' },
  pickerOptionCopy: { flex: 1 },
  group: { marginTop: 14, color: colors.muted },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  transactionAmount: { flexShrink: 0, maxWidth: '36%', textAlign: 'right' },
  roundIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E1EBDD', alignItems: 'center', justifyContent: 'center' },
  overview: { gap: 10, alignSelf: 'stretch' },
  overviewValue: { flexShrink: 1, textAlign: 'right' },
  structureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  structureChart: { width: '48%', alignItems: 'center' },
  structureLegend: { flex: 1, minWidth: 0 },
  structureTitle: { alignSelf: 'flex-start', marginTop: 6 },
  structureEmpty: { gap: 12, alignSelf: 'stretch', paddingVertical: 8 },
  searchWide: { flex: 1, minHeight: 46, borderRadius: radii.pill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,253,247,.96)', borderWidth: 1, borderColor: colors.line },
  filterPill: { minHeight: 46, paddingHorizontal: 16, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,253,247,.96)', borderWidth: 1.5, borderColor: colors.lightGreen },
  filterPillActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  filterPillText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  filterPillTextActive: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  filterClear: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.pale },
  filterSection: { gap: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 36, paddingHorizontal: 13, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.pale },
  filterChipSelected: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  filterChipText: { color: colors.deepForest, fontFamily: 'JakartaMedium' },
  filterChipTextSelected: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  roundIconIncoming: { backgroundColor: '#DDF0E2' },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  editField: { minHeight: 54, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.9)', borderWidth: 1, borderColor: '#C9D5C5', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  editFieldError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  editFieldText: { flex: 1, minWidth: 0, fontFamily: 'JakartaMedium' },
  stepper: { minHeight: 56, borderRadius: radii.lg, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,253,247,.97)', ...shadow },
  stepperButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  stepperButtonDisabled: { opacity: 0.45 },
  stepperLabel: { flex: 1, minWidth: 0, textAlign: 'center' },
  walletActions: { flexDirection: 'row', gap: 10 },
  budgetTotals: { gap: 8, paddingVertical: 14 },
  categoryHidden: { opacity: 0.85 },
  categoryRestore: { minHeight: 38, paddingHorizontal: 12, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.pale },
  loadingCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 12 },
  skeletonList: { gap: 10, marginTop: 8 },
  skeletonCard: { minHeight: 86, borderRadius: radii.lg, backgroundColor: 'rgba(255,253,247,.9)', flexDirection: 'row', alignItems: 'center', padding: 15, gap: 14 },
  skeletonIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DDE5D9' },
  skeletonCopy: { flex: 1, gap: 9 },
  skeletonLineWide: { width: '68%', height: 14, borderRadius: 7, backgroundColor: '#DDE5D9' },
  skeletonLine: { width: '42%', height: 11, borderRadius: 6, backgroundColor: '#E7EBE3' },
  emptyCard: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 13, paddingHorizontal: 28 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  detailHead: { alignItems: 'center', gap: 8 },
  divider: { height: 1, backgroundColor: colors.line },
  receiptPreview: { height: 140, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginTop: 10, alignItems: 'flex-start', paddingLeft: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  edit: { flex: 1, height: 58, gap: 8, flexDirection: 'row', borderRadius: radii.md, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  delete: { flex: 1, height: 58, gap: 8, flexDirection: 'row', borderRadius: radii.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  editHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  editCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editCategory: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  editCategoryActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  editCategoryTextActive: { color: colors.surface },
  editNotes: { minHeight: 96, alignItems: 'flex-start' },
  errorText: { color: colors.danger, marginTop: -8 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  analyticsMonth: { minHeight: 68, borderRadius: radii.lg, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,253,247,.97)', ...shadow },
  monthlyBudgetCard: { gap: 13, paddingVertical: 22 },
  editBudgetButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  budgetSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  budgetSummaryItem: { flexGrow: 1, minWidth: 118, gap: 2 },
  budgetSummaryRight: { alignItems: 'flex-end' },
  budgetPercent: { flexShrink: 0, minWidth: 54, textAlign: 'right' },
  addBudgetContext: { gap: 10, padding: 14, borderRadius: radii.md, backgroundColor: colors.pale },
  noLimits: { gap: 4, backgroundColor: 'rgba(255,253,247,.9)' },
  /* Wallet panel: dark summary card, then a card-face grid of wallets. */
  balanceCard: { borderRadius: radii.lg, padding: spacing.lg, gap: 6, backgroundColor: colors.deepForest, ...shadow },
  balanceCaption: { color: 'rgba(255,255,255,.66)', fontFamily: 'JakartaSemiBold', fontSize: 9, lineHeight: 13, letterSpacing: 1.1 },
  balanceEye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.14)' },
  balanceValue: { color: colors.white, fontFamily: 'JakartaExtraBold', fontSize: 34, lineHeight: 41 },
  balanceMetrics: { marginTop: 6, flexDirection: 'row', gap: 8 },
  balanceMetric: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 9, paddingHorizontal: 11, borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,.12)' },
  balanceMetricValue: { color: colors.white, fontFamily: 'JakartaBold', fontSize: 15, lineHeight: 20 },
  sectionHead: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionLink: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  sectionLinkText: { color: colors.forest, fontFamily: 'JakartaBold' },
  // Two columns with a gap; the cell holds the width so the card face itself
  // only ever has to be 100% wide and keep its aspect ratio.
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Fixed width, never flex-grow: a lone card in the last row must stay
  // card-sized instead of stretching into a full-width slab.
  walletCell: { width: '48%' },
  walletSkeleton: { width: '100%', aspectRatio: 1.62, borderRadius: radii.md, backgroundColor: 'rgba(255,253,247,.9)' },
  addMoneyRow: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.md, backgroundColor: colors.pale },
  goalsRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.md, backgroundColor: 'rgba(255,253,247,.96)', ...shadow },
  goalsIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radii.md, backgroundColor: colors.pale, padding: 4 },
  segmentActive: { flex: 1, height: 42, borderRadius: radii.sm, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' },
  segmentActiveText: { color: colors.surface },
  segmentHalf: { flex: 1, height: 42, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  donut: { width: 200, height: 200, borderRadius: 100, borderWidth: 18, borderColor: colors.deepForest, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  donutInner: { alignItems: 'center' },
  analyticsCard: { alignItems: 'center', paddingVertical: 22 },
  analyticsLoading: { minHeight: 350, alignItems: 'center', justifyContent: 'center', gap: 18 },
  analyticsSkeletonCircle: { width: 190, height: 190, borderRadius: 95, borderWidth: 25, borderColor: '#DDE5D9' },
  legendList: { width: '100%', marginTop: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  // Name takes the slack; the percentage keeps its width and stays right-aligned.
  legendLabel: { flex: 1, minWidth: 0 },
  legendValue: { flexGrow: 0, flexShrink: 0, minWidth: 44, textAlign: 'right' },
  legendDot: { flexGrow: 0, flexShrink: 0, width: 12, height: 12, borderRadius: 6 },
  // A deliberate secondary CTA rather than a floating text link: full content
  // width, centred label and arrow, on its own pale surface.
  insightsLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: '#E7F0E2',
    borderWidth: 1.5,
    borderColor: '#C6D9BF',
  },
  insightsLinkHovered: { backgroundColor: '#DBE9D4', borderColor: colors.forest },
  insightsLinkText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold', fontSize: 16, lineHeight: 22 },
  trendsCard: { gap: 22, paddingVertical: 24 },
  trendChange: { alignItems: 'flex-end', gap: 3 },
  trendEmpty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  barChart: { minHeight: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 4 },
  barColumn: { flex: 1, minWidth: 7, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  bar: { width: '72%', maxWidth: 24, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: colors.forest },
  trendMetrics: { gap: 0 },
  trendMetric: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  insightHero: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'visible' },
  insightTitle: { fontSize: 38, lineHeight: 42 },
  insightMascot: { width: 128, height: 128, marginRight: -8 },
  insightCard: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20 },
  insightIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  iconSoft: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  // Profile & Settings — mirrors 11_ProfileSettingsScreen: a tall avatar card,
  // then evenly weighted rows with pale-green icon circles and a chevron.
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  profileHeaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  profileCard: { alignItems: 'center', gap: 6, paddingVertical: 26, borderRadius: radii.lg },
  profileAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  profileAvatarSkeleton: { backgroundColor: colors.pale },
  profileInitials: { color: colors.surface, fontSize: 38, lineHeight: 44 },
  profileSkeletonName: { width: 128, height: 22, borderRadius: radii.pill, backgroundColor: colors.pale },
  profileSkeletonEmail: { width: 176, height: 15, borderRadius: radii.pill, backgroundColor: colors.pale, marginTop: 6 },
  profileRetry: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, marginTop: 4 },
  profileRetryText: { color: colors.deepForest },
  settingsRow: {
    boxSizing: 'border-box',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,253,247,.97)',
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadow,
  },
  settingsRowHovered: { backgroundColor: '#F2F6EE', borderColor: '#D5E2CF' },
  settingsRowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDEBDD', alignItems: 'center', justifyContent: 'center' },
  settingsRowLabel: { flex: 1, minWidth: 0 },
  logoutCard: {
    boxSizing: 'border-box',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 68,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F3DBD8',
    marginTop: 4,
  },
  logoutText: { color: colors.danger },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryLoading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryError: { gap: 10 },
  categoryMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1EBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEdit: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.pale, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  choiceCircleActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  colorChoice: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  colorChoiceActive: { borderColor: colors.text },
  dashboardToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardToggleOn: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  dashboardToggleBlocked: { borderColor: colors.line, backgroundColor: colors.pale },

  /* Budget row: icon | info (flex) | values | chevron */
  budgetRow: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,253,247,.96)',
    ...shadow,
  },
  budgetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  // Capped as a share of the row so a large amount can't starve the category
  // name next to it. Percentage rather than pixels keeps it responsive.
  budgetValues: {
    alignItems: 'flex-end',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 76,
    maxWidth: '42%',
    gap: 2,
  },
});
