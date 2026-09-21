import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { categoryLibrary, type DashboardCategory } from '@/features/dashboard/dashboard-data';
import * as service from './category-service';
import type { CategoryInput, CategoryResult } from './category-service';

type Value = {
  categories: DashboardCategory[];
  allCategories: DashboardCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<CategoryResult<DashboardCategory>>;
  updateCategory: (id: string, input: CategoryInput) => Promise<CategoryResult<DashboardCategory>>;
  archiveCategory: (id: string) => Promise<CategoryResult<{ id: string }>>;
  findCategory: (id: string | undefined) => DashboardCategory | null;
};
const Context = createContext<Value | null>(null);

export function CategoriesProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [custom, setCustom] = useState<DashboardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) { setCustom([]); setLoading(false); setError(null); return; }
    setLoading(true); const result = await service.getCustomCategories();
    if (result.ok) { setCustom(result.data); setError(null); } else setError(result.message);
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
  const archiveCategory = useCallback(async (id: string) => { const result = await service.archiveCustomCategory(id); if (result.ok) setCustom((current) => current.map((item) => item.id === id ? { ...item, archived: true } : item)); return result; }, []);
  const allCategories = useMemo(() => [...categoryLibrary, ...custom], [custom]);
  const categories = useMemo(() => allCategories.filter((item) => !item.archived), [allCategories]);
  const findCategory = useCallback((id: string | undefined) => allCategories.find((item) => item.id === id) ?? null, [allCategories]);
  const value = useMemo(() => ({ categories, allCategories, loading, error, refresh, createCategory, updateCategory, archiveCategory, findCategory }), [allCategories, archiveCategory, categories, createCategory, error, findCategory, loading, refresh, updateCategory]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCategories() { const value = useContext(Context); if (!value) throw new Error('useCategories must be used within CategoriesProvider'); return value; }
