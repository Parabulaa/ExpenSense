import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/motion';
import { AppText } from '@/components/common/ui';
import { colors, radii } from '@/constants/theme';
import { selectionFeedback } from '@/lib/haptics';

const STEPS = [100, 200, 500, 1000];
/** The largest amount any field accepts (₱9,999,999.99). */
const MAX_PESOS = 9_999_999.99;

/** Adds pesos to a typed amount, keeping any centavos: "1000" + 1000 → "2000", "12.50" + 100 → "112.50". */
export function addToAmount(value: string, pesos: number) {
  const current = Number(value.replace(/,/g, '')) || 0;
  const next = Math.min(MAX_PESOS, Math.round((current + pesos) * 100) / 100);
  return Number.isInteger(next) ? String(next) : next.toFixed(2);
}

/**
 * Quick-add buttons for every amount field. They add to what is already there
 * instead of replacing it, so ₱1,000 tapped four times on top of 1000 gives
 * 5000 — no retyping.
 */
export function AmountChips({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.row}>
      {STEPS.map((step) => (
        <PressableScale
          key={step}
          accessibilityRole="button"
          accessibilityLabel={`Add ${step} pesos`}
          onPress={() => { selectionFeedback(); onChange(addToAmount(value, step)); }}
          style={styles.chip}
        >
          <AppText variant="small" numberOfLines={1} adjustsFontSizeToFit style={styles.text}>+₱{step.toLocaleString('en-PH')}</AppText>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, minHeight: 40, paddingHorizontal: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lightGreen, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.deepForest, fontFamily: 'JakartaSemiBold' },
});
