import { Image, type ImageSource } from 'expo-image';
import { router, usePathname } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useDrift } from '@/components/common/motion';

import { AppText, PrimaryButton } from '@/components/common/ui';
import { assets, radii, shadow } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { selectionFeedback } from '@/lib/haptics';

import { appTourSeen, markAppTourSeen } from './tour-status';

export type TourTargetId =
  | 'adviser'
  | 'summary'
  | 'nav-scan'
  | 'nav-transactions'
  | 'nav-analytics'
  | 'nav-wallet'
  | 'quick-menu';

type TourStep = {
  /** Control to spotlight; without one the card sits centred on the screen. */
  target?: TourTargetId;
  title: string;
  body: string;
  mascot: ImageSource;
};

const STEPS: TourStep[] = [
  {
    title: 'Welcome to ExpenSense',
    body: 'Here’s a quick tour of where everything lives. It takes about 30 seconds.',
    mascot: assets.mascotSuccess,
  },
  {
    target: 'adviser',
    title: 'Meet your Financial Adviser',
    body: 'Tap the mascot’s speech bubble to chat about your money. Pick a personality like Strict Mom or Chill Guy, and set how intense they are, in Profile → Financial Adviser.',
    mascot: assets.mascotTip,
  },
  {
    target: 'summary',
    title: 'Your spending at a glance',
    body: 'See how much you’ve spent this week, month or year, and how much of your budget is left.',
    mascot: assets.mascotNeutral,
  },
  {
    target: 'nav-scan',
    title: 'Add an expense',
    body: 'Tap Scan to photograph a receipt, upload one, or type an expense in by hand. Nothing is saved until you confirm the details.',
    mascot: assets.mascotScanning,
  },
  {
    target: 'nav-transactions',
    title: 'Every record in one place',
    body: 'Search, filter and open any transaction to check or edit it. Tip: swipe left or right to move between tabs.',
    mascot: assets.mascotNeutral,
  },
  {
    target: 'nav-analytics',
    title: 'See where your money goes',
    body: 'Category breakdowns, trends and tips built from your verified expenses.',
    mascot: assets.mascotTip,
  },
  {
    target: 'nav-wallet',
    title: 'Wallets, goals and budgets',
    body: 'Manage your wallets, track savings goals and set a monthly limit for each category.',
    mascot: assets.mascotNeutral,
  },
  {
    target: 'quick-menu',
    title: 'Settings, alerts and help',
    body: 'Your profile, notifications and FAQ live here. You can replay this tour from the FAQ any time.',
    mascot: assets.mascotTip,
  },
];

/** Gives the Home screen and navigation time to lay out before measuring. */
const START_DELAY_MS = 700;
const REPLAY_DELAY_MS = 1100;
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const SCREEN_MARGIN = 16;
const CARD_MAX_WIDTH = 420;

type Rect = { x: number; y: number; width: number; height: number };

type TourContextValue = {
  register: (id: TourTargetId, view: View | null) => void;
  /** Replays the tour from the start; sends the user to Home first. */
  replay: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useAppTour() {
  const context = useContext(TourContext);
  if (!context) throw new Error('useAppTour must be used inside AppTourProvider');
  return context;
}

export function AppTourProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const pathname = usePathname();
  const targets = useRef(new Map<TourTargetId, View>());
  const [step, setStep] = useState<number | null>(null);
  const [replayRequested, setReplayRequested] = useState(false);

  const register = useCallback((id: TourTargetId, view: View | null) => {
    if (view) targets.current.set(id, view);
    else targets.current.delete(id);
  }, []);

  const replay = useCallback(() => {
    setReplayRequested(true);
    // Close back to the existing app shell, then switch its tab. dismissTo
    // could stack a second shell when FAQ was opened from another tab.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/home');
  }, []);

  // Runs once per person the first time they land on Home. The auth guard
  // only lets a new user reach Home after budget setup, so the tour never
  // competes with it. Leaving Home before the delay cancels the start.
  const shouldAutoStart = Boolean(user && !appTourSeen(user));
  useEffect(() => {
    if (pathname !== '/home' || step !== null) return;
    if (!replayRequested && !shouldAutoStart) return;
    // A replay also waits out the screen transition back to Home, so the
    // overlay never opens while Home is still animating in.
    const id = setTimeout(() => {
      setReplayRequested(false);
      setStep(0);
    }, replayRequested ? REPLAY_DELAY_MS : START_DELAY_MS);
    return () => clearTimeout(id);
  }, [pathname, replayRequested, shouldAutoStart, step]);

  // Always answers asynchronously, so the overlay only ever sets state from
  // a callback. A missing target answers null and the card centres itself.
  const measure = useCallback((id: TourTargetId | undefined, done: (rect: Rect | null) => void) => {
    const view = id ? targets.current.get(id) : undefined;
    if (!view) {
      requestAnimationFrame(() => done(null));
      return;
    }
    view.measureInWindow((x, y, width, height) => done(width > 0 && height > 0 ? { x, y, width, height } : null));
  }, []);

  const finish = useCallback(() => {
    if (user) markAppTourSeen(user.id);
    setStep(null);
  }, [user]);

  const value = useMemo(() => ({ register, replay }), [register, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {step !== null && pathname === '/home' ? (
        <TourOverlay
          step={step}
          measure={measure}
          onBack={() => setStep((current) => Math.max(0, (current ?? 0) - 1))}
          onNext={() => (step >= STEPS.length - 1 ? finish() : setStep(step + 1))}
          onSkip={finish}
        />
      ) : null}
    </TourContext.Provider>
  );
}

/** Marks a control the tour can spotlight. Layout is unaffected. */
export function TourTarget({ id, style, children }: PropsWithChildren<{ id: TourTargetId; style?: StyleProp<ViewStyle> }>) {
  const { register } = useAppTour();
  return (
    <View collapsable={false} style={style} ref={(view) => register(id, view)}>
      {children}
    </View>
  );
}

function TourOverlay({
  step,
  measure,
  onBack,
  onNext,
  onSkip,
}: {
  step: number;
  measure: (id: TourTargetId | undefined, done: (rect: Rect | null) => void) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const current = STEPS[step];
  const [cardHeight, setCardHeight] = useState(0);
  const mascotBob = useDrift({ x: 0, y: 6, rotate: 5, scale: 0.04, duration: 1300 });

  // Re-measured per step and on resize/rotation, so the spotlight always sits
  // on the real control rather than on a hard-coded position. A result only
  // counts for the step and window size it was taken at.
  const measurementKey = `${step}:${window.width}x${window.height}`;
  const [measurement, setMeasurement] = useState<{ key: string; hole: Rect | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    measure(current.target, (rect) => {
      if (!cancelled) setMeasurement({ key: measurementKey, hole: rect });
    });
    return () => {
      cancelled = true;
    };
  }, [current.target, measure, measurementKey]);
  const measured = measurement?.key === measurementKey;
  const hole = measured ? measurement.hole : null;

  const next = () => {
    selectionFeedback();
    onNext();
  };

  // Buttons get a circle centred on them; the wide summary card and the
  // adviser's bubble-and-mascot keep a snug rounded rectangle, since a circle
  // around them would cover half the screen.
  const round = current.target !== 'summary' && current.target !== 'adviser';
  let spot: (Rect & { radius: number }) | null = null;
  if (hole && round) {
    const diameter = Math.max(hole.width, hole.height) + SPOTLIGHT_PADDING * 2;
    spot = {
      x: hole.x + hole.width / 2 - diameter / 2,
      y: hole.y + hole.height / 2 - diameter / 2,
      width: diameter,
      height: diameter,
      radius: diameter / 2,
    };
  } else if (hole) {
    spot = {
      x: hole.x - SPOTLIGHT_PADDING,
      y: hole.y - SPOTLIGHT_PADDING,
      width: hole.width + SPOTLIGHT_PADDING * 2,
      height: hole.height + SPOTLIGHT_PADDING * 2,
      radius: radii.lg + SPOTLIGHT_PADDING,
    };
  }

  const cardWidth = Math.min(window.width - SCREEN_MARGIN * 2, CARD_MAX_WIDTH);
  const cardLeft = (window.width - cardWidth) / 2;
  // Card goes on whichever side of the spotlight has more room.
  let cardTop = (window.height - cardHeight) / 2;
  if (spot) {
    const below = spot.y + spot.height + CARD_GAP;
    const above = spot.y - CARD_GAP - cardHeight;
    cardTop = spot.y + spot.height / 2 < window.height / 2 ? below : above;
    cardTop = Math.max(SCREEN_MARGIN, Math.min(cardTop, window.height - cardHeight - SCREEN_MARGIN));
  }

  const isLast = step === STEPS.length - 1;
  const entering = reducedMotion ? undefined : FadeInDown.duration(280).easing(Easing.out(Easing.cubic));
  const exiting = reducedMotion ? undefined : FadeOut.duration(120);

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onSkip}>
      <View style={styles.root} accessibilityViewIsModal>
        <Spotlight spot={spot} />

        {/* Swallows taps so the app underneath can't be used mid-tour. */}
        <Pressable style={styles.fill} accessible={false} onPress={() => undefined} />

        {measured ? (
          <Animated.View
            key={`card-${step}`}
            entering={entering}
            exiting={exiting}
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
            style={[styles.card, { width: cardWidth, left: cardLeft, top: cardTop, opacity: cardHeight ? 1 : 0 }]}
          >
            <View style={styles.header}>
              <Animated.View style={mascotBob}>
                <Image source={current.mascot} contentFit="contain" style={styles.mascot} />
              </Animated.View>
              <View style={styles.headerText}>
                <AppText variant="small" style={styles.counter}>
                  Step {step + 1} of {STEPS.length}
                </AppText>
                <AppText variant="h3" accessibilityRole="header">{current.title}</AppText>
              </View>
            </View>
            <AppText style={styles.body}>{current.body}</AppText>

            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {STEPS.map((_, index) => (
                <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
              ))}
            </View>

            <PrimaryButton title={isLast ? 'Start tracking' : step === 0 ? 'Show me around' : 'Next'} onPress={next} hideTrailingIcon={isLast} />

            <View style={styles.footer}>
              {step > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Previous step" onPress={onBack} hitSlop={10}>
                  <AppText variant="bodyMedium" style={styles.link}>Back</AppText>
                </Pressable>
              ) : <View />}
              {!isLast ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Skip tour" onPress={onSkip} hitSlop={10}>
                  <AppText variant="bodyMedium" style={[styles.link, { color: colors.muted }]}>Skip tour</AppText>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const SPOT_MOVE_MS = 420;
const PULSE_MS = 1500;
/** How far, in px, the pulse ripples out past the spotlight edge. */
const PULSE_GROWTH = 18;

/**
 * The dimmed screen with a hole over the current control. The hole glides
 * between steps, and grows out of the screen centre on the first one, instead
 * of jumping; a soft ring ripples outward to draw the eye to it.
 */
function Spotlight({ spot }: { spot: (Rect & { radius: number }) | null }) {
  const styles = useStyles();
  const window = useWindowDimensions();
  const reduced = useReducedMotion();
  // No target collapses the hole to a point at the centre, fully dimming the
  // screen while still giving the next step somewhere to grow from.
  const target = spot ?? { x: window.width / 2, y: window.height / 2, width: 0, height: 0, radius: 0 };
  // The dim layer is one view whose huge border surrounds the hole, so its
  // inner edge follows the hole's rounded shape exactly.
  const border = Math.max(window.width, window.height) * 2;

  const x = useSharedValue(window.width / 2);
  const y = useSharedValue(window.height / 2);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const radius = useSharedValue(0);
  const visible = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const move = (value: typeof x, to: number) => {
      value.value = reduced ? to : withTiming(to, { duration: SPOT_MOVE_MS, easing: Easing.inOut(Easing.cubic) });
    };
    move(x, target.x);
    move(y, target.y);
    move(width, target.width);
    move(height, target.height);
    move(radius, target.radius);
    move(visible, spot ? 1 : 0);
  }, [height, radius, reduced, spot, target.height, target.radius, target.width, target.x, target.y, visible, width, x, y]);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);

  const dimStyle = useAnimatedStyle(() => ({
    left: x.value - border,
    top: y.value - border,
    width: width.value + border * 2,
    height: height.value + border * 2,
    borderRadius: radius.value + border,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderRadius: radius.value,
    opacity: visible.value,
  }));
  // Scaled per axis so the ripple grows the same distance on every side,
  // whether the hole is a small circle or the wide summary card.
  const pulseStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderRadius: radius.value,
    opacity: visible.value * (1 - pulse.value) * 0.9,
    transform: [
      { scaleX: 1 + (pulse.value * PULSE_GROWTH * 2) / Math.max(width.value, 1) },
      { scaleY: 1 + (pulse.value * PULSE_GROWTH * 2) / Math.max(height.value, 1) },
    ],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.dimFrame, { borderWidth: border }, dimStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ring, pulseStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  dim: { position: 'absolute', backgroundColor: 'rgba(10, 22, 15, 0.62)' },
  dimFrame: { position: 'absolute', borderColor: 'rgba(10, 22, 15, 0.62)' },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.lightGreen,
  },
  card: {
    position: 'absolute',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
    ...shadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  mascot: { width: 64, height: 64 },
  counter: { color: colors.muted },
  body: { color: colors.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pale },
  dotActive: { width: 18, backgroundColor: colors.deepForest },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  link: { color: colors.forest },
}));
