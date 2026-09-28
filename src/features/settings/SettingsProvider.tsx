import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

const STORAGE_KEY = 'expensense.settings.v1';

export type BudgetAlertThreshold = 80 | 90 | 100;

export type ThemeMode = 'system' | 'light' | 'dark';

export type AppSettings = {
  budgetAlerts: boolean;
  budgetAlertThreshold: BudgetAlertThreshold;
  spendingInsights: boolean;
  transactionReminders: boolean;
  themeMode: ThemeMode;
  /** True once the user has picked an appearance themselves. */
  themeChosen: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  budgetAlerts: true,
  budgetAlertThreshold: 80,
  spendingInsights: true,
  transactionReminders: false,
  // Light unless the user chooses otherwise. Following the phone by default made
  // a fresh install start light and then flip to dark on screen.
  themeMode: 'light',
  themeChosen: false,
};

type SettingsContextValue = {
  settings: AppSettings;
  /** False until the stored values have been read back from the device. */
  ready: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<boolean>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function parseSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      budgetAlerts: typeof parsed.budgetAlerts === 'boolean' ? parsed.budgetAlerts : DEFAULT_SETTINGS.budgetAlerts,
      budgetAlertThreshold: parsed.budgetAlertThreshold === 90 || parsed.budgetAlertThreshold === 100
        ? parsed.budgetAlertThreshold
        : DEFAULT_SETTINGS.budgetAlertThreshold,
      spendingInsights: typeof parsed.spendingInsights === 'boolean' ? parsed.spendingInsights : DEFAULT_SETTINGS.spendingInsights,
      transactionReminders: typeof parsed.transactionReminders === 'boolean' ? parsed.transactionReminders : DEFAULT_SETTINGS.transactionReminders,
      // A saved 'system' from before appearance became a user choice was just the
      // old default, not a decision — it becomes light until the user picks.
      themeMode: parsed.themeMode === 'light' || parsed.themeMode === 'dark' || (parsed.themeMode === 'system' && parsed.themeChosen === true)
        ? parsed.themeMode
        : DEFAULT_SETTINGS.themeMode,
      themeChosen: parsed.themeChosen === true,
    };
  } catch {
    // Corrupt or hand-edited storage shouldn't brick the settings screen.
    return DEFAULT_SETTINGS;
  }
}

/**
 * These are device-local display preferences, not account data — there is no
 * push infrastructure behind them yet, so they deliberately live in
 * AsyncStorage rather than in Supabase where they'd imply server behaviour.
 */
export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        setSettings(parseSettings(raw));
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    let next = DEFAULT_SETTINGS;
    setSettings((current) => {
      next = { ...current, ...patch, ...(patch.themeMode ? { themeChosen: true } : {}) };
      return next;
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<SettingsContextValue>(() => ({ settings, ready, updateSettings }), [ready, settings, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
