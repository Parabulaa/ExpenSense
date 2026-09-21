import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';

import { Calendar } from '@/components/common/calendar';
import { FadeSlideIn, PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton, SecondaryButton, StatusChip } from '@/components/common/ui';
import { assets, colors, radii, shadow, spacing } from '@/constants/theme';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import type { ExpenseFormErrors, ExpenseFormValues } from '@/features/expenses/types';
import { dateToLocalDate, formatExpenseDate, isValidLocalDate, localDateToDate, MAX_MERCHANT_LENGTH, MAX_NOTES_LENGTH, normalizeAmountInput, todayLocalDate, validateExpenseForm } from '@/features/expenses/validation';
import { selectionFeedback } from '@/lib/haptics';

export function AddExpenseScreen() {
  const { showToast } = useToast();
  return (
    <Screen scroll={false} variant={4} padded={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close add expense" onPress={() => router.back()} style={styles.dim} />
      <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.rowBetween}>
          <View>
            <AppText variant="title">Add Expense</AppText>
            <AppText style={styles.muted}>Choose how you want to record it.</AppText>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
            <AppIcon name="close" size={22} />
          </PressableScale>
        </View>
        <ExpenseOption icon="receipt-text-outline" title="Scan Receipt" description="Coming in Phase 4" muted onPress={() => showToast('Receipt scanning is coming in Phase 4.', { tone: 'warning' })} />
        <ExpenseOption icon="pencil-outline" title="Enter Manually" description="Add an expense yourself" onPress={() => router.replace('/manual-expense')} />
        <SecondaryButton title="Cancel" onPress={() => router.back()} />
      </Animated.View>
    </Screen>
  );
}

function ExpenseOption({ icon, title, description, muted, onPress }: { icon: Parameters<typeof AppIcon>[0]['name']; title: string; description: string; muted?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description} onPress={onPress} style={muted ? [styles.option, styles.optionMuted] : styles.option}>
      <View style={[styles.optionIcon, muted && styles.optionIconMuted]}>
        <AppIcon name={icon} size={27} color={muted ? colors.muted : colors.surface} />
      </View>
      <View style={styles.optionCopy}>
        <AppText variant="h3">{title}</AppText>
        <AppText style={styles.muted}>{description}</AppText>
      </View>
      <AppIcon name="chevron-right" color={colors.muted} />
    </PressableScale>
  );
}

export function ManualExpenseScreen() {
  const { findCategory } = useCategories();
  const { createExpense } = useExpenses();
  const { showToast } = useToast();
  const submitting = useRef(false);
  const [values, setValues] = useState<ExpenseFormValues>({ amount: '', merchant: '', categoryId: '', transactionDate: todayLocalDate(), notes: '' });
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const selectedCategory = useMemo(() => findCategory(values.categoryId), [findCategory, values.categoryId]);

  const update = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

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
          </View>
        </FadeSlideIn>
        <FadeSlideIn index={2} style={styles.formFields}>
          <FormInput label="Merchant / Description" accessibilityLabel="Merchant or expense description" placeholder="Jollibee, Grab, School Supplies..." value={values.merchant} onChangeText={(value) => update('merchant', value)} autoCapitalize="words" returnKeyType="next" maxLength={MAX_MERCHANT_LENGTH} error={errors.merchant} />
          <FormButton label="Category" value={selectedCategory?.fullLabel ?? 'Select category'} icon={selectedCategory?.icon ?? 'shape-outline'} placeholder={!selectedCategory} error={errors.categoryId} onPress={() => { Keyboard.dismiss(); setCategoryOpen(true); }} />
          <FormButton label="Date" value={formatExpenseDate(values.transactionDate)} icon="calendar-outline" error={errors.transactionDate} onPress={() => { Keyboard.dismiss(); setDateOpen(true); }} />
          <FormInput label="Notes (optional)" accessibilityLabel="Optional expense notes" placeholder="Add context for this expense" value={values.notes} onChangeText={(value) => update('notes', value)} multiline textAlignVertical="top" maxLength={MAX_NOTES_LENGTH} error={errors.notes} hint={`${values.notes.length}/${MAX_NOTES_LENGTH}`} style={styles.notesInput} inputStyle={styles.notesInputText} />
        </FadeSlideIn>
        <PrimaryButton title="Save Expense" loadingTitle="Saving..." loading={saving} disabled={saving} icon="check" onPress={submit} />
      </View>
      <CategoryPicker visible={categoryOpen} selectedId={values.categoryId} onClose={() => setCategoryOpen(false)} onSelect={(id) => { update('categoryId', id); selectionFeedback(); setCategoryOpen(false); }} />
      {dateOpen ? <ExpenseDatePicker value={values.transactionDate} onClose={() => setDateOpen(false)} onSelect={(date) => { update('transactionDate', date); setDateOpen(false); }} /> : null}
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
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.modalDim} />
        <Animated.View entering={SlideInDown.duration(240)} style={styles.pickerSheet}>
          <View style={styles.handle} />
          <View style={styles.rowBetween}>
            <AppText variant="h2">{title}</AppText>
            <PressableScale accessibilityLabel="Close" onPress={onClose} style={styles.close}><AppIcon name="close" size={21} /></PressableScale>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
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

// Phase 4 scaffolds remain, but the Phase 3 chooser never fakes a successful scan.
export function ScannerScreen() {
  return <Screen scroll={false} variant={4}><View style={styles.scannerPage}><View style={styles.camera}><View style={styles.cameraTop}><Pressable onPress={() => router.back()}><AppIcon name="close" color={colors.surface} /></Pressable><AppIcon name="flash-outline" color={colors.surface} /></View><Image source={assets.receipt} contentFit="contain" style={styles.scanReceipt} /><Image source={assets.scanFrame} contentFit="contain" style={styles.scanFrame} /><View style={styles.cameraBottom}><AppText style={styles.white}>Position the receipt inside the frame.</AppText><View style={styles.captureRow}><View style={{ width: 34 }} /><Pressable accessibilityLabel="Capture receipt" style={styles.capture} /><View style={{ width: 34 }} /></View></View></View></View></Screen>;
}

export function ProcessingScreen() {
  const [done, setDone] = useState(0);
  useEffect(() => { const id = setInterval(() => setDone((value) => Math.min(value + 1, 5)), 550); return () => clearInterval(id); }, []);
  const steps = ['Checking image quality', 'Validating receipt', 'Extracting information', 'Checking totals', 'Preparing verification'];
  return <Screen scroll={false} variant={4}><View style={styles.processing}><Animated.Image entering={FadeIn.duration(350)} source={assets.mascotSuccess} resizeMode="contain" style={styles.processMascot} /><AppText variant="title">Reading receipt...</AppText><View style={styles.steps}>{steps.map((step, index) => <Animated.View entering={FadeInDown.delay(index * 80)} key={step} style={styles.step}><View style={[styles.stepCircle, index < done && styles.stepDone]}>{index < done ? <AppIcon name="check" size={18} color={colors.surface} /> : null}</View><AppText variant="h3" style={index < done ? undefined : styles.muted}>{step}</AppText></Animated.View>)}</View></View></Screen>;
}

export function ReceiptReviewScreen() {
  return <Screen variant={4}><View style={styles.formPage}><BackButton /><Card style={{ gap: 14 }}><View style={styles.reviewTop}><View style={styles.receiptPhoto}><Image source={assets.receipt} contentFit="contain" style={styles.fill} /></View><View style={styles.optionCopy}><AppText variant="h2">Coffee Project</AppText><AppText style={styles.muted}>Sep 14, 2024</AppText><StatusChip warning>Needs Review</StatusChip></View></View><AppText>This receipt flow will be completed in Phase 4.</AppText></Card></View></Screen>;
}

export function RecognitionFailedScreen() {
  return <Screen scroll={false} variant={6}><View style={styles.failed}><Image source={assets.mascotConfused} contentFit="contain" style={styles.failedMascot} /><AppText variant="title" style={styles.center}>We couldn&apos;t recognize{`\n`}this as a receipt.</AppText><PrimaryButton title="Enter Manually" icon="pencil-outline" onPress={() => router.replace('/manual-expense')} /></View></Screen>;
}

const styles = StyleSheet.create({
  muted: { color: colors.muted }, white: { color: colors.surface }, center: { textAlign: 'center' }, fill: { width: '100%', height: '100%' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl, gap: 14, ...shadow },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF', alignSelf: 'center' },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  option: { boxSizing: 'border-box', width: '100%', minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: '#F8F7F0', borderWidth: 1, borderColor: colors.line },
  optionMuted: { backgroundColor: '#F0F1EC' }, optionIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' }, optionIconMuted: { backgroundColor: '#DDE2DC' }, optionCopy: { flex: 1, minWidth: 0, gap: 3 },
  formPage: { paddingTop: spacing.md, gap: 22 }, formHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, headerCopy: { flex: 1, minWidth: 0, paddingTop: 2, gap: 3 }, amountBlock: { gap: 9 },
  amountInput: { minHeight: 78, borderRadius: radii.lg, backgroundColor: 'rgba(255,253,247,.96)' }, amountInputText: { height: 78, fontFamily: 'JakartaExtraBold', fontSize: 28, color: colors.deepForest }, formFields: { gap: 18 },
  notesInput: { height: 112, alignItems: 'flex-start', paddingTop: 7 }, notesInputText: { height: 96, paddingTop: 10 }, fieldGroup: { gap: 7 }, fieldLabel: { marginLeft: 2 },
  formButton: { minHeight: 56, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.9)', borderWidth: 1, borderColor: '#C9D5C5', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, formButtonError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft }, formButtonText: { flex: 1, minWidth: 0, fontFamily: 'JakartaMedium' }, errorText: { color: colors.danger, marginLeft: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, modalDim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay }, pickerSheet: { maxHeight: '86%', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: spacing.xl, paddingBottom: spacing.xxl, gap: 18, ...shadow },
  categoryPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, categoryChoice: { width: '31%', minHeight: 96, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8F7F0', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8 }, categoryChoiceSelected: { borderColor: colors.deepForest, backgroundColor: '#E3ECDF' }, categoryChoiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E1EBDD', alignItems: 'center', justifyContent: 'center' }, categoryChoiceIconSelected: { backgroundColor: colors.deepForest }, categoryChoiceLabel: { textAlign: 'center', fontFamily: 'JakartaMedium' },
  nativeDatePicker: { alignItems: 'center', minHeight: Platform.OS === 'ios' ? 310 : 60 }, selectedDate: { textAlign: 'center', color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  scannerPage: { flex: 1, padding: 24, justifyContent: 'center' }, camera: { height: '86%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#1D271F', borderWidth: 4, borderColor: '#DCE7D8' }, cameraTop: { height: 70, flexDirection: 'row', justifyContent: 'space-between', padding: 20, zIndex: 3 }, scanReceipt: { position: 'absolute', width: '58%', height: '60%', top: '16%', left: '21%', transform: [{ rotate: '-4deg' }] }, scanFrame: { position: 'absolute', width: '72%', height: '58%', top: '17%', left: '14%', tintColor: '#3CE8B0' }, cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, backgroundColor: 'rgba(0,0,0,.64)', alignItems: 'center', justifyContent: 'space-around', padding: 18 }, captureRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, capture: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 5, borderColor: colors.white },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 30 }, processMascot: { width: 250, height: 220 }, steps: { gap: 16 }, step: { flexDirection: 'row', alignItems: 'center', gap: 16 }, stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#B7C0BD', alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  reviewTop: { flexDirection: 'row', gap: 16 }, receiptPhoto: { width: '42%', height: 210, borderRadius: 14, backgroundColor: '#59442E', padding: 8 }, failed: { flex: 1, justifyContent: 'center', padding: 28, gap: 18 }, failedMascot: { width: 260, height: 240, alignSelf: 'center' },
});
