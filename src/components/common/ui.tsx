import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextProps, TextInput, type TextInputProps, View } from 'react-native';
import { assets, colors, radii, shadow, spacing, type } from '@/constants/theme';
import { PressableScale } from './motion';
export { OrganicBackground } from './organic-background';

export function AppText({ children, variant = 'body', style, ...props }: PropsWithChildren<Omit<TextProps, 'style'> & { variant?: keyof typeof type; style?: any }>) {
  return <Text {...props} style={[type[variant], { color: colors.text }, style]}>{children}</Text>;
}
export function AppIcon({ name, size = 24, color = colors.deepForest }: { name: keyof typeof MaterialCommunityIcons.glyphMap; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
export function Brand({ compact = false, large = false, align = 'center' }: { compact?: boolean; large?: boolean; align?: 'center' | 'left' }) {
  return (
    <View style={[styles.brand, compact && styles.brandCompact, large && styles.brandLarge, { alignSelf: align === 'left' ? 'flex-start' : 'center' }]}>
      <Image source={assets.logoMark} contentFit="contain" style={[styles.brandMark, compact && styles.brandMarkCompact, large && styles.brandMarkLarge]} />
      <View>
        <View style={styles.wordmark}>
          <AppText style={[styles.brandText, compact && styles.brandTextCompact, large && styles.brandTextLarge]}>Expen</AppText>
          <AppText style={[styles.brandText, styles.brandSense, compact && styles.brandTextCompact, large && styles.brandTextLarge]}>Sense</AppText>
        </View>
        <AppText style={[styles.tagline, compact && styles.taglineCompact, large && styles.taglineLarge]}>TRACK SMARTER. LIVE BETTER.</AppText>
      </View>
    </View>
  );
}
export function PrimaryButton({ title, onPress, icon, danger = false, loading = false, disabled = false, loadingTitle, hideTrailingIcon = false }: { title: string; onPress?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap; danger?: boolean; loading?: boolean; disabled?: boolean; loadingTitle?: string; hideTrailingIcon?: boolean }) {
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={loading && loadingTitle ? loadingTitle : title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.primary, danger && { backgroundColor: colors.danger }, isDisabled && styles.disabled] as any}
    >
      {loading ? (
        // Keep the label visible while busy so the button communicates what
        // it's doing, not just that something is happening.
        <>
          <ActivityIndicator color={colors.surface} />
          {loadingTitle ? <AppText variant="button" style={{ color: colors.surface }}>{loadingTitle}</AppText> : null}
        </>
      ) : (
        <>{icon ? <AppIcon name={icon} color={colors.surface} /> : null}<AppText variant="button" style={{ color: colors.surface }}>{title}</AppText>{!icon && !hideTrailingIcon && <AppIcon name="arrow-right" size={25} color={colors.surface} />}</>
      )}
    </PressableScale>
  );
}
export function SecondaryButton({ title, onPress, icon, disabled = false }: { title: string; onPress?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondary, disabled && styles.disabled, pressed && !disabled && { opacity: .75 }]}>{icon && <AppIcon name={icon} />}<AppText variant="button">{title}</AppText></Pressable>; }
export function BackButton({ onPress }: { onPress?: () => void }) { const goBack = () => router.canGoBack() ? router.back() : router.replace('/'); return <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={onPress ?? goBack} style={styles.back}><AppIcon name="arrow-left" size={25} /></Pressable>; }
export function FormInput({ icon, secure, right, style, inputStyle, error, label, hint, onFocus, onBlur, ...props }: Omit<TextInputProps, 'style'> & { icon?: keyof typeof MaterialCommunityIcons.glyphMap; secure?: boolean; right?: ReactNode; style?: any; inputStyle?: TextInputProps['style']; error?: string | null; label?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  // Error wins over hint so the field never shows contradictory guidance, and
  // the row below is always reserved by the same component either way.
  const helper = error ?? hint ?? null;

  return (
    <View style={styles.field}>
      {label ? <AppText variant="bodyMedium" style={styles.inputLabel}>{label}</AppText> : null}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, !!error && styles.inputWrapError, style]}>
        {icon && <View style={styles.inputIcon}><AppIcon name={icon} size={23} color={error ? colors.danger : focused ? colors.deepForest : colors.forest} /></View>}
        <TextInput
          placeholderTextColor="#849096"
          secureTextEntry={secure}
          style={[styles.input, inputStyle]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {right}
      </View>
      {helper ? <AppText variant="small" style={error ? styles.inputError : styles.inputHint}>{helper}</AppText> : null}
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: any }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function ProgressBar({ value, height = 12 }: { value: number; height?: number }) {
  const pct = Math.max(0, Math.min(value, 100));
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.value = reduced ? pct : withDelay(260, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pct, progress, reduced]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return <View style={[styles.track, { height }]}><Animated.View style={[styles.fill, fillStyle]} /></View>;
}
export function StatusChip({ children, warning = false }: PropsWithChildren<{ warning?: boolean }>) { return <View style={[styles.chip, warning && styles.warningChip]}><AppText variant="bodyMedium" style={{ color: warning ? colors.warning : colors.success }}>{children}</AppText></View>; }
const styles = StyleSheet.create({
  brand: { height: 72, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, brandCompact: { height: 60, alignSelf: 'flex-start' }, brandLarge: { height: 92, gap: 4 }, brandMarkLarge: { width: 72, height: 72 }, brandTextLarge: { fontSize: 32, lineHeight: 37 }, taglineLarge: { fontSize: 8, lineHeight: 11, letterSpacing: 1.35 }, brandMark: { width: 56, height: 56 }, brandMarkCompact: { width: 48, height: 48 }, wordmark: { flexDirection: 'row', alignItems: 'center' }, brandText: { fontFamily: 'JakartaExtraBold', fontSize: 26, lineHeight: 30 }, brandTextCompact: { fontSize: 23, lineHeight: 27 }, brandSense: { color: colors.success }, tagline: { fontFamily: 'JakartaSemiBold', fontSize: 6.5, lineHeight: 9, letterSpacing: 1.1, color: colors.forest }, taglineCompact: { fontSize: 5.8, letterSpacing: .9 }, primary: { minHeight: 54, backgroundColor: colors.deepForest, borderRadius: radii.md, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  secondary: { minHeight: 52, borderRadius: radii.md, borderWidth: 1.5, borderColor: '#C6D3C1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, backgroundColor: colors.surface },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, inputWrap: { minHeight: 56, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.86)', borderWidth: 1, borderColor: '#C9D5C5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  inputIcon: { width: 32, alignItems: 'flex-start' }, input: { flex: 1, height: 56, color: colors.text, fontFamily: 'JakartaRegular', fontSize: 15, paddingHorizontal: 8 }, inputWrapError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft }, inputError: { color: colors.danger, marginTop: 6, marginLeft: 4 }, disabled: { opacity: .55 }, card: { backgroundColor: 'rgba(255,253,247,.96)', borderRadius: radii.md, padding: spacing.lg, ...shadow },
  field: { gap: 7 }, inputLabel: { color: colors.text, fontFamily: 'JakartaSemiBold', marginLeft: 2 }, inputHint: { color: colors.muted, marginTop: 6, marginLeft: 4 },
  inputWrapFocused: { borderColor: colors.forest, borderWidth: 1.5, backgroundColor: 'rgba(240,245,236,.96)' },
  track: { backgroundColor: '#DCE5D7', borderRadius: radii.pill, overflow: 'hidden', flex: 1 }, fill: { height: '100%', backgroundColor: colors.success, borderRadius: radii.pill }, chip: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: '#E2F0DD' }, warningChip: { backgroundColor: colors.warningSoft },
});
