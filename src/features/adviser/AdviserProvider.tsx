import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, AppText } from '@/components/common/ui';
import { radii, shadow, spacing } from '@/constants/theme';
import { adviserFacts, adviserPersona, adviserSeed, reactionFacts, type AdviserPersona } from '@/features/adviser/personas';
import { analyticsForMonth, previousMonth } from '@/features/analytics/analytics';
import { mascotImage, type MascotMood } from '@/features/analytics/mascot-mood';
import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import type { Expense } from '@/features/expenses/types';
import { todayLocalDate } from '@/features/expenses/validation';
import { makeStyles, useAdaptiveColor, useColors } from '@/features/settings/ThemeProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { warningFeedback } from '@/lib/haptics';

const VISIBLE_MS = 4800;

/** The chosen persona plus this month's facts, shared by every adviser surface. */
export function useAdviser(month = todayLocalDate().slice(0, 7)) {
  const { settings, updateSettings } = useSettings();
  const { expenses } = useExpenses();
  const { allCategories } = useCategories();
  const { budgets } = useBudgets();
  const persona = adviserPersona(settings.adviserPersona);
  const budget = budgets.find((item) => item.month === month);
  const current = useMemo(() => analyticsForMonth(expenses, allCategories, month), [allCategories, expenses, month]);
  const previous = useMemo(() => analyticsForMonth(expenses, allCategories, previousMonth(month)), [allCategories, expenses, month]);
  const facts = useMemo(() => adviserFacts({ current, previous, categories: allCategories, budget, today: todayLocalDate() }), [allCategories, budget, current, previous]);
  return { persona, facts, current, previous, budget, setPersona: (id: AdviserPersona['id']) => updateSettings({ adviserPersona: id }) };
}

type Reaction = { key: number; persona: AdviserPersona; text: string; mood: MascotMood };
type ReactionInput = Pick<Expense, 'id' | 'amountCents' | 'merchant' | 'categoryId' | 'transactionDate'>;

const AdviserReactionContext = createContext<{ reactToExpense: (expense: ReactionInput) => void } | null>(null);

/**
 * The adviser's one-line comment after an expense is saved. It floats above
 * whatever screen the save lands on and never blocks touches.
 */
export function AdviserReactionProvider({ children }: PropsWithChildren) {
  const { settings } = useSettings();
  const { expenses } = useExpenses();
  const { allCategories } = useCategories();
  const { budgets } = useBudgets();
  const [reaction, setReaction] = useState<Reaction | null>(null);

  const reactToExpense = useCallback((expense: ReactionInput) => {
    const persona = adviserPersona(settings.adviserPersona);
    // The plain voice already has the "Expense added" toast; it doesn't heckle.
    if (persona.id === 'classic') return;
    const facts = reactionFacts({ expense, expenses, categories: allCategories, budget: budgets.find((item) => item.month === expense.transactionDate.slice(0, 7)) });
    const mood: MascotMood = facts.pushedOver || facts.big ? 'warning' : facts.small ? 'success' : 'tip';
    if (mood === 'warning') warningFeedback();
    setReaction({ key: Date.now(), persona, text: persona.react(facts, adviserSeed(expense.amountCents)), mood });
  }, [allCategories, budgets, expenses, settings.adviserPersona]);

  const dismiss = useCallback((key: number) => setReaction((current) => (current?.key === key ? null : current)), []);
  const value = useMemo(() => ({ reactToExpense }), [reactToExpense]);

  return (
    <AdviserReactionContext.Provider value={value}>
      {children}
      {reaction ? <ReactionBubble key={reaction.key} reaction={reaction} onDismiss={dismiss} /> : null}
    </AdviserReactionContext.Provider>
  );
}

function ReactionBubble({ reaction, onDismiss }: { reaction: Reaction; onDismiss: (key: number) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { tint, ink } = useAdaptiveColor();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const hop = useSharedValue(1);
  const { key } = reaction;

  useEffect(() => {
    if (!reduced) {
      progress.value = withSpring(1, { damping: 14, stiffness: 170 });
      hop.value = withSequence(withTiming(1, { duration: 220 }), withTiming(1.14, { duration: 130 }), withSpring(1, { damping: 6, stiffness: 240 }));
    }
    const hide = setTimeout(() => {
      if (reduced) onDismiss(key);
      else progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    }, VISIBLE_MS);
    const remove = setTimeout(() => onDismiss(key), VISIBLE_MS + 240);
    return () => { clearTimeout(hide); clearTimeout(remove); };
  }, [hop, key, onDismiss, progress, reduced]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 40 }, { scale: 0.92 + progress.value * 0.08 }] }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: hop.value }, { rotate: `${(hop.value - 1) * -40}deg` }] }));

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: insets.bottom + 104 }]}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Pressable accessibilityRole="alert" accessibilityLabel={`${reaction.persona.name} says: ${reaction.text}. Tap to dismiss.`} onPress={() => onDismiss(key)} style={styles.row}>
          <Animated.View style={[styles.mascotWrap, mascotStyle]}>
            <Image source={mascotImage[reaction.mood]} contentFit="contain" style={styles.mascot} />
            <View style={[styles.badge, { backgroundColor: tint(reaction.persona.accent) }]}>
              <AppIcon name={reaction.persona.icon} size={14} color={ink('#173D2B')} />
            </View>
          </Animated.View>
          <View style={styles.bubble}>
            <AppText variant="small" style={[styles.name, { color: colors.muted }]}>{reaction.persona.name}</AppText>
            <AppText variant="bodyMedium">{reaction.text}</AppText>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function useAdviserReaction() {
  const context = useContext(AdviserReactionContext);
  if (!context) throw new Error('useAdviserReaction must be used within an AdviserReactionProvider');
  return context;
}

const useStyles = makeStyles((colors) => ({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
  card: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, ...shadow, shadowOpacity: 0.16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mascotWrap: { width: 64, height: 64 },
  mascot: { width: 64, height: 64 },
  badge: { position: 'absolute', right: -2, bottom: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  bubble: { flex: 1, gap: 2 },
  name: { fontFamily: 'JakartaBold', textTransform: 'uppercase', letterSpacing: 0.6 },
}));
