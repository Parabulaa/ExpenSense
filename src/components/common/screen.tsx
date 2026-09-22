import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { OrganicBackground } from './ui';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  background?: boolean;
  bottomInset?: number;
  variant?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
  padded?: boolean;
  fixed?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Set by root panels that live inside the authenticated app shell. The shell
   * already owns the canvas frame, the organic background, the safe-area inset
   * and the bottom navigation, so an embedded screen contributes only its
   * scrolling content — that is what keeps the header and navbar from being
   * re-created (and shifting) on every tab.
   */
  embedded?: boolean;
}>;

export function Screen({
  children,
  scroll = true,
  background = true,
  bottomInset = 24,
  variant = 1,
  padded = true,
  fixed,
  refreshing = false,
  onRefresh,
  embedded = false,
}: ScreenProps) {
  const { width } = useWindowDimensions();

  const horizontalPadding =
    width >= 768 ? spacing.xxl : width >= 430 ? spacing.xl : spacing.lg;

  const body = (
    <View
      style={[
        styles.inner,
        padded && { paddingHorizontal: horizontalPadding },
      ]}
    >
      {children}
    </View>
  );

  const scroller = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.deepForest} colors={[colors.deepForest]} /> : undefined}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );

  // Inside the shell the surrounding chrome already exists, so this renders
  // only the scrolling content.
  if (embedded) {
    return (
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={!scroll && Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? scroller : body}
        {fixed}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        {background && <OrganicBackground variant={variant} />}

        <SafeAreaView style={styles.safe} edges={['top']}>
          {/*
            Scrolling screens handle the keyboard through the ScrollView's own
            keyboard insets (iOS) and Android's native resize, so padding here
            would offset the layout twice. Non-scrolling screens still need it.
          */}
          <KeyboardAvoidingView
            style={styles.safe}
            behavior={!scroll && Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                // Keeps the focused field above the keyboard and lets the CTA
                // stay reachable while typing, instead of the keyboard covering
                // the bottom of the form.
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.deepForest} colors={[colors.deepForest]} /> : undefined}
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: bottomInset },
                ]}
                showsVerticalScrollIndicator={false}
              >
                {body}
              </ScrollView>
            ) : (
              body
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>

        {fixed}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#202220',
    overflow: 'hidden',
  },

  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },

  safe: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
  },

  inner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
  },
});
