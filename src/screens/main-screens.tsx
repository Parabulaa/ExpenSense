import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '@/components/common/screen';
import { AppIcon, AppText, BackButton, Card, PrimaryButton, ProgressBar, StatusChip } from '@/components/common/ui';
import { BottomNavigation } from '@/components/navigation/bottom-navigation';
import { assets, colors, radii } from '@/constants/theme';
import { budgets, categories, transactions } from '@/data/mockData';

export function HomeScreen() {
  return (
    <Screen bottomInset={115} variant={4}>
      <View style={s.page}>
        <Pressable onPress={() => router.push('/profile')} style={s.avatar}>
          <AppText variant="h2">R</AppText>
        </Pressable>
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Good afternoon,</AppText>
            <AppText variant="title">Ryan!</AppText>
            <AppText style={s.muted}>A clearer view of your spending.</AppText>
          </View>
          <Image source={assets.mascotTip} contentFit="contain" style={s.heroMascot} />
        </View>
        <Card>
          <View style={s.rowBetween}>
            <AppText variant="h3" numberOfLines={1}>September 2026</AppText>
            <StatusChip>This Month</StatusChip>
          </View>
          <AppText style={s.muted}>Total Spent</AppText>
          <AppText variant="title">₱8,420</AppText>
          <AppText style={s.muted}>of ₱15,000 budget</AppText>
          <View style={[s.row, { marginTop: 12 }]}>
            <ProgressBar value={56} />
            <AppText variant="h3" style={{ color: colors.deepForest }}>56% used</AppText>
          </View>
        </Card>
        <View style={s.metricRow}>
          {([['chart-donut', '56%', 'Budget used'], ['wallet-outline', '₱6,580', 'Remaining'], ['receipt-text-outline', '28', 'Transactions']] as const).map(x => (
            <Card key={x[2]} style={s.metric}>
              <AppIcon name={x[0]} size={21} />
              <AppText variant="h3">{x[1]}</AppText>
              <AppText variant="small" style={s.muted}>{x[2]}</AppText>
            </Card>
          ))}
        </View>
        <View style={s.rowBetween}>
          <AppText variant="h2" style={{ flex: 1 }}>Your Budget Categories</AppText>
          <Pressable onPress={() => router.push('/categories')}>
            <AppText variant="bodyMedium" style={{ color: colors.deepForest }}>See all →</AppText>
          </Pressable>
        </View>
        <View style={s.categoryGrid}>
          {categories.slice(0, 6).map(c => (
            <Card key={c[1]} style={s.categoryTile}>
              <AppIcon name={c[0]} size={22} />
              <AppText variant="small" style={s.center}>{c[1].replace('Food & Dining', 'Food').replace('Transportation', 'Transport')}</AppText>
            </Card>
          ))}
          <Pressable onPress={() => router.push('/categories')} style={s.addTile}>
            <AppIcon name="plus" size={26} />
            <AppText variant="small">Add / Edit</AppText>
          </Pressable>
        </View>
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function TransactionsScreen() {
  return (
    <Screen bottomInset={110} variant={4}>
      <View style={s.page}>
        <AppText variant="hero">Transactions</AppText>
        <View style={s.search}>
          <AppText variant="h2">⌕</AppText>
          <TextInput placeholder="Search transactions" placeholderTextColor={colors.muted} style={s.searchInput} />
        </View>
        <View style={s.filters}>
          {['Date⌄', 'Category⌄', 'Sort⌄'].map(x => (
            <Pressable style={s.filter} key={x}>
              <AppText>{x}</AppText>
            </Pressable>
          ))}
        </View>
        {transactions.map((t, index) => {
          const show = index === 0 || t.day !== transactions[index - 1].day;
          return (
            <View key={t.id}>
              {show && <AppText variant="h2" style={s.group}>{t.day}</AppText>}
              <Pressable onPress={() => router.push(`/transaction/${t.id}` as never)}>
                <Card style={s.transaction}>
                  <View style={[s.roundIcon, { backgroundColor: t.color }]}>
                    <AppText variant="h3" style={{ color: colors.surface }}>{t.icon}</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{t.merchant}</AppText>
                    <AppText style={s.muted}>{t.category}</AppText>
                  </View>
                  <AppText variant="h2">-₱{t.amount}</AppText>
                </Card>
              </Pressable>
            </View>
          );
        })}
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function TransactionDetailsScreen() {
  return (
    <Screen variant={4}>
      <View style={s.page}>
        <BackButton />
        <View style={s.detailHead}>
          <View style={[s.roundIcon, { width: 78, height: 78, borderRadius: 39, backgroundColor: '#F9D0D0' }]}>
            <AppText variant="title">🍗</AppText>
          </View>
          <AppText variant="h2">Jollibee</AppText>
          <AppText variant="hero">₱230.00</AppText>
          <AppText style={s.muted}>Sep 14, 2024 • 2:14 PM</AppText>
          <StatusChip>✓  Verified</StatusChip>
        </View>
        <Card style={{ gap: 12 }}>
          <InfoRow label="🍴  Category" value="Food & Dining" />
          <InfoRow label="▣  Payment Method" value="Cash" />
          <View style={s.divider} />
          <AppText style={s.muted}>Items</AppText>
          <InfoRow label="1  ×  Chicken Meal" value="₱230" />
          <View style={s.divider} />
          <InfoRow label="Total" value="₱230" bold />
        </Card>
        <Card>
          <AppText style={s.muted}>Receipt</AppText>
          <View style={s.receiptPreview}>
            <Image source={assets.receipt} contentFit="contain" style={{ width: 110, height: 130 }} />
          </View>
        </Card>
        <View style={s.actions}>
          <Pressable style={s.edit}>
            <AppText variant="h3" style={{ color: colors.deepForest }}>✎  Edit</AppText>
          </Pressable>
          <Pressable style={s.delete}>
            <AppText variant="h3" style={{ color: colors.danger }}>▰  Delete</AppText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
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
  return (
    <Screen bottomInset={110} variant={4}>
      <View style={s.page}>
        <AppText variant="hero">Budget</AppText>
        <Card style={s.select}>
          <AppText>September 2024</AppText>
          <AppText>⌄</AppText>
        </Card>
        <Card style={{ gap: 10 }}>
          <AppText variant="h3">Monthly Budget</AppText>
          <AppText variant="hero">₱10,000</AppText>
          <View style={s.rowBetween}>
            <AppText variant="h3" style={{ color: colors.deepForest }}>₱4,280 spent</AppText>
            <AppText variant="h3" style={{ color: colors.deepForest }}>₱5,720 left</AppText>
          </View>
          <View style={s.row}>
            <ProgressBar value={43} />
            <AppText variant="h3">43%</AppText>
          </View>
        </Card>
        <AppText variant="h2">Category Budgets</AppText>
        {budgets.map(b => (
          <Card key={b[1]} style={s.budgetRow}>
            <View style={s.budgetIcon}>
              <AppIcon name={b[0]} size={22} color={colors.deepForest} />
            </View>
            <View style={s.budgetInfo}>
              <AppText variant="h3" numberOfLines={1}>{b[1]}</AppText>
              <ProgressBar value={b[3] / b[2] * 100} height={10} />
            </View>
            <View style={s.budgetValues}>
              <AppText variant="h3" numberOfLines={1}>₱{b[2].toLocaleString()}</AppText>
              <AppText variant="small" style={{ color: colors.deepForest }} numberOfLines={1}>₱{b[3].toLocaleString()} spent</AppText>
            </View>
            <AppIcon name="chevron-right" size={20} color={colors.muted} />
          </Card>
        ))}
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function AnalyticsScreen() {
  return (
    <Screen bottomInset={110} variant={3}>
      <View style={s.page}>
        <AppText variant="hero">Analytics</AppText>
        <AppText style={s.muted}>A clearer view of your spending.</AppText>
        <Card style={s.select}>
          <AppText variant="h2">September 2026</AppText>
          <AppText>⌄</AppText>
        </Card>
        <View style={s.segment}>
          <View style={s.segmentActive}>
            <AppText variant="h3" style={{ color: colors.surface }}>Spending</AppText>
          </View>
          <Pressable onPress={() => router.push('/insights')} style={s.segmentHalf}>
            <AppText variant="h3" style={s.muted}>Trends</AppText>
          </Pressable>
        </View>
        <Card style={{ alignItems: 'center' }}>
          <View style={s.donut}>
            <View style={s.donutInner}>
              <AppText variant="title">₱4,280</AppText>
              <AppText style={s.muted}>Total Spending</AppText>
            </View>
          </View>
          {([['#145733', 'Food & Dining', '32%'], ['#3C8055', 'Transportation', '18%'], ['#70A16E', 'Shopping', '17%'], ['#98BA8D', 'Bills', '12%'], ['#C7D9BC', 'Others', '21%']] as const).map(x => (
            <View style={s.legend} key={x[1]}>
              <View style={[s.legendDot, { backgroundColor: x[0] }]} />
              <AppText style={[s.muted, { flex: 1 }]}>{x[1]}</AppText>
              <AppText style={s.muted}>{x[2]}</AppText>
            </View>
          ))}
        </Card>
        <Pressable onPress={() => router.push('/insights')}>
          <AppText variant="h3" style={{ textAlign: 'right', color: colors.deepForest }}>View Spending Insights →</AppText>
        </Pressable>
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function InsightsScreen() {
  return (
    <Screen bottomInset={110} variant={4}>
      <View style={s.page}>
        <View style={s.insightHero}>
          <View style={{ flex: 1 }}>
            <AppText variant="title">Spending Insights</AppText>
            <AppText style={s.muted}>Simple insights for a smarter you.</AppText>
          </View>
          <Image source={assets.mascotScanning} contentFit="contain" style={{ width: 135, height: 120 }} />
        </View>
        {([['🍴', 'Top Category', 'Food & Dining', 'accounts for 32% of your spending this month.'], ['🛒', 'Recurring Expenses', 'You have 2 recurring', 'merchants this month.'], ['☕', 'Unusual Spending', '45% higher', 'Your coffee shop spending is higher than usual.'], ['🎁', 'Recommendation', 'Food & Dining', 'Consider setting a budget to stay on track.']] as const).map(x => (
          <Card key={x[1]} style={s.insightCard}>
            <View style={s.iconSoft}>
              <AppText variant="h2">{x[0]}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.muted}>{x[1]}</AppText>
              <AppText variant="h2">{x[2]}</AppText>
              <AppText style={s.muted}>{x[3]}</AppText>
            </View>
            <AppText variant="title">›</AppText>
          </Card>
        ))}
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function CategoriesScreen() {
  return (
    <Screen bottomInset={110} variant={5}>
      <View style={s.page}>
        <AppText variant="hero">Categories</AppText>
        <AppText style={s.muted}>Organize your spending, your way.</AppText>
        {categories.map(c => (
          <Pressable key={c[1]}>
            <Card style={s.categoryRow}>
              <View style={[s.roundIcon, { backgroundColor: c[2] }]}>
                <AppIcon name={c[0]} />
              </View>
              <AppText variant="h3" style={{ flex: 1 }}>{c[1]}</AppText>
              <AppIcon name="chevron-right" color={colors.muted} />
            </Card>
          </Pressable>
        ))}
        <PrimaryButton title="Add Category" icon="plus" />
      </View>
      <BottomNavigation />
    </Screen>
  );
}

export function ProfileScreen() {
  return (
    <Screen bottomInset={110} variant={4}>
      <View style={s.page}>
        <AppText variant="title">Profile & Settings</AppText>
        <AppText style={s.muted}>Manage your account and preferences.</AppText>
        <Card style={s.profileCard}>
          <View style={s.profileAvatar}>
            <AppText variant="hero" style={{ color: colors.surface }}>R</AppText>
          </View>
          <AppText variant="h2">Ryan</AppText>
          <AppText style={s.muted}>ryan@example.com</AppText>
        </Card>
        {([['♙', 'Account Information'], ['▣', 'Change Password'], ['♧', 'Notifications'], ['◉', 'Appearance'], ['♢', 'Privacy & Data'], ['?', 'Help & Support'], ['ⓘ', 'About']] as const).map(x => (
          <Pressable key={x[1]}>
            <Card style={s.settingsRow}>
              <View style={s.iconSoft}>
                <AppText variant="h3">{x[0]}</AppText>
              </View>
              <AppText style={{ flex: 1 }}>{x[1]}</AppText>
              <AppText variant="h2" style={s.muted}>›</AppText>
            </Card>
          </Pressable>
        ))}
        <Pressable onPress={() => router.replace('/welcome')} style={s.logout}>
          <AppText variant="h3" style={{ color: colors.danger }}>⇥  Logout</AppText>
        </Pressable>
      </View>
      <BottomNavigation />
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { padding: 24, gap: 16 },
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
  search: { height: 54, backgroundColor: 'rgba(232,238,227,.88)', borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontFamily: 'JakartaRegular', fontSize: 15, color: colors.text },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { flex: 1, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  group: { marginTop: 14, color: colors.muted },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  roundIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  detailHead: { alignItems: 'center', gap: 8 },
  divider: { height: 1, backgroundColor: colors.line },
  receiptPreview: { height: 140, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginTop: 10, alignItems: 'flex-start', paddingLeft: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  edit: { flex: 1, height: 56, borderRadius: radii.md, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  delete: { flex: 1, height: 56, borderRadius: radii.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', borderRadius: radii.md, backgroundColor: colors.pale, padding: 4 },
  segmentActive: { flex: 1, height: 42, borderRadius: radii.sm, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' },
  segmentHalf: { flex: 1, height: 42, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  donut: { width: 200, height: 200, borderRadius: 100, borderWidth: 18, borderColor: colors.deepForest, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  donutInner: { alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  insightHero: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconSoft: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  profileCard: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logout: { alignItems: 'center', paddingVertical: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  /* Budget row: icon | info (flex) | values | chevron */
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
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
  budgetValues: {
    alignItems: 'flex-end',
    minWidth: 72,
    gap: 2,
  },
});
