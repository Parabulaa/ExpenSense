import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
  variant?: 1 | 2 | 3 | 4 | 5 | 6;
  padded?: boolean;
}>;

export function Screen({
  children,
  scroll = true,
  background = true,
  bottomInset = 24,
  variant = 1,
  padded = true,
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

  return (
    <View style={styles.root}>
      {background && <OrganicBackground variant={variant} />}

      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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