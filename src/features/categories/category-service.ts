import { supabase } from '@/lib/supabase';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';

type CategoryRow = { id: string; name: string; icon: DashboardCategory['icon']; color: string; archived_at: string | null };
export type CategoryInput = { name: string; icon: DashboardCategory['icon']; color: string };
export type CategoryResult<T> = { ok: true; data: T } | { ok: false; message: string };
const ERROR = "Couldn't save the category. Check your connection and try again.";
const DUPLICATE = 'A category with this name already exists.';
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
    return error || !data ? { ok: false, message: error?.code === '23505' ? DUPLICATE : ERROR } : { ok: true, data: mapRow(data as CategoryRow) };
  } catch { return { ok: false, message: ERROR }; }
}
export async function updateCustomCategory(id: string, input: CategoryInput): Promise<CategoryResult<DashboardCategory>> {
  try { const { data, error } = await supabase.from('custom_categories').update({ name: input.name, icon: input.icon, color: input.color }).eq('id', id).select('id,name,icon,color,archived_at').single(); return error || !data ? { ok: false, message: error?.code === '23505' ? DUPLICATE : ERROR } : { ok: true, data: mapRow(data as CategoryRow) }; }
  catch { return { ok: false, message: ERROR }; }
}
export async function archiveCustomCategory(id: string): Promise<CategoryResult<{ id: string }>> {
  try { const { error } = await supabase.from('custom_categories').update({ archived_at: new Date().toISOString() }).eq('id', id); return error ? { ok: false, message: ERROR } : { ok: true, data: { id } }; }
  catch { return { ok: false, message: ERROR }; }
}
export async function restoreCustomCategory(id: string): Promise<CategoryResult<{ id: string }>> {
  try { const { error } = await supabase.from('custom_categories').update({ archived_at: null }).eq('id', id); return error ? { ok: false, message: error.code === '23505' ? DUPLICATE : ERROR } : { ok: true, data: { id } }; }
  catch { return { ok: false, message: ERROR }; }
}

/** Default categories live in code; which ones a user has hidden lives on their profile. */
export async function getHiddenCategoryIds(): Promise<CategoryResult<string[]>> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: true, data: [] };
    const { data, error } = await supabase.from('profiles').select('hidden_category_ids').eq('id', auth.user.id).maybeSingle();
    return error ? { ok: false, message: ERROR } : { ok: true, data: (data?.hidden_category_ids as string[] | null) ?? [] };
  } catch { return { ok: false, message: ERROR }; }
}
export async function saveHiddenCategoryIds(ids: string[]): Promise<CategoryResult<string[]>> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: 'Sign in again before changing categories.' };
    const { error } = await supabase.from('profiles').update({ hidden_category_ids: ids }).eq('id', auth.user.id);
    return error ? { ok: false, message: ERROR } : { ok: true, data: ids };
  } catch { return { ok: false, message: ERROR }; }
}
