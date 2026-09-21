import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadow } from '@/constants/theme';
import { AppIcon, AppText } from '@/components/common/ui';

const items = [
  { label: 'Home', icon: 'home', path: '/home' },
  { label: 'Transactions', icon: 'receipt-text-outline', path: '/transactions' },
  { label: 'Scan', icon: 'line-scan', path: '/add-expense', scan: true },
  { label: 'Analytics', icon: 'chart-bar', path: '/analytics' },
  { label: 'Budget', icon: 'wallet-outline', path: '/budget' },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.outer, { paddingBottom: bottomPadding }]} pointerEvents="box-none">
      <View style={styles.wrap}>
        {items.map(item => {
          const active = pathname === item.path || (item.label === 'Home' && pathname === '/categories');
          const isScan = 'scan' in item && item.scan;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => router.replace(item.path as never)}
              style={[styles.item, active && !isScan && styles.active, isScan && styles.scan]}
            >
              <AppIcon
                name={item.icon}
                size={isScan ? 28 : active ? 26 : 24}
                color={isScan ? colors.surface : active ? colors.deepForest : colors.muted}
              />
              {!isScan && (
                <AppText
                  variant="small"
                  style={[styles.label, active && styles.activeText]}
                  numberOfLines={1}
                >
                  {item.label}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  },
  wrap: {
    width: '100%',
    maxWidth: 430,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    ...shadow,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: radii.md,
    minWidth: 0,
  },
  active: {
    backgroundColor: '#E2EBDD',
  },
  scan: {
    flex: 0,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.deepForest,
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadow,
  },
  label: {
    color: colors.muted,
    fontFamily: 'JakartaMedium',
    fontSize: 10,
  },
  activeText: {
    color: colors.deepForest,
  },
});
