import DateTimePicker from '@react-native-community/datetimepicker';
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
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { useFinance } from '@/features/finance/FinanceProvider';
import type { ExpenseFormErrors, ExpenseFormValues } from '@/features/expenses/types';
import { useReceipt } from '@/features/receipts/ReceiptProvider';
import { dateToLocalDate, formatExpenseDate, isValidLocalDate, localDateToDate, MAX_MERCHANT_LENGTH, MAX_NOTES_LENGTH, normalizeAmountInput, todayLocalDate, validateExpenseForm } from '@/features/expenses/validation';
import { selectionFeedback } from '@/lib/haptics';
import { skipNextPanelRefresh } from '@/lib/panel-refresh';

export function AddExpenseScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const leafDrift = useDrift({ x: 24, y: 20, rotate: 9, scale: 0.08, duration: 2400, baseRotate: 28 });
  const safeReturn = returnTo === '/transactions' || returnTo === '/analytics' || returnTo === '/budget' ? returnTo : '/home';
  const close = () => {
    skipNextPanelRefresh(safeReturn);
    if (router.canGoBack()) router.back();
    else router.replace(safeReturn as never);
  };
  const { setSource } = useReceipt();
  const upload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) { setSource({ uri: asset.uri, width: asset.width, height: asset.height, size: asset.fileSize }); router.push('/processing'); }
  };
  return (
    <View style={styles.addExpenseModal}>
      <DraggableBottomSheet visible onClose={close}>{(dismiss) => <>
        <Animated.Image source={assets.shape6} resizeMode="contain" style={[styles.sheetLeaf, leafDrift]} />
        <View style={[styles.rowBetween, styles.sheetContent]}>
          <View>
            <AppText variant="title">Add Expense</AppText>
            <AppText style={styles.muted}>Choose how you want to record it.</AppText>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={dismiss} style={styles.close}>
            <AppIcon name="close" size={22} />
          </PressableScale>
        </View>
        <View style={styles.sheetContent}>
          <ExpenseOption icon="line-scan" title="Scan Receipt" description="Use your camera" onPress={() => router.push('/scanner')} />
          <ExpenseOption icon="image-outline" title="Upload Receipt" description="Choose from gallery" onPress={upload} />
          <ExpenseOption icon="file-document-edit-outline" title="Manual Entry" description="Enter details manually" onPress={() => router.push('/manual-expense')} />
        </View>
        <View style={styles.sheetContent}><SecondaryButton title="Cancel" onPress={dismiss} /></View>
      </>}</DraggableBottomSheet>
    </View>
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
  const { wallets } = useFinance();
  const { showToast } = useToast();
  const submitting = useRef(false);
  const [values, setValues] = useState<ExpenseFormValues>({ amount: '', merchant: '', categoryId: '', walletId: '', transactionDate: todayLocalDate(), notes: '' });
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
    selectionFeedback();
    const category = findCategory(result.data.categoryId);
    const amount = (result.data.amountCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    showToast(`Expense added · ₱${amount} to ${category?.fullLabel ?? 'Expenses'}.`, { icon: 'check-circle-outline' });
    router.replace('/transactions');
  };

  return (
    <Screen bottomInset={40} variant={4}>
      <View style={styles.formPage}>
        <FadeSlideIn index={0}>
          <View style={styles.formHeader}>
            <BackButton />
            <View style={styles.headerCopy}>
              <AppText variant="title">Add Expense</AppText>
              <AppText style={styles.muted}>Record a transaction manually.</AppText>
            </View>
          </View>
        </FadeSlideIn>
        <FadeSlideIn index={1}>
          <View style={styles.amountBlock}>
            <AppText variant="bodyMedium">Amount</AppText>
            <FormInput icon="currency-php" accessibilityLabel="Expense amount" placeholder="0.00" value={values.amount} onChangeText={(value) => update('amount', normalizeAmountInput(value, values.amount))} keyboardType="decimal-pad" inputMode="decimal" returnKeyType="next" error={errors.amount} style={styles.amountInput} inputStyle={styles.amountInputText} maxLength={10} />
            <ExpenseQuickAmounts value={values.amount} onSelect={(amount) => { update('amount', String(amount)); selectionFeedback(); }} />
          </View>
        </FadeSlideIn>
        <FadeSlideIn index={2} style={styles.formFields}>
          <FormInput label="Merchant / Description" accessibilityLabel="Merchant or expense description" placeholder="Jollibee, Grab, School Supplies..." value={values.merchant} onChangeText={(value) => update('merchant', value)} autoCapitalize="words" returnKeyType="next" maxLength={MAX_MERCHANT_LENGTH} error={errors.merchant} />
          <FormButton label="Category" value={selectedCategory?.fullLabel ?? 'Select category'} icon={selectedCategory?.icon ?? 'shape-outline'} placeholder={!selectedCategory} error={errors.categoryId} onPress={() => { Keyboard.dismiss(); setCategoryOpen(true); }} />
          <FormButton label="Wallet (optional)" value={selectedWallet?.name ?? (wallets.length ? 'Select wallet' : 'Add wallets in Budget')} icon="wallet-outline" placeholder={!selectedWallet} onPress={() => { Keyboard.dismiss(); if (wallets.length) setWalletOpen(true); else router.push('/wallets' as never); }} />
          <FormButton label="Date" value={formatExpenseDate(values.transactionDate)} icon="calendar-outline" error={errors.transactionDate} onPress={() => { Keyboard.dismiss(); setDateOpen(true); }} />
          <FormInput label="Notes (optional)" accessibilityLabel="Optional expense notes" placeholder="Add context for this expense" value={values.notes} onChangeText={(value) => update('notes', value)} multiline textAlignVertical="top" maxLength={MAX_NOTES_LENGTH} error={errors.notes} hint={`${values.notes.length}/${MAX_NOTES_LENGTH}`} style={styles.notesInput} inputStyle={styles.notesInputText} />
        </FadeSlideIn>
        <PrimaryButton title="Save Expense" loadingTitle="Saving..." loading={saving} disabled={saving} icon="check" onPress={submit} />
      </View>
      <CategoryPicker visible={categoryOpen} selectedId={values.categoryId} onClose={() => setCategoryOpen(false)} onSelect={(id) => { update('categoryId', id); selectionFeedback(); setCategoryOpen(false); }} />
      <SheetModal visible={walletOpen} title="Choose Wallet" onClose={() => setWalletOpen(false)}><View style={styles.walletPicker}>{wallets.map((wallet) => <PressableScale key={wallet.id} onPress={() => { update('walletId', wallet.id); setWalletOpen(false); }} style={[styles.walletChoice, values.walletId === wallet.id && styles.walletChoiceSelected]}><View style={styles.walletChoiceCopy}><AppIcon name="wallet-outline" /><View><AppText variant="h3">{wallet.name}</AppText><AppText variant="small" style={styles.muted}>{wallet.isDefault ? 'Default wallet' : wallet.type}</AppText></View></View><AppIcon name={values.walletId === wallet.id ? 'check-circle' : 'circle-outline'} color={colors.success} /></PressableScale>)}</View></SheetModal>
      {dateOpen ? <ExpenseDatePicker value={values.transactionDate} onClose={() => setDateOpen(false)} onSelect={(date) => { update('transactionDate', date); setDateOpen(false); }} /> : null}
    </Screen>
  );
}

function ExpenseQuickAmounts({ value, onSelect }: { value: string; onSelect: (amount: number) => void }) {
  return <View style={styles.quickAmounts}>{[100, 200, 500, 1000].map((amount) => {
    const selected = Number(value) === amount;
    return <PressableScale key={amount} accessibilityRole="button" accessibilityLabel={`Use ${amount} pesos`} accessibilityState={{ selected }} onPress={() => onSelect(amount)} style={[styles.quickAmount, selected && styles.quickAmountSelected]}><AppText variant="small" style={selected ? styles.quickAmountTextSelected : styles.quickAmountText}>₱{amount.toLocaleString('en-PH')}</AppText></PressableScale>;
  })}</View>;
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
              <AppText variant="small" style={styles.categoryChoiceLabel} numberOfLines={2}>{category.fullLabel}</AppText>
            </PressableScale>
          );
        })}
      </View>
    </SheetModal>
  );
}

function ExpenseDatePicker({ value, onClose, onSelect }: { value: string; onClose: () => void; onSelect: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const validDraft = isValidLocalDate(draft) && draft <= todayLocalDate();
  return (
    <SheetModal visible title="Transaction Date" onClose={onClose}>
      {Platform.OS === 'web' ? (
        // The community picker is native-only, so web gets the in-app calendar
        // rather than making the user type a date by hand.
        <Calendar value={draft} maxDate={todayLocalDate()} onSelect={setDraft} />
      ) : (
        <View style={styles.nativeDatePicker}>
          <DateTimePicker value={localDateToDate(draft)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} maximumDate={localDateToDate(todayLocalDate())} accentColor={colors.deepForest} onChange={(event, date) => { if (event.type === 'set' && date) setDraft(dateToLocalDate(date)); if (Platform.OS === 'android' && event.type === 'dismissed') onClose(); }} />
        </View>
      )}
      <AppText style={styles.selectedDate}>{validDraft ? formatExpenseDate(draft) : 'Choose a valid date'}</AppText>
      <PrimaryButton title="Use This Date" disabled={!validDraft} onPress={() => onSelect(draft)} />
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
  return <Screen scroll={false} variant={4}><View style={styles.processing}><Animated.Image entering={FadeIn.duration(350)} source={assets.mascotSuccess} resizeMode="contain" style={styles.processMascot} /><AppText variant="title">Reading receipt…</AppText><AppText style={styles.muted}>Keep ExpenSense open while we securely read this image.</AppText><View style={styles.steps}>{steps.map((step, index) => { const done = completed.includes(step as never); const active = progress === step; return <Animated.View entering={FadeInDown.delay(index * 60)} key={step} style={styles.step}><View style={[styles.stepCircle, done && styles.stepDone]}>{done ? <AppIcon name="check" size={18} color={colors.surface} /> : active ? <ActivityIndicator size="small" color={colors.forest} /> : null}</View><AppText variant="h3" style={!done && !active ? styles.muted : undefined}>{step}</AppText></Animated.View>; })}</View></View></Screen>;
}

export function ReceiptReviewScreen() {
  const { draft, updateDraft, save, saving, reset } = useReceipt(); const { refresh } = useExpenses(); const { findCategory } = useCategories(); const { showToast } = useToast(); const [categoryOpen, setCategoryOpen] = useState(false);
  if (!draft) return <Screen variant={4}><View style={styles.failed}><AppText variant="h2">No receipt is ready to review.</AppText><PrimaryButton title="Scan a Receipt" onPress={() => router.replace('/scanner')} /></View></Screen>;
  const confirm = async () => { if (!draft.merchant.trim() || !draft.categoryId || draft.totalCents <= 0) { showToast('Confirm the merchant, category, and total first.', { tone: 'warning' }); return; } const result = await save(); if (!result.ok) { showToast(result.message, { tone: 'warning' }); return; } await refresh(); reset(); showToast('Receipt expense saved.', { icon: 'check-circle-outline' }); router.replace('/transactions'); };
  return <Screen variant={4}><View style={styles.formPage}><BackButton /><Card style={{ gap: 16 }}><View style={styles.reviewTop}><View style={styles.receiptPhoto}><Image source={{ uri: draft.image.uri }} contentFit="cover" style={styles.fill} /></View><View style={styles.optionCopy}><AppText variant="h2">Review receipt</AppText><StatusChip warning={draft.issues.length > 0}>{draft.issues.length ? 'Needs Review' : 'Ready'}</StatusChip><AppText style={styles.muted}>{draft.confidence}% recognition confidence</AppText></View></View>{draft.issues.map((issue) => <AppText key={issue} variant="small" style={styles.warningText}>• {issue}</AppText>)}</Card><FormInput label="Merchant" value={draft.merchant} onChangeText={(merchant) => updateDraft({ merchant })} maxLength={80} /><FormInput label="Date (YYYY-MM-DD)" value={draft.transactionDate} onChangeText={(transactionDate) => updateDraft({ transactionDate })} /><FormButton label="Category" value={findCategory(draft.categoryId)?.fullLabel ?? 'Select category'} icon="shape-outline" placeholder={!draft.categoryId} onPress={() => setCategoryOpen(true)} /><Card style={{ gap: 12 }}><AppText variant="h2">Items ({draft.items.length})</AppText>{draft.items.map((item) => <View key={item.id} style={styles.itemEditRow}><FormInput value={item.name} onChangeText={(name) => updateDraft({ items: draft.items.map((current) => current.id === item.id ? { ...current, name } : current) })} style={styles.itemNameInput} /><FormInput value={(item.lineTotalCents / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => updateDraft({ items: draft.items.map((current) => current.id === item.id ? { ...current, lineTotalCents: Math.round((Number(value) || 0) * 100) } : current) })} style={styles.itemAmountInput} /></View>)}</Card><FormInput label="Subtotal" value={(draft.subtotalCents / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => updateDraft({ subtotalCents: Math.round((Number(value) || 0) * 100) })} /><FormInput label="Tax" value={(draft.taxCents / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => updateDraft({ taxCents: Math.round((Number(value) || 0) * 100) })} /><FormInput label="Total" value={(draft.totalCents / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => updateDraft({ totalCents: Math.round((Number(value) || 0) * 100) })} /><FormInput label="Notes (optional)" value={draft.notes} onChangeText={(notes) => updateDraft({ notes })} /><PrimaryButton title="Confirm & Save" loadingTitle="Saving receipt…" loading={saving} disabled={saving} onPress={confirm} /></View><CategoryPicker visible={categoryOpen} selectedId={draft.categoryId} onClose={() => setCategoryOpen(false)} onSelect={(categoryId) => { updateDraft({ categoryId }); setCategoryOpen(false); }} /></Screen>;
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
  walletPicker: { gap: 8 }, walletChoice: { minHeight: 64, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }, walletChoiceSelected: { borderColor: colors.success, backgroundColor: colors.pale }, walletChoiceCopy: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  nativeDatePicker: { alignItems: 'center', minHeight: Platform.OS === 'ios' ? 310 : 60 }, selectedDate: { textAlign: 'center', color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  scannerPage: { flex: 1, padding: 24, justifyContent: 'center' }, camera: { height: '86%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#1D271F', borderWidth: 4, borderColor: '#DCE7D8' }, cameraTop: { height: 70, flexDirection: 'row', justifyContent: 'space-between', padding: 20, zIndex: 3 }, scanReceipt: { position: 'absolute', width: '58%', height: '60%', top: '16%', left: '21%', transform: [{ rotate: '-4deg' }] }, scanFrame: { position: 'absolute', width: '72%', height: '58%', top: '17%', left: '14%', tintColor: '#3CE8B0' }, cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, backgroundColor: 'rgba(0,0,0,.64)', alignItems: 'center', justifyContent: 'space-around', padding: 18 }, captureRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, capture: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 5, borderColor: colors.white },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 30 }, processMascot: { width: 250, height: 220 }, steps: { gap: 16 }, step: { flexDirection: 'row', alignItems: 'center', gap: 16 }, stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#B7C0BD', alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  reviewTop: { flexDirection: 'row', gap: 16 }, receiptPhoto: { width: '42%', height: 210, borderRadius: 14, backgroundColor: '#59442E', padding: 8 }, failed: { flex: 1, justifyContent: 'center', padding: 28, gap: 18 }, failedMascot: { width: 260, height: 240, alignSelf: 'center' },
  warningText: { color: '#9A6400' }, itemEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, itemNameInput: { flex: 1 }, itemAmountInput: { width: 104 },
});
