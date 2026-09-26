/* eslint-disable react-hooks/refs, react-hooks/immutability --
   The PanResponder callbacks only run on touch, never during render, and
   Reanimated shared values are mutable animation state by design. The React
   Compiler rules cannot see either, so they are relaxed for this file only. */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
/** px per ms — a quick flick down closes the sheet even over a short distance. */
const DISMISS_VELOCITY = 0.85;
const MAX_HEIGHT_RATIO = 0.9;

/**
 * Bottom sheet whose top handle resizes it: drag up to make it taller (up to
 * 90% of the screen), drag down to shrink it again, and keep going down to
 * close it. The handle uses React Native's own PanResponder rather than the
 * gesture-handler library, because a Modal is a separate native window on
 * Android and library gestures inside it never receive touches.
 */
export function DraggableBottomSheet({ visible, onClose, disabled = false, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = height * MAX_HEIGHT_RATIO;
  const translateY = useSharedValue(height);
  /** Extra height added by dragging the handle up. */
  const lift = useSharedValue(0);
  /** Resting height of the sheet with no extra lift, measured on layout. */
  const restingHeight = useSharedValue(0);
  const dragStart = useRef({ lift: 0 });
  const latest = useRef({ disabled, onClose, height, maxHeight });
  useEffect(() => { latest.current = { disabled, onClose, height, maxHeight }; }, [disabled, height, maxHeight, onClose]);

  useEffect(() => {
    if (!visible) return;
    lift.value = 0;
    translateY.value = withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) });
  }, [lift, translateY, visible]);

  const dismiss = () => {
    if (disabled) return;
    translateY.value = withTiming(height, { duration: 230 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: (_, gesture) => !latest.current.disabled && Math.abs(gesture.dy) > 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { dragStart.current.lift = lift.value; },
    onPanResponderMove: (_, gesture) => {
      const maxLift = Math.max(0, latest.current.maxHeight - restingHeight.value);
      const next = dragStart.current.lift - gesture.dy;
      if (next >= 0) {
        // Upward (or back down while still lifted): resize the sheet.
        lift.value = Math.min(maxLift, next);
        translateY.value = 0;
      } else {
        // Below the resting height: slide the sheet down toward closing.
        lift.value = 0;
        translateY.value = -next;
      }
    },
    onPanResponderRelease: (_, gesture) => {
      const maxLift = Math.max(0, latest.current.maxHeight - restingHeight.value);
      if (translateY.value > DISMISS_DISTANCE || (lift.value === 0 && gesture.vy > DISMISS_VELOCITY)) {
        translateY.value = withTiming(latest.current.height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(latest.current.onClose)();
        });
        return;
      }
      translateY.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
      // Snap to whichever size is closer, or follow a clear flick.
      const expand = gesture.vy < -0.5 || (gesture.vy <= 0.5 && lift.value > maxLift / 2);
      lift.value = withTiming(expand ? maxLift : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
    },
  }), [lift, restingHeight, translateY]);

  const bottomPadding = Math.max(insets.bottom, 12) + 14;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) }],
    minHeight: lift.value > 0 ? restingHeight.value + lift.value : 0,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={disabled} onPress={dismiss} style={StyleSheet.absoluteFill} />
        <Animated.View
          onLayout={(event) => { if (lift.value === 0) restingHeight.value = event.nativeEvent.layout.height; }}
          style={[styles.sheet, { maxHeight, paddingBottom: bottomPadding }, animatedStyle]}
        >
          <View {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Drag to resize or close" style={styles.handleTarget}>
            <View style={styles.handle} />
          </View>
          {/* Scrolls when the content is taller than the sheet, so the last
              button is never hidden behind the system navigation bar. */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            {typeof children === 'function' ? children(dismiss) : children}
          </ScrollView>
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, ...shadow },
  // Tall, full-width touch target so the handle is easy to grab.
  handleTarget: { height: 40, marginHorizontal: -22, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#B8B6AF' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 16 },
});
