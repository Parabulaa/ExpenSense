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
  route: '/profile' | '/notifications' | '/settings/help';
  right: number;
  top: number;
  originX: number;
  originY: number;
  /**
   * FAQ sits directly under the trigger, so a label to its left would run into
   * the Notifications button. It gets its label underneath instead.
   */
  labelBelow?: boolean;
};

const ACTIONS: MenuAction[] = [
  { label: 'Settings', icon: 'cog-outline', route: '/profile', right: 79, top: 4, originX: 70, originY: 3 },
  { label: 'Notifications', icon: 'bell-outline', route: '/notifications', right: 60, top: 50, originX: 51, originY: -43 },
  // `right` offsets the 60-wide column so the button stays centred under the trigger.
  { label: 'FAQ', icon: 'help-circle-outline', route: '/settings/help', right: 1, top: 74, originX: 0, originY: -67, labelBelow: true },
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
        {open ? <View pointerEvents="none" style={styles.connectors}>
          <View style={[styles.connector, styles.connectorSettings]} />
          <View style={[styles.connector, styles.connectorNotifications]} />
          <View style={[styles.connector, styles.connectorFaq]} />
        </View> : null}
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
      { translateX: interpolate(progress.value, [0, 1], [action.originX, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [action.originY, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.54, 1]) },
    ],
  }));

  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[action.labelBelow ? styles.actionWrapBelow : styles.actionWrap, { right: action.right, top: action.top }, animatedStyle]}>
      {action.labelBelow ? null : <AppText variant="small" numberOfLines={1} style={styles.actionLabel}>{action.label}</AppText>}
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
      {action.labelBelow ? <AppText variant="small" numberOfLines={1} style={styles.actionLabel}>{action.label}</AppText> : null}
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
    width: 224,
    height: 144,
    zIndex: 40,
  },
  trigger: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,247,.97)',
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    zIndex: 2,
    ...shadow,
  },
  triggerOpen: {
    backgroundColor: colors.deepForest,
    borderColor: colors.deepForest,
  },
  actionWrap: {
    position: 'absolute',
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    zIndex: 2,
  },
  actionWrapBelow: {
    position: 'absolute',
    width: 60,
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  actionLabel: {
    maxWidth: 96,
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
    width: 44,
    height: 44,
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
  connectors: { ...StyleSheet.absoluteFill },
  connector: { position: 'absolute', height: 1.5, borderRadius: 1, backgroundColor: 'rgba(77,112,82,.52)' },
  connectorSettings: { left: 145, top: 25, width: 21 },
  // Spans from the bell's edge to the trigger's edge along the line between their centres.
  connectorNotifications: { left: 153, top: 51, width: 25, transform: [{ rotate: '-40deg' }] },
  connectorFaq: { left: 192, top: 56, width: 1.5, height: 18 },
});
