import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen } from '@/components/common/screen';
import { LiquidScene } from '@/components/common/liquid-scene';
import { FadeSlideIn } from '@/components/common/motion';
import { AppIcon, AppText, BackButton, Brand, Card, FormInput, PrimaryButton } from '@/components/common/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import * as authService from '@/features/auth/auth-service';
import {
  normalizeEmail,
  validateEmail,
  validateFullName,
  validatePasswordsMatch,
  validateSignInPassword,
  validateSignUpPassword,
} from '@/features/auth/auth-validation';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import { authCopy, errorCopyForKind } from '@/features/auth/copy';
import { useAuthDialog } from '@/features/auth/hooks/useAuthDialog';

export function SplashScreen() {
  const { height } = useWindowDimensions();
  const { session } = useAuth();
  useEffect(() => {
    const id = setTimeout(() => router.replace(session ? '/home' : '/onboarding'), 2200);
    return () => clearTimeout(id);
  }, [session]);
  return <Screen scroll={false} background={false}><LiquidScene scene="splash"/><Animated.View entering={FadeIn.duration(650)} style={[s.splash,{minHeight:height}]}><View style={s.splashCopy}><Brand /><AppText variant="hero" style={s.center}>Smarter habits.{`\n`}<AppText variant="hero" style={s.green}>Brighter tomorrows.</AppText></AppText><AppText variant="h3" style={[s.center,s.muted]}>Take control of your spending{`\n`}one receipt at a time.</AppText></View><View style={s.splashLoading}><View style={s.dots}><View style={s.dotActive}/><View style={s.dot}/><View style={s.dot}/></View><AppText variant="bodyMedium" style={s.green}>Loading your brighter tomorrow...</AppText></View></Animated.View></Screen>;
}
export function OnboardingScreen() { const {height}=useWindowDimensions(); return <Screen background={false}><View style={[s.onboarding,{minHeight:Math.max(height,760)}]}><LiquidScene scene="onboarding"/><View style={s.backFloat}><BackButton/></View><View style={s.onboardBrand}><Brand compact /></View><View style={s.onboardContent}><AppText variant="title" style={s.center}>Track smarter,{`\n`}not harder.</AppText><AppText style={[s.center,s.muted]}>Turn receipts into verified expense records{`\n`}and understand your spending with less effort.</AppText>{([['receipt-text-outline','Scan Receipts','Snap a photo, we do the rest.'],['shield-check','Verify Details','We extract and confirm the key info.'],['chart-bar','See Insights','Understand your spending, grow smarter.']] as const).map(x=><Card key={x[1]} style={s.feature}><View style={s.featureIcon}><AppIcon name={x[0]} size={28}/></View><View style={{flex:1}}><AppText variant="h3">{x[1]}</AppText><AppText variant="small" style={s.muted}>{x[2]}</AppText></View></Card>)}<View style={s.dots}><View style={s.dotActive}/><View style={s.dot}/><View style={s.dot}/></View><PrimaryButton title="Get Started" onPress={()=>router.push('/create-account')}/><Pressable onPress={()=>router.push('/sign-in')} accessibilityRole="button" accessibilityLabel="I already have an account"><AppText variant="bodyMedium" style={[s.center,s.muted]}>I already have an account</AppText></Pressable></View></View></Screen>; }

// The shared auth content frame. Header, title, fields, CTA and footer all
// resolve to the same left/right edges because they're siblings in one column
// — no screen sets its own horizontal measurements. The brand is centred and
// the back button is absolutely positioned, so the logo lands at the same
// place whether or not a screen has a back button (matching onboarding).
//
// Entry is scripted here rather than per screen: header -> title -> fields ->
// CTA -> footer, 0/70/140/200/250ms, each 380ms. Total ~630ms, and the stagger
// is small enough not to fight the stack's own push transition.
function AuthShell({
  back = false,
  title,
  subtitle,
  children,
  cta,
  footer,
  variant = 1,
  density = 'roomy',
}: {
  back?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  cta?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 1 | 2 | 3 | 4 | 5 | 6;
  density?: 'roomy' | 'compact';
}) {
  const compact = density === 'compact';

  return (
    <Screen variant={variant} bottomInset={28}>
      <View style={[s.auth, compact && s.authCompact]}>
        <FadeSlideIn delay={0} distance={6}>
          <View style={s.authHeader}>
            {back ? (
              <View style={s.authBack}>
                <BackButton />
              </View>
            ) : null}
            <Brand large />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={70} distance={8}>
          <View style={s.authIntro}>
            <AppText variant="hero">{title}</AppText>
            {subtitle ? <AppText variant="subtitle" style={s.muted}>{subtitle}</AppText> : null}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={140} distance={10}>{children}</FadeSlideIn>

        {cta ? (
          <FadeSlideIn delay={200} distance={6} style={compact ? s.ctaCompact : s.cta}>
            {cta}
          </FadeSlideIn>
        ) : null}

        {footer ? (
          <FadeSlideIn delay={250} distance={0} style={s.authFooter}>
            {footer}
          </FadeSlideIn>
        ) : null}
      </View>
    </Screen>
  );
}

function PasswordEye({ visible, toggle, disabled = false }: { visible: boolean; toggle: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      accessibilityState={{ disabled }}
      style={s.eye}
    >
      <AppIcon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.forest} />
    </Pressable>
  );
}

// Shared bottom link. `prompt` is optional so a screen can show the action
// on its own ("Back to sign in").
function AuthSwitchLink({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action}
      hitSlop={10}
      style={({ pressed }) => [s.switchRow, pressed && { opacity: 0.7 }]}
    >
      {prompt ? <AppText style={s.muted}>{prompt} </AppText> : null}
      <AppText variant="bodyMedium" style={s.switchAction}>{action}</AppText>
    </Pressable>
  );
}

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { dialogProps, showDialog, hideDialog } = useAuthDialog();

  const handleSignIn = async () => {
    if (submitting) return;
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validateSignInPassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setSubmitting(true);
    const result = await authService.signIn({ email: normalizeEmail(email), password });
    setSubmitting(false);

    if (result.ok) {
      router.replace('/home');
      return;
    }

    const copy = errorCopyForKind(result.error.kind);
    showDialog({ title: copy.title, message: copy.message, primaryAction: { label: 'OK', onPress: hideDialog } });
  };

  return (
    <AuthShell
      back
      title="Welcome back"
      subtitle="Sign in to continue to ExpenSense."
      variant={1}
      density="roomy"
      cta={
        <PrimaryButton
          title="Sign In"
          loadingTitle="Signing in…"
          onPress={handleSignIn}
          loading={submitting}
        />
      }
      footer={
        <AuthSwitchLink
          prompt="New to ExpenSense?"
          action="Create account"
          onPress={() => router.push('/create-account')}
        />
      }
    >
      <View style={s.form}>
        <FormInput
          icon="email-outline"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          value={email}
          onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); }}
          error={emailError}
          accessibilityLabel="Email"
          editable={!submitting}
        />

        <View style={s.passwordBlock}>
          <FormInput
            icon="lock-outline"
            placeholder="Password"
            secure={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
            value={password}
            onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(null); }}
            error={passwordError}
            right={<PasswordEye visible={show} toggle={() => setShow(!show)} disabled={submitting} />}
            accessibilityLabel="Password"
            editable={!submitting}
          />
          <Pressable
            onPress={() => router.push('/forgot-password')}
            disabled={submitting}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            style={({ pressed }) => [s.forgotRow, pressed && { opacity: 0.7 }]}
          >
            <AppText variant="small" style={s.link}>Forgot password?</AppText>
          </Pressable>
        </View>
      </View>
      {dialogProps && <AuthDialog {...dialogProps} />}
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { dialogProps, showDialog, hideDialog } = useAuthDialog();

  const handleSend = async () => {
    if (submitting) return;
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    setSubmitting(true);
    const result = await authService.sendPasswordReset(normalizeEmail(email));
    setSubmitting(false);

    if (result.ok) {
      showDialog({
        title: authCopy.forgotPasswordSent.title,
        message: authCopy.forgotPasswordSent.message,
        primaryAction: { label: 'OK', onPress: () => { hideDialog(); router.replace('/sign-in'); } },
      });
      return;
    }

    const copy = errorCopyForKind(result.error.kind);
    showDialog({ title: copy.title, message: copy.message, primaryAction: { label: 'OK', onPress: hideDialog } });
  };

  return (
    <AuthShell
      back
      title="Forgot password?"
      subtitle="Enter your email and we’ll send a reset link."
      variant={3}
      density="roomy"
      cta={
        <PrimaryButton
          title="Send Reset Link"
          loadingTitle="Sending…"
          onPress={handleSend}
          loading={submitting}
        />
      }
      footer={
        <AuthSwitchLink
          prompt=""
          action="Back to sign in"
          onPress={() => router.replace('/sign-in')}
        />
      }
    >
      <View style={s.form}>
        <FormInput
          icon="email-outline"
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={handleSend}
          value={email}
          onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); }}
          error={emailError}
          accessibilityLabel="Email"
          editable={!submitting}
        />
      </View>
      {dialogProps && <AuthDialog {...dialogProps} />}
    </AuthShell>
  );
}

export function CreateNewPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const { signOut } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>(code ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { dialogProps, showDialog, hideDialog } = useAuthDialog();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!code || hasAttempted.current) return;
    hasAttempted.current = true;

    authService.exchangeRecoveryCode(code).then((result) => {
      setStatus(result.ok ? 'ready' : 'invalid');
    });
  }, [code]);

  useEffect(() => {
    if (status !== 'invalid') return;
    showDialog({
      title: authCopy.expiredReset.title,
      message: authCopy.expiredReset.message,
      primaryAction: { label: 'Request New Link', onPress: () => { hideDialog(); router.replace('/forgot-password'); } },
      tertiaryAction: { label: 'Back to Sign In', onPress: () => { hideDialog(); router.replace('/sign-in'); } },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleUpdate = async () => {
    if (submitting || status !== 'ready') return;
    const nextPasswordError = validateSignUpPassword(password);
    const nextConfirmError = validatePasswordsMatch(password, confirmPassword);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    setSubmitting(true);
    const result = await authService.updatePassword(password);

    if (result.ok) {
      await signOut();
      setSubmitting(false);
      showDialog({
        title: authCopy.passwordResetSuccess.title,
        message: authCopy.passwordResetSuccess.message,
        primaryAction: { label: 'OK', onPress: () => { hideDialog(); router.replace('/sign-in'); } },
      });
      return;
    }

    setSubmitting(false);
    const copy = errorCopyForKind(result.error.kind);
    showDialog({ title: copy.title, message: copy.message, primaryAction: { label: 'OK', onPress: hideDialog } });
  };

  return (
    <AuthShell
      title="Create a new password"
      subtitle="Use a strong password to secure your account."
      variant={2}
      density="roomy"
    >
      {status === 'checking' ? (
        <View style={s.checking}>
          <ActivityIndicator color={colors.deepForest} />
          <AppText style={s.muted}>Checking your reset link…</AppText>
        </View>
      ) : (
        <View style={s.form}>
          <FormInput
            icon="lock-outline"
            placeholder="New password"
            hint="Use at least 8 characters with a letter and number."
            secure={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            value={password}
            onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(null); }}
            error={passwordError}
            right={<PasswordEye visible={show} toggle={() => setShow(!show)} disabled={submitting} />}
            accessibilityLabel="New password"
            editable={status === 'ready' && !submitting}
          />
          <FormInput
            icon="lock-outline"
            placeholder="Confirm password"
            secure={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleUpdate}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); if (confirmError) setConfirmError(null); }}
            error={confirmError}
            right={<PasswordEye visible={show} toggle={() => setShow(!show)} disabled={submitting} />}
            accessibilityLabel="Confirm new password"
            editable={status === 'ready' && !submitting}
          />

          <View style={s.cta}>
            <PrimaryButton
              title="Update Password"
              loadingTitle="Updating…"
              onPress={handleUpdate}
              loading={submitting}
              disabled={status !== 'ready'}
            />
          </View>
        </View>
      )}
      {dialogProps && <AuthDialog {...dialogProps} />}
    </AuthShell>
  );
}

export function CreateAccountScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { dialogProps, showDialog, hideDialog } = useAuthDialog();

  const handleCreateAccount = async () => {
    if (submitting) return;
    const nextFullNameError = validateFullName(fullName);
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validateSignUpPassword(password);
    const nextConfirmError = validatePasswordsMatch(password, confirmPassword);
    setFullNameError(nextFullNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextFullNameError || nextEmailError || nextPasswordError || nextConfirmError) return;

    setSubmitting(true);
    const result = await authService.signUp({ email: normalizeEmail(email), password, fullName: fullName.trim() });
    setSubmitting(false);

    if (result.ok) {
      if (result.data.session) {
        router.replace('/home');
      } else {
        showDialog({
          title: authCopy.verifyEmail.title,
          message: authCopy.verifyEmail.message,
          primaryAction: { label: 'OK', onPress: () => { hideDialog(); router.replace('/sign-in'); } },
        });
      }
      return;
    }

    if (result.error.kind === 'signup_conflict') {
      showDialog({
        title: authCopy.signupConflict.title,
        message: authCopy.signupConflict.message,
        primaryAction: { label: 'Sign In', onPress: () => { hideDialog(); router.replace('/sign-in'); } },
        secondaryAction: { label: 'Reset Password', onPress: () => { hideDialog(); router.push('/forgot-password'); } },
        tertiaryAction: { label: 'Cancel', onPress: hideDialog },
      });
      return;
    }

    const copy = errorCopyForKind(result.error.kind);
    showDialog({ title: copy.title, message: copy.message, primaryAction: { label: 'OK', onPress: hideDialog } });
  };

  return (
    <AuthShell
      back
      title="Create your account"
      subtitle="Start tracking verified expenses."
      variant={5}
      density="compact"
      cta={
        <PrimaryButton
          title="Create Account"
          loadingTitle="Creating account…"
          onPress={handleCreateAccount}
          loading={submitting}
        />
      }
      footer={
        <AuthSwitchLink
          prompt="Already have an account?"
          action="Sign in"
          onPress={() => router.replace('/sign-in')}
        />
      }
    >
      <View style={s.formCompact}>
        <FormInput
          icon="account-outline"
          placeholder="Full name"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          value={fullName}
          onChangeText={(t) => { setFullName(t); if (fullNameError) setFullNameError(null); }}
          error={fullNameError}
          accessibilityLabel="Full name"
          editable={!submitting}
        />
        <FormInput
          icon="email-outline"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          value={email}
          onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); }}
          error={emailError}
          accessibilityLabel="Email"
          editable={!submitting}
        />
        <FormInput
          icon="lock-outline"
          placeholder="Password"
          hint="Use at least 8 characters with a letter and number."
          secure={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="next"
          value={password}
          onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(null); }}
          error={passwordError}
          right={<PasswordEye visible={show} toggle={() => setShow(!show)} disabled={submitting} />}
          accessibilityLabel="Password"
          editable={!submitting}
        />
        <FormInput
          icon="lock-outline"
          placeholder="Confirm password"
          secure={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleCreateAccount}
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); if (confirmError) setConfirmError(null); }}
          error={confirmError}
          right={<PasswordEye visible={show} toggle={() => setShow(!show)} disabled={submitting} />}
          accessibilityLabel="Confirm password"
          editable={!submitting}
        />
      </View>
      {dialogProps && <AuthDialog {...dialogProps} />}
    </AuthShell>
  );
}
const s=StyleSheet.create({
  center:{textAlign:'center'},muted:{color:colors.muted},green:{color:colors.forest},
  splash:{flex:1,alignItems:'center',paddingHorizontal:24},splashCopy:{position:'absolute',top:'14%',alignItems:'center',gap:24},splashLoading:{position:'absolute',top:'80%',alignItems:'center',gap:16},
  dots:{flexDirection:'row',gap:10,justifyContent:'center',alignItems:'center'},dot:{width:10,height:10,borderRadius:5,backgroundColor:'#C8D8C1'},dotActive:{width:10,height:10,borderRadius:5,backgroundColor:colors.deepForest},
  backFloat:{position:'absolute',left:18,top:16,zIndex:20},
  onboarding:{paddingHorizontal:24,paddingBottom:22},onboardBrand:{position:'absolute',top:32,left:0,right:0,alignItems:'center'},onboardContent:{paddingTop:330,gap:10},feature:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:12,gap:14,backgroundColor:'rgba(238,242,233,.96)',borderRadius:22},featureIcon:{width:58,height:48,borderRadius:17,backgroundColor:'#DCE8D5',alignItems:'center',justifyContent:'center'},
  // Auth rhythm: header -> 28 -> intro -> 28 -> form -> 24 -> footer.
  // No fixed minHeight, so short screens scroll instead of overflowing and
  // tall screens centre the form rather than stranding it at the top.
  // Shared auth frame. One column, so header/title/fields/CTA/footer inherit
  // identical left and right edges. Vertical rhythm lives only here.
  auth:{flexGrow:1,justifyContent:'center',paddingVertical:20,gap:28},
  authCompact:{gap:20,paddingVertical:14},
  authHeader:{alignItems:'center',justifyContent:'center',minHeight:96,paddingTop:34},
  authBack:{position:'absolute',left:0,top:0,zIndex:2},
  authIntro:{gap:8},
  authFooter:{alignItems:'center'},
  form:{gap:16},
  formCompact:{gap:12},
  cta:{marginTop:4},
  ctaCompact:{marginTop:0},
  passwordBlock:{gap:10},
  forgotRow:{alignSelf:'flex-end',paddingVertical:2},
  switchRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',justifyContent:'center',minHeight:44},
  switchAction:{color:colors.deepForest,fontFamily:'JakartaBold'},
  eye:{paddingLeft:8,paddingVertical:8},
  link:{color:colors.deepForest,fontFamily:'JakartaSemiBold'},
  checking:{marginTop:40,alignItems:'center',gap:14},
});
