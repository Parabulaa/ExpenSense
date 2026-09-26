import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Calendar } from '@/components/common/calendar';
import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { FadeSlideIn, PressableScale, useDrift } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton, SecondaryButton, StatusChip } from '@/components/common/ui';
import { assets, colors, radii, shadow, spacing } from '@/constants/theme';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useFinance } from '@/features/finance/FinanceProvider';
import type { ExpenseFormErrors, ExpenseFormValues } from '@/features/expenses/types';
import { useReceipt } from '@/features/receipts/ReceiptProvider';
import { formatDateTime, isFutureDateTime, isValidLocalDate, isValidLocalTime, MAX_MERCHANT_LENGTH, MAX_NOTES_LENGTH, normalizeAmountInput, nowLocalTime, todayLocalDate, validateExpenseForm } from '@/features/expenses/validation';
import { TimeSelector } from '@/components/common/time-selector';
import { AmountChips } from '@/components/common/amount-chips';
import { walletTypeMeta } from '@/features/finance/wallet-presentation';
import type { ReceiptKind } from '@/features/receipts/types';
import { selectionFeedback } from '@/lib/haptics';
import { formatPeso } from '@/lib/format';
import { skipNextPanelRefresh } from '@/lib/panel-refresh';

export function AddExpenseScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const safeReturn = returnTo === '/transactions' || returnTo === '/analytics' || returnTo === '/wallet' ? returnTo : '/home';
  const close = () => {
    skipNextPanelRefresh(safeReturn);
    if (router.canGoBack()) router.back();
    else router.replace(safeReturn as never);
  };
  return <View style={styles.addExpenseModal}><AddExpenseSheet visible onClose={close} /></View>;
}

export function AddExpenseSheet({ visible, onClose, onNavigate }: { visible: boolean; onClose: () => void; onNavigate?: (route: '/scanner' | '/manual-expense' | '/processing') => void }) {
  const leafDrift = useDrift({ x: 24, y: 20, rotate: 9, scale: 0.08, duration: 2400, baseRotate: 28 });
  const { setSource } = useReceipt();
  const navigate = (route: '/scanner' | '/manual-expense' | '/processing') => onNavigate ? onNavigate(route) : router.push(route);
  const upload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) { setSource({ uri: asset.uri, width: asset.width, height: asset.height, size: asset.fileSize }); navigate('/processing'); }
  };
  return (
      <DraggableBottomSheet visible={visible} onClose={onClose}>{(dismiss) => <>
        <Animated.Image source={assets.shape6} resizeMode="contain" style={[styles.sheetLeaf, leafDrift]} />
        <View style={[styles.rowBetween, styles.sheetContent]}>
          <View>
            <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Add Expense</AppText>
            <AppText style={styles.muted}>Choose how you want to record it.</AppText>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={dismiss} style={styles.close}>
            <AppIcon name="close" size={22} />
          </PressableScale>
        </View>
        <View style={styles.sheetContent}>
          <ExpenseOption icon="line-scan" title="Scan Receipt" description="Use your camera" onPress={() => navigate('/scanner')} />
          <ExpenseOption icon="image-outline" title="Upload Receipt" description="Choose from gallery" onPress={upload} />
          <ExpenseOption icon="file-document-edit-outline" title="Manual Entry" description="Enter details manually" onPress={() => navigate('/manual-expense')} />
        </View>
        <View style={styles.sheetContent}><SecondaryButton title="Cancel" onPress={dismiss} /></View>
      </>}</DraggableBottomSheet>
  );
}

function ExpenseOption({ icon, title, description, disabled = false, onPress }: { icon: Parameters<typeof AppIcon>[0]['name']; title: string; description: string; disabled?: boolean; onPress?: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={disabled ? [styles.option, styles.optionMuted] : styles.option}>
      <View style={[styles.optionIcon, disabled && styles.optionIconMuted]}>
        <AppIcon name={icon} size={27} color={disabled ? colors.muted : colors.surface} />
      </View>
      <View style={styles.optionCopy}>
        <AppText variant="h3" style={disabled ? styles.optionTitleMuted : undefined}>{title}</AppText>
        <AppText style={styles.muted}>{description}</AppText>
      </View>
      {disabled ? <View style={styles.comingSoonPill}><AppText variant="small" style={styles.comingSoonText}>Soon</AppText></View> : <AppIcon name="chevron-right" color={colors.muted} />}
    </PressableScale>
  );
}

export function ManualExpenseScreen() {
  const { findCategory } = useCategories();
  const { createExpense } = useExpenses();
  const { wallets, refresh: refreshFinance } = useFinance();
  const { showToast } = useToast();
  const submitting = useRef(false);
  const [values, setValues] = useState<ExpenseFormValues>(() => ({ amount: '', merchant: '', categoryId: '', walletId: '', transactionDate: todayLocalDate(), transactionTime: nowLocalTime(), notes: '' }));
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const selectedCategory = useMemo(() => findCategory(values.categoryId), [findCategory, values.categoryId]);
  const selectedWallet = wallets.find((wallet) => wallet.id === values.walletId);

  const update = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  useEffect(() => {
    if (!values.walletId && wallets.length) { // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((current) => ({ ...current, walletId: (wallets.find((wallet) => wallet.isDefault) ?? wallets[0]).id }));
    }
    // Default only initializes an untouched form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  const submit = async () => {
    if (submitting.current) return;
    Keyboard.dismiss();
    const validation = validateExpenseForm(values);
    setErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true;
    setSaving(true);
    const result = await createExpense(validation.input);
    setSaving(false);
    submitting.current = false;
    if (!result.ok) {
      showToast(result.message, { tone: 'warning', icon: 'alert-circle-outline' });
      return;
    }
    // The database already moved the wallet balance; reload so every screen agrees.
    void refreshFinance();
    selectionFeedback();
    const category = findCategory(result.data.categoryId);
    const amount = (result.data.amountCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    showToast(result.queued ? `Saved offline · ₱${amount} to ${category?.fullLabel ?? 'Expenses'}. It will sync when you are back online.` : `Expense added · ₱${amount} to ${category?.fullLabel ?? 'Expenses'}.`, { icon: result.queued ? 'cloud-off-outline' : 'check-circle-outline' });
    router.replace('/transactions');
  };

  return (
    <Screen bottomInset={40} variant={4}>
      <View style={styles.formPage}>
        <FadeSlideIn index={0}>
          <View style={styles.formHeader}>
            <BackButton />
            <View style={styles.headerCopy}>
              <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Add Expense</AppText>
              <AppText style={styles.muted}>Record a transaction manually.</AppText>
            </View>
          </View>
        </FadeSlideIn>
        <FadeSlideIn index={1}>
          <View style={styles.amountBlock}>
            <AppText variant="bodyMedium">Amount</AppText>
            <FormInput icon="currency-php" accessibilityLabel="Expense amount" placeholder="0.00" value={values.amount} onChangeText={(value) => update('amount', normalizeAmountInput(value, values.amount))} keyboardType="decimal-pad" inputMode="decimal" returnKeyType="next" error={errors.amount} style={styles.amountInput} inputStyle={styles.amountInputText} maxLength={10} />
            <AmountChips value={values.amount} onChange={(amount) => update('amount', amount)} />
          </View>
        </FadeSlideIn>
        <FadeSlideIn index={2} style={styles.formFields}>
          <FormInput label="Merchant / Description" accessibilityLabel="Merchant or expense description" placeholder="Jollibee, Grab, School Supplies..." value={values.merchant} onChangeText={(value) => update('merchant', value)} autoCapitalize="words" returnKeyType="next" maxLength={MAX_MERCHANT_LENGTH} error={errors.merchant} />
          <FormButton label="Category" value={selectedCategory?.fullLabel ?? 'Select category'} icon={selectedCategory?.icon ?? 'shape-outline'} placeholder={!selectedCategory} error={errors.categoryId} onPress={() => { Keyboard.dismiss(); setCategoryOpen(true); }} />
          <FormButton label="Wallet (optional)" value={selectedWallet?.name ?? (wallets.length ? 'Select wallet' : 'Add a wallet first')} icon="wallet-outline" placeholder={!selectedWallet} onPress={() => { Keyboard.dismiss(); if (wallets.length) setWalletOpen(true); else router.push('/wallets' as never); }} />
          <FormButton label="Date & Time" value={formatDateTime(values.transactionDate, values.transactionTime)} icon="calendar-clock-outline" error={errors.transactionDate} onPress={() => { Keyboard.dismiss(); setDateOpen(true); }} />
          <FormInput label="Notes (optional)" accessibilityLabel="Optional expense notes" placeholder="Add context for this expense" value={values.notes} onChangeText={(value) => update('notes', value)} multiline textAlignVertical="top" maxLength={MAX_NOTES_LENGTH} error={errors.notes} hint={`${values.notes.length}/${MAX_NOTES_LENGTH}`} style={styles.notesInput} inputStyle={styles.notesInputText} />
        </FadeSlideIn>
        <PrimaryButton title="Save Expense" loadingTitle="Saving..." loading={saving} disabled={saving} icon="check" onPress={submit} />
      </View>
      <CategoryPicker visible={categoryOpen} selectedId={values.categoryId} onClose={() => setCategoryOpen(false)} onSelect={(id) => { update('categoryId', id); selectionFeedback(); setCategoryOpen(false); }} />
      <WalletPicker visible={walletOpen} selectedId={values.walletId} onClose={() => setWalletOpen(false)} onSelect={(id) => { update('walletId', id); setWalletOpen(false); }} />
      {dateOpen ? <ExpenseDatePicker value={values.transactionDate} time={values.transactionTime} onClose={() => setDateOpen(false)} onSelect={(date, time) => { setValues((current) => ({ ...current, transactionDate: date, transactionTime: time })); setErrors((current) => ({ ...current, transactionDate: undefined })); setDateOpen(false); }} /> : null}
    </Screen>
  );
}

function FormButton({ label, value, icon, placeholder, error, onPress }: { label: string; value: string; icon: Parameters<typeof AppIcon>[0]['name']; placeholder?: boolean; error?: string; onPress: () => void }) {
  return (
    <View style={styles.fieldGroup}>
      <AppText variant="bodyMedium" style={styles.fieldLabel}>{label}</AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={error ? [styles.formButton, styles.formButtonError] : styles.formButton}>
        <AppIcon name={icon} size={22} color={error ? colors.danger : colors.forest} />
        <AppText style={[styles.formButtonText, placeholder && styles.muted]} numberOfLines={1}>{value}</AppText>
        <AppIcon name="chevron-down" size={20} color={colors.muted} />
      </PressableScale>
      {error ? <AppText variant="small" style={styles.errorText}>{error}</AppText> : null}
    </View>
  );
}

function SheetModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <DraggableBottomSheet visible={visible} onClose={onClose}>{(dismiss) => <>
      <View style={styles.rowBetween}>
        <AppText variant="h2">{title}</AppText>
        <PressableScale accessibilityLabel="Close" onPress={dismiss} style={styles.close}><AppIcon name="close" size={21} /></PressableScale>
      </View>
      {children}
    </>}</DraggableBottomSheet>
  );
}

function CategoryPicker({ visible, selectedId, onClose, onSelect }: { visible: boolean; selectedId: string; onClose: () => void; onSelect: (id: string) => void }) {
  const { categories } = useCategories();
  return (
    <SheetModal visible={visible} title="Choose Category" onClose={onClose}>
      <View style={styles.categoryPickerGrid}>
        {categories.map((category) => {
          const selected = category.id === selectedId;
          return (
            <PressableScale key={category.id} accessibilityRole="button" accessibilityLabel={category.fullLabel} accessibilityState={{ selected }} onPress={() => onSelect(category.id)} style={[styles.categoryChoice, selected && styles.categoryChoiceSelected]}>
              <View style={[styles.categoryChoiceIcon, selected && styles.categoryChoiceIconSelected]}><AppIcon name={category.icon} size={24} color={selected ? colors.surface : colors.deepForest} /></View>
              <AppText variant="small" style={styles.categoryChoiceLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{category.fullLabel}</AppText>
            </PressableScale>
          );
        })}
      </View>
    </SheetModal>
  );
}

/** Wallet chooser shared by every form that moves money, so each lists wallets the same way. */
export function WalletPicker({ visible, selectedId, title = 'Choose Wallet', excludeId, onClose, onSelect }: { visible: boolean; selectedId: string; title?: string; excludeId?: string; onClose: () => void; onSelect: (id: string) => void }) {
  const { wallets } = useFinance();
  return (
    <SheetModal visible={visible} title={title} onClose={onClose}>
      <View style={styles.walletPicker}>
        {wallets.filter((wallet) => wallet.id !== excludeId).map((wallet) => {
          const selected = selectedId === wallet.id;
          return (
            <PressableScale key={wallet.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onSelect(wallet.id)} style={[styles.walletChoice, selected && styles.walletChoiceSelected]}>
              <View style={styles.walletChoiceCopy}>
                <View style={[styles.walletColor, { backgroundColor: wallet.color ?? colors.forest }]} />
                <View>
                  <AppText variant="h3">{wallet.name}</AppText>
                  <AppText variant="small" style={styles.muted}>{walletTypeMeta(wallet.type).label} · {formatPeso(wallet.balanceCents, { alwaysShowDecimals: true })}{wallet.isDefault ? ' · Default' : ''}</AppText>
                </View>
              </View>
              <AppIcon name={selected ? 'check-circle' : 'circle-outline'} color={colors.success} />
            </PressableScale>
          );
        })}
      </View>
    </SheetModal>
  );
}

export function ExpenseDatePicker({ value, time, title = 'Date & Time', onClose, onSelect }: { value: string; time: string; title?: string; onClose: () => void; onSelect: (value: string, time: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [timeDraft, setTimeDraft] = useState(isValidLocalTime(time) ? time : nowLocalTime());
  const validDate = isValidLocalDate(draft) && draft <= todayLocalDate();
  const future = validDate && isFutureDateTime(draft, timeDraft);
  return (
    <SheetModal visible title={title} onClose={onClose}>
      {/* The in-app calendar on every platform: the native Android dialog opens
          behind this sheet, and one design everywhere keeps it consistent. */}
      <Calendar value={draft} maxDate={todayLocalDate()} onSelect={setDraft} />
      <TimeSelector value={timeDraft} onChange={setTimeDraft} />
      <AppText style={[styles.selectedDate, future && styles.errorText]}>{!validDate ? 'Choose a valid date' : future ? 'That time is still in the future' : formatDateTime(draft, timeDraft)}</AppText>
      <PrimaryButton title="Use This Date & Time" disabled={!validDate || future} onPress={() => onSelect(draft, timeDraft)} />
    </SheetModal>
  );
}

export function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions(); const [torch, setTorch] = useState(false); const [busy, setBusy] = useState(false); const camera = useRef<CameraView>(null); const { setSource } = useReceipt();
  const pick = async () => { const access = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!access.granted) return; const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }); const asset = result.assets?.[0]; if (!result.canceled && asset) { setSource({ uri: asset.uri, width: asset.width, height: asset.height, size: asset.fileSize }); router.replace('/processing'); } };
  if (!permission) return <Screen scroll={false} variant={4}><View style={styles.processing}><ActivityIndicator color={colors.deepForest} /><AppText>Checking camera access…</AppText></View></Screen>;
  if (!permission.granted) return <Screen scroll={false} variant={4}><View style={styles.failed}><AppIcon name="camera-off-outline" size={72} color={colors.forest} /><AppText variant="title" style={styles.center}>Camera access is needed</AppText><AppText style={[styles.muted, styles.center]}>Allow camera access to scan a receipt, or choose one from your gallery.</AppText><PrimaryButton title="Allow Camera" onPress={permission.canAskAgain ? requestPermission : Linking.openSettings} /><SecondaryButton title="Choose from Gallery" onPress={pick} /></View></Screen>;
  const capture = async () => { if (busy) return; setBusy(true); try { const photo = await camera.current?.takePictureAsync({ quality: 1, skipProcessing: false }); if (photo) { setSource({ uri: photo.uri, width: photo.width, height: photo.height }); router.replace('/processing'); } } finally { setBusy(false); } };
  return <Screen scroll={false} variant={4}><View style={styles.scannerPage}><CameraView ref={camera} style={styles.camera} facing="back" enableTorch={torch}><View style={styles.cameraTop}><Pressable accessibilityLabel="Close scanner" onPress={() => router.back()}><AppIcon name="close" color={colors.surface} size={32} /></Pressable><Pressable accessibilityLabel="Toggle flashlight" onPress={() => setTorch((value) => !value)}><AppIcon name={torch ? 'flash' : 'flash-outline'} color={colors.surface} size={30} /></Pressable></View><Image source={assets.scanFrame} contentFit="contain" style={styles.scanFrame} /><View style={styles.cameraBottom}><AppText style={styles.white}>Position the whole receipt inside the frame.</AppText><View style={styles.captureRow}><Pressable accessibilityLabel="Choose receipt from gallery" onPress={pick}><AppIcon name="image-outline" color={colors.surface} size={34} /></Pressable><Pressable accessibilityLabel="Capture receipt" disabled={busy} onPress={capture} style={styles.capture}>{busy ? <ActivityIndicator color={colors.deepForest} /> : null}</Pressable><View style={{ width: 34 }} /></View></View></CameraView></View></Screen>;
}

export function ProcessingScreen() {
  const { process, progress, completed, source } = useReceipt(); const started = useRef(false);
  useEffect(() => { if (started.current) return; started.current = true; if (!source) { router.replace('/add-expense'); return; } void process().then((result) => router.replace(result === 'review' ? '/receipt-review' : '/recognition-failed')); }, [process, source]);
  const steps = ['Preparing image', 'Checking image quality', 'Reading receipt', 'Checking receipt structure', 'Extracting details', 'Checking totals'];
  return <Screen scroll={false} variant={4}><View style={styles.processing}><Animated.Image entering={FadeIn.duration(350)} source={assets.mascotSuccess} resizeMode="contain" style={styles.processMascot} /><AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Reading receipt…</AppText><AppText style={styles.muted}>Keep ExpenSense open while we securely read this image.</AppText><View style={styles.steps}>{steps.map((step, index) => { const done = completed.includes(step as never); const active = progress === step; return <Animated.View entering={FadeInDown.delay(index * 60)} key={step} style={styles.step}><View style={[styles.stepCircle, done && styles.stepDone]}>{done ? <AppIcon name="check" size={18} color={colors.surface} /> : active ? <ActivityIndicator size="small" color={colors.forest} /> : null}</View><AppText variant="h3" style={!done && !active ? styles.muted : undefined}>{step}</AppText></Animated.View>; })}</View></View></Screen>;
}

const RECEIPT_KINDS: { id: Exclude<ReceiptKind, 'unknown'>; label: string; icon: Parameters<typeof AppIcon>[0]['name'] }[] = [
  { id: 'expense', label: 'Expense', icon: 'cart-outline' },
  { id: 'cash_in', label: 'Cash-in', icon: 'cash-plus' },
  { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal' },
];

/**
 * Peso field that keeps what the user typed while reporting cents upward, so
 * editing "350.5" never snaps to "350.50" mid-keystroke.
 */
function MoneyField({ label, cents, onChange, style, chips = false }: { label?: string; cents: number; onChange: (cents: number) => void; style?: object; chips?: boolean }) {
  const [text, setText] = useState(cents ? (cents / 100).toFixed(2) : '');
  const set = (next: string) => { setText(next); onChange(Math.round((Number(next) || 0) * 100)); };
  const field = <FormInput label={label} icon={label ? 'currency-php' : undefined} placeholder="0.00" value={text} keyboardType="decimal-pad" inputMode="decimal" onChangeText={(value) => set(normalizeAmountInput(value, text))} style={style} />;
  return chips ? <View style={styles.amountBlock}>{field}<AmountChips value={text} onChange={set} /></View> : field;
}

function ChangeRow({ label, before, after }: { label: string; before: number; after: number }) {
  const money = (value: number) => `${value < 0 ? '−' : ''}${formatPeso(Math.abs(value), { alwaysShowDecimals: true })}`;
  return (
    <View style={styles.changeRow}>
      <AppText variant="bodyMedium" style={styles.changeLabel} numberOfLines={1}>{label}</AppText>
      <AppText variant="small" style={styles.muted}>{money(before)}</AppText>
      <AppIcon name="arrow-right" size={14} color={colors.muted} />
      <AppText variant="small" style={[styles.changeAfter, after < 0 && { color: colors.danger }]}>{money(after)}</AppText>
    </View>
  );
}

export function ReceiptReviewScreen() {
  const { draft, updateDraft, save, saving, reset } = useReceipt();
  const { expenses, refresh } = useExpenses();
  const { findCategory } = useCategories();
  const { budgets } = useBudgets();
  const { wallets, refresh: refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState<'source' | 'destination' | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  useEffect(() => { if (draft && !draft.walletId && wallets.length) updateDraft({ walletId: (wallets.find(wallet => wallet.isDefault) ?? wallets[0]).id }); }, [draft, updateDraft, wallets]);
  if (!draft) return <Screen variant={4}><View style={styles.failed}><AppText variant="h2">No receipt is ready to review.</AppText><PrimaryButton title="Scan a Receipt" onPress={() => router.replace('/scanner')} /></View></Screen>;

  const kind = draft.kind;
  const source = wallets.find((wallet) => wallet.id === draft.walletId);
  const destination = wallets.find((wallet) => wallet.id === draft.destinationWalletId);
  const category = findCategory(draft.categoryId);
  const merchantLabel = kind === 'cash_in' ? 'Source' : kind === 'transfer' ? 'Description' : 'Merchant';
  const walletLabel = kind === 'cash_in' ? 'Add to wallet' : kind === 'transfer' ? 'From wallet' : 'Paid from wallet';

  // Preview of exactly what confirming will change — nothing moves until then.
  const month = draft.transactionDate.slice(0, 7);
  const limit = budgets.find((item) => item.month === month)?.categoryBudgets.find((item) => item.categoryId === draft.categoryId);
  const categorySpent = expenses.filter((item) => item.categoryId === draft.categoryId && item.transactionDate.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0);
  const changes: { label: string; before: number; after: number }[] = [];
  if (source && kind === 'expense') changes.push({ label: source.name, before: source.balanceCents, after: source.balanceCents - draft.totalCents });
  if (source && kind === 'cash_in') changes.push({ label: source.name, before: source.balanceCents, after: source.balanceCents + draft.totalCents });
  if (source && kind === 'transfer') changes.push({ label: source.name, before: source.balanceCents, after: source.balanceCents - draft.totalCents - draft.feeCents });
  if (destination && kind === 'transfer') changes.push({ label: destination.name, before: destination.balanceCents, after: destination.balanceCents + draft.totalCents });
  if (kind === 'expense' && category && limit) changes.push({ label: `${category.fullLabel} budget left`, before: limit.amountCents - categorySpent, after: limit.amountCents - categorySpent - draft.totalCents });

  const problem = (() => {
    if (kind === 'unknown') return 'Choose whether this is an expense, cash-in or transfer.';
    if (draft.totalCents <= 0) return 'Enter an amount greater than zero.';
    if (!isValidLocalDate(draft.transactionDate) || !isValidLocalTime(draft.transactionTime) || isFutureDateTime(draft.transactionDate, draft.transactionTime)) return 'Choose a valid date and time.';
    if (kind === 'expense' && (!draft.merchant.trim() || !draft.categoryId)) return 'Confirm the merchant and category.';
    if (kind === 'expense' && wallets.length > 0 && !draft.walletId) return 'Choose the wallet you paid from.';
    if (kind === 'cash_in' && !draft.walletId) return wallets.length ? 'Choose the wallet that received the cash-in.' : 'Add a wallet before saving a cash-in.';
    if (kind === 'transfer' && (!draft.walletId || !draft.destinationWalletId)) return wallets.length < 2 ? 'Transfers need at least two wallets.' : 'Choose both wallets for this transfer.';
    if (kind === 'transfer' && draft.walletId === draft.destinationWalletId) return 'Choose two different wallets.';
    return null;
  })();

  const confirm = async () => {
    if (problem) { showToast(problem, { tone: 'warning' }); return; }
    const result = await save();
    if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; }
    await Promise.all([refresh(), refreshFinance()]);
    reset();
    showToast(kind === 'expense' ? 'Receipt expense saved.' : kind === 'cash_in' ? 'Cash-in saved to your wallet.' : 'Transfer saved.', { icon: 'check-circle-outline' });
    router.replace('/transactions');
  };
  const detectedLabel = RECEIPT_KINDS.find((item) => item.id === draft.detected.kind)?.label;

  return <Screen variant={4}><View style={styles.formPage}>
    <BackButton />
    <Card style={{ gap: 16 }}>
      <View style={styles.reviewTop}>
        <View style={styles.receiptPhoto}><Image source={{ uri: draft.image.uri }} contentFit="cover" style={styles.fill} /></View>
        <View style={styles.optionCopy}>
          <AppText variant="h2">Review receipt</AppText>
          <StatusChip warning={draft.issues.length > 0}>{draft.issues.length ? 'Needs Review' : 'Ready'}</StatusChip>
          <AppText style={styles.muted}>{draft.confidence}% recognition confidence</AppText>
        </View>
      </View>
      {draft.issues.map((issue) => <AppText key={issue} variant="small" style={styles.warningText}>• {issue}</AppText>)}
    </Card>

    <View style={styles.fieldGroup}>
      <AppText variant="bodyMedium" style={styles.fieldLabel}>Transaction type</AppText>
      <AppText variant="small" style={styles.muted}>{detectedLabel ? `Detected as ${detectedLabel} (${draft.detected.confidence}% sure) · ${draft.detected.signals.join(', ')}` : "We couldn't tell what kind of receipt this is. Choose one."}</AppText>
      <View style={styles.kindRow}>{RECEIPT_KINDS.map((option) => { const selected = kind === option.id; return <PressableScale key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { selectionFeedback(); updateDraft({ kind: option.id }); }} style={[styles.kindOption, selected && styles.kindOptionSelected]}><AppIcon name={option.icon} size={20} color={selected ? colors.surface : colors.deepForest} /><AppText variant="small" style={selected ? styles.kindTextSelected : styles.kindText}>{option.label}</AppText></PressableScale>; })}</View>
    </View>

    {kind !== 'unknown' ? <>
      <FormInput label={merchantLabel} value={draft.merchant} onChangeText={(merchant) => updateDraft({ merchant })} maxLength={80} />
      <FormButton label="Date & Time" value={formatDateTime(draft.transactionDate, draft.transactionTime)} icon="calendar-clock-outline" onPress={() => setDateOpen(true)} />
      {kind === 'expense' ? <FormButton label="Category" value={category?.fullLabel ?? 'Select category'} icon={category?.icon ?? 'shape-outline'} placeholder={!draft.categoryId} onPress={() => setCategoryOpen(true)} /> : null}
      <FormButton label={walletLabel} value={source?.name ?? (wallets.length ? 'Select wallet' : 'Add a wallet first')} icon="wallet-outline" placeholder={!source} onPress={() => wallets.length ? setWalletOpen('source') : router.push('/wallets' as never)} />
      {kind === 'transfer' ? <FormButton label="To wallet" value={destination?.name ?? (wallets.length > 1 ? 'Select wallet' : 'Add another wallet first')} icon="wallet-plus-outline" placeholder={!destination} onPress={() => wallets.length > 1 ? setWalletOpen('destination') : router.push('/wallets' as never)} /> : null}
      {kind === 'expense' ? <>
        <Card style={{ gap: 12 }}><AppText variant="h2">Items ({draft.items.length})</AppText>{draft.items.map((item) => <View key={item.id} style={styles.itemEditRow}><FormInput value={item.name} onChangeText={(name) => updateDraft({ items: draft.items.map((current) => current.id === item.id ? { ...current, name } : current) })} style={styles.itemNameInput} /><MoneyField cents={item.lineTotalCents} onChange={(lineTotalCents) => updateDraft({ items: draft.items.map((current) => current.id === item.id ? { ...current, lineTotalCents } : current) })} style={styles.itemAmountInput} /></View>)}</Card>
        <MoneyField label="Subtotal" cents={draft.subtotalCents} onChange={(subtotalCents) => updateDraft({ subtotalCents })} />
        <MoneyField label="Tax" cents={draft.taxCents} onChange={(taxCents) => updateDraft({ taxCents })} />
      </> : null}
      <MoneyField chips label={kind === 'expense' ? 'Total' : 'Amount'} cents={draft.totalCents} onChange={(totalCents) => updateDraft({ totalCents })} />
      {kind === 'transfer' ? <MoneyField label="Transfer fee" cents={draft.feeCents} onChange={(feeCents) => updateDraft({ feeCents })} /> : null}
      <FormInput label="Notes (optional)" value={draft.notes} onChangeText={(notes) => updateDraft({ notes })} />
      {changes.length ? <Card style={{ gap: 10 }}>
        <AppText variant="h3">After you confirm</AppText>
        {changes.map((change) => <ChangeRow key={change.label} {...change} />)}
        <AppText variant="small" style={styles.muted}>{kind === 'expense' ? 'Counts as spending in this category.' : kind === 'cash_in' ? 'Adds money to the wallet. It is not spending and does not change any budget.' : 'Moves money between wallets. It is not spending or income, and budgets are unchanged.'}</AppText>
      </Card> : null}
    </> : null}
    <PrimaryButton title="Confirm & Save" loadingTitle="Saving receipt…" loading={saving} disabled={saving || kind === 'unknown'} onPress={confirm} />
  </View>
  <CategoryPicker visible={categoryOpen} selectedId={draft.categoryId} onClose={() => setCategoryOpen(false)} onSelect={(categoryId) => { updateDraft({ categoryId }); setCategoryOpen(false); }} />
  <WalletPicker visible={walletOpen !== null} title={walletOpen === 'destination' ? 'Transfer To' : kind === 'transfer' ? 'Transfer From' : 'Choose Wallet'} selectedId={walletOpen === 'destination' ? draft.destinationWalletId : draft.walletId} excludeId={kind === 'transfer' ? (walletOpen === 'destination' ? draft.walletId : draft.destinationWalletId) : undefined} onClose={() => setWalletOpen(null)} onSelect={(id) => { updateDraft(walletOpen === 'destination' ? { destinationWalletId: id } : { walletId: id }); setWalletOpen(null); }} />
  {dateOpen ? <ExpenseDatePicker value={draft.transactionDate} time={draft.transactionTime} onClose={() => setDateOpen(false)} onSelect={(transactionDate, transactionTime) => { updateDraft({ transactionDate, transactionTime }); setDateOpen(false); }} /> : null}
  </Screen>;
}

export function RecognitionFailedScreen() {
  const { failureMessage } = useReceipt();
  return <Screen scroll={false} variant={6}><View style={styles.failed}><Image source={assets.mascotConfused} contentFit="contain" style={styles.failedMascot} /><AppText variant="title" style={styles.center}>We couldn&apos;t recognize{`\n`}this as a receipt.</AppText><AppText style={[styles.muted, styles.center]}>{failureMessage ?? 'Try a clearer photo with the full receipt visible.'}</AppText><PrimaryButton title="Retake Photo" icon="camera-outline" onPress={() => router.replace('/scanner')} /><SecondaryButton title="Upload Another Image" icon="image-outline" onPress={() => router.replace('/add-expense')} /><SecondaryButton title="Enter Manually" icon="pencil-outline" onPress={() => router.replace('/manual-expense')} /></View></Screen>;
}

const styles = StyleSheet.create({
  muted: { color: colors.muted }, white: { color: colors.surface }, center: { textAlign: 'center' }, fill: { width: '100%', height: '100%' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  addExpenseModal: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: 'transparent' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 20, 14, 0.62)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl, paddingBottom: 18, gap: 14, ...shadow },
  sheetLeaf: { position: 'absolute', width: 116, height: 108, left: -45, top: -32, opacity: 0.55 },
  sheetContent: { zIndex: 1, gap: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF', alignSelf: 'center' },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  option: { boxSizing: 'border-box', width: '100%', minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: '#F8F7F0', borderWidth: 1, borderColor: colors.line },
  optionMuted: { backgroundColor: '#F0F1EC', opacity: 0.78 }, optionIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' }, optionIconMuted: { backgroundColor: '#DDE2DC' }, optionCopy: { flex: 1, minWidth: 0, gap: 3 },
  optionTitleMuted: { color: colors.muted },
  comingSoonPill: { minWidth: 45, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  comingSoonText: { color: colors.forest, fontFamily: 'JakartaBold' },
  formPage: { paddingTop: spacing.md, gap: 22 }, formHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, headerCopy: { flex: 1, minWidth: 0, paddingTop: 2, gap: 3 }, amountBlock: { gap: 9 },
  amountInput: { minHeight: 78, borderRadius: radii.lg, backgroundColor: 'rgba(255,253,247,.96)' }, amountInputText: { height: 78, fontFamily: 'JakartaExtraBold', fontSize: 28, color: colors.deepForest }, formFields: { gap: 18 },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAmount: { flexGrow: 1, minWidth: '21%', minHeight: 42, paddingHorizontal: 9, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lightGreen, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  quickAmountSelected: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  quickAmountText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  quickAmountTextSelected: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  notesInput: { height: 112, alignItems: 'flex-start', paddingTop: 7 }, notesInputText: { height: 96, paddingTop: 10 }, fieldGroup: { gap: 7 }, fieldLabel: { marginLeft: 2 },
  formButton: { minHeight: 56, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.9)', borderWidth: 1, borderColor: '#C9D5C5', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, formButtonError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft }, formButtonText: { flex: 1, minWidth: 0, fontFamily: 'JakartaMedium' }, errorText: { color: colors.danger, marginLeft: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, modalDim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay }, pickerSheet: { maxHeight: '86%', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: spacing.xl, paddingBottom: spacing.xxl, gap: 18, ...shadow },
  categoryPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, categoryChoice: { width: '31%', minHeight: 96, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8F7F0', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8 }, categoryChoiceSelected: { borderColor: colors.deepForest, backgroundColor: '#E3ECDF' }, categoryChoiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E1EBDD', alignItems: 'center', justifyContent: 'center' }, categoryChoiceIconSelected: { backgroundColor: colors.deepForest }, categoryChoiceLabel: { textAlign: 'center', fontFamily: 'JakartaMedium' },
  walletPicker: { gap: 8 }, walletChoice: { minHeight: 64, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }, walletChoiceSelected: { borderColor: colors.success, backgroundColor: colors.pale }, walletChoiceCopy: { flexDirection: 'row', gap: 12, alignItems: 'center' }, walletColor: { width: 12, height: 42, borderRadius: 6 },
  nativeDatePicker: { alignItems: 'center', minHeight: Platform.OS === 'ios' ? 310 : 60 }, selectedDate: { textAlign: 'center', color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  scannerPage: { flex: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16 }, camera: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1D271F', borderWidth: 4, borderColor: '#DCE7D8' }, cameraTop: { height: 70, flexDirection: 'row', justifyContent: 'space-between', padding: 20, zIndex: 3 }, scanReceipt: { position: 'absolute', width: '58%', height: '60%', top: '16%', left: '21%', transform: [{ rotate: '-4deg' }] }, scanFrame: { position: 'absolute', width: '84%', height: '62%', top: '11%', left: '8%', tintColor: '#3CE8B0' }, cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, backgroundColor: 'rgba(0,0,0,.64)', alignItems: 'center', justifyContent: 'space-around', padding: 18 }, captureRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, capture: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 5, borderColor: colors.white },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 30 }, processMascot: { width: 250, height: 220 }, steps: { gap: 16 }, step: { flexDirection: 'row', alignItems: 'center', gap: 16 }, stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#B7C0BD', alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  reviewTop: { flexDirection: 'row', gap: 16 }, receiptPhoto: { width: '42%', height: 210, borderRadius: 14, backgroundColor: '#59442E', padding: 8 }, failed: { flex: 1, justifyContent: 'center', padding: 28, gap: 18 }, failedMascot: { width: 260, height: 240, alignSelf: 'center' },
  kindRow: { flexDirection: 'row', gap: 8 }, kindOption: { flex: 1, minHeight: 64, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }, kindOptionSelected: { backgroundColor: colors.deepForest, borderColor: colors.deepForest }, kindText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' }, kindTextSelected: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, changeLabel: { flex: 1, minWidth: 0 }, changeAfter: { color: colors.deepForest, fontFamily: 'JakartaBold' },
  warningText: { color: '#9A6400' }, itemEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, itemNameInput: { flex: 1 }, itemAmountInput: { width: 104 },
});
