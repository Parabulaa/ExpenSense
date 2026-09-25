import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FadeSlideIn } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { AppIcon, AppText, BackButton, Card, PrimaryButton, ProgressBar } from '@/components/common/ui';
import { colors, radii, spacing } from '@/constants/theme';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { formatDateTime, todayLocalDate } from '@/features/expenses/validation';

const PESO = '₱';

function formatMoney(value: number) {
  return `${value < 0 ? '−' : ''}${PESO}${Math.abs(value).toLocaleString('en-US')}`;
}

export function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses } = useExpenses();
  const { findCategory } = useCategories();
  const { budgets } = useBudgets();
  const category = findCategory(Array.isArray(id) ? id[0] : id);

  if (!category) {
    return (
      <Screen variant={4}>
        <View style={styles.page}>
          <BackButton />
          <View style={styles.missing}>
            <AppIcon name="tag-off-outline" size={44} color={colors.muted} />
            <AppText variant="h2" style={styles.center}>Category not found</AppText>
            <AppText style={[styles.center, styles.muted]}>
              This category is no longer available.
            </AppText>
            <PrimaryButton title="Back to Categories" onPress={() => router.replace('/categories')} />
          </View>
        </View>
      </Screen>
    );
  }

  const currentMonth = todayLocalDate().slice(0, 7);
  const monthlyBudget = budgets.find((item) => item.month === currentMonth);
  const categoryBudget = monthlyBudget?.categoryBudgets.find((item) => item.categoryId === category.id);
  const categoryTransactions = expenses.filter((item) => item.categoryId === category.id && item.transactionDate.startsWith(currentMonth));
  const spent = categoryTransactions.reduce((total, item) => total + item.amountCents, 0) / 100;
  const limit = (categoryBudget?.amountCents ?? 0) / 100;
  const usage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const remaining = limit - spent;

  return (
    <Screen variant={4}>
      <View style={styles.page}>
        <BackButton />

        <FadeSlideIn index={0}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <AppIcon name={category.icon} size={32} color={colors.deepForest} />
            </View>
            <View style={styles.headerCopy}>
              <AppText variant="title" numberOfLines={2}>{category.fullLabel}</AppText>
              <AppText style={styles.muted}>{limit > 0 ? `${usage}% of this month’s budget used` : 'No category budget set'}</AppText>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <Card style={styles.budgetCard}>
            <AppText style={styles.muted}>Spent this month</AppText>
            <AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>
              {formatMoney(spent)}
            </AppText>
            <AppText style={styles.muted}>{limit > 0 ? `of ${formatMoney(limit)} budget` : 'Set a budget from Wallet'}</AppText>

            <View style={styles.progressRow}>
              <ProgressBar value={Math.min(100, usage)} height={14} />
              <AppText variant="h3" style={styles.usage}>{usage}%</AppText>
            </View>

            <View style={styles.splitRow}>
              <View style={styles.split}>
                <AppText variant="small" style={styles.muted}>Remaining</AppText>
                <AppText variant="h3">{formatMoney(remaining)}</AppText>
              </View>
              <View style={styles.split}>
                <AppText variant="small" style={styles.muted}>Transactions</AppText>
                <AppText variant="h3">{categoryTransactions.length}</AppText>
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <AppText variant="h2" style={styles.sectionTitle}>Recent transactions</AppText>
        </FadeSlideIn>

        {categoryTransactions.length > 0 ? (
          categoryTransactions.map((item, index) => (
            <FadeSlideIn key={item.id} index={3 + index}>
              <Card style={styles.transaction}>
                <View style={styles.transactionIcon}>
                  <AppIcon name={category.icon} size={22} color={colors.deepForest} />
                </View>
                <View style={styles.transactionCopy}>
                  <AppText variant="h3" numberOfLines={1}>{item.merchant}</AppText>
                  <AppText variant="small" style={styles.muted}>{formatDateTime(item.transactionDate, item.transactionTime)}</AppText>
                </View>
                <AppText variant="h3">-{formatMoney(item.amountCents / 100)}</AppText>
              </Card>
            </FadeSlideIn>
          ))
        ) : (
          <FadeSlideIn index={3}>
            <Card style={styles.empty}>
              <AppIcon name="receipt-text-outline" size={30} color={colors.softGreen} />
              <AppText style={[styles.center, styles.muted]}>
                No transactions in {category.fullLabel} yet.
              </AppText>
            </Card>
          </FadeSlideIn>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: spacing.lg, gap: 14 },
  center: { textAlign: 'center' },
  muted: { color: colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#E1EBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  budgetCard: { borderRadius: 24, gap: 3 },
  amount: { fontSize: 40, lineHeight: 46, color: '#06120D' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  usage: { color: colors.deepForest, minWidth: 52, textAlign: 'right' },
  splitRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  split: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.pale,
  },
  sectionTitle: { marginTop: 6 },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20 },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1EBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCopy: { flex: 1, minWidth: 0 },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.xl,
    borderRadius: 20,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
  },
});
