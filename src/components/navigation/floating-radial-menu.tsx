import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/common/motion';
import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii, shadow } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { selectionFeedback } from '@/lib/haptics';

type IconName = Parameters<typeof AppIcon>[0]['name'];

type MenuAction = {
  label: string;
  icon: IconName;
  route: '/settings/account' | '/notifications' | '/settings/help';
  x: number;
  y: number;
};

const ACTIONS: MenuAction[] = [
  { label: 'Account', icon: 'account-outline', route: '/settings/account', x: 24, y: 6 },
  { label: 'Notifications', icon: 'bell-outline', route: '/notifications', x: 0, y: 64 },
  { label: 'FAQ', icon: 'help-circle-outline', route: '/settings/help', x: 35, y: 122 },
];

export function FloatingRadialMenu() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const choose = (action: MenuAction) => {
    selectionFeedback();
    setOpen(false);
    router.push(action.route);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Pressable
          accessibilityLabel="Close quick menu"
          onPress={() => setOpen(false)}
          style={styles.backdrop}
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 4 }]}>
        {ACTIONS.map((action, index) => (
          <RadialAction
            action={action}
            badge={action.label === 'Notifications' ? unreadCount : 0}
            index={index}
            key={action.label}
            open={open}
            onPress={() => choose(action)}
          />
        ))}

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close quick menu' : 'Open quick menu'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          scaleTo={0.93}
          style={[styles.trigger, open && styles.triggerOpen]}
        >
          <AppIcon name={open ? 'close' : 'dots-grid'} size={24} color={open ? colors.surface : colors.deepForest} />
        </PressableScale>
      </View>
    </View>
  );
}

function RadialAction({ action, badge, index, open, onPress }: { action: MenuAction; badge: number; index: number; open: boolean; onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = open ? 1 : 0;
      return;
    }
    progress.value = open
      ? withDelay(index * 42, withSpring(1, { damping: 17, stiffness: 205, mass: 0.72 }))
      : withTiming(0, { duration: 125 });
  }, [index, open, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [182 - action.x, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [10 - action.y, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.54, 1]) },
    ],
  }));

  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.actionWrap, { left: action.x, top: action.y }, animatedStyle]}>
      <AppText variant="small" numberOfLines={1} style={styles.actionLabel}>{action.label}</AppText>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={badge ? `${action.label}, ${badge} unread` : action.label}
        onPress={onPress}
        scaleTo={0.91}
        style={styles.action}
      >
        <AppIcon name={action.icon} size={21} color={colors.deepForest} />
        {badge ? <View style={styles.badge}><AppText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</AppText></View> : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 34, 25, 0.12)',
  },
  host: {
    position: 'absolute',
    right: 12,
    width: 210,
    height: 180,
    zIndex: 40,
  },
  trigger: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,247,.97)',
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    ...shadow,
  },
  triggerOpen: {
    backgroundColor: colors.deepForest,
    borderColor: colors.deepForest,
  },
  actionWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  actionLabel: {
    maxWidth: 88,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
    color: colors.deepForest,
    backgroundColor: 'rgba(255,253,247,.92)',
    fontFamily: 'JakartaSemiBold',
    fontSize: 10,
    lineHeight: 14,
  },
  action: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,247,.98)',
    borderWidth: 1,
    borderColor: '#CAD6C5',
    ...shadow,
  },
  badge: {
    position: 'absolute',
    right: -3,
    top: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.surface, fontSize: 8, lineHeight: 10, fontFamily: 'JakartaBold' },
});
