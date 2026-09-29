export const lightColors = {
  deepForest: '#173D2B', forest: '#315F43', softGreen: '#75926E', lightGreen: '#B5C7A9',
  cream: '#F5F2E8', surface: '#FFFDF7', text: '#15231B', muted: '#536C74', pale: '#E8EEE3',
  line: '#D9DED6', danger: '#DE2B2B', dangerSoft: '#FCE7E4', warning: '#C98500',
  warningSoft: '#FFF0C8', success: '#2E8A4F', white: '#FFFFFF', overlay: 'rgba(8, 20, 14, 0.68)',
};

export type Palette = { [K in keyof typeof lightColors]: string };

// Dark mode keeps the light theme's pairings readable by inverting them: the
// brand green becomes a light mint and `surface` becomes a dark card, so a
// `deepForest` fill with `surface` text stays high-contrast in both themes.
export const darkColors: Palette = {
  deepForest: '#A9D3AE', forest: '#8DBB95', softGreen: '#6F8F6A', lightGreen: '#3F5B46',
  cream: '#0F1813', surface: '#18231D', text: '#E6EEE4', muted: '#9DB0A8', pale: '#223128',
  line: '#2D3C33', danger: '#FF6B63', dangerSoft: '#3B1E1C', warning: '#E8A93A',
  warningSoft: '#3A2E14', success: '#5CC27F', white: '#FFFFFF', overlay: 'rgba(0, 0, 0, 0.72)',
};

// Pale scenery shapes were drawn for cream; on the dark canvas they'd glare.
export const DARK_DECOR_OPACITY = 0.3;

export type ColorSchemeName = 'light' | 'dark';
export const palettes: Record<ColorSchemeName, Palette> = { light: lightColors, dark: darkColors };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;
export const type = {
  hero: { fontSize: 32, lineHeight: 37, fontFamily: 'JakartaExtraBold' },
  title: { fontSize: 26, lineHeight: 31, fontFamily: 'JakartaExtraBold' },
  h2: { fontSize: 19, lineHeight: 25, fontFamily: 'JakartaBold' },
  h3: { fontSize: 15, lineHeight: 20, fontFamily: 'JakartaBold' },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'JakartaRegular' },
  subtitle: { fontSize: 14, lineHeight: 21, fontFamily: 'JakartaRegular' },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontFamily: 'JakartaMedium' },
  small: { fontSize: 12, lineHeight: 16, fontFamily: 'JakartaRegular' },
  button: { fontSize: 15, lineHeight: 20, fontFamily: 'JakartaBold' },
} as const;
export const shadow = { shadowColor: '#173D2B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 } as const;
export const assets = {
  logo: require('../../assets/Branding/Wordmark_Primary.png'), logoMark: require('../../assets/Branding/Logo_Mark.png'),
  mascotNeutral: require('../../assets/Mascot/Mascot_Neutral.png'), mascotScanning: require('../../assets/Mascot/Mascot_Scanning.png'),
  mascotSuccess: require('../../assets/Mascot/Mascot_Success.png'), mascotConfused: require('../../assets/Mascot/Mascot_Confused.png'),
  mascotTip: require('../../assets/Mascot/Mascot_Tip.png'), mascotWarning: require('../../assets/Mascot/Mascot_Warning.png'),
  shape1: require('../../assets/organic-shapes/Organic_Shape_01.png'), shape2: require('../../assets/organic-shapes/Organic_Shape_02.png'),
  shape3: require('../../assets/organic-shapes/Organic_Shape_03.png'), shape4: require('../../assets/organic-shapes/Organic_Shape_04.png'),
  shape5: require('../../assets/organic-shapes/Organic_Shape_05.png'), shape6: require('../../assets/organic-shapes/Organic_Shape_06.png'),
  receipt: require('../../assets/Receipt/Receipt_Standalone.png'), scanFrame: require('../../assets/Scan/Scan_Frame.png'),
  verified: require('../../assets/Status/Status_Verified.png'),
} as const;

// Compatibility for a few retained Expo starter helpers that are outside the app flow.
export const Colors = {
  light: { text: lightColors.text, background: lightColors.cream, backgroundElement: lightColors.pale, backgroundSelected: lightColors.lightGreen, textSecondary: lightColors.muted },
  dark: { text: darkColors.text, background: darkColors.cream, backgroundElement: darkColors.pale, backgroundSelected: darkColors.lightGreen, textSecondary: darkColors.muted },
} as const;
export type ThemeColor = keyof typeof Colors.light;
export const Fonts = { sans: 'JakartaRegular', serif: 'serif', rounded: 'JakartaRegular', mono: 'monospace' } as const;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const MaxContentWidth = 800;
