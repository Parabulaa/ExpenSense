import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_ADVISER, isAdviserPersonaId, type AdviserIntensity, type AdviserPersonaId } from '@/features/adviser/personas';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

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
  /** Voice the mascot speaks in across the app. */
  adviserPersona: AdviserPersonaId;
  /** How hard the adviser goes: gentle, normal or savage. */
  adviserIntensity: AdviserIntensity;
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
  adviserPersona: DEFAULT_ADVISER,
  adviserIntensity: 'medium',
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
      adviserPersona: isAdviserPersonaId(parsed.adviserPersona) ? parsed.adviserPersona : DEFAULT_ADVISER,
      adviserIntensity: parsed.adviserIntensity === 'low' || parsed.adviserIntensity === 'high' ? parsed.adviserIntensity : 'medium',
    };
  } catch {
    // Corrupt or hand-edited storage shouldn't brick the settings screen.
    return DEFAULT_SETTINGS;
  }
}

type AdviserRow = { adviser_persona: string | null; adviser_intensity: string | null };

/** The adviser fields stored on the profile, or nothing when the row has none yet. */
function adviserFromRow(row: AdviserRow | null | undefined): Partial<AppSettings> {
  if (!row) return {};
  const patch: Partial<AppSettings> = {};
  if (isAdviserPersonaId(row.adviser_persona)) patch.adviserPersona = row.adviser_persona;
  if (row.adviser_intensity === 'low' || row.adviser_intensity === 'medium' || row.adviser_intensity === 'high') patch.adviserIntensity = row.adviser_intensity;
  return patch;
}

/**
 * Display preferences live in AsyncStorage on each device. The adviser persona
 * and intensity also follow the account: they are written to the profile and
 * pushed back over Supabase Realtime, so web and phone stay in step live.
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

  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Pull the account's adviser choice, then keep listening for changes made on other devices.
  useEffect(() => {
    if (!userId || !ready) return;
    let active = true;
    const apply = (row: AdviserRow | null | undefined) => {
      const patch = adviserFromRow(row);
      if (!active || !Object.keys(patch).length) return;
      setSettings((current) => {
        const next = { ...current, ...patch };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    };
    void supabase.from('profiles').select('adviser_persona,adviser_intensity').eq('id', userId).maybeSingle()
      .then(({ data }) => apply(data as AdviserRow | null), () => undefined);
    const channel = supabase
      .channel(`adviser-settings-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => apply(payload.new as AdviserRow))
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [ready, userId]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    let next = DEFAULT_SETTINGS;
    setSettings((current) => {
      next = { ...current, ...patch, ...(patch.themeMode ? { themeChosen: true } : {}) };
      return next;
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (userId && (patch.adviserPersona || patch.adviserIntensity)) {
        const row: Partial<AdviserRow> = {};
        if (patch.adviserPersona) row.adviser_persona = patch.adviserPersona;
        if (patch.adviserIntensity) row.adviser_intensity = patch.adviserIntensity;
        // Best effort: the choice is already saved on this device.
        await supabase.from('profiles').update(row).eq('id', userId).then(() => undefined, () => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  const value = useMemo<SettingsContextValue>(() => ({ settings, ready, updateSettings }), [ready, settings, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
