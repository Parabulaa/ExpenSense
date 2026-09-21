import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Linking, StyleSheet, Switch, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/common/motion';
import { Screen } from '@/components/common/screen';
import { useToast } from '@/components/common/toast';
import { AppIcon, AppText, BackButton, Card, FormInput, PrimaryButton } from '@/components/common/ui';
import { colors, radii, spacing } from '@/constants/theme';
import * as authService from '@/features/auth/auth-service';
import { validatePasswordsMatch, validateSignUpPassword } from '@/features/auth/auth-validation';
import { errorCopyForKind } from '@/features/auth/copy';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { MAX_FULL_NAME_LENGTH, validateProfileName } from '@/features/profile/validation';
import { useSettings, type BudgetAlertThreshold } from '@/features/settings/SettingsProvider';
import { selectionFeedback } from '@/lib/haptics';

/** Shared chrome for every settings sub-page: back arrow, title, subtitle. */
function SettingsPage({
  title,
  subtitle,
  variant = 8,
  children,
}: {
  title: string;
  subtitle: string;
  variant?: 4 | 8 | 11;
  children: React.ReactNode;
}) {
  return (
    <Screen variant={variant} bottomInset={48}>
      <View style={s.page}>
        <FadeSlideIn index={0}>
          <View style={s.header}>
            <BackButton />
            <View style={s.headerCopy}>
              <AppText variant="title">{title}</AppText>
              <AppText style={s.muted}>{subtitle}</AppText>
            </View>
          </View>
        </FadeSlideIn>
        {children}
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <AppText variant="small" style={s.muted}>{label}</AppText>
      <AppText variant="h3" numberOfLines={2}>{value}</AppText>
    </View>
  );
}

export function AccountInformationScreen() {
  const { profile, displayName, email, loading, updateFullName } = useProfile();
  const { showToast } = useToast();
  const saving = useRef(false);
  const [name, setName] = useState(profile?.fullName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const memberSince = profile?.createdAt
    ? new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(profile.createdAt))
    : '—';

  const save = async () => {
    if (saving.current) return;
    Keyboard.dismiss();
    const validation = validateProfileName(name);
    setError(validation);
    if (validation) return;

    saving.current = true;
    setBusy(true);
    const result = await updateFullName(name.trim());
    setBusy(false);
    saving.current = false;

    if (!result.ok) {
      showToast(result.message, { tone: 'warning', icon: 'alert-circle-outline' });
      return;
    }

    selectionFeedback();
    showToast('Profile updated', { icon: 'check-circle-outline' });
    router.back();
  };

  return (
    <SettingsPage title="Account Information" subtitle="Your ExpenSense account details.">
      <FadeSlideIn index={1}>
        <Card style={s.card}>
          <FormInput
            label="Full name"
            accessibilityLabel="Full name"
            placeholder="Add your name"
            value={name}
            onChangeText={(value) => { setName(value); setError(null); }}
            autoCapitalize="words"
            maxLength={MAX_FULL_NAME_LENGTH}
            error={error}
            hint={`Shown on your dashboard greeting. ${name.trim().length}/${MAX_FULL_NAME_LENGTH}`}
            editable={!loading && !busy}
          />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Card style={s.card}>
          <InfoRow label="Email" value={email || '—'} />
          <View style={s.divider} />
          <InfoRow label="Member since" value={memberSince} />
          <AppText variant="small" style={[s.muted, s.footnote]}>
            Your email is the address you sign in with and can&apos;t be changed here yet.
          </AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={3}>
        <PrimaryButton
          title="Save Changes"
          loadingTitle="Saving..."
          loading={busy}
          disabled={busy || loading || name.trim() === (profile?.fullName ?? '').trim()}
          icon="check"
          onPress={save}
        />
      </FadeSlideIn>

      <AppText variant="small" style={[s.muted, s.footnote]}>
        Signed in as {displayName}.
      </AppText>
    </SettingsPage>
  );
}

export function ChangePasswordScreen() {
  const { showToast } = useToast();
  const saving = useRef(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (saving.current) return;
    Keyboard.dismiss();

    // Reuses the Phase 1 policy rather than defining a second one.
    const nextPasswordError = validateSignUpPassword(password);
    const nextConfirmError = validatePasswordsMatch(password, confirm);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    saving.current = true;
    setBusy(true);
    const result = await authService.updatePassword(password);
    setBusy(false);
    saving.current = false;

    if (!result.ok) {
      const copy = errorCopyForKind(result.error.kind);
      showToast(copy.message, { tone: 'warning', icon: 'alert-circle-outline' });
      return;
    }

    // Supabase keeps the current session valid after updateUser, so there's no
    // reason to sign the user out of a device they're already trusted on.
    selectionFeedback();
    setPassword('');
    setConfirm('');
    showToast('Password updated. Your password has been changed successfully.', { icon: 'check-circle-outline' });
    router.back();
  };

  return (
    <SettingsPage title="Change Password" subtitle="Set a new password for this account." variant={11}>
      <FadeSlideIn index={1}>
        <Card style={s.card}>
          <FormInput
            label="New password"
            accessibilityLabel="New password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={(value) => { setPassword(value); setPasswordError(null); }}
            secure={!show}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            error={passwordError}
            hint="Use at least 8 characters with a letter and a number."
            right={
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={show ? 'Hide password' : 'Show password'}
                hitSlop={10}
                onPress={() => setShow((current) => !current)}
              >
                <AppIcon name={show ? 'eye-off-outline' : 'eye-outline'} size={22} />
              </PressableScale>
            }
            editable={!busy}
          />
          <FormInput
            label="Confirm new password"
            accessibilityLabel="Confirm new password"
            placeholder="Re-enter the new password"
            value={confirm}
            onChangeText={(value) => { setConfirm(value); setConfirmError(null); }}
            secure={!show}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            error={confirmError}
            editable={!busy}
          />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <PrimaryButton
          title="Update Password"
          loadingTitle="Updating..."
          loading={busy}
          disabled={busy}
          icon="lock-check-outline"
          onPress={submit}
        />
      </FadeSlideIn>

      <AppText variant="small" style={[s.muted, s.footnote]}>
        You&apos;ll stay signed in on this device after updating.
      </AppText>
    </SettingsPage>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  disabled,
  onValueChange,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.settingIcon}><AppIcon name={icon} size={21} color={colors.deepForest} /></View>
      <View style={s.toggleCopy}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="small" style={s.muted}>{description}</AppText>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: '#CBD8C6', true: colors.softGreen }}
        thumbColor={value ? colors.deepForest : colors.surface}
      />
    </View>
  );
}

export function NotificationsScreen() {
  const { settings, ready, updateSettings } = useSettings();
  const { showToast } = useToast();

  const persist = async (patch: Parameters<typeof updateSettings>[0]) => {
    const saved = await updateSettings(patch);
    if (!saved) showToast("Couldn't save that preference. Try again.", { tone: 'warning', icon: 'alert-circle-outline' });
  };

  const thresholds: BudgetAlertThreshold[] = [80, 90, 100];

  return (
    <SettingsPage title="Notifications" subtitle="Choose what ExpenSense should flag for you.">
      <FadeSlideIn index={1}>
        <Card style={s.noticeCard}>
          <AppIcon name="information-outline" size={20} color={colors.forest} />
          <AppText variant="small" style={s.noticeText}>
            These preferences are saved on this device and control in-app alerts. Push notifications
            aren&apos;t part of ExpenSense yet.
          </AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Card style={s.card}>
          <ToggleRow
            icon="wallet-outline"
            title="Budget alerts"
            description="Warn me as I approach a budget limit."
            value={settings.budgetAlerts}
            disabled={!ready}
            onValueChange={(next) => void persist({ budgetAlerts: next })}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="lightbulb-outline"
            title="Spending insights"
            description="Surface patterns from my own transactions."
            value={settings.spendingInsights}
            disabled={!ready}
            onValueChange={(next) => void persist({ spendingInsights: next })}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="receipt-text-outline"
            title="Transaction reminders"
            description="Nudge me to log expenses I may have missed."
            value={settings.transactionReminders}
            disabled={!ready}
            onValueChange={(next) => void persist({ transactionReminders: next })}
          />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={3}>
        <Card style={s.card}>
          <AppText variant="h3">Warn me at</AppText>
          <AppText variant="small" style={s.muted}>
            How much of a budget can be used before ExpenSense flags it.
          </AppText>
          <View style={s.thresholdRow}>
            {thresholds.map((threshold) => {
              const active = settings.budgetAlertThreshold === threshold;
              return (
                <PressableScale
                  key={threshold}
                  accessibilityRole="button"
                  accessibilityLabel={`Warn at ${threshold} percent`}
                  accessibilityState={{ selected: active }}
                  disabled={!ready || !settings.budgetAlerts}
                  onPress={() => void persist({ budgetAlertThreshold: threshold })}
                  style={[s.threshold, active && s.thresholdActive, (!ready || !settings.budgetAlerts) && s.thresholdDisabled]}
                >
                  <AppText variant="h3" style={active ? s.thresholdActiveText : undefined}>{threshold}%</AppText>
                </PressableScale>
              );
            })}
          </View>
        </Card>
      </FadeSlideIn>
    </SettingsPage>
  );
}

export function AppearanceScreen() {
  return (
    <SettingsPage title="Appearance" subtitle="How ExpenSense looks on this device.">
      <FadeSlideIn index={1}>
        <Card style={s.card}>
          <View style={s.themeRow}>
            <View style={[s.themeSwatch, s.themeSwatchLight]}>
              <AppIcon name="white-balance-sunny" size={22} color={colors.deepForest} />
            </View>
            <View style={s.toggleCopy}>
              <AppText variant="h3">Light</AppText>
              <AppText variant="small" style={s.muted}>The cream and forest-green ExpenSense theme.</AppText>
            </View>
            <View style={s.activePill}><AppText variant="small" style={s.activePillText}>Active</AppText></View>
          </View>

          <View style={s.divider} />

          <View style={[s.themeRow, s.themeRowDisabled]}>
            <View style={[s.themeSwatch, s.themeSwatchDark]}>
              <AppIcon name="weather-night" size={22} color={colors.lightGreen} />
            </View>
            <View style={s.toggleCopy}>
              <AppText variant="h3" style={s.muted}>Dark</AppText>
              <AppText variant="small" style={s.muted}>Not available yet — planned for a later release.</AppText>
            </View>
          </View>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Card style={s.noticeCard}>
          <AppIcon name="information-outline" size={20} color={colors.forest} />
          <AppText variant="small" style={s.noticeText}>
            ExpenSense follows your device&apos;s reduced-motion setting. Turn it on in your system
            accessibility settings to calm the animated background.
          </AppText>
        </Card>
      </FadeSlideIn>
    </SettingsPage>
  );
}

function BulletRow({ icon, title, body }: { icon: Parameters<typeof AppIcon>[0]['name']; title: string; body: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.settingIcon}><AppIcon name={icon} size={20} color={colors.deepForest} /></View>
      <View style={s.toggleCopy}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="small" style={s.muted}>{body}</AppText>
      </View>
    </View>
  );
}

export function PrivacyDataScreen() {
  return (
    <SettingsPage title="Privacy & Data" subtitle="What ExpenSense stores and why." variant={11}>
      <FadeSlideIn index={1}>
        <Card style={s.card}>
          <AppText variant="h3">What we store</AppText>
          <View style={s.divider} />
          <BulletRow icon="account-outline" title="Account" body="Your email and the display name you choose." />
          <BulletRow icon="receipt-text-outline" title="Expenses" body="Amounts, merchants, categories, dates and notes you enter." />
          <BulletRow icon="wallet-outline" title="Budgets" body="Monthly totals and any category limits you set." />
          <BulletRow icon="shape-outline" title="Categories" body="The default set plus any categories you create." />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Card style={s.card}>
          <AppText variant="h3">How analytics work</AppText>
          <AppText variant="small" style={s.muted}>
            Every chart and insight is calculated inside the app from your own transactions. Nothing is
            derived from other users, and your records are never pooled or sold.
          </AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={3}>
        <Card style={s.card}>
          <AppText variant="h3">Who can see it</AppText>
          <AppText variant="small" style={s.muted}>
            Your rows are protected by row-level security in Supabase: every query is scoped to your own
            account, so no other signed-in user can read or change your data.
          </AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={4}>
        <Card style={s.card}>
          <AppText variant="h3">Export and deletion</AppText>
          <AppText variant="small" style={s.muted}>
            Exporting your records and deleting your account aren&apos;t available in this build. Both need a
            secure server-side path, which is planned rather than half-built — so no button here pretends
            to do it.
          </AppText>
        </Card>
      </FadeSlideIn>
    </SettingsPage>
  );
}

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How do I add an expense?',
    answer: 'Tap the centre Scan button in the bottom navigation, then choose "Enter Manually". Fill in the amount, merchant, category and date, then save.',
  },
  {
    question: 'Can I scan a receipt?',
    answer: 'Not yet. Receipt scanning is designed but not implemented, so the option is marked as coming later rather than pretending to read your receipt.',
  },
  {
    question: 'How do I set a budget?',
    answer: 'Open Budget from the bottom navigation, pick a month, then set a monthly total. You can also add per-category limits to track individual spending areas.',
  },
  {
    question: 'Where do the insights come from?',
    answer: 'They are calculated from the expenses you have entered — top categories, repeat merchants, and month-over-month changes. No estimates or sample data are used.',
  },
  {
    question: 'How do I change the categories on my dashboard?',
    answer: 'Long-press any category tile on the dashboard to enter edit mode. Drag a tile onto another to swap them, or tap the x to remove it. The dashboard shows up to eight.',
  },
  {
    question: 'I forgot my password.',
    answer: 'Sign out, then use "Forgot password?" on the sign-in screen. You will get an email with a reset link that opens straight back into ExpenSense.',
  },
];

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <FadeSlideIn index={index}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={s.faqCard}
      >
        <View style={s.faqHeader}>
          <AppText variant="h3" style={s.faqQuestion}>{question}</AppText>
          <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.deepForest} />
        </View>
        {open ? <AppText variant="small" style={[s.muted, s.faqAnswer]}>{answer}</AppText> : null}
      </PressableScale>
    </FadeSlideIn>
  );
}

export function HelpSupportScreen() {
  return (
    <SettingsPage title="Help & Support" subtitle="Answers to the most common questions.">
      {FAQ.map((item, index) => (
        <FaqItem key={item.question} question={item.question} answer={item.answer} index={index + 1} />
      ))}

      <FadeSlideIn index={FAQ.length + 1}>
        <Card style={s.noticeCard}>
          <AppIcon name="information-outline" size={20} color={colors.forest} />
          <AppText variant="small" style={s.noticeText}>
            ExpenSense is a student project and doesn&apos;t have a support desk. These answers are stored in
            the app, so they work offline too.
          </AppText>
        </Card>
      </FadeSlideIn>
    </SettingsPage>
  );
}

export function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const sdk = Constants.expoConfig?.sdkVersion;

  return (
    <SettingsPage title="About" subtitle="About this build of ExpenSense." variant={11}>
      <FadeSlideIn index={1}>
        <Card style={[s.card, s.aboutCard]}>
          <View style={s.aboutMark}><AppIcon name="leaf" size={32} color={colors.surface} /></View>
          <AppText variant="h2">ExpenSense</AppText>
          <AppText style={[s.muted, s.center]}>Intelligent Ledger for Finance &amp; Expense Tracking</AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Card style={s.card}>
          <InfoRow label="Version" value={version} />
          <View style={s.divider} />
          <InfoRow label="Expo SDK" value={sdk ?? '—'} />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={3}>
        <Card style={s.card}>
          <AppText variant="h3">What it does</AppText>
          <AppText variant="small" style={s.muted}>
            ExpenSense turns everyday spending into something you can actually read: log an expense, set a
            budget, and watch the dashboard and analytics update from your own records. Receipt scanning is
            designed but not yet implemented.
          </AppText>
        </Card>
      </FadeSlideIn>

      <FadeSlideIn index={4}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Open the Expo documentation"
          onPress={() => void Linking.openURL('https://docs.expo.dev')}
          style={s.linkRow}
        >
          <AppIcon name="open-in-new" size={20} color={colors.deepForest} />
          <AppText variant="h3" style={s.linkText}>Built with Expo</AppText>
        </PressableScale>
      </FadeSlideIn>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  page: { padding: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  muted: { color: colors.muted },
  center: { textAlign: 'center' },
  card: { borderRadius: radii.lg, gap: 10 },
  divider: { height: 1, backgroundColor: colors.line },
  infoRow: { gap: 2 },
  footnote: { marginTop: 2 },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DDEBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toggleCopy: { flex: 1, minWidth: 0, gap: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: radii.lg,
    backgroundColor: '#EAF1E6',
  },
  noticeText: { flex: 1, minWidth: 0, color: colors.forest, lineHeight: 18 },
  thresholdRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  threshold: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  thresholdActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  thresholdActiveText: { color: colors.surface },
  thresholdDisabled: { opacity: 0.5 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  themeRowDisabled: { opacity: 0.6 },
  themeSwatch: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  themeSwatchLight: { backgroundColor: '#DDEBDD' },
  themeSwatchDark: { backgroundColor: colors.text },
  activePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: '#DDEBDD' },
  activePillText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  faqCard: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,253,247,.96)',
    padding: spacing.lg,
    gap: 8,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faqQuestion: { flex: 1, minWidth: 0 },
  faqAnswer: { lineHeight: 19 },
  aboutCard: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  aboutMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.deepForest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.pale,
  },
  linkText: { color: colors.deepForest },
  emptyAlerts: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  emptyAlertsIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#E6F0E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  alertCard: {
    boxSizing: 'border-box',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,253,247,.97)',
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DDEBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconCritical: { backgroundColor: colors.dangerSoft },
  alertIconWarning: { backgroundColor: colors.warningSoft },
  unreadDot: { width: 9, height: 9, borderRadius: radii.pill, backgroundColor: colors.success },
});

export function NotificationsFeedScreen() {
  const { alerts, unreadCount, isRead, markAllRead } = useNotifications();
  const cleared = useRef(false);

  // Seen on open — the badge reflects "you haven't looked", not "unresolved".
  useFocusEffect(
    useCallback(() => {
      if (cleared.current) return;
      cleared.current = true;
      void markAllRead();
    }, [markAllRead]),
  );

  return (
    <SettingsPage
      title="Notifications"
      subtitle={alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'} from your own activity.` : 'Alerts from your budgets and spending.'}
      variant={11}
    >
      {alerts.length === 0 ? (
        <FadeSlideIn index={1}>
          <Card style={[s.card, s.emptyAlerts]}>
            <View style={s.emptyAlertsIcon}><AppIcon name="bell-check-outline" size={30} color={colors.softGreen} /></View>
            <AppText variant="h2">Nothing to flag</AppText>
            <AppText variant="small" style={[s.muted, s.center]}>
              Budget warnings and spending patterns appear here as they happen. Set a budget to get more
              out of this.
            </AppText>
          </Card>
        </FadeSlideIn>
      ) : (
        alerts.map((alert, index) => (
          <FadeSlideIn key={alert.id} index={index + 1}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}. ${alert.detail}`}
              disabled={!alert.route}
              onPress={() => alert.route && router.push(alert.route)}
              scaleTo={0.985}
              style={s.alertCard}
            >
              <View style={[s.alertIcon, alert.tone === 'critical' && s.alertIconCritical, alert.tone === 'warning' && s.alertIconWarning]}>
                <AppIcon
                  name={alert.icon}
                  size={21}
                  color={alert.tone === 'critical' ? colors.danger : alert.tone === 'warning' ? colors.warning : colors.deepForest}
                />
              </View>
              <View style={s.toggleCopy}>
                <AppText variant="h3" numberOfLines={2}>{alert.title}</AppText>
                <AppText variant="small" style={s.muted}>{alert.detail}</AppText>
              </View>
              {!isRead(alert.id) && unreadCount > 0 ? <View style={s.unreadDot} /> : null}
              {alert.route ? <AppIcon name="chevron-right" size={22} color={colors.muted} /> : null}
            </PressableScale>
          </FadeSlideIn>
        ))
      )}

      <FadeSlideIn index={alerts.length + 1}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Open notification preferences"
          onPress={() => router.push('/settings/notifications')}
          style={s.linkRow}
        >
          <AppIcon name="cog-outline" size={20} color={colors.deepForest} />
          <AppText variant="h3" style={s.linkText}>Notification preferences</AppText>
        </PressableScale>
      </FadeSlideIn>
    </SettingsPage>
  );
}
