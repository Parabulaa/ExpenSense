import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { categoryLibrary, type DashboardCategory } from '@/features/dashboard/dashboard-data';
import { readCache, writeCache } from '@/lib/offline/cache';
import * as service from './category-service';
import type { CategoryInput, CategoryResult } from './category-service';

type Value = {
  /** Active categories: what pickers, budgets and the dashboard offer. */
  categories: DashboardCategory[];
  /** Every category ever used, so historical transactions keep their name. */
  allCategories: DashboardCategory[];
  /** Hidden defaults and archived custom categories, restorable from Categories. */
  hiddenCategories: DashboardCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<CategoryResult<DashboardCategory>>;
  updateCategory: (id: string, input: CategoryInput) => Promise<CategoryResult<DashboardCategory>>;
  /** Hides a default category or archives a custom one. History is preserved either way. */
  hideCategory: (id: string) => Promise<CategoryResult<{ id: string }>>;
  restoreCategory: (id: string) => Promise<CategoryResult<{ id: string }>>;
  findCategory: (id: string | undefined) => DashboardCategory | null;
};
const Context = createContext<Value | null>(null);

export function CategoriesProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [custom, setCustom] = useState<DashboardCategory[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) { setCustom([]); setHiddenIds([]); setLoading(false); setError(null); return; }
    // The saved copy first, so categories are there offline and on every launch.
    const cached = await readCache<{ custom: DashboardCategory[]; hiddenIds: string[] }>(user.id, 'categories');
    if (cached) { setCustom(cached.custom); setHiddenIds(cached.hiddenIds); }
    setLoading(true);
    const [result, hidden] = await Promise.all([service.getCustomCategories(), service.getHiddenCategoryIds()]);
    if (result.ok) setCustom(result.data);
    if (hidden.ok) setHiddenIds(hidden.data);
    // Offline with a saved copy is not an error worth showing.
    setError(cached ? null : !result.ok ? result.message : !hidden.ok ? hidden.message : null);
    setLoading(false);
  }, [user]);
  useEffect(() => {
    if (!initialized) return;
    // Synchronize custom categories after the authenticated identity is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [initialized, refresh]);
  const createCategory = useCallback(async (input: CategoryInput) => { const result = await service.createCustomCategory(input); if (result.ok) setCustom((current) => [...current, result.data]); return result; }, []);
  const updateCategory = useCallback(async (id: string, input: CategoryInput) => { const result = await service.updateCustomCategory(id, input); if (result.ok) setCustom((current) => current.map((item) => item.id === id ? result.data : item)); return result; }, []);
  const isDefault = useCallback((id: string) => categoryLibrary.some((item) => item.id === id), []);
  const hideCategory = useCallback(async (id: string): Promise<CategoryResult<{ id: string }>> => {
    if (isDefault(id)) {
      const result = await service.saveHiddenCategoryIds([...new Set([...hiddenIds, id])]);
      if (!result.ok) return result;
      setHiddenIds(result.data);
      return { ok: true, data: { id } };
    }
    const result = await service.archiveCustomCategory(id);
    if (result.ok) setCustom((current) => current.map((item) => item.id === id ? { ...item, archived: true } : item));
    return result;
  }, [hiddenIds, isDefault]);
  const restoreCategory = useCallback(async (id: string): Promise<CategoryResult<{ id: string }>> => {
    if (isDefault(id)) {
      const result = await service.saveHiddenCategoryIds(hiddenIds.filter((item) => item !== id));
      if (!result.ok) return result;
      setHiddenIds(result.data);
      return { ok: true, data: { id } };
    }
    const result = await service.restoreCustomCategory(id);
    if (result.ok) setCustom((current) => current.map((item) => item.id === id ? { ...item, archived: false } : item));
    return result;
  }, [hiddenIds, isDefault]);
  useEffect(() => { if (user && !loading) writeCache(user.id, 'categories', { custom, hiddenIds }); }, [custom, hiddenIds, loading, user]);
  const allCategories = useMemo(() => [...categoryLibrary.map((item) => hiddenIds.includes(item.id) ? { ...item, archived: true } : item), ...custom], [custom, hiddenIds]);
  const categories = useMemo(() => allCategories.filter((item) => !item.archived), [allCategories]);
  const hiddenCategories = useMemo(() => allCategories.filter((item) => item.archived), [allCategories]);
  const findCategory = useCallback((id: string | undefined) => allCategories.find((item) => item.id === id) ?? null, [allCategories]);
  const value = useMemo(() => ({ categories, allCategories, hiddenCategories, loading, error, refresh, createCategory, updateCategory, hideCategory, restoreCategory, findCategory }), [allCategories, categories, createCategory, error, findCategory, hiddenCategories, hideCategory, loading, refresh, restoreCategory, updateCategory]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCategories() { const value = useContext(Context); if (!value) throw new Error('useCategories must be used within CategoriesProvider'); return value; }
