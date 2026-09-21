import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 500,
    letterSpacing: -0.2,
  },
  smallBold: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 700,
    letterSpacing: -0.2,
  },
  default: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 500,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 70,
    letterSpacing: -1.6,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 600,
    letterSpacing: -0.8,
  },
  link: {
    fontFamily: Fonts.sans,
    lineHeight: 24,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: -0.2,
  },
  linkPrimary: {
    fontFamily: Fonts.sans,
    lineHeight: 24,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: -0.2,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
    letterSpacing: 0,
  },
});
