import { supabase } from '@/lib/supabase';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';

type CategoryRow = { id: string; name: string; icon: DashboardCategory['icon']; color: string; archived_at: string | null };
export type CategoryInput = { name: string; icon: DashboardCategory['icon']; color: string };
export type CategoryResult<T> = { ok: true; data: T } | { ok: false; message: string };
const ERROR = "Couldn't save the category. Check your connection and try again.";
const mapRow = (row: CategoryRow): DashboardCategory => ({ id: row.id, label: row.name, fullLabel: row.name, budget: 0, spent: 0, icon: row.icon, color: row.color, custom: true, archived: Boolean(row.archived_at) });

export async function getCustomCategories(): Promise<CategoryResult<DashboardCategory[]>> {
  try { const { data, error } = await supabase.from('custom_categories').select('id,name,icon,color,archived_at').order('created_at'); return error ? { ok: false, message: ERROR } : { ok: true, data: (data as CategoryRow[]).map(mapRow) }; }
  catch { return { ok: false, message: ERROR }; }
}
export async function createCustomCategory(input: CategoryInput): Promise<CategoryResult<DashboardCategory>> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: 'Sign in again before creating a category.' };
    const { data, error } = await supabase.from('custom_categories').insert({ user_id: auth.user.id, name: input.name, icon: input.icon, color: input.color }).select('id,name,icon,color,archived_at').single();
    return error || !data ? { ok: false, message: error?.code === '23505' ? 'A category with this name already exists.' : ERROR } : { ok: true, data: mapRow(data as CategoryRow) };
  } catch { return { ok: false, message: ERROR }; }
}
export async function updateCustomCategory(id: string, input: CategoryInput): Promise<CategoryResult<DashboardCategory>> {
  try { const { data, error } = await supabase.from('custom_categories').update({ name: input.name, icon: input.icon, color: input.color }).eq('id', id).select('id,name,icon,color,archived_at').single(); return error || !data ? { ok: false, message: error?.code === '23505' ? 'A category with this name already exists.' : ERROR } : { ok: true, data: mapRow(data as CategoryRow) }; }
  catch { return { ok: false, message: ERROR }; }
}
export async function archiveCustomCategory(id: string): Promise<CategoryResult<{ id: string }>> {
  try { const { error } = await supabase.from('custom_categories').update({ archived_at: new Date().toISOString() }).eq('id', id); return error ? { ok: false, message: ERROR } : { ok: true, data: { id } }; }
  catch { return { ok: false, message: ERROR }; }
}
