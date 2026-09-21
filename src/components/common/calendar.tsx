import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii } from '@/constants/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number) {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Month-grid date picker built from plain primitives, so the same calendar
 * works on web (where the community date picker is native-only) without
 * pulling in another dependency.
 */
export function Calendar({
  value,
  maxDate,
  onSelect,
}: {
  /** Selected date as YYYY-MM-DD. */
  value: string;
  /** Latest selectable date as YYYY-MM-DD. Later days render disabled. */
  maxDate?: string;
  onSelect: (date: string) => void;
}) {
  const [year, month] = useMemo(() => {
    const [y, m] = value.split('-').map(Number);
    return Number.isFinite(y) && Number.isFinite(m) ? [y, m - 1] : [new Date().getFullYear(), new Date().getMonth()];
  }, [value]);

  const [visible, setVisible] = useState({ year, month });

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(
        new Date(visible.year, visible.month, 1),
      ),
    [visible],
  );

  const leadingBlanks = new Date(visible.year, visible.month, 1).getDay();
  const totalDays = daysInMonth(visible.year, visible.month);
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  // Pad the final row so the grid keeps a stable shape between months.
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => {
    setVisible((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  // Disable forward navigation once the visible month already contains maxDate.
  const nextMonthStart = toLocalDate(
    new Date(visible.year, visible.month + 1, 1).getFullYear(),
    new Date(visible.year, visible.month + 1, 1).getMonth(),
    1,
  );
  const canGoForward = !maxDate || nextMonthStart <= maxDate;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          onPress={() => step(-1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <AppIcon name="chevron-left" size={22} color={colors.deepForest} />
        </Pressable>

        <AppText variant="h3" style={styles.monthLabel}>{monthLabel}</AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          hitSlop={8}
          onPress={() => step(1)}
          style={({ pressed }) => [
            styles.navButton,
            !canGoForward && styles.navButtonDisabled,
            pressed && canGoForward && styles.pressed,
          ]}
        >
          <AppIcon name="chevron-right" size={22} color={canGoForward ? colors.deepForest : colors.lightGreen} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.cell}>
            <AppText variant="small" style={styles.weekday}>{label}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

          const date = toLocalDate(visible.year, visible.month, day);
          const selected = date === value;
          const disabled = maxDate ? date > maxDate : false;

          return (
            <View key={date} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={date}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onSelect(date)}
                style={({ pressed }) => [
                  styles.day,
                  selected && styles.daySelected,
                  pressed && !disabled && !selected && styles.dayPressed,
                ]}
              >
                <AppText
                  variant="bodyMedium"
                  style={[
                    styles.dayText,
                    selected && styles.dayTextSelected,
                    disabled && styles.dayTextDisabled,
                  ]}
                >
                  {day}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  navButtonDisabled: { backgroundColor: 'transparent' },
  monthLabel: { flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { color: colors.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  day: {
    width: '100%',
    height: '100%',
    maxWidth: 42,
    maxHeight: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.deepForest },
  dayPressed: { backgroundColor: colors.pale },
  dayText: { color: colors.text },
  dayTextSelected: { color: colors.surface, fontFamily: 'JakartaBold' },
  dayTextDisabled: { color: '#B6C2BA' },
  pressed: { opacity: 0.7 },
});
