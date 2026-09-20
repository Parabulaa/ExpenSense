import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { OrganicBackground } from './ui';
export function Screen({ children, scroll = true, background = true, bottomInset = 24, variant = 1 }: PropsWithChildren<{ scroll?: boolean; background?: boolean; bottomInset?: number; variant?: 1|2|3|4|5|6 }>) {
  const body = <View style={styles.inner}>{children}</View>;
  return <View style={styles.root}>{background && <OrganicBackground variant={variant} />}<SafeAreaView style={styles.safe} edges={['top']}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>{body}</ScrollView> : body}</KeyboardAvoidingView></SafeAreaView></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.cream, overflow: 'hidden' }, safe: { flex: 1 }, content: { flexGrow: 1 }, inner: { width: '100%', maxWidth: 430, alignSelf: 'center', flexGrow: 1 } });
