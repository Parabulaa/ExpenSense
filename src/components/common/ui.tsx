import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { assets, colors, radii, shadow, spacing, type } from '@/constants/theme';

export function AppText({ children, variant = 'body', style, ...props }: PropsWithChildren<{ variant?: keyof typeof type; style?: any; numberOfLines?: number }>) {
  return <Text {...props} style={[type[variant], { color: colors.text }, style]}>{children}</Text>;
}
export function AppIcon({ name, size = 24, color = colors.deepForest }: { name: keyof typeof MaterialCommunityIcons.glyphMap; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
export function OrganicBackground({ variant = 1 }: { variant?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const source = assets[`shape${variant}`];
  return <><Image source={source} contentFit="contain" style={styles.shapeTop} pointerEvents="none" /><Image source={variant === 1 ? assets.shape4 : assets.shape1} contentFit="contain" style={styles.shapeBottom} pointerEvents="none" /></>;
}
export function Brand({ compact = false }: { compact?: boolean }) { return <View style={[styles.brand, compact && styles.brandCompact,{alignSelf:'center'}]}><Image source={assets.logoMark} contentFit="contain" style={[styles.brandMark, compact && styles.brandMarkCompact]} /><View><View style={styles.wordmark}><AppText style={[styles.brandText, compact && styles.brandTextCompact]}>Expen</AppText><AppText style={[styles.brandText, styles.brandSense, compact && styles.brandTextCompact]}>Sense</AppText></View><AppText style={[styles.tagline, compact && styles.taglineCompact]}>TRACK SMARTER. LIVE BETTER.</AppText></View></View>; }
export function PrimaryButton({ title, onPress, icon, danger = false }: { title: string; onPress?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.primary, danger && { backgroundColor: colors.danger }, pressed && { opacity: .84 }]}>{icon ? <AppIcon name={icon} color={colors.surface} /> : null}<AppText variant="button" style={{ color: colors.surface }}>{title}</AppText>{!icon && <AppIcon name="arrow-right" size={25} color={colors.surface} />}</Pressable>;
}
export function SecondaryButton({ title, onPress, icon }: { title: string; onPress?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && { opacity: .75 }]}>{icon && <AppIcon name={icon} />}<AppText variant="button">{title}</AppText></Pressable>; }
export function BackButton({ onPress }: { onPress?: () => void }) { const goBack = () => router.canGoBack() ? router.back() : router.replace('/'); return <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={onPress ?? goBack} style={styles.back}><AppIcon name="arrow-left" size={25} /></Pressable>; }
export function FormInput({ icon, secure, right, style, ...props }: Omit<TextInputProps, 'style'> & { icon?: keyof typeof MaterialCommunityIcons.glyphMap; secure?: boolean; right?: ReactNode; style?: any }) { return <View style={[styles.inputWrap, style]}>{icon && <View style={styles.inputIcon}><AppIcon name={icon} size={23} /></View>}<TextInput placeholderTextColor="#849096" secureTextEntry={secure} style={styles.input} {...props} />{right}</View>; }
export function Card({ children, style }: PropsWithChildren<{ style?: any }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function ProgressBar({ value, height = 12 }: { value: number; height?: number }) { return <View style={[styles.track, { height }]}><View style={[styles.fill, { width: `${Math.min(value, 100)}%` }]} /></View>; }
export function StatusChip({ children, warning = false }: PropsWithChildren<{ warning?: boolean }>) { return <View style={[styles.chip, warning && styles.warningChip]}><AppText variant="bodyMedium" style={{ color: warning ? colors.warning : colors.success }}>{children}</AppText></View>; }
const styles = StyleSheet.create({
  shapeTop: { position: 'absolute', width: 255, height: 245, right: -88, top: -82, opacity: .95 }, shapeBottom: { position: 'absolute', width: 330, height: 260, left: -145, bottom: -115, opacity: .92, transform: [{ rotate: '10deg' }] },
  brand: { height: 72, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, brandCompact: { height: 60, alignSelf: 'flex-start' }, brandMark: { width: 56, height: 56 }, brandMarkCompact: { width: 48, height: 48 }, wordmark: { flexDirection: 'row', alignItems: 'center' }, brandText: { fontFamily: 'JakartaExtraBold', fontSize: 26, lineHeight: 30 }, brandTextCompact: { fontSize: 23, lineHeight: 27 }, brandSense: { color: colors.success }, tagline: { fontFamily: 'JakartaSemiBold', fontSize: 6.5, lineHeight: 9, letterSpacing: 1.1, color: colors.forest }, taglineCompact: { fontSize: 5.8, letterSpacing: .9 }, primary: { minHeight: 54, backgroundColor: colors.deepForest, borderRadius: radii.md, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  secondary: { minHeight: 52, borderRadius: radii.md, borderWidth: 1.5, borderColor: '#C6D3C1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, backgroundColor: colors.surface },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, inputWrap: { minHeight: 56, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.86)', borderWidth: 1, borderColor: '#C9D5C5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  inputIcon: { width: 32, alignItems: 'flex-start' }, input: { flex: 1, height: 56, color: colors.text, fontFamily: 'JakartaRegular', fontSize: 15, paddingHorizontal: 8 }, card: { backgroundColor: 'rgba(255,253,247,.96)', borderRadius: radii.md, padding: spacing.lg, ...shadow },
  track: { backgroundColor: '#DCE5D7', borderRadius: radii.pill, overflow: 'hidden', flex: 1 }, fill: { height: '100%', backgroundColor: colors.success, borderRadius: radii.pill }, chip: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: '#E2F0DD' }, warningChip: { backgroundColor: colors.warningSoft },
});
