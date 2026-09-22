import { router, usePathname } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '@/constants/theme';
import { AppIcon, AppText } from '@/components/common/ui';
import { PressableScale } from '@/components/common/motion';

const items = [
  { label: 'Home', icon: 'home', path: '/home' },
  { label: 'Transactions', icon: 'receipt-text-outline', path: '/transactions' },
  { label: 'Scan', icon: 'line-scan', path: '/add-expense', scan: true },
  { label: 'Analytics', icon: 'chart-bar', path: '/analytics' },
  { label: 'Budget', icon: 'wallet-outline', path: '/budget' },
] as const;

/** Height of the floating bar itself, excluding the safe-area gutter below it. */
export const BOTTOM_NAV_HEIGHT = 82;
/** Floor for the gutter on devices that report no bottom inset (web, older Android). */
const MIN_BOTTOM_GUTTER = 8;
/** Breathing room between the last piece of content and the bar. */
const CONTENT_CLEARANCE = 16;

/**
 * Scroll-content inset that keeps content clear of the floating bar. Derived
 * from the bar's real height plus the device's safe area, so it stays correct
 * on a gesture-nav phone and on web instead of being a hand-tuned number.
 */
export function useBottomNavInset() {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_GUTTER) + CONTENT_CLEARANCE;
}

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_GUTTER);
  const navigationWidth = Math.max(0, Math.min(452, width - 20));
  const itemWidth = (navigationWidth - 14) / items.length;

  return (
    <View style={[styles.outer, { paddingBottom: bottomPadding }]} pointerEvents="box-none">
      <View style={[styles.wrap, { width: navigationWidth }]}>
        {items.map(item => {
          const active = pathname === item.path || (item.label === 'Home' && pathname === '/categories') || (item.label === 'Analytics' && pathname === '/insights');
          const isScan = 'scan' in item && item.scan;
          return (
            <PressableScale
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                if (isScan) {
                  router.push({ pathname: '/add-expense', params: { returnTo: pathname } } as never);
                  return;
                }
                router.replace(item.path as never);
              }}
              scaleTo={isScan ? 0.92 : 0.94}
              style={[
                styles.item,
                { width: itemWidth },
                active && !isScan && styles.active,
                isScan && styles.scanItem,
              ]}
            >
              {isScan ? (
                <View style={styles.scanButton}>
                  <AppIcon name={item.icon} size={30} color={colors.surface} />
                </View>
              ) : (
                <AppIcon
                  name={item.icon}
                  size={active ? 26 : 24}
                  color={active ? colors.deepForest : colors.muted}
                />
              )}
              <AppText
                variant="small"
                style={[styles.label, active && styles.activeText, isScan && styles.scanLabel]}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
            </PressableScale>
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
    paddingHorizontal: 10,
    pointerEvents: 'box-none',
  },
  wrap: {
    boxSizing: 'border-box',
    maxWidth: 452,
    height: BOTTOM_NAV_HEIGHT,
    borderRadius: 30,
    backgroundColor: 'rgba(255,253,247,.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 7,
    ...shadow,
  },
  item: {
    boxSizing: 'border-box',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    // Every horizontal pixel here comes out of the label's width, so the tab
    // keeps only enough inset to round its active background.
    paddingHorizontal: 1,
    borderRadius: 20,
    minWidth: 0,
  },
  active: {
    backgroundColor: '#E2EBDD',
  },
  scanItem: {
    marginTop: -28,
    paddingTop: 0,
    gap: 1,
  },
  scanButton: {
    boxSizing: 'border-box',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.deepForest,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  label: {
    color: colors.muted,
    fontFamily: 'JakartaMedium',
    // "Transactions" is the longest tab label; at this size it fits a 320px
    // screen without being truncated to "Transacti...".
    fontSize: 9.5,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  activeText: {
    color: colors.deepForest,
  },
  scanLabel: {
    color: colors.muted,
    marginTop: 1,
  },
});
