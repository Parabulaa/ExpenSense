export const colors = {
  deepForest: '#173D2B', forest: '#315F43', softGreen: '#75926E', lightGreen: '#B5C7A9',
  cream: '#F5F2E8', surface: '#FFFDF7', text: '#15231B', muted: '#536C74', pale: '#E8EEE3',
  line: '#D9DED6', danger: '#DE2B2B', dangerSoft: '#FCE7E4', warning: '#C98500',
  warningSoft: '#FFF0C8', success: '#2E8A4F', white: '#FFFFFF', overlay: 'rgba(8, 20, 14, 0.68)',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;
export const type = {
  hero: { fontSize: 38, lineHeight: 42, fontFamily: 'JakartaExtraBold' },
  title: { fontSize: 30, lineHeight: 35, fontFamily: 'JakartaExtraBold' },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: 'JakartaBold' },
  h3: { fontSize: 17, lineHeight: 22, fontFamily: 'JakartaBold' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'JakartaRegular' },
  subtitle: { fontSize: 16, lineHeight: 24, fontFamily: 'JakartaRegular' },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: 'JakartaMedium' },
  small: { fontSize: 12, lineHeight: 17, fontFamily: 'JakartaRegular' },
  button: { fontSize: 17, lineHeight: 22, fontFamily: 'JakartaBold' },
} as const;
export const shadow = { shadowColor: '#173D2B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 } as const;
export const assets = {
  logo: require('../../assets/Branding/Wordmark_Primary.png'), logoMark: require('../../assets/Branding/Logo_Mark.png'),
  mascotNeutral: require('../../assets/Mascot/Mascot_Neutral.png'), mascotScanning: require('../../assets/Mascot/Mascot_Scanning.png'),
  mascotSuccess: require('../../assets/Mascot/Mascot_Success.png'), mascotConfused: require('../../assets/Mascot/Mascot_Confused.png'),
  mascotTip: require('../../assets/Mascot/Mascot_Tip.png'), mascotWarning: require('../../assets/Mascot/Mascot_Warning.png'),
  shape1: require('../../assets/Organic Shape/Organic_Shape_01.png'), shape2: require('../../assets/Organic Shape/Organic_Shape_02.png'),
  shape3: require('../../assets/Organic Shape/Organic_Shape_03.png'), shape4: require('../../assets/Organic Shape/Organic_Shape_04.png'),
  shape5: require('../../assets/Organic Shape/Organic_Shape_05.png'), shape6: require('../../assets/Organic Shape/Organic_Shape_06.png'),
  receipt: require('../../assets/Receipt/Receipt_Standalone.png'), scanFrame: require('../../assets/Scan/Scan_Frame.png'),
  verified: require('../../assets/Status/Status_Verified.png'),
} as const;

// Compatibility for a few retained Expo starter helpers that are outside the app flow.
export const Colors = { light: { text: colors.text, background: colors.cream, backgroundElement: colors.pale, backgroundSelected: colors.lightGreen, textSecondary: colors.muted }, dark: { text: colors.surface, background: colors.text, backgroundElement: colors.forest, backgroundSelected: colors.softGreen, textSecondary: colors.lightGreen } } as const;
export type ThemeColor = keyof typeof Colors.light;
export const Fonts = { sans: 'JakartaRegular', serif: 'serif', rounded: 'JakartaRegular', mono: 'monospace' } as const;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const MaxContentWidth = 800;
