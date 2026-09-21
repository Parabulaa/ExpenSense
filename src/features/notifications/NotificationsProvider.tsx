import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { useBudgets } from '@/features/budget/BudgetProvider';
import { useCategories } from '@/features/categories/CategoriesProvider';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import { todayLocalDate } from '@/features/expenses/validation';
import { useSettings } from '@/features/settings/SettingsProvider';
import { buildAlerts, type AppAlert } from './alerts';

const STORAGE_KEY = 'expensense.alerts.seen.v1';

type NotificationsContextValue = {
  alerts: AppAlert[];
  unreadCount: number;
  /** True once an alert id has been marked seen on this device. */
  isRead: (id: string) => boolean;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Turns the user's own budgets and expenses into an alert feed. The unread
 * badge is driven by ids the device has actually seen, so the dot on the bell
 * only ever appears when there is something real behind it.
 */
export function NotificationsProvider({ children }: PropsWithChildren) {
  const { expenses } = useExpenses();
  const { budgets } = useBudgets();
  const { allCategories } = useCategories();
  const { settings } = useSettings();
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setSeen(parsed.filter((item): item is string => typeof item === 'string'));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const today = todayLocalDate();
  const month = today.slice(0, 7);

  const alerts = useMemo(
    () => buildAlerts({ expenses, budgets, categories: allCategories, settings, month, today }),
    [allCategories, budgets, expenses, month, settings, today],
  );

  const seenSet = useMemo(() => new Set(seen), [seen]);
  const unreadCount = useMemo(() => alerts.filter((alert) => !seenSet.has(alert.id)).length, [alerts, seenSet]);

  const isRead = useCallback((id: string) => seenSet.has(id), [seenSet]);

  const markAllRead = useCallback(async () => {
    const ids = alerts.map((alert) => alert.id);
    // Keep only ids that still exist so storage can't grow without bound.
    setSeen(ids);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // A failed write only means the badge reappears next launch.
    }
  }, [alerts]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ alerts, unreadCount, isRead, markAllRead }),
    [alerts, isRead, markAllRead, unreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
