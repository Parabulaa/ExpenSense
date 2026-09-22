import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Calendar } from '@/components/common/calendar';
import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { FadeSlideIn, PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton, ProgressBar, SecondaryButton, StatusChip } from '@/components/common/ui';
import { BottomNavigation, useBottomNavInset } from '@/components/navigation/bottom-navigation';
import { FloatingRadialMenu } from '@/components/navigation/floating-radial-menu';
import { assets, colors, radii, shadow, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { analyticsForMonth, buildInsights, previousMonth } from '@/features/analytics/analytics';
import { DonutChart } from '@/features/analytics/DonutChart';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import { authCopy } from '@/features/auth/copy';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { parseBudgetAmount } from '@/features/budget/validation';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { MAX_DASHBOARD_CATEGORIES } from '@/features/dashboard/dashboard-data';
import { useDashboardCategories } from '@/features/dashboard/DashboardCategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import type { Expense, ExpenseFormErrors, ExpenseFormValues } from '@/features/expenses/types';
import { formatExpenseDate, normalizeAmountInput, todayLocalDate, validateExpenseForm } from '@/features/expenses/validation';
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
  const { categories } = useCategories();
  const { expenses, loading, loadError, refresh } = useExpenses();
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
  const [picker, setPicker] = useState<PickerKind>(null);
  const [calendarMonth, setCalendarMonth] = useState(todayLocalDate().slice(0, 7));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (consumeSkippedPanelRefresh('/transactions')) return;
    void refresh();
  }, [refresh]));

  const visibleExpenses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const today = todayLocalDate();
    const now = new Date(`${today}T12:00:00`);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (dateFilter === 'last7' ? 6 : 29));
    const cutoffValue = localDateString(cutoff);
    const filtered = expenses.filter((expense) => {
      const category = categories.find((item) => item.id === expense.categoryId);
      const matchesQuery = !needle || `${expense.merchant} ${category?.fullLabel ?? ''} ${expense.notes ?? ''}`.toLocaleLowerCase().includes(needle);
      const matchesCategory = categoryFilter === 'all' || expense.categoryId === categoryFilter;
      const matchesDisplayedMonth = expense.transactionDate.startsWith(calendarMonth);
      const matchesCalendarDate = !selectedCalendarDate || expense.transactionDate === selectedCalendarDate;
      const matchesDate = dateFilter === 'all' ||
        (dateFilter === 'today' && expense.transactionDate === today) ||
        (dateFilter === 'month' && expense.transactionDate.startsWith(calendarMonth)) ||
        ((dateFilter === 'last7' || dateFilter === 'last30') && expense.transactionDate >= cutoffValue && expense.transactionDate <= today);
      return matchesDisplayedMonth && matchesQuery && matchesCategory && matchesDate && matchesCalendarDate;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return a.transactionDate.localeCompare(b.transactionDate) || a.createdAt.localeCompare(b.createdAt);
      if (sort === 'highest') return b.amountCents - a.amountCents;
      if (sort === 'lowest') return a.amountCents - b.amountCents;
      return b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [calendarMonth, categories, categoryFilter, dateFilter, expenses, query, selectedCalendarDate, sort]);

  const groups = useMemo(() => groupExpensesByDate(visibleExpenses), [visibleExpenses]);
  const hasFilters = Boolean(query.trim()) || dateFilter !== 'all' || categoryFilter !== 'all' || sort !== 'newest' || Boolean(selectedCalendarDate);
  const clearFilters = () => { setQuery(''); setSearchOpen(false); setDateFilter('all'); setCategoryFilter('all'); setSort('newest'); setSelectedCalendarDate(null); };

  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading && expenses.length > 0} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <AppText variant="hero">Transactions</AppText>
        <Animated.View layout={LinearTransition.duration(180)} style={s.transactionToolbar}>
          {searchOpen ? <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={s.searchExpanded}><AppIcon name="magnify" size={21} color={colors.muted} /><TextInput autoFocus accessibilityLabel="Search transactions" placeholder="Search transactions..." placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.searchInput} /><PressableScale accessibilityLabel="Close transaction search" onPress={() => { setQuery(''); setSearchOpen(false); }} style={s.searchClose}><AppIcon name="close" size={19} /></PressableScale></Animated.View> : <><PressableScale accessibilityRole="button" accessibilityLabel="Open transaction search" onPress={() => setSearchOpen(true)} style={s.searchCompact}><AppIcon name="magnify" size={22} color={colors.deepForest} /></PressableScale><FilterButton label="Date" active={dateFilter !== 'all'} flex={0.9} onPress={() => setPicker('date')} /><FilterButton label="Category" active={categoryFilter !== 'all'} flex={1.25} onPress={() => setPicker('category')} /><FilterButton label="Sort" active={sort !== 'newest'} flex={0.9} onPress={() => setPicker('sort')} /></>}
        </Animated.View>
        <Animated.View key={calendarMonth} entering={FadeIn.duration(180)}><SpendingCalendar expenses={expenses} month={calendarMonth} selectedDate={selectedCalendarDate} onMonthChange={(next) => { setCalendarMonth(next); setDateFilter('all'); setSelectedCalendarDate(null); }} onSelectDate={(date) => { setDateFilter('all'); setSelectedCalendarDate(date); }} /></Animated.View>
        {hasFilters ? <Pressable accessibilityRole="button" accessibilityLabel="Clear transaction filters" onPress={clearFilters} style={s.clearFilters}><AppIcon name="filter-remove-outline" size={17} /><AppText variant="small" style={s.clearFiltersText}>Clear filters</AppText></Pressable> : null}

        {loading && expenses.length === 0 ? (
          <View style={s.skeletonList}>{[0, 1, 2].map((item) => <View key={item} style={s.skeletonCard}><View style={s.skeletonIcon} /><View style={s.skeletonCopy}><View style={s.skeletonLineWide} /><View style={s.skeletonLine} /></View></View>)}</View>
        ) : loadError && expenses.length === 0 ? (
          <Card style={s.emptyCard}>
            <View style={s.emptyIcon}><AppIcon name="cloud-alert-outline" size={30} /></View>
            <AppText variant="h2">Couldn&apos;t load transactions</AppText>
            <AppText style={[s.muted, s.center]}>{loadError}</AppText>
            <SecondaryButton title="Try Again" onPress={() => void refresh()} />
          </Card>
        ) : groups.length === 0 ? (
          <Card style={s.emptyCard}>
            <View style={s.emptyIcon}><AppIcon name="receipt-text-outline" size={31} /></View>
            <AppText variant="h2">{hasFilters ? 'No matching transactions' : 'No transactions yet'}</AppText>
            <AppText style={[s.muted, s.center]}>{hasFilters ? 'No transactions match these filters.' : 'Add your first expense to start tracking your spending.'}</AppText>
            {hasFilters ? <SecondaryButton title="Clear Filters" onPress={clearFilters} /> : <PrimaryButton title="Add Expense" icon="plus" onPress={() => router.push('/add-expense')} />}
          </Card>
        ) : groups.map((group) => (
          <View key={group.date}>
            <AppText variant="h2" style={s.group}>{group.label}</AppText>
            {group.expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
          </View>
        ))}
      </View>
      <TransactionPicker kind={picker} dateFilter={dateFilter} categoryFilter={categoryFilter} sort={sort} onDate={(value) => { setDateFilter(value); setSelectedCalendarDate(null); if (value === 'today') setCalendarMonth(todayLocalDate().slice(0, 7)); }} onCategory={setCategoryFilter} onSort={setSort} onClose={() => setPicker(null)} />
    </Screen>
  );
}

type DateFilter = 'all' | 'today' | 'last7' | 'month' | 'last30';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type PickerKind = 'date' | 'category' | 'sort' | null;
const DATE_LABELS: Record<DateFilter, string> = { all: 'Date', today: 'Today', last7: 'Last 7 Days', month: 'This Month', last30: 'Last 30 Days' };
const SORT_LABELS: Record<SortOption, string> = { newest: 'Sort', oldest: 'Oldest', highest: 'Highest', lowest: 'Lowest' };

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

function SpendingCalendar({ expenses, month, selectedDate, onMonthChange, onSelectDate }: { expenses: Expense[]; month: string; selectedDate: string | null; onMonthChange: (month: string) => void; onSelectDate: (date: string | null) => void }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const leading = new Date(year, monthNumber - 1, 1).getDay();
  const cells: (number | null)[] = [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const monthExpenses = expenses.filter((expense) => expense.transactionDate.startsWith(month));
  const totals = new Map<string, number>();
  monthExpenses.forEach((expense) => totals.set(expense.transactionDate, (totals.get(expense.transactionDate) ?? 0) + expense.amountCents));
  const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const selectedTotal = selectedDate ? totals.get(selectedDate) ?? 0 : 0;

  return <Card style={s.spendingCalendar}>
    <View style={s.calendarHeader}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Previous spending month" onPress={() => onMonthChange(shiftMonth(month, -1))} style={s.calendarNav}><AppIcon name="chevron-left" size={21} /></PressableScale>
      <View style={{ alignItems: 'center' }}><AppText variant="h2">{formatMonth(month)}</AppText><AppText variant="small" style={s.muted}>{monthExpenses.length} transaction{monthExpenses.length === 1 ? '' : 's'}</AppText></View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Next spending month" onPress={() => onMonthChange(shiftMonth(month, 1))} style={s.calendarNav}><AppIcon name="chevron-right" size={21} /></PressableScale>
    </View>
    <View style={s.calendarWeek}>{CALENDAR_WEEKDAYS.map((label, index) => <View key={`${label}-${index}`} style={s.calendarCell}><AppText variant="small" style={s.calendarWeekday}>{label}</AppText></View>)}</View>
    <View style={s.calendarGrid}>{cells.map((day, index) => {
      if (!day) return <View key={`blank-${index}`} style={s.calendarCell} />;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const total = totals.get(date) ?? 0;
      const selected = date === selectedDate;
      return <View key={date} style={s.calendarCell}><PressableScale scaleTo={0.92} accessibilityRole="button" accessibilityLabel={`${date}${total ? `, spent ${compactCurrency(total)}` : ', no spending'}`} accessibilityState={{ selected }} onPress={() => onSelectDate(selected ? null : date)} style={[s.calendarDay, total > 0 && s.calendarDayHasSpending, selected && s.calendarDaySelected]}><AppText variant="bodyMedium" style={selected ? s.calendarDaySelectedText : undefined}>{day}</AppText>{total > 0 ? <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.calendarAmount, selected && s.calendarDaySelectedText]}>{compactCurrency(total)}</AppText> : null}</PressableScale></View>;
    })}</View>
    <View style={s.calendarSummary}>
      <View><AppText variant="small" style={s.muted}>Month spent</AppText><AppText variant="h3">{compactCurrency(monthTotal)}</AppText></View>
      <View style={{ alignItems: 'center' }}><AppText variant="small" style={s.muted}>Active days</AppText><AppText variant="h3">{totals.size}</AppText></View>
      <View style={{ alignItems: 'flex-end' }}><AppText variant="small" style={s.muted}>{selectedDate ? 'Selected day' : 'Daily average'}</AppText><AppText variant="h3">{compactCurrency(selectedDate ? selectedTotal : totals.size ? Math.round(monthTotal / totals.size) : 0)}</AppText></View>
    </View>
    {selectedDate ? <Pressable accessibilityRole="button" accessibilityLabel="Show every transaction in this month" onPress={() => onSelectDate(null)} style={s.calendarSelection}><AppText variant="small" style={s.calendarSelectionText}>Showing {formatExpenseDate(selectedDate)} · Tap to clear</AppText></Pressable> : null}
  </Card>;
}

function FilterButton({ label, active, flex = 1, onPress }: { label: string; active: boolean; flex?: number; onPress: () => void }) {
  // `flex` is weighted per control: "Category" is the longest label, so it gets
  // more of the row than "Date"/"Sort" instead of all three being equal and
  // clipping the middle one.
  return <PressableScale accessibilityRole="button" accessibilityLabel={`${label} filter`} accessibilityState={{ selected: active }} onPress={onPress} style={[s.filter, { flex }, active && s.filterActive]}><AppText variant="bodyMedium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[s.filterLabel, active && s.filterActiveText]}>{label}</AppText><AppIcon name="chevron-down" size={16} color={active ? colors.surface : colors.deepForest} /></PressableScale>;
}

function QuickAmountButtons({ value, onSelect }: { value: string; onSelect: (amount: number) => void }) {
  return <View style={s.quickAmounts}>{[100, 200, 500, 1000].map((amount) => {
    const selected = Number(value) === amount;
    return <PressableScale key={amount} accessibilityRole="button" accessibilityLabel={`Use ${amount} pesos`} accessibilityState={{ selected }} onPress={() => onSelect(amount)} style={[s.quickAmount, selected && s.quickAmountSelected]}><AppText variant="small" style={selected ? s.quickAmountTextSelected : s.quickAmountText}>₱{amount.toLocaleString('en-PH')}</AppText></PressableScale>;
  })}</View>;
}

function TransactionPicker({ kind, dateFilter, categoryFilter, sort, onDate, onCategory, onSort, onClose }: { kind: PickerKind; dateFilter: DateFilter; categoryFilter: string; sort: SortOption; onDate: (value: DateFilter) => void; onCategory: (value: string) => void; onSort: (value: SortOption) => void; onClose: () => void }) {
  const { categories } = useCategories();
  if (!kind) return null;
  const options: { id: string; label: string; icon?: Parameters<typeof AppIcon>[0]['name'] }[] = kind === 'date'
    ? (Object.entries(DATE_LABELS) as [DateFilter, string][]).map(([id, label]) => ({ id, label }))
    : kind === 'sort'
      ? (Object.entries(SORT_LABELS) as [SortOption, string][]).map(([id, label]) => ({ id, label }))
      : [{ id: 'all', label: 'All Categories', icon: 'shape-outline' as const }, ...categories.map((item) => ({ id: item.id, label: item.fullLabel, icon: item.icon }))];
  const selected = kind === 'date' ? dateFilter : kind === 'sort' ? sort : categoryFilter;
  const choose = (id: string) => { selectionFeedback(); if (kind === 'date') onDate(id as DateFilter); else if (kind === 'sort') onSort(id as SortOption); else onCategory(id); onClose(); };
  return <DraggableBottomSheet visible onClose={onClose}><AppText variant="h2">{kind === 'date' ? 'Filter by Date' : kind === 'sort' ? 'Sort Transactions' : 'Filter by Category'}</AppText><View style={s.pickerOptions}>{options.map((option) => <PressableScale key={option.id} onPress={() => choose(option.id)} accessibilityRole="button" accessibilityState={{ selected: selected === option.id }} style={[s.pickerOption, selected === option.id && s.pickerOptionSelected]}>{option.icon ? <View style={s.pickerOptionIcon}><AppIcon name={option.icon} size={21} /></View> : null}<AppText variant="bodyMedium" style={s.pickerOptionCopy}>{option.label}</AppText>{selected === option.id ? <AppIcon name="check-circle" color={colors.deepForest} /> : null}</PressableScale>)}</View></DraggableBottomSheet>;
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const { findCategory } = useCategories();
  const category = findCategory(expense.categoryId);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${expense.merchant}, ${category?.fullLabel ?? 'Expense'}`} onPress={() => router.push(`/transaction/${expense.id}` as never)} style={({ pressed }) => pressed && { opacity: 0.78 }}>
      <Card style={s.transaction}>
        <View style={s.roundIcon}><AppIcon name={category?.icon ?? 'receipt-text-outline'} size={24} color={colors.deepForest} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="h3" numberOfLines={2}>{expense.merchant}</AppText>
          <AppText style={s.muted} numberOfLines={2}>{category?.fullLabel ?? expense.categoryId}</AppText>
        </View>
        <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={s.transactionAmount}>−{formatCompactPeso(expense.amountCents)}</AppText>
      </Card>
    </Pressable>
  );
}

function groupExpensesByDate(expenses: Expense[]) {
  const today = todayLocalDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
  const groups = new Map<string, Expense[]>();
  expenses.forEach((expense) => groups.set(expense.transactionDate, [...(groups.get(expense.transactionDate) ?? []), expense]));
  return [...groups.entries()].map(([date, items]) => ({ date, label: date === today ? 'Today' : date === yesterday ? 'Yesterday' : formatExpenseDate(date), expenses: items }));
}

export function TransactionDetailsScreen() {
  const { findCategory } = useCategories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, loading, deleteExpense } = useExpenses();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expense = expenses.find((item) => item.id === id);
  const category = findCategory(expense?.categoryId);

  const remove = async () => {
    if (!expense || deleting) return;
    setDeleting(true);
    const result = await deleteExpense(expense.id);
    setDeleting(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    warningFeedback();
    showToast('Transaction deleted.');
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
          <AppText variant="hero">₱{(expense.amountCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</AppText>
          <AppText style={s.muted}>{formatExpenseDate(expense.transactionDate)}</AppText>
          {expense.source === 'receipt' ? <StatusChip>Verified</StatusChip> : <StatusChip>Manual entry</StatusChip>}
        </FadeSlideIn>
        <FadeSlideIn delay={80}><Card style={{ gap: 12 }}>
          <InfoRow label="Category" value={category?.fullLabel ?? expense.categoryId} />
          <InfoRow label="Source" value={expense.source === 'receipt' ? 'Receipt' : 'Manual'} />
          <View style={s.divider} />
          <InfoRow label="Total" value={`₱${(expense.amountCents / 100).toFixed(2)}`} bold />
          {expense.notes ? <><View style={s.divider} /><AppText style={s.muted}>Notes</AppText><AppText>{expense.notes}</AppText></> : null}
        </Card></FadeSlideIn>
        <FadeSlideIn delay={150} style={s.actions}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Edit transaction" onPress={() => router.push(`/transaction/${expense.id}/edit` as never)} style={s.edit}><AppIcon name="pencil-outline" color={colors.deepForest} /><AppText variant="h3" style={{ color: colors.deepForest }}>Edit</AppText></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Delete transaction" onPress={() => setConfirmDelete(true)} style={s.delete}><AppIcon name="delete-outline" color={colors.danger} /><AppText variant="h3" style={{ color: colors.danger }}>Delete</AppText></PressableScale>
        </FadeSlideIn>
      </View>
      <AuthDialog visible={confirmDelete} title="Delete transaction?" message="This transaction will be permanently removed from your expense history." primaryAction={{ label: 'Delete', destructive: true, loading: deleting, onPress: () => void remove() }} secondaryAction={{ label: 'Cancel', onPress: () => setConfirmDelete(false) }} onRequestClose={() => setConfirmDelete(false)} />
    </Screen>
  );
}

export function EditTransactionScreen() {
  const { categories } = useCategories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, updateExpense } = useExpenses();
  const { showToast } = useToast();
  const expense = expenses.find((item) => item.id === id);
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [values, setValues] = useState<ExpenseFormValues>(() => expense ? { amount: (expense.amountCents / 100).toFixed(2), merchant: expense.merchant, categoryId: expense.categoryId, transactionDate: expense.transactionDate, notes: expense.notes ?? '' } : { amount: '', merchant: '', categoryId: '', transactionDate: todayLocalDate(), notes: '' });
  if (!expense) return <Screen variant={8}><View style={s.page}><BackButton /><Card style={s.emptyCard}><AppText variant="h2">Transaction not found</AppText></Card></View></Screen>;
  const update = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const save = async () => {
    if (submitting.current) return;
    Keyboard.dismiss();
    const validation = validateExpenseForm(values);
    setErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true; setSaving(true);
    const result = await updateExpense({ id: expense.id, ...validation.input });
    submitting.current = false; setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    selectionFeedback(); showToast('Transaction updated.'); router.replace(`/transaction/${expense.id}` as never);
  };
  return <Screen variant={8} bottomInset={40}><View style={s.page}><View style={s.editHeader}><BackButton /><View><AppText variant="title">Edit Transaction</AppText><AppText style={s.muted}>Update the saved expense.</AppText></View></View><FormInput label="Amount" icon="currency-php" value={values.amount} onChangeText={(value) => update('amount', normalizeAmountInput(value, values.amount))} keyboardType="decimal-pad" error={errors.amount} /><QuickAmountButtons value={values.amount} onSelect={(amount) => update('amount', String(amount))} /><FormInput label="Merchant / Description" value={values.merchant} onChangeText={(value) => update('merchant', value)} error={errors.merchant} /><AppText variant="bodyMedium">Category</AppText><View style={s.editCategories}>{categories.map((category) => <PressableScale key={category.id} onPress={() => update('categoryId', category.id)} style={[s.editCategory, values.categoryId === category.id && s.editCategoryActive]}><AppIcon name={category.icon} size={18} color={values.categoryId === category.id ? colors.surface : colors.deepForest} /><AppText variant="small" style={values.categoryId === category.id ? s.editCategoryTextActive : undefined}>{category.label}</AppText></PressableScale>)}</View>{errors.categoryId ? <AppText variant="small" style={s.errorText}>{errors.categoryId}</AppText> : null}<FormInput label="Date" placeholder="YYYY-MM-DD" value={values.transactionDate} onChangeText={(value) => update('transactionDate', value)} error={errors.transactionDate} /><FormInput label="Notes (optional)" value={values.notes} onChangeText={(value) => update('notes', value)} multiline style={s.editNotes} error={errors.notes} /><PrimaryButton title={saving ? 'Saving Changes…' : 'Save Changes'} disabled={saving} onPress={() => void save()} /></View></Screen>;
}

function InfoRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.rowBetween}>
      <AppText variant={bold ? 'h3' : 'body'} style={s.muted}>{label}</AppText>
      <AppText variant={bold ? 'h3' : 'body'}>{value}</AppText>
    </View>
  );
}

export function BudgetScreen() {
  const { categories } = useCategories();
  const categoryLibrary = categories;
  const bottomInset = useBottomNavInset();
  const { expenses } = useExpenses();
  const { budgets: monthlyBudgets, loading, error, refresh, saveMonthlyBudget, saveCategoryBudget, removeCategoryBudget } = useBudgets();
  const { showToast } = useToast();
  const currentMonth = todayLocalDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [monthPicker, setMonthPicker] = useState(false);
  const [monthDraft, setMonthDraft] = useState(`${currentMonth}-01`);
  const [editor, setEditor] = useState<{ type: 'addMonthly' } | { type: 'editMonthly' } | { type: 'category'; categoryId: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const budget = monthlyBudgets.find((item) => item.month === month);
  const monthExpenses = expenses.filter((item) => item.transactionDate.startsWith(month));
  const spentCents = monthExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  const remainingCents = (budget?.amountCents ?? 0) - spentCents;
  // Null when no budget exists or it's zero, so a missing budget can never
  // produce an Infinity/NaN percentage.
  const percentage = percentOf(spentCents, budget?.amountCents) ?? 0;
  const currency = (cents: number) => formatPeso(Math.abs(cents), { alwaysShowDecimals: true });
  const compact = (cents: number) => formatCompactPeso(Math.abs(cents), { alwaysShowDecimals: false });
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
  const status = percentage >= 100 ? 'Budget exceeded' : percentage >= 90 ? 'Near budget limit' : percentage >= 70 ? 'Approaching limit' : 'On track';

  const openAddMonthly = () => { setAmount(''); setAmountError(null); setEditor({ type: 'addMonthly' }); };
  const openEditMonthly = () => { setAmount(budget ? (budget.amountCents / 100).toFixed(2) : ''); setAmountError(null); setEditor({ type: 'editMonthly' }); };
  const openCategory = (categoryId: string) => { const limit = budget?.categoryBudgets.find((item) => item.categoryId === categoryId); setAmount(limit ? (limit.amountCents / 100).toFixed(2) : ''); setAmountError(null); setEditor({ type: 'category', categoryId }); };
  const save = async () => {
    if (!editor || saving) return;
    const cents = parseBudgetAmount(amount);
    if (!cents) { setAmountError('Enter a valid amount greater than zero.'); return; }
    setSaving(true);
    const result = editor.type === 'addMonthly'
      ? await saveMonthlyBudget(month, (budget?.amountCents ?? 0) + cents)
      : editor.type === 'editMonthly'
        ? await saveMonthlyBudget(month, cents)
        : budget ? await saveCategoryBudget(budget.id, editor.categoryId, cents) : { ok: false as const, message: 'Add a monthly budget first.' };
    setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    selectionFeedback(); showToast(editor.type === 'addMonthly' ? 'Budget amount added.' : editor.type === 'editMonthly' ? 'Total budget updated.' : 'Category limit saved.'); setEditor(null);
  };
  const removeLimit = async () => {
    if (!budget || editor?.type !== 'category') return;
    const limit = budget.categoryBudgets.find((item) => item.categoryId === editor.categoryId);
    if (!limit) return;
    setSaving(true); const result = await removeCategoryBudget(budget.id, limit.id); setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    showToast('Category limit removed.'); setEditor(null);
  };
  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <AppText variant="hero">Budget</AppText>
        <PressableScale accessibilityRole="button" accessibilityLabel={`Selected budget month: ${monthLabel}`} onPress={() => { setMonthDraft(`${month}-01`); setMonthPicker(true); }} style={s.budgetMonth}><AppText variant="h3">{monthLabel}</AppText><AppIcon name="calendar-month-outline" /></PressableScale>
        {loading && monthlyBudgets.length === 0 ? <View style={s.skeletonCard} /> : error && monthlyBudgets.length === 0 ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load budgets</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : !budget ? <Card style={s.emptyCard}><View style={s.emptyIcon}><AppIcon name="wallet-plus-outline" size={30} /></View><AppText variant="h2">No budget yet</AppText><AppText style={[s.muted, s.center]}>Add your first monthly budget amount to start tracking spending.</AppText><PrimaryButton title="Add Budget Amount" onPress={openAddMonthly} /></Card> : <Card style={s.monthlyBudgetCard}><View style={s.rowBetween}><AppText variant="h3">Monthly Budget</AppText><PressableScale accessibilityRole="button" accessibilityLabel="Edit total budget" onPress={openEditMonthly} style={s.editBudgetButton}><AppIcon name="pencil-outline" size={20} color={colors.muted} /></PressableScale></View><AppText variant="hero" adjustsFontSizeToFit numberOfLines={1}>{currency(budget.amountCents)}</AppText><View style={s.budgetSummary}><View style={s.budgetSummaryItem}><AppText variant="small" style={s.muted}>Spent</AppText><AppText variant="h3" style={{ color: colors.deepForest }}>{compact(spentCents)}</AppText></View><View style={[s.budgetSummaryItem, s.budgetSummaryRight]}><AppText variant="small" style={s.muted}>{remainingCents < 0 ? 'Over' : 'Left'}</AppText><AppText variant="h3" style={{ color: remainingCents < 0 ? colors.danger : colors.deepForest }}>{compact(remainingCents)}</AppText></View></View><View style={s.row}><ProgressBar value={Math.min(100, percentage)} /><AppText variant="h3" style={s.budgetPercent}>{percentage}%</AppText></View><StatusChip warning={percentage >= 90}>{status}</StatusChip><SecondaryButton title="Add to Budget" icon="plus" onPress={openAddMonthly} /></Card>}
        <AppText variant="h2">Category Budgets</AppText>
        {!budget ? <AppText style={s.muted}>Set a monthly budget before adding category limits.</AppText> : budget.categoryBudgets.length === 0 ? <Card style={s.noLimits}><AppText variant="h3">No category limits yet</AppText><AppText style={s.muted}>Tap a category below to add one.</AppText></Card> : null}
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
            accessibilityHint={budget ? 'Opens the category budget editor' : 'Set a monthly budget first'}
            hitSlop={4}
            onPress={() => budget ? openCategory(category.id) : openAddMonthly()}
            style={s.budgetRow}
          >
            <View style={[s.budgetIcon, { backgroundColor: category.color ? `${category.color}22` : CATEGORY_TONES[category.id]?.background ?? colors.pale }]}>
              <AppIcon name={category.icon} size={22} color={category.color ?? CATEGORY_TONES[category.id]?.foreground ?? colors.deepForest} />
            </View>
            <View style={s.budgetInfo}>
              {/* Two lines so "Food & Dining" wraps instead of becoming "Food &...". */}
              <AppText variant="h3" numberOfLines={2}>{category.fullLabel}</AppText>
              <ProgressBar value={Math.min(100, categoryPercent)} height={9} />
            </View>
            <View style={s.budgetValues}>
              <AppText variant="h3">{limit ? compact(limit.amountCents) : 'Set limit'}</AppText>
              <AppText variant="small" style={{ color: categoryPercent >= 100 ? colors.danger : colors.deepForest }}>{compact(categorySpent)} spent</AppText>
              {categoryRemaining !== null ? <AppText variant="small" style={{ color: categoryRemaining < 0 ? colors.danger : colors.muted }}>{compact(categoryRemaining)} {categoryRemaining < 0 ? 'over' : 'left'}</AppText> : null}
            </View>
            <AppIcon name="chevron-right" size={20} color={colors.muted} />
          </PressableScale>);
        })}
      </View>
      <DraggableBottomSheet visible={monthPicker} onClose={() => setMonthPicker(false)}>{(dismiss) => <><AppText variant="h2">Choose Budget Month</AppText><Calendar value={monthDraft} onSelect={setMonthDraft} /><AppText style={s.selectedMonthPreview}>{formatMonth(monthDraft.slice(0, 7))}</AppText><PrimaryButton title="Use This Month" onPress={() => { setMonth(monthDraft.slice(0, 7)); dismiss(); }} /></>}</DraggableBottomSheet>
      <DraggableBottomSheet visible={Boolean(editor)} disabled={saving} onClose={() => setEditor(null)}>
        <AppText variant="h2">{editor?.type === 'addMonthly' ? 'Add Budget Amount' : editor?.type === 'editMonthly' ? 'Edit Total Budget' : `Set ${categoryLibrary.find((item) => item.id === (editor?.type === 'category' ? editor.categoryId : ''))?.fullLabel ?? 'Category'} Limit`}</AppText>
        {editor?.type === 'addMonthly' ? <View style={s.addBudgetContext}><InfoRow label="Current budget" value={currency(budget?.amountCents ?? 0)} /><InfoRow label="Amount to add" value={currency(Math.round((Number(amount) || 0) * 100))} /><InfoRow bold label="New budget" value={currency((budget?.amountCents ?? 0) + Math.round((Number(amount) || 0) * 100))} /></View> : null}
        <FormInput label={editor?.type === 'addMonthly' ? 'Amount to add' : 'Amount'} icon="currency-php" placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(normalizeAmountInput(value, amount)); setAmountError(null); }} keyboardType="decimal-pad" error={amountError ?? undefined} />
        <QuickAmountButtons value={amount} onSelect={(value) => { setAmount(String(value)); setAmountError(null); }} />
        <PrimaryButton title={saving ? 'Saving…' : editor?.type === 'addMonthly' ? `Add ${formatPeso(Math.round((Number(amount) || 0) * 100))}` : editor?.type === 'editMonthly' ? 'Save Total Budget' : 'Save Category Limit'} disabled={saving} onPress={() => void save()} />
        {editor?.type === 'category' && budget?.categoryBudgets.some((item) => item.categoryId === editor.categoryId) ? <SecondaryButton title="Remove Category Limit" disabled={saving} onPress={() => void removeLimit()} /> : null}
      </DraggableBottomSheet>
    </Screen>
  );
}

export function AnalyticsScreen() {
  const { expenses, loading, loadError, refresh } = useExpenses();
  const { allCategories } = useCategories();
  const bottomInset = useBottomNavInset();
  const [month, setMonth] = useState(todayLocalDate().slice(0, 7));
  const [monthDraft, setMonthDraft] = useState(`${month}-01`);
  const [monthPicker, setMonthPicker] = useState(false);
  const [mode, setMode] = useState<'spending' | 'trends'>('spending');
  useFocusEffect(useCallback(() => { if (!consumeSkippedPanelRefresh('/analytics')) void refresh(); }, [refresh]));
  const analytics = useMemo(() => analyticsForMonth(expenses, allCategories, month), [allCategories, expenses, month]);
  const priorMonth = previousMonth(month);
  const previous = useMemo(() => analyticsForMonth(expenses, allCategories, priorMonth), [allCategories, expenses, priorMonth]);
  const monthLabel = formatMonth(month);
  const maxDay = Math.max(...analytics.dailyTotals.map((item) => item.amountCents), 1);
  const change = previous.totalCents ? Math.round(((analytics.totalCents - previous.totalCents) / previous.totalCents) * 100) : null;
  return (
    <Screen embedded bottomInset={bottomInset} background={false} refreshing={loading && expenses.length > 0} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <AppText variant="hero">Analytics</AppText>
        <AppText style={s.muted}>A clearer view of your spending.</AppText>
        <PressableScale accessibilityRole="button" accessibilityLabel={`Selected analytics month: ${monthLabel}`} onPress={() => { setMonthDraft(`${month}-01`); setMonthPicker(true); }} style={s.analyticsMonth}><AppText variant="h2">{monthLabel}</AppText><AppIcon name="calendar-month-outline" /></PressableScale>
        <View style={s.segment}>
          <PressableScale onPress={() => setMode('spending')} style={[s.segmentHalf, mode === 'spending' && s.segmentActive]}><AppText variant="h3" style={mode === 'spending' ? s.segmentActiveText : s.muted}>Spending</AppText></PressableScale>
          <PressableScale onPress={() => setMode('trends')} style={[s.segmentHalf, mode === 'trends' && s.segmentActive]}><AppText variant="h3" style={mode === 'trends' ? s.segmentActiveText : s.muted}>Trends</AppText></PressableScale>
        </View>
        {loading && expenses.length === 0 ? <Card style={s.analyticsLoading}><ActivityIndicator color={colors.deepForest} /><View style={s.analyticsSkeletonCircle} /><View style={s.skeletonLineWide} /></Card> : loadError ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load analytics.</AppText><AppText style={[s.muted, s.center]}>Check your connection and try again.</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : analytics.expenses.length === 0 ? <Card style={s.emptyCard}><View style={s.emptyIcon}><AppIcon name="chart-donut" size={30} /></View><AppText variant="h2">No spending data yet</AppText><AppText style={[s.muted, s.center]}>Add expenses to start seeing your spending patterns.</AppText><PrimaryButton title="Add Expense" onPress={() => router.push('/add-expense')} /></Card> : mode === 'spending' ? <Card style={s.analyticsCard}><DonutChart slices={analytics.categorySlices} refreshKey={month}><AppText variant="title" adjustsFontSizeToFit numberOfLines={1}>{compactCurrency(analytics.totalCents)}</AppText><AppText style={s.muted}>Total Spending</AppText></DonutChart><View style={s.legendList}>{analytics.categorySlices.map((slice) => <View style={s.legend} key={slice.id}><View style={[s.legendDot, { backgroundColor: slice.color }]} /><AppText style={[s.muted, s.legendLabel]} numberOfLines={1}>{slice.label}</AppText><AppText style={[s.muted, s.legendValue]}>{formatPercent(slice.percentage)}</AppText></View>)}</View></Card> : <Card style={s.trendsCard}><View style={s.rowBetween}><View><AppText style={s.muted}>This month</AppText><AppText variant="title">{compactCurrency(analytics.totalCents)}</AppText></View><View style={s.trendChange}><AppIcon name={change !== null && change > 0 ? 'trending-up' : 'trending-down'} size={20} color={change !== null && change > 0 ? colors.danger : colors.success} /><AppText variant="h3" style={{ color: change !== null && change > 0 ? colors.danger : colors.success }}>{change === null ? 'No comparison' : `${change > 0 ? '+' : ''}${change}%`}</AppText></View></View>{previous.totalCents === 0 || analytics.expenses.length < 2 ? <View style={s.trendEmpty}><AppText variant="h2">Not enough history yet</AppText><AppText style={[s.muted, s.center]}>Keep tracking expenses and your trends will appear here.</AppText></View> : <><View style={s.barChart}>{analytics.dailyTotals.map((item) => <View key={item.day} style={s.barColumn}><View style={[s.bar, { height: Math.max(8, Math.round((item.amountCents / maxDay) * 130)) }]} /><AppText variant="small" style={s.muted}>{item.day}</AppText></View>)}</View><View style={s.trendMetrics}><TrendMetric label={`${formatMonth(priorMonth)} total`} value={compactCurrency(previous.totalCents)} /><TrendMetric label="Daily average" value={compactCurrency(analytics.averageDailyCents)} /><TrendMetric label="Highest-spend day" value={analytics.highestDay ? `${monthLabel.split(' ')[0]} ${analytics.highestDay.day} · ${compactCurrency(analytics.highestDay.amountCents)}` : '—'} /></View></>}</Card>}
        {analytics.expenses.length > 0 ? <InsightsLink month={month} /> : null}
      </View>
      <MonthPickerModal visible={monthPicker} title="Choose Analytics Month" value={monthDraft} onChange={setMonthDraft} onClose={() => setMonthPicker(false)} onConfirm={(value) => setMonth(value.slice(0, 7))} />
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
  const params = useLocalSearchParams<{ month?: string }>();
  const { expenses, loading, loadError, refresh } = useExpenses();
  const { allCategories } = useCategories();
  const { budgets } = useBudgets();
  const bottomInset = useBottomNavInset();
  const month = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : todayLocalDate().slice(0, 7);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const current = useMemo(() => analyticsForMonth(expenses, allCategories, month), [allCategories, expenses, month]);
  const previous = useMemo(() => analyticsForMonth(expenses, allCategories, previousMonth(month)), [allCategories, expenses, month]);
  const insights = useMemo(() => buildInsights(current, previous, allCategories, budgets.find((item) => item.month === month)), [allCategories, budgets, current, month, previous]);
  return (
    <Screen bottomInset={bottomInset} variant={12} fixed={<BottomNavigation />} refreshing={loading && expenses.length > 0} onRefresh={() => void refresh()}>
      <View style={s.page}>
        <View style={s.insightHero}>
          <View style={{ flex: 1 }}>
            <AppText variant="title">Spending Insights</AppText>
            <AppText style={s.muted}>Simple insights for a smarter you. · {formatMonth(month)}</AppText>
          </View>
          <Image source={assets.mascotScanning} contentFit="contain" style={s.insightMascot} />
        </View>
        {loading && expenses.length === 0 ? <Card style={s.analyticsLoading}><ActivityIndicator color={colors.deepForest} /><View style={s.skeletonLineWide} /><View style={s.skeletonLine} /></Card> : loadError ? <Card style={s.emptyCard}><AppText variant="h2">Couldn&apos;t load insights.</AppText><AppText style={[s.muted, s.center]}>Check your connection and try again.</AppText><SecondaryButton title="Try Again" onPress={() => void refresh()} /></Card> : insights.length === 0 ? <Card style={s.emptyCard}><View style={s.emptyIcon}><AppIcon name="lightbulb-outline" size={30} /></View><AppText variant="h2">No insights yet</AppText><AppText style={[s.muted, s.center]}>Add expenses for {formatMonth(month)} to reveal useful spending patterns.</AppText><PrimaryButton title="Add Expense" onPress={() => router.push('/add-expense')} /></Card> : insights.map((insight) => <PressableScale key={insight.id} disabled={!insight.destination} onPress={() => { if (!insight.destination) return; if (insight.destination === '/transactions' && insight.filterQuery) { router.push({ pathname: '/transactions', params: { q: insight.filterQuery } }); return; } router.push(insight.destination); }}><Card style={s.insightCard}><View style={s.insightIcon}><AppIcon name={insight.icon} size={32} color={colors.deepForest} /></View><View style={{ flex: 1 }}><AppText style={s.muted}>{insight.label}</AppText><AppText variant="h2">{insight.title}</AppText><AppText style={s.muted}>{insight.detail}</AppText></View>{insight.destination ? <AppIcon name="chevron-right" size={28} color={colors.deepForest} /> : null}</Card></PressableScale>)}
      </View>
    </Screen>
  );
}

function MonthPickerModal({ visible, title, value, onChange, onClose, onConfirm }: { visible: boolean; title: string; value: string; onChange: (value: string) => void; onClose: () => void; onConfirm: (value: string) => void }) {
  return <DraggableBottomSheet visible={visible} onClose={onClose}>{(dismiss) => <><AppText variant="h2">{title}</AppText><Calendar value={value} onSelect={onChange} /><AppText style={s.selectedMonthPreview}>{formatMonth(value.slice(0, 7))}</AppText><PrimaryButton title="Use This Month" onPress={() => { onConfirm(value); dismiss(); }} /></>}</DraggableBottomSheet>;
}

function TrendMetric({ label, value }: { label: string; value: string }) {
  return <View style={s.trendMetric}><AppText style={s.muted}>{label}</AppText><AppText variant="h3">{value}</AppText></View>;
}

export function CategoriesScreen() {
  const { categories, loading: categoriesLoading, error: categoriesError, refresh: refreshCategories, createCategory, updateCategory, archiveCategory } = useCategories();
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
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const iconChoices = ['shape-outline', 'coffee-outline', 'home-outline', 'paw-outline', 'music-note-outline', 'briefcase-outline'] as const;
  const colorChoices = ['#315F43', '#C92525', '#E45C0A', '#3477B8', '#7057A3', '#28704B'] as const;

  const openCreate = () => { setName(''); setIcon('shape-outline'); setColor('#315F43'); setFormError(null); setEditor({}); };
  const openEdit = (id: string) => { const category = categories.find((item) => item.id === id); if (!category?.custom) return; setName(category.fullLabel); setIcon(category.icon); setColor(category.color ?? '#315F43'); setFormError(null); setEditor({ id }); };
  const saveCategory = async () => {
    if (!editor || saving) return;
    const cleanName = name.trim();
    if (!cleanName) { setFormError('Enter a category name.'); return; }
    if (cleanName.length > 40) { setFormError('Use 40 characters or fewer.'); return; }
    if (categories.some((item) => item.id !== editor.id && item.fullLabel.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) { setFormError('A category with this name already exists.'); return; }
    setSaving(true);
    const input = { name: cleanName, icon: icon as (typeof categories)[number]['icon'], color };
    const result = editor.id ? await updateCategory(editor.id, input) : await createCategory(input);
    setSaving(false);
    if (!result.ok) { setFormError(result.message); return; }
    selectionFeedback(); showToast(editor.id ? 'Category updated.' : 'Category added.'); setEditor(null);
  };
  const archive = async () => {
    if (!archiveId || saving) return;
    setSaving(true); const result = await archiveCategory(archiveId); setSaving(false);
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    removeCategory(archiveId); showToast('Category archived. Historical transactions are preserved.'); setArchiveId(null); setEditor(null);
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
        <AppText variant="hero">Categories</AppText>
        <AppText style={s.muted}>Organize your spending, your way.</AppText>
        <AppText variant="small" style={s.muted}>
          {dashboardCategories.length} of {MAX_DASHBOARD_CATEGORIES} shown on your dashboard
        </AppText>
        {categoriesLoading ? <View style={s.categoryLoading}><ActivityIndicator color={colors.deepForest} /><AppText style={s.muted}>Loading your categories…</AppText></View> : null}
        {categoriesError ? <Card style={s.categoryError}><AppText style={s.muted}>Custom categories couldn&apos;t be loaded.</AppText><SecondaryButton title="Try Again" onPress={() => void refreshCategories()} /></Card> : null}

        {categories.map(category => {
          const onDashboard = isOnDashboard(category.id);
          return (
            /*
              Plain container with two sibling press targets. Nesting the toggle
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
              {category.custom ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${category.fullLabel}`} hitSlop={6} onPress={() => openEdit(category.id)} style={({ pressed }) => [s.categoryEdit, pressed && { opacity: 0.7 }]}><AppIcon name="pencil-outline" size={18} /></Pressable> : null}
            </Card>
          );
        })}

        <PrimaryButton
          title="Add Custom Category"
          icon="plus"
          onPress={openCreate}
        />
      </View>
      <DraggableBottomSheet visible={Boolean(editor)} disabled={saving} onClose={() => setEditor(null)}><AppText variant="h2">{editor?.id ? 'Edit Category' : 'Add Category'}</AppText><FormInput label="Category name" placeholder="e.g. Pets" value={name} onChangeText={(value) => { setName(value); setFormError(null); }} maxLength={40} error={formError ?? undefined} /><AppText variant="bodyMedium">Icon</AppText><View style={s.choiceRow}>{iconChoices.map((value) => <PressableScale key={value} accessibilityLabel={`Use ${value} icon`} accessibilityState={{ selected: icon === value }} onPress={() => setIcon(value)} style={[s.choiceCircle, icon === value && s.choiceCircleActive]}><AppIcon name={value} color={icon === value ? colors.surface : colors.deepForest} /></PressableScale>)}</View><AppText variant="bodyMedium">Color</AppText><View style={s.choiceRow}>{colorChoices.map((value) => <PressableScale key={value} accessibilityLabel={`Use color ${value}`} accessibilityState={{ selected: color === value }} onPress={() => setColor(value)} style={[s.colorChoice, { backgroundColor: value }, color === value && s.colorChoiceActive]}>{color === value ? <AppIcon name="check" size={17} color={colors.surface} /> : null}</PressableScale>)}</View><PrimaryButton title={saving ? 'Saving…' : editor?.id ? 'Save Changes' : 'Add Category'} disabled={saving} onPress={() => void saveCategory()} />{editor?.id ? <SecondaryButton title="Archive Category" disabled={saving} onPress={() => setArchiveId(editor.id ?? null)} /> : null}</DraggableBottomSheet>
      <AuthDialog visible={Boolean(archiveId)} title="Archive category?" message="The category will be hidden from new expenses, but all historical transactions will keep their category." primaryAction={{ label: 'Archive', destructive: true, loading: saving, onPress: () => void archive() }} secondaryAction={{ label: 'Cancel', onPress: () => setArchiveId(null) }} onRequestClose={() => setArchiveId(null)} />
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
            <AppText variant="title">Profile &amp; Settings</AppText>
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
  calendarSummary: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
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
  budgetMonth: { minHeight: 62, borderRadius: radii.lg, backgroundColor: 'rgba(255,253,247,.96)', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthlyBudgetCard: { gap: 13, paddingVertical: 22 },
  editBudgetButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  budgetSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  budgetSummaryItem: { flexGrow: 1, minWidth: 118, gap: 2 },
  budgetSummaryRight: { alignItems: 'flex-end' },
  budgetPercent: { flexShrink: 0, minWidth: 54, textAlign: 'right' },
  addBudgetContext: { gap: 10, padding: 14, borderRadius: radii.md, backgroundColor: colors.pale },
  noLimits: { gap: 4, backgroundColor: 'rgba(255,253,247,.9)' },
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
  insightHero: { minHeight: 172, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'visible' },
  insightMascot: { width: 145, height: 145, marginRight: -8, alignSelf: 'flex-end' },
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
