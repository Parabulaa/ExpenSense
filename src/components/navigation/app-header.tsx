import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/motion';
import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii, shadow } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useProfile } from '@/features/profile/ProfileProvider';

function HeaderAction({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      scaleTo={0.94}
      style={hovered ? [s.action, s.actionHovered] : s.action}
    >
      <AppIcon name={icon} size={24} color={colors.deepForest} />
      {badge ? <View style={s.badge} accessibilityElementsHidden /> : null}
    </PressableScale>
  );
}

/**
 * The persistent top bar for the authenticated app: identity on the left,
 * help and alerts on the right. Every main panel renders the same component so
 * the controls never shift position between screens.
 */
export function AppHeader() {
  const { initials, displayName } = useProfile();
  const { unreadCount } = useNotifications();
  const [hovered, setHovered] = useState(false);

  return (
    <View style={s.bar}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Profile and settings for ${displayName}`}
        onPress={() => router.push('/profile')}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        scaleTo={0.94}
        style={hovered ? [s.avatar, s.avatarHovered] : s.avatar}
      >
        <AppText variant="h3" style={s.avatarText}>{initials}</AppText>
      </PressableScale>

      <View style={s.actions}>
        <HeaderAction icon="help-circle-outline" label="Help and guide" onPress={() => router.push('/settings/help')} />
        <HeaderAction
          icon="bell-outline"
          label="Notifications"
          badge={unreadCount}
          onPress={() => router.push('/notifications')}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  // All three controls sit on their own surface with an outline: the organic
  // background runs right under this bar, and a bare icon disappears against a
  // dark shape.
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DDEBDD',
    borderWidth: 1.5,
    borderColor: colors.softGreen,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  avatarHovered: { backgroundColor: '#CFE2C9', borderColor: colors.forest },
  avatarText: { color: colors.deepForest },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,253,247,.97)',
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  actionHovered: { backgroundColor: colors.pale, borderColor: colors.forest },
  badge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    // Matches the button surface it sits on so the dot reads as a badge.
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
