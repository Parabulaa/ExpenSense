import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/motion';
import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii } from '@/constants/theme';
import { selectionFeedback } from '@/lib/haptics';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * Hour / minute steppers with an AM–PM switch. Built from plain primitives so
 * it behaves the same on iOS, Android and web, and always yields `HH:MM`.
 */
export function TimeSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hours24, minutes] = value.split(':').map(Number);
  const safeHours = Number.isFinite(hours24) ? hours24 : 12;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const pm = safeHours >= 12;
  const hours12 = safeHours % 12 || 12;

  const set = (nextHours: number, nextMinutes: number) => {
    selectionFeedback();
    onChange(`${pad(((nextHours % 24) + 24) % 24)}:${pad(((nextMinutes % 60) + 60) % 60)}`);
  };
  const stepHour = (delta: number) => set(safeHours + delta, safeMinutes);
  const stepMinute = (delta: number) => set(safeHours, safeMinutes + delta);
  const setMeridiem = (toPm: boolean) => { if (toPm !== pm) set(safeHours + (toPm ? 12 : -12), safeMinutes); };

  return (
    <View style={styles.row} accessibilityLabel={`Time ${hours12}:${pad(safeMinutes)} ${pm ? 'PM' : 'AM'}`}>
      <Stepper label="Hour" display={String(hours12)} onDown={() => stepHour(-1)} onUp={() => stepHour(1)} />
      <AppText variant="h2" style={styles.colon}>:</AppText>
      <Stepper label="Minute" display={pad(safeMinutes)} onDown={() => stepMinute(-5)} onUp={() => stepMinute(5)} />
      <View style={styles.meridiem}>
        {(['AM', 'PM'] as const).map((option) => {
          const active = (option === 'PM') === pm;
          return (
            <PressableScale key={option} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setMeridiem(option === 'PM')} style={[styles.meridiemOption, active && styles.meridiemActive]}>
              <AppText variant="small" style={active ? styles.meridiemActiveText : styles.meridiemText}>{option}</AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Stepper({ label, display, onDown, onUp }: { label: string; display: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={styles.stepper}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label} up`} hitSlop={6} onPress={onUp} style={styles.stepButton}>
        <AppIcon name="chevron-up" size={20} color={colors.deepForest} />
      </PressableScale>
      <AppText variant="h2" style={styles.value}>{display}</AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label} down`} hitSlop={6} onPress={onDown} style={styles.stepButton}>
        <AppIcon name="chevron-down" size={20} color={colors.deepForest} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  colon: { marginTop: -2 },
  stepper: { alignItems: 'center', gap: 2 },
  stepButton: { width: 44, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  value: { minWidth: 44, textAlign: 'center' },
  meridiem: { marginLeft: 8, gap: 6 },
  meridiemOption: { minWidth: 52, minHeight: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lightGreen, backgroundColor: colors.surface },
  meridiemActive: { backgroundColor: colors.deepForest, borderColor: colors.deepForest },
  meridiemText: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
  meridiemActiveText: { color: colors.surface, fontFamily: 'JakartaSemiBold' },
});
