import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/ui';
import { colors, radii, shadow, spacing } from '@/constants/theme';

export type AuthDialogAction = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  /** Renders the action in the destructive tone. Only meaningful on the primary action. */
  destructive?: boolean;
};

export type AuthDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  primaryAction: AuthDialogAction;
  secondaryAction?: AuthDialogAction;
  tertiaryAction?: AuthDialogAction;
  onRequestClose?: () => void;
};

export function AuthDialog({
  visible,
  title,
  message,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onRequestClose,
}: AuthDialogProps) {
  // While an action is running the dialog must not be dismissable — backdrop
  // tap or hardware back would otherwise strand an in-flight request.
  const busy = Boolean(primaryAction.loading);
  const handleRequestClose = busy ? undefined : onRequestClose;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={s.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleRequestClose}
          disabled={busy}
          accessibilityLabel="Dismiss dialog"
        />
        <View style={s.card} accessibilityRole="alert" accessibilityViewIsModal>
          <AppText variant="h2" style={s.title}>{title}</AppText>
          <AppText style={s.message}>{message}</AppText>

          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
              accessibilityState={{ disabled: primaryAction.loading }}
              disabled={primaryAction.loading}
              onPress={primaryAction.onPress}
              style={({ pressed }) => [
                s.primaryButton,
                primaryAction.destructive && s.destructiveButton,
                pressed && s.pressed,
                primaryAction.loading && s.disabled,
              ]}
            >
              <AppText variant="button" style={s.primaryButtonText}>
                {primaryAction.loading ? 'Please wait…' : primaryAction.label}
              </AppText>
            </Pressable>

            {secondaryAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={secondaryAction.label}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={secondaryAction.onPress}
                style={({ pressed }) => [s.secondaryButton, pressed && s.pressed, busy && s.disabled]}
              >
                <AppText variant="button" style={s.secondaryButtonText}>{secondaryAction.label}</AppText>
              </Pressable>
            ) : null}

            {tertiaryAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tertiaryAction.label}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={tertiaryAction.onPress}
                hitSlop={8}
                style={({ pressed }) => [s.tertiaryButton, pressed && s.pressed, busy && s.disabled]}
              >
                <AppText variant="bodyMedium" style={s.tertiaryButtonText}>{tertiaryAction.label}</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    // Matches the elevation language used by Card across the app.
    ...shadow,
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg },
  actions: { gap: spacing.sm },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.deepForest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.surface },
  destructiveButton: { backgroundColor: colors.danger },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#C6D3C1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.deepForest },
  tertiaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tertiaryButtonText: { color: colors.muted },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
