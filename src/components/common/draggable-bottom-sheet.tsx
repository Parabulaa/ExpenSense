import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
    if (visible) translateY.value = withSpring(0, { damping: 22, stiffness: 230 });
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
      translateY.value = Math.max(-28, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 250 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={disabled} onPress={dismiss} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: Math.max(insets.bottom, 12) + 14 }, animatedStyle]}>
          <GestureDetector gesture={pan}>
            <View accessibilityRole="adjustable" accessibilityLabel="Drag sheet" style={styles.handleTarget}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          <View style={styles.content}>{typeof children === 'function' ? children(dismiss) : children}</View>
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, ...shadow },
  handleTarget: { height: 34, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF' },
  content: { gap: 16 },
});
