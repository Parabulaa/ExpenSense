import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Keyboard, View } from 'react-native';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton, ProgressBar, SecondaryButton, StatusChip } from '@/components/common/ui';
import { radii, spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { useFinance } from '@/features/finance/FinanceProvider';
import { incomeKindLabels, type IncomeKind, type SavingsGoal, type Wallet, type WalletType } from '@/features/finance/types';
import { WalletCardFace } from '@/features/finance/components/WalletCardFace';
import { walletAccent, walletColors, walletTypeMeta, walletTypes } from '@/features/finance/wallet-presentation';
import { formatPeso } from '@/lib/format';
import { formatDateTime, formatExpenseDate, nowLocalTime, todayLocalDate } from '@/features/expenses/validation';
import { Calendar } from '@/components/common/calendar';
import { AmountChips } from '@/components/common/amount-chips';
import { ExpenseDatePicker, WalletPicker } from '@/screens/expense-screens';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';

const money = (c: number) => formatPeso(c, { alwaysShowDecimals: true });
const parseMoney = (v: string) => { const n = Number(v.replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };

type MoneyForm = { walletId: string; toWalletId: string; kind: IncomeKind; source: string; amount: string; fee: string; date: string; time: string };
const emptyMoneyForm = (walletId = ''): MoneyForm => ({ walletId, toWalletId: '', kind: 'income', source: '', amount: '', fee: '', date: todayLocalDate(), time: nowLocalTime() });

type ConfirmRequest = { title: string; message: string; label: string; run: () => Promise<unknown> };

/**
 * The app's own confirmation dialog, used instead of the native Alert so every
 * prompt matches the green-and-cream design and also works on the web app,
 * where the native Alert does nothing.
 */
function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) setRequest(null); };
  const dialog = (
    <AuthDialog
      visible={Boolean(request)}
      title={request?.title ?? ''}
      message={request?.message ?? ''}
      primaryAction={{ label: request?.label ?? 'Confirm', destructive: true, loading: busy, onPress: async () => { if (!request) return; setBusy(true); await request.run(); setBusy(false); setRequest(null); } }}
      secondaryAction={{ label: 'Cancel', onPress: close }}
      onRequestClose={close}
    />
  );
  return { ask: setRequest, dialog };
}

function SheetField({ label, value, icon, placeholder, onPress }: { label: string; value: string; icon: Parameters<typeof AppIcon>[0]['name']; placeholder?: boolean; onPress: () => void }) {
  const colors = useColors();
  const s = useStyles();
  return (
    <View style={s.fieldGroup}>
      <AppText variant="bodyMedium">{label}</AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={s.fieldButton}>
        <AppIcon name={icon} size={21} color={colors.forest} />
        <AppText numberOfLines={1} style={[s.fieldButtonText, placeholder && s.muted]}>{value}</AppText>
        <AppIcon name="chevron-down" size={20} color={colors.muted} />
      </PressableScale>
    </View>
  );
}

export function WalletsScreen() {
  const colors = useColors();
  const s = useStyles();
  const { wallets, loading, error, refresh, revalidate, saveWallet, archiveWallet, deleteWallet, addIncome, addTransfer } = useFinance();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null);
  const [name, setName] = useState(''); const [balance, setBalance] = useState(''); const [type, setType] = useState<WalletType>('cash'); const [color, setColor] = useState(walletColors[0]); const [isDefault, setDefault] = useState(false); const [saving, setSaving] = useState(false);
  // One sheet handles both ways money moves in: income/cash-in, or a transfer.
  const [moneySheet, setMoneySheet] = useState<'in' | 'transfer' | null>(null);
  const [form, setForm] = useState<MoneyForm>(emptyMoneyForm());
  const [picker, setPicker] = useState<'wallet' | 'toWallet' | 'date' | null>(null);
  useFocusEffect(useCallback(() => { void revalidate(); }, [revalidate]));
  const params = useLocalSearchParams<{ wallet?: string; new?: string; transfer?: string; add?: string }>();
  const handledParams = useRef(false);
  const defaultWalletId = (wallets.find(w => w.isDefault) ?? wallets[0])?.id ?? '';
  const walletName = (id: string) => wallets.find(w => w.id === id)?.name;
  const updateForm = (patch: Partial<MoneyForm>) => setForm(current => ({ ...current, ...patch }));
  const open = (wallet?: Wallet) => { setEditing(wallet ?? 'new'); setName(wallet?.name ?? ''); setBalance(wallet ? String(wallet.balanceCents / 100) : ''); setType(wallet?.type ?? 'cash'); setColor(wallet?.color ?? walletColors[wallets.length % walletColors.length]); setDefault(wallet?.isDefault ?? wallets.length === 0); };
  const submit = async () => { const amount = parseMoney(balance); if (!name.trim() || amount === null) { showToast('Enter a wallet name and a valid balance.', { tone: 'warning' }); return; } setSaving(true); const r = await saveWallet({ id: editing !== 'new' && editing ? editing.id : undefined, name, type, balanceCents: amount, color, isDefault }); setSaving(false); if (!r.ok) return showToast(r.message, { tone: 'warning' }); setEditing(null); showToast('Wallet saved.'); };
  const openMoneyIn = (wallet?: Wallet) => { setForm(emptyMoneyForm(wallet?.id ?? defaultWalletId)); setMoneySheet('in'); };
  const openTransfer = (wallet?: Wallet) => {
    const from = wallet?.id ?? defaultWalletId;
    setForm({ ...emptyMoneyForm(from), toWalletId: wallets.find(w => w.id !== from)?.id ?? '' });
    setMoneySheet('transfer');
  };
  const submitMoney = async () => {
    const amount = parseMoney(form.amount);
    if (moneySheet === 'in') {
      if (!form.walletId || !amount || !form.source.trim()) return showToast('Choose a wallet, enter a source, and add an amount.', { tone: 'warning' });
      setSaving(true);
      const r = await addIncome({ walletId: form.walletId, amountCents: amount, kind: form.kind, source: form.source, transactionDate: form.date, transactionTime: form.time });
      setSaving(false);
      if (!r.ok) return showToast(r.message, { tone: 'warning' });
      setMoneySheet(null); showToast(r.queued ? `${incomeKindLabels[form.kind]} saved offline. It will sync when you are back online.` : `${incomeKindLabels[form.kind]} added to ${walletName(form.walletId) ?? 'wallet'}.`);
      return;
    }
    const fee = form.fee.trim() ? parseMoney(form.fee) : 0;
    if (!form.walletId || !form.toWalletId) return showToast('Choose both wallets.', { tone: 'warning' });
    if (form.walletId === form.toWalletId) return showToast('Choose two different wallets.', { tone: 'warning' });
    if (!amount || fee === null) return showToast('Enter a valid amount and fee.', { tone: 'warning' });
    setSaving(true);
    const r = await addTransfer({ fromWalletId: form.walletId, toWalletId: form.toWalletId, amountCents: amount, feeCents: fee, transactionDate: form.date, transactionTime: form.time });
    setSaving(false);
    if (!r.ok) return showToast(r.message, { tone: 'warning' });
    setMoneySheet(null); showToast(r.queued ? 'Transfer saved offline. It will sync when you are back online.' : `Moved ${money(amount)} to ${walletName(form.toWalletId) ?? 'wallet'}.`);
  };
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const archive = (wallet: Wallet) => ask({ title: 'Archive wallet?', message: `${wallet.name} will be hidden from active wallets. Its transaction history will be preserved.${wallet.isDefault ? ' Another wallet will become the default when available.' : ''}`, label: 'Archive', run: async () => { const r = await archiveWallet(wallet.id); showToast(r.ok ? 'Wallet archived.' : r.message, r.ok ? undefined : { tone: 'warning' }); } });
  const permanentlyDelete = (wallet: Wallet) => ask({ title: 'Delete wallet permanently?', message: `This cannot be undone. Expenses remain in your history without a wallet, but ${wallet.name}'s income and transfer records will be deleted.${wallet.isDefault ? ' Another wallet will become the default when available.' : ''}`, label: 'Delete', run: async () => { const r = await deleteWallet(wallet.id); showToast(r.ok ? 'Wallet deleted.' : r.message, r.ok ? undefined : { tone: 'warning' }); } });
  // Opens the sheet the wallet tab asked for, once, after the wallets land.
  // Guarded by a ref so going back to this screen does not reopen it.
  useEffect(() => {
    if (handledParams.current) return;
    // Deliberate: this effect exists precisely to open a sheet on arrival, and
    // the ref guard keeps it to a single extra render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.new === '1') { handledParams.current = true; open(); return; }
    if ((params.add === '1' || params.transfer === '1') && wallets.length) {
      // A wallet page passes its own wallet so the sheet starts from it.
      const from = wallets.find(item => item.id === params.wallet);
      handledParams.current = true;
      if (params.add === '1') openMoneyIn(from); else openTransfer(from);
      return;
    }
    if (!params.wallet) return;
    const target = wallets.find(item => item.id === params.wallet);
    if (target) { handledParams.current = true; open(target); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.new, params.add, params.transfer, params.wallet, wallets]);

  const amountCents = parseMoney(form.amount) ?? 0;
  const feeCents = parseMoney(form.fee || '0') ?? 0;
  const fromWallet = wallets.find(w => w.id === form.walletId);

  return <Screen bottomInset={40} variant={7} refreshing={loading} onRefresh={refresh}>
    <View style={s.page}>
      <View style={s.header}><BackButton /><View style={s.headerCopy}><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Manage wallets</AppText><AppText style={s.muted}>Edit, archive, or permanently delete a wallet.</AppText></View></View>
      {error && !wallets.length ? <Card><AppText variant="h3">Couldn&apos;t load wallets</AppText><SecondaryButton title="Try Again" onPress={refresh} /></Card> : (
        <View style={walletManageStyles.list}>
          {wallets.map((wallet, index) => {
            const meta = walletTypeMeta(wallet.type);
            // Same row language as Categories and Budgets: round icon, name + meta,
            // small tag, and soft pill actions.
            return <Card key={wallet.id} style={walletManageStyles.row}>
              <PressableScale accessibilityRole="button" accessibilityLabel={`Edit ${wallet.name}`} onPress={() => open(wallet)} style={walletManageStyles.main}>
                <View style={[walletManageStyles.icon, { backgroundColor: walletAccent(wallet.color, index) }]}><AppIcon name={meta.icon} size={22} color="#FFFFFF" /></View>
                <View style={s.grow}>
                  <View style={walletManageStyles.nameRow}>
                    <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={walletManageStyles.name}>{wallet.name}</AppText>
                    {wallet.isDefault ? <View style={[walletManageStyles.tag, { backgroundColor: colors.pale }]}><AppText variant="small" style={[walletManageStyles.tagText, { color: colors.deepForest }]}>Default</AppText></View> : null}
                  </View>
                  <AppText variant="small" style={s.muted}>{meta.label} · {wallet.balanceCents < 0 ? '−' : ''}{money(Math.abs(wallet.balanceCents))}</AppText>
                </View>
                <View style={[walletManageStyles.edit, { backgroundColor: colors.pale }]}><AppIcon name="pencil-outline" size={18} color={colors.deepForest} /></View>
              </PressableScale>
              <View style={walletManageStyles.actions}>
                <PressableScale accessibilityRole="button" accessibilityLabel={`Archive ${wallet.name}`} onPress={() => archive(wallet)} style={[walletManageStyles.action, { backgroundColor: colors.pale }]}><AppIcon name="archive-arrow-down-outline" size={18} color={colors.deepForest} /><AppText variant="bodyMedium" style={{ color: colors.deepForest }}>Archive</AppText></PressableScale>
                <PressableScale accessibilityRole="button" accessibilityLabel={`Delete ${wallet.name} permanently`} onPress={() => permanentlyDelete(wallet)} style={[walletManageStyles.action, { backgroundColor: colors.dangerSoft }]}><AppIcon name="delete-outline" size={18} color={colors.danger} /><AppText variant="bodyMedium" style={{ color: colors.danger }}>Delete</AppText></PressableScale>
              </View>
            </Card>;
          })}
          <PrimaryButton title="Add Wallet" icon="plus" onPress={() => open()} />
        </View>
      )}
    </View>

    <DraggableBottomSheet visible={editing !== null} disabled={saving} onClose={() => setEditing(null)}><AppText variant="h2">{editing === 'new' ? 'Add Wallet' : 'Edit Wallet'}</AppText><FormInput label="Wallet name" value={name} onChangeText={setName} maxLength={60} /><AppText variant="bodyMedium">Wallet type</AppText><View style={s.chips}>{walletTypes.map(x => <PressableScale key={x.id} onPress={() => setType(x.id)} style={[s.chip, type === x.id && s.chipActive]}><AppIcon name={x.icon} size={18} color={type === x.id ? colors.surface : colors.deepForest} /><AppText variant="small" style={type === x.id ? s.white : undefined}>{x.label}</AppText></PressableScale>)}</View><AppText variant="bodyMedium">Wallet color</AppText><View style={s.colorRow}>{walletColors.map(value => <PressableScale key={value} accessibilityLabel={`Use wallet color ${value}`} onPress={() => setColor(value)} style={[s.colorChoice, { backgroundColor: value }, color === value && s.colorChoiceSelected]}>{color === value ? <AppIcon name="check" size={18} color={colors.surface} /> : null}</PressableScale>)}</View><FormInput label={editing === 'new' ? 'Opening balance' : 'Current balance'} icon="currency-php" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" /><AmountChips value={balance} onChange={setBalance} /><PressableScale disabled={Boolean(editing && editing !== 'new' && editing.isDefault)} onPress={() => setDefault(v => !v)} style={s.defaultRow}><AppIcon name={isDefault ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={colors.success} /><View style={s.grow}><AppText variant="bodyMedium">Default wallet</AppText><AppText variant="small" style={s.muted}>{editing && editing !== 'new' && editing.isDefault ? 'To change it, set another wallet as the default.' : 'Preselected for new expenses'}</AppText></View></PressableScale><PrimaryButton title="Save Wallet" loading={saving} loadingTitle="Saving..." onPress={submit} /></DraggableBottomSheet>

    <DraggableBottomSheet visible={moneySheet !== null} disabled={saving} onClose={() => { setPicker(null); setMoneySheet(null); }}>
      <AppText variant="h2">{moneySheet === 'transfer' ? 'Transfer' : 'Add Income'}</AppText>
      {moneySheet === 'in' ? <>
        <View style={s.chips}>{(['income', 'cash_in'] as IncomeKind[]).map(kind => <PressableScale key={kind} onPress={() => updateForm({ kind })} style={[s.chip, form.kind === kind && s.chipActive]}><AppText variant="small" style={form.kind === kind ? s.white : undefined}>{incomeKindLabels[kind]}</AppText></PressableScale>)}</View>
        <AppText variant="small" style={s.muted}>{form.kind === 'income' ? 'Money you earned or received, like salary.' : 'A top-up from outside your wallets, like a 7-Eleven or bank cash-in.'}</AppText>
        <SheetField label="Wallet" value={walletName(form.walletId) ?? 'Select wallet'} icon="wallet-outline" placeholder={!form.walletId} onPress={() => setPicker('wallet')} />
        <FormInput label="Source" placeholder={form.kind === 'income' ? 'Salary, freelance, gift...' : '7-Eleven, bank, partner outlet...'} value={form.source} onChangeText={source => updateForm({ source })} maxLength={100} />
        <FormInput label="Amount" icon="currency-php" value={form.amount} onChangeText={amount => updateForm({ amount })} keyboardType="decimal-pad" />
        <AmountChips value={form.amount} onChange={amount => updateForm({ amount })} />
      </> : <>
        <SheetField label="From wallet" value={walletName(form.walletId) ?? 'Select wallet'} icon="wallet-outline" placeholder={!form.walletId} onPress={() => setPicker('wallet')} />
        <SheetField label="To wallet" value={walletName(form.toWalletId) ?? 'Select wallet'} icon="wallet-plus-outline" placeholder={!form.toWalletId} onPress={() => setPicker('toWallet')} />
        <FormInput label="Amount" icon="currency-php" value={form.amount} onChangeText={amount => updateForm({ amount })} keyboardType="decimal-pad" />
        <AmountChips value={form.amount} onChange={amount => updateForm({ amount })} />
        <FormInput label="Transfer fee (optional)" icon="currency-php" placeholder="0.00" value={form.fee} onChangeText={fee => updateForm({ fee })} keyboardType="decimal-pad" hint="Charged by the app or bank. It leaves the source wallet only." />
        {fromWallet && amountCents > 0 ? <View style={s.summary}><AppText variant="small" style={s.muted}>{fromWallet.name} will go down by</AppText><AppText variant="h3">{money(amountCents + feeCents)}</AppText></View> : null}
      </>}
      <SheetField label="Date & Time" value={formatDateTime(form.date, form.time)} icon="calendar-clock-outline" onPress={() => setPicker('date')} />
      <PrimaryButton title={moneySheet === 'transfer' ? 'Transfer' : 'Add to Wallet'} loading={saving} loadingTitle="Saving..." onPress={submitMoney} />
      {/* Nested inside the sheet so the picker presents above it on every platform. */}
      <WalletPicker visible={picker === 'wallet' || picker === 'toWallet'} title={picker === 'toWallet' ? 'Transfer To' : moneySheet === 'transfer' ? 'Transfer From' : 'Choose Wallet'} selectedId={picker === 'toWallet' ? form.toWalletId : form.walletId} excludeId={moneySheet === 'transfer' ? (picker === 'toWallet' ? form.walletId : form.toWalletId) : undefined} onClose={() => setPicker(null)} onSelect={id => { updateForm(picker === 'toWallet' ? { toWalletId: id } : { walletId: id }); setPicker(null); }} />
      {picker === 'date' ? <ExpenseDatePicker value={form.date} time={form.time} onClose={() => setPicker(null)} onSelect={(date, time) => { updateForm({ date, time }); setPicker(null); }} /> : null}
    </DraggableBottomSheet>
    {confirmDialog}
  </Screen>;
}

/** One wallet's own page: its balance, what moved in and out of it, and the actions for it. */
export function WalletDetailScreen() {
  const colors = useColors();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const walletId = Array.isArray(id) ? id[0] : id;
  const { wallets, incomeEntries, transfers, loading, refresh, revalidate } = useFinance();
  const { expenses, refresh: refreshExpenses, revalidate: revalidateExpenses } = useExpenses();
  const { findCategory } = useCategories();
  useFocusEffect(useCallback(() => { void revalidate(); void revalidateExpenses(); }, [revalidate, revalidateExpenses]));
  const index = wallets.findIndex(item => item.id === walletId);
  const wallet = wallets[index];
  const walletName = (otherId: string) => wallets.find(w => w.id === otherId)?.name ?? 'Wallet';
  const manage = (params: Record<string, string>) => router.push({ pathname: '/wallets', params: { wallet: walletId, ...params } } as never);

  if (!wallet) {
    return <Screen bottomInset={40} variant={7}><View style={s.page}><BackButton /><Card><AppText variant="h3">{loading ? 'Loading wallet…' : 'Wallet not found'}</AppText>{loading ? null : <AppText style={s.muted}>It may have been archived.</AppText>}</Card></View></Screen>;
  }

  // Signed amounts from this wallet's point of view, newest first.
  const rows = [
    ...expenses.filter(item => item.walletId === walletId).map(item => ({ key: `e-${item.id}`, date: item.transactionDate, time: item.transactionTime, created: item.createdAt, title: item.merchant, detail: findCategory(item.categoryId)?.fullLabel ?? 'Expense', cents: -item.amountCents, onPress: () => router.push(`/transaction/${item.id}` as never) })),
    ...incomeEntries.filter(item => item.walletId === walletId).map(item => ({ key: `i-${item.id}`, date: item.transactionDate, time: item.transactionTime, created: item.createdAt, title: item.source, detail: incomeKindLabels[item.kind], cents: item.amountCents, onPress: undefined })),
    ...transfers.filter(item => item.fromWalletId === walletId).map(item => ({ key: `to-${item.id}`, date: item.transactionDate, time: item.transactionTime, created: item.createdAt, title: `To ${walletName(item.toWalletId)}`, detail: item.feeCents ? `Transfer · ${money(item.feeCents)} fee` : 'Transfer', cents: -(item.amountCents + item.feeCents), onPress: undefined })),
    ...transfers.filter(item => item.toWalletId === walletId).map(item => ({ key: `from-${item.id}`, date: item.transactionDate, time: item.transactionTime, created: item.createdAt, title: `From ${walletName(item.fromWalletId)}`, detail: 'Transfer', cents: item.amountCents, onPress: undefined })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.created.localeCompare(a.created));
  const moneyIn = rows.filter(row => row.cents > 0).reduce((sum, row) => sum + row.cents, 0);
  const moneyOut = rows.filter(row => row.cents < 0).reduce((sum, row) => sum - row.cents, 0);
  const walletExpenses = expenses.filter(item => item.walletId === walletId);
  const monthPrefix = todayLocalDate().slice(0, 7);
  const monthExpenses = walletExpenses.filter(item => item.transactionDate.startsWith(monthPrefix));
  const monthSpent = monthExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  const totalSpent = walletExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  const averageExpense = walletExpenses.length ? Math.round(totalSpent / walletExpenses.length) : 0;
  const categorySpending = Object.entries(walletExpenses.reduce<Record<string, number>>((totals, item) => {
    totals[item.categoryId] = (totals[item.categoryId] ?? 0) + item.amountCents;
    return totals;
  }, {})).map(([categoryId, cents]) => ({ categoryId, cents, label: findCategory(categoryId)?.fullLabel ?? 'Archived category' })).sort((a, b) => b.cents - a.cents);
  const maxCategory = categorySpending[0]?.cents ?? 1;
  return <Screen bottomInset={40} variant={7} refreshing={loading} onRefresh={() => { void refresh(); void refreshExpenses(); }}>
    <View style={s.page}>
      <View style={s.header}><BackButton /><View style={s.headerCopy}><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>{wallet.name}</AppText><AppText style={s.muted}>{wallet.isDefault ? 'Default wallet' : 'Wallet'}</AppText></View></View>
      <WalletCardFace wallet={wallet} index={index} />
      <View style={s.actionRow}>
        <View style={s.grow}><SecondaryButton title="Add Income" icon="cash-plus" onPress={() => manage({ add: '1' })} /></View>
        <View style={s.grow}><SecondaryButton title="Transfer" icon="swap-horizontal" disabled={wallets.length < 2} onPress={() => manage({ transfer: '1' })} /></View>
      </View>
      <SecondaryButton title="Edit Wallet" icon="pencil-outline" onPress={() => manage({})} />
      <Card style={s.detailTotals}>
        <View style={s.grow}><AppText variant="small" style={s.muted}>Money in</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.success }}>+{money(moneyIn)}</AppText></View>
        <View style={s.grow}><AppText variant="small" style={s.muted}>Money out</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit>−{money(moneyOut)}</AppText></View>
      </Card>
      <View style={s.analyticsSection}>
        <AppText variant="h2">Spending analytics</AppText>
        <Card style={s.analyticsCard}>
          <View style={s.analyticsGrid}>
            <View style={s.analyticsMetric}><AppText variant="small" style={s.muted}>This month</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit>{money(monthSpent)}</AppText></View>
            <View style={s.analyticsMetric}><AppText variant="small" style={s.muted}>All-time spent</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit>{money(totalSpent)}</AppText></View>
            <View style={s.analyticsMetric}><AppText variant="small" style={s.muted}>Expenses</AppText><AppText variant="h3">{walletExpenses.length}</AppText></View>
            <View style={s.analyticsMetric}><AppText variant="small" style={s.muted}>Average</AppText><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit>{money(averageExpense)}</AppText></View>
          </View>
          {categorySpending.length ? <View style={s.categoryAnalytics}><AppText variant="bodyMedium">Spending by category</AppText>{categorySpending.map(category => <View key={category.categoryId} style={s.categoryMetric}><View style={s.summary}><AppText variant="small" numberOfLines={1} style={s.grow}>{category.label}</AppText><AppText variant="small">{money(category.cents)}</AppText></View><ProgressBar value={Math.round(category.cents / maxCategory * 100)} /></View>)}</View> : <AppText variant="small" style={s.muted}>No expenses from this wallet yet.</AppText>}
        </Card>
      </View>
      <AppText variant="h2">History</AppText>
      {rows.length === 0 ? <AppText style={s.muted}>Nothing has moved in or out of this wallet yet.</AppText> : rows.map(row => (
        <PressableScale key={row.key} disabled={!row.onPress} onPress={row.onPress} style={s.historyRow}>
          <View style={[s.historyDot, { backgroundColor: row.cents > 0 ? colors.success : wallet.color ?? colors.forest }]} />
          <View style={s.grow}><AppText variant="bodyMedium" numberOfLines={1}>{row.title}</AppText><AppText variant="small" style={s.muted} numberOfLines={1}>{row.detail} · {formatDateTime(row.date, row.time)}</AppText></View>
          <AppText variant="h3" numberOfLines={1} style={{ color: row.cents > 0 ? colors.success : colors.deepForest }}>{row.cents > 0 ? '+' : '−'}{money(Math.abs(row.cents))}</AppText>
        </PressableScale>
      ))}
    </View>
  </Screen>;
}

const walletManageStyles = {
  list: { gap: 12 },
  row: { gap: 12 },
  main: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  // Matches the 44px round icons used on Categories and Budgets.
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  nameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  name: { flexShrink: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  tagText: { fontFamily: 'JakartaSemiBold' },
  edit: { width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const },
  actions: { flexDirection: 'row' as const, gap: 8 },
  action: { flex: 1, minHeight: 42, borderRadius: radii.pill, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 },
};

export function GoalsScreen() {
  const colors = useColors();
  const s = useStyles();
  const { goals, loading, error, refresh, saveGoal, addToGoal, archiveGoal } = useFinance(); const { showToast } = useToast();
  const [mode, setMode] = useState<'new' | 'edit' | 'add' | null>(null); const [selected, setSelected] = useState<SavingsGoal | null>(null); const [name, setName] = useState(''); const [target, setTarget] = useState(''); const [current, setCurrent] = useState(''); const [date, setDate] = useState(''); const [saving, setSaving] = useState(false); const [datePickerOpen, setDatePickerOpen] = useState(false); const [dateDraft, setDateDraft] = useState(todayLocalDate());
  const openNew = () => { setSelected(null); setMode('new'); setName(''); setTarget(''); setCurrent(''); setDate(''); };
  const openEdit = (g: SavingsGoal) => { setSelected(g); setMode('edit'); setName(g.name); setTarget(String(g.targetCents / 100)); setDate(g.targetDate ?? ''); };
  const openAdd = (g: SavingsGoal) => { setSelected(g); setMode('add'); setCurrent(''); };
  const save = async () => { Keyboard.dismiss(); setSaving(true); let r; if (mode === 'add' && selected) { const n = parseMoney(current); r = n && n > 0 ? await addToGoal(selected, n) : { ok: false as const, message: 'Enter an amount greater than zero.' }; } else { const t = parseMoney(target); const c = parseMoney(current || '0'); r = name.trim() && t && c !== null ? await saveGoal({ id: mode === 'edit' ? selected?.id : undefined, name, targetCents: t, currentCents: c, targetDate: date || null }) : { ok: false as const, message: 'Enter a name and valid target amount.' }; } setSaving(false); if (!r.ok) return showToast(r.message, { tone: 'warning' }); setMode(null); showToast(mode === 'add' ? 'Money added to goal.' : 'Goal saved.'); };
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const remove = (g: SavingsGoal) => ask({ title: 'Archive goal?', message: `${g.name} will be hidden. Your wallets and expenses are not affected.`, label: 'Archive', run: async () => { const r = await archiveGoal(g.id); showToast(r.ok ? 'Goal archived.' : r.message, r.ok ? undefined : { tone: 'warning' }); } });
  const saved = useMemo(() => goals.reduce((n, g) => n + g.currentCents, 0), [goals]);
  return <Screen bottomInset={40} variant={9} refreshing={loading} onRefresh={refresh}><View style={s.page}><View style={s.header}><BackButton /><View style={s.headerCopy}><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Savings Goals</AppText><AppText style={s.muted}>Turn plans into visible progress.</AppText></View></View><Card style={s.totalCard}><AppText style={s.muted}>Saved across goals</AppText><AppText variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(saved)}</AppText></Card>{error && !goals.length ? <Card><AppText variant="h3">Couldn&apos;t load goals</AppText><SecondaryButton title="Try Again" onPress={refresh} /></Card> : goals.map(g => { const pct = Math.round((g.currentCents / g.targetCents) * 100); return <Card key={g.id} style={s.goal}><View style={s.titleRow}><View style={s.grow}><AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{g.name}</AppText><AppText style={s.muted}>{money(g.currentCents)} of {money(g.targetCents)}</AppText></View>{pct >= 100 ? <StatusChip>Goal reached</StatusChip> : <AppText variant="h3">{pct}%</AppText>}<PressableScale accessibilityRole="button" accessibilityLabel={`Archive ${g.name}`} hitSlop={6} onPress={() => remove(g)} style={s.iconButton}><AppIcon name="archive-outline" size={18} color={colors.muted} /></PressableScale></View><ProgressBar value={pct} />{g.targetDate ? <AppText variant="small" style={s.muted}>Target date: {formatExpenseDate(g.targetDate)}</AppText> : null}<View style={s.actions}><PressableScale accessibilityRole="button" onPress={() => openAdd(g)} style={s.smallButton}><AppIcon name="plus" size={18} /><AppText variant="bodyMedium">Add to Goal</AppText></PressableScale><PressableScale accessibilityRole="button" onPress={() => openEdit(g)} style={s.smallButton}><AppIcon name="pencil-outline" size={18} /><AppText variant="bodyMedium">Edit</AppText></PressableScale></View></Card>; })}<PrimaryButton title="Add Goal" icon="plus" onPress={openNew} /></View><DraggableBottomSheet visible={mode !== null} disabled={saving} onClose={() => setMode(null)}><AppText variant="h2">{mode === 'add' ? `Add to ${selected?.name}` : mode === 'edit' ? 'Edit Goal' : 'Add Goal'}</AppText>{mode === 'add' ? <><View style={s.summary}><AppText style={s.muted}>Currently saved</AppText><AppText variant="h3">{money(selected?.currentCents ?? 0)}</AppText></View><FormInput label="Amount to add" icon="currency-php" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /><AmountChips value={current} onChange={setCurrent} /></> : <><FormInput label="Goal name" value={name} onChangeText={setName} maxLength={80} /><FormInput label="Target amount" icon="currency-php" value={target} onChangeText={setTarget} keyboardType="decimal-pad" /><AmountChips value={target} onChange={setTarget} />{mode === 'new' ? <><FormInput label="Starting amount" icon="currency-php" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /><AmountChips value={current} onChange={setCurrent} /></> : null}<SheetField label="Target date (optional)" value={date ? formatExpenseDate(date) : 'No target date'} icon="calendar-outline" placeholder={!date} onPress={() => { setDateDraft(date || todayLocalDate()); setDatePickerOpen(true); }} /><DraggableBottomSheet visible={datePickerOpen} onClose={() => setDatePickerOpen(false)}>{(dismiss) => <><AppText variant="h2">Target Date</AppText><Calendar value={dateDraft} onSelect={setDateDraft} /><AppText style={s.pickedDate}>{formatExpenseDate(dateDraft)}</AppText><PrimaryButton title="Use This Date" onPress={() => { setDate(dateDraft); dismiss(); }} />{date ? <SecondaryButton title="No Target Date" onPress={() => { setDate(''); dismiss(); }} /> : null}</>}</DraggableBottomSheet></>}<PrimaryButton title={mode === 'add' ? 'Add to Goal' : 'Save Goal'} loading={saving} loadingTitle="Saving..." onPress={save} /></DraggableBottomSheet>{confirmDialog}</Screen>;
}

const useStyles = makeStyles((colors) => ({ pickedDate: { textAlign: 'center', color: colors.deepForest, fontFamily: 'JakartaSemiBold' }, detailTotals: { flexDirection: 'row', gap: 12 }, analyticsSection: { gap: 10 }, analyticsCard: { gap: 18 }, analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, analyticsMetric: { width: '48%', minHeight: 74, borderRadius: radii.md, padding: 12, gap: 4, backgroundColor: colors.pale }, categoryAnalytics: { gap: 12 }, categoryMetric: { gap: 6 }, walletManagement: { gap: 10, marginTop: spacing.sm }, actionRow: { flexDirection: 'row', gap: 10 }, fieldGroup: { gap: 7 }, fieldButton: { minHeight: 54, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.9)', borderWidth: 1, borderColor: '#C9D5C5', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, fieldButtonText: { flex: 1, minWidth: 0, fontFamily: 'JakartaMedium' }, walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, walletCell: { width: '48%' }, page: { paddingTop: spacing.md, gap: spacing.lg }, header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, headerCopy: { flex: 1, gap: 3 }, muted: { color: colors.muted }, totalCard: { gap: 8, padding: spacing.xl }, grow: { flex: 1, minWidth: 0, gap: 3 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, minHeight: 40, borderRadius: radii.pill, backgroundColor: colors.pale }, chipActive: { backgroundColor: colors.deepForest }, white: { color: colors.surface }, colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, colorChoice: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, colorChoiceSelected: { borderWidth: 3, borderColor: colors.surface }, defaultRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radii.md, backgroundColor: colors.pale }, goal: { gap: 14 }, actions: { flexDirection: 'row', gap: 8 }, smallButton: { flex: 1, minHeight: 42, borderRadius: radii.pill, backgroundColor: colors.pale, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }, iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, summary: { flexDirection: 'row', justifyContent: 'space-between' }, history: { gap: 8 }, historyRow: { minHeight: 62, padding: 11, borderRadius: radii.md, backgroundColor: 'rgba(255,253,247,.96)', flexDirection: 'row', alignItems: 'center', gap: 10 }, historyDot: { width: 10, height: 38, borderRadius: 5 }, historyDelete: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' } }));
