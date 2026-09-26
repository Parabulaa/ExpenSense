import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DraggableBottomSheet } from '@/components/common/draggable-bottom-sheet';
import { AppIcon, AppText, PrimaryButton, SecondaryButton } from '@/components/common/ui';
import { colors, radii } from '@/constants/theme';
import type { InsightDetail } from './insight-details';
import { mascotImage } from './mascot-mood';

/**
 * Opening an insight or alert explains it: the numbers behind it, what they
 * mean, and concrete next steps — instead of dropping the user on another screen.
 */
export function InsightDetailSheet({ detail, onClose }: { detail: InsightDetail | null; onClose: () => void }) {
  const toneColor = detail?.tone === 'critical' ? colors.danger : detail?.tone === 'warning' ? colors.warning : colors.deepForest;
  const toneBackground = detail?.tone === 'critical' ? colors.dangerSoft : detail?.tone === 'warning' ? colors.warningSoft : colors.pale;
  return (
    <DraggableBottomSheet visible={Boolean(detail)} onClose={onClose}>{(dismiss) => detail ? <>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: toneBackground }]}><AppIcon name={detail.icon} size={24} color={toneColor} /></View>
        <View style={styles.headerCopy}>
          <AppText variant="h2" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{detail.title}</AppText>
          <AppText style={styles.muted}>{detail.headline}</AppText>
        </View>
        {/* Worried for a problem, a tip for everything else. */}
        <Image source={mascotImage[detail.tone === 'info' ? 'tip' : 'warning']} contentFit="contain" style={styles.mascot} />
      </View>

      {detail.stats.length ? (
        <View style={styles.stats}>
          {detail.stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <AppText variant="small" style={styles.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{stat.label}</AppText>
              <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{stat.value}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {detail.tips.length ? (
        <View style={styles.tips}>
          <AppText variant="h3">What you can do</AppText>
          {detail.tips.map((tip) => (
            <View key={tip} style={styles.tip}>
              <AppIcon name="lightbulb-on-outline" size={18} color={colors.forest} />
              <AppText style={styles.tipText}>{tip}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {detail.actions.map((action, index) => {
        const go = () => { dismiss(); requestAnimationFrame(() => router.push({ pathname: action.pathname, params: action.params } as never)); };
        return index === 0
          ? <PrimaryButton key={action.label} title={action.label} onPress={go} />
          : <SecondaryButton key={action.label} title={action.label} onPress={go} />;
      })}
    </> : null}</DraggableBottomSheet>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  mascot: { width: 64, height: 64, marginTop: -6 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '48%', flexGrow: 1, minWidth: 0, gap: 2, padding: 12, borderRadius: radii.md, backgroundColor: colors.pale },
  tips: { gap: 10 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, minWidth: 0 },
});
