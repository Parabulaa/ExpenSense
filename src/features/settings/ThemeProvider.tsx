import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';

import { darkColors, palettes, type ColorSchemeName, type Palette } from '@/constants/theme';
import { adaptSheetForDark, darkTint, lightInk } from '@/features/settings/adapt-color';
import { useSettings } from '@/features/settings/SettingsProvider';

type ThemeContextValue = { scheme: ColorSchemeName; colors: Palette };

const ThemeContext = createContext<ThemeContextValue>({ scheme: 'light', colors: palettes.light });

/**
 * Resolves the user's Appearance choice (system / light / dark) into a palette.
 * Must sit inside SettingsProvider.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const { settings } = useSettings();
  const systemScheme = useColorScheme();
  const scheme: ColorSchemeName = settings.themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : settings.themeMode;

  // Keeps native pieces we don't draw ourselves (date pickers, keyboards,
  // alerts) in step with an explicit choice; 'unspecified' hands control back
  // to the OS.
  useEffect(() => {
    Appearance.setColorScheme(settings.themeMode === 'system' ? 'unspecified' : settings.themeMode);
  }, [settings.themeMode]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palettes[scheme].cream).catch(() => {});
  }, [scheme]);

  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}

const darkTokens = new Set<string>(Object.values(darkColors));

/**
 * Theme-aware replacement for a module-level StyleSheet.create: returns a hook
 * that builds the sheet once per palette and hands back the current one.
 *
 * In dark mode, literal colors that aren't palette tokens (one-off pale tints,
 * translucent cream cards, dark ink) are adapted automatically. Pass
 * `{ adaptLiterals: false }` for sheets drawn on a fixed-color surface, such
 * as wallet cards on the user's own accent color.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: Palette) => T & StyleSheet.NamedStyles<any>,
  { adaptLiterals = true }: { adaptLiterals?: boolean } = {},
) {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const colors = useColors();
    let sheet = cache.get(colors);
    if (!sheet) {
      const raw = factory(colors);
      sheet = StyleSheet.create(colors === darkColors && adaptLiterals ? adaptSheetForDark(raw, darkTokens) : raw);
      cache.set(colors, sheet);
    }
    return sheet;
  };
}

/**
 * For literal colors used outside a makeStyles sheet (category tones, inline
 * tints): `tint` darkens a light fill and `ink` lightens dark text in dark
 * mode. Both return the color unchanged in light mode.
 */
export function useAdaptiveColor() {
  const { scheme } = useAppTheme();
  const dark = scheme === 'dark';
  return {
    tint: (color: string) => (dark ? darkTint(color) : color),
    ink: (color: string) => (dark ? lightInk(color) : color),
  };
}
