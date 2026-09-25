import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  disabled?: boolean;
  footer?: ReactNode;
  children: ReactNode | ((dismiss: () => void) => ReactNode);
};

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 850;

export function DraggableBottomSheet({ visible, onClose, disabled = false, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (visible) translateY.value = withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) });
  }, [translateY, visible]);

  const dismiss = () => {
    if (disabled) return;
    // Reanimated shared values are intentionally mutable animation state.
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(height, { duration: 230 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetY([-6, 6])
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = Math.max(-height * 0.16, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
      }
    });

  const baseBottomPadding = Math.max(insets.bottom, 12) + 14;
  const animatedStyle = useAnimatedStyle(() => ({
    // Pulling down moves the whole sheet. Pulling up extends its surface while
    // keeping the bottom edge attached to the viewport instead of exposing a gap.
    transform: [{ translateY: Math.max(0, translateY.value) }],
    paddingBottom: baseBottomPadding + Math.max(0, -translateY.value),
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      {/* A Modal is a separate native window on Android, so gestures inside it
          need their own root or the drag handle never receives touches. */}
      <GestureHandlerRootView style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={disabled} onPress={dismiss} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.9 }, animatedStyle]}>
          <GestureDetector gesture={pan}>
            <View accessibilityRole="adjustable" accessibilityLabel="Drag sheet" style={styles.handleTarget}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          {/* Scrolls when the content is taller than the sheet, so the last
              button is never hidden behind the system navigation bar. */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            {typeof children === 'function' ? children(dismiss) : children}
          </ScrollView>
          {footer}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, ...shadow },
  handleTarget: { height: 34, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 16 },
});
