import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/common/motion';
import { AppIcon, AppText } from '@/components/common/ui';
import { radii, spacing } from '@/constants/theme';
import { chat, type ChatContext, type ChatMemory } from '@/features/adviser/chatbot/engine';
import { loadLearnedExamples, teach } from '@/features/adviser/chatbot/learning';
import type { Intent } from '@/features/adviser/chatbot/training-data';
import { withIntensity } from '@/features/adviser/intensity';
import { adviserSeed, isHarshSituation, type AdviserIntensity, type AdviserPersona } from '@/features/adviser/personas';
import { PersonaMascot } from '@/features/adviser/PersonaMascot';
import type { MascotMood } from '@/features/analytics/mascot-mood';
import { makeStyles, useColors } from '@/features/settings/ThemeProvider';
import { selectionFeedback, successFeedback, warningFeedback } from '@/lib/haptics';

type Message = { id: number; role: 'user' | 'adviser'; text: string };
type Choice = { label: string; intent?: Intent };

/** How long each persona "types" before a bubble appears. */
const TYPING_MS: Record<AdviserPersona['id'], number> = { classic: 450, mom: 750, chill: 1000, bestie: 500, sergeant: 300, butler: 1200, sensei: 1100 };

/** `compact` drops the header and scrolls the thread, for the Home sheet. */
export function AdviserChat({ persona, context, intensity, compact = false }: { persona: AdviserPersona; context: ChatContext; intensity: AdviserIntensity; compact?: boolean }) {
  const colors = useColors();
  const s = useStyles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [mood, setMood] = useState<MascotMood>('tip');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [question, setQuestion] = useState('');
  const memory = useRef<ChatMemory>({});
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastQuestion = useRef('');
  const scroller = useRef<ScrollView>(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  /** Shows bubbles one at a time, with typing dots before each. */
  const deliver = (bubbles: string[], nextMood: MascotMood, nextChoices: Choice[]) => {
    clearTimers();
    let at = 0;
    bubbles.forEach((text, index) => {
      const typingFor = Math.min(1600, TYPING_MS[persona.id] + text.length * 8);
      timers.current.push(setTimeout(() => setTyping(true), at));
      at += typingFor;
      timers.current.push(setTimeout(() => {
        setTyping(false);
        if (index === 0) {
          setMood(nextMood);
          if (nextMood === 'warning') warningFeedback(); else if (nextMood === 'success') successFeedback();
        }
        setMessages((items) => [...items.slice(-20), { id: (nextId.current += 1), role: 'adviser', text }]);
      }, at));
      at += 220;
    });
    timers.current.push(setTimeout(() => setChoices(nextChoices), at));
  };

  // The adviser opens the conversation itself. The screen remounts this
  // component per persona, so switching advisers starts a fresh chat.
  useEffect(() => {
    void loadLearnedExamples();
    const opener = chat('hello', context, {}, persona.id, adviserSeed(), undefined, intensity);
    const headline = withIntensity(persona.say(context.facts, adviserSeed()), persona.id, intensity, isHarshSituation(context.facts.situation), adviserSeed());
    deliver([headline, ...opener.bubbles.slice(0, 1)], opener.mood, opener.suggestions.map((label) => ({ label })));
    return clearTimers;
    // Runs once on mount; later data changes don't restart the conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (text: string, forced?: Intent) => {
    const value = text.trim();
    if (!value || typing) return;
    Keyboard.dismiss();
    selectionFeedback();
    lastQuestion.current = forced ? lastQuestion.current : value;
    setMessages((items) => [...items.slice(-20), { id: (nextId.current += 1), role: 'user', text: value }]);
    setQuestion('');
    setChoices([]);
    const reply = chat(forced ? lastQuestion.current : value, context, memory.current, persona.id, adviserSeed(nextId.current), forced, intensity);
    memory.current = reply.memory;
    deliver(reply.bubbles, reply.mood, reply.didYouMean?.length ? reply.didYouMean : reply.suggestions.map((label) => ({ label })));
  };

  const pickChoice = (choice: Choice) => {
    // A "Did you mean" tap teaches the classifier what the user meant.
    if (choice.intent && lastQuestion.current) teach(choice.intent, lastQuestion.current);
    send(choice.label, choice.intent);
  };

  return (
    <View style={s.wrap}>
      {compact ? null : <View style={s.header}>
        <PersonaMascot persona={persona.id} mood={mood} size={52} />
        <View style={{ flex: 1 }}>
          <AppText variant="h3">Chat with {persona.id === 'classic' ? 'your adviser' : persona.name}</AppText>
          {typing ? <AppText variant="small" style={s.status}>typing…</AppText> : null}
        </View>
      </View>}

      <ScrollView ref={scroller} style={compact ? s.compactThread : undefined} contentContainerStyle={s.thread} keyboardShouldPersistTaps="handled" scrollEnabled={compact} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {messages.map((message) => (
          <Animated.View key={message.id} entering={(message.role === 'user' ? FadeInUp : FadeInDown).duration(220).springify().damping(16)} layout={LinearTransition} style={[s.bubble, message.role === 'user' ? s.user : s.adviser]}>
            <AppText style={message.role === 'user' ? s.userText : s.adviserText}>{message.text}</AppText>
          </Animated.View>
        ))}
        {typing ? <TypingDots /> : null}
      </ScrollView>

      {choices.length ? (
        <Animated.View entering={FadeInDown.duration(220)} style={s.chips}>
          {choices.map((choice) => (
            <PressableScale key={choice.label} accessibilityRole="button" onPress={() => pickChoice(choice)} style={choice.intent ? [s.chip, s.chipGuess] : s.chip}>
              <AppText variant="small" style={s.chipText}>{choice.label}</AppText>
            </PressableScale>
          ))}
        </Animated.View>
      ) : null}

      <View style={s.inputRow}>
        <TextInput value={question} onChangeText={setQuestion} onSubmitEditing={() => send(question)} returnKeyType="send" placeholder="Can I afford ₱2,000 shoes?" placeholderTextColor={colors.muted} style={s.input} accessibilityLabel={`Message ${persona.name}`} />
        <PressableScale accessibilityRole="button" accessibilityLabel="Send message" onPress={() => send(question)} style={[s.send, (!question.trim() || typing) && { opacity: 0.5 }]}>
          <AppIcon name="send" size={20} color={colors.surface} />
        </PressableScale>
      </View>
    </View>
  );
}

function TypingDots() {
  const s = useStyles();
  return (
    <Animated.View entering={FadeInDown.duration(160)} style={[s.bubble, s.adviser, s.dots]} accessibilityLabel="Adviser is typing">
      {[0, 1, 2].map((index) => <Dot key={index} delay={index * 140} />)}
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const s = useStyles();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduced) y.value = withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 260 }), withTiming(0, { duration: 260 })), -1));
  }, [delay, reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[s.dot, style]} />;
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  status: { color: colors.muted },
  thread: { gap: 6, minHeight: 60 },
  compactThread: { maxHeight: 330, minHeight: 180 },
  bubble: { maxWidth: '86%', borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.deepForest, borderBottomRightRadius: 6 },
  adviser: { alignSelf: 'flex-start', backgroundColor: colors.pale, borderBottomLeftRadius: 6 },
  userText: { color: colors.surface },
  adviserText: { color: colors.text },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: 7, backgroundColor: colors.surface },
  chipGuess: { borderColor: colors.forest, borderStyle: 'dashed' },
  chipText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.pale, paddingHorizontal: spacing.md, color: colors.text, fontFamily: 'JakartaRegular', fontSize: 14 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.deepForest, alignItems: 'center', justifyContent: 'center' },
}));
