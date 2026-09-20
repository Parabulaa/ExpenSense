import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, shadow } from '@/constants/theme';
import { AppText } from '@/components/common/ui';

const items = [
  { label: 'Home', icon: '⌂', path: '/home' }, { label: 'Transactions', icon: '▤', path: '/transactions' },
  { label: 'Scan', icon: '⌗', path: '/add-expense', scan: true }, { label: 'Analytics', icon: '▥', path: '/analytics' },
  { label: 'Budget', icon: '◔', path: '/budget' },
] as const;
export function BottomNavigation() {
  const pathname = usePathname();
  return <View style={styles.wrap}>{items.map(item => {
    const active = pathname === item.path || (item.label === 'Home' && pathname === '/categories');
    const isScan = 'scan' in item && item.scan;
    return <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => router.replace(item.path as never)} style={[styles.item, active && !isScan && styles.active, isScan && styles.scan]}>
      <AppText variant={isScan ? 'h2' : 'h3'} style={[styles.icon, (active || isScan) && styles.activeText]}>{item.icon}</AppText>
      <AppText variant="small" style={[styles.label, active && styles.activeText]}>{item.label}</AppText>
    </Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, bottom: 10, height: 78, borderRadius: 28, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, ...shadow },
  item: { width: 68, height: 62, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', gap: 1 }, active: { backgroundColor: '#E2EBDD' },
  scan: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.deepForest, marginTop: -35, borderWidth: 4, borderColor: colors.surface, ...shadow },
  icon: { color: colors.muted, fontSize: 24, lineHeight: 27 }, label: { color: colors.muted, fontFamily: 'JakartaMedium', fontSize: 10 }, activeText: { color: colors.deepForest },
});
