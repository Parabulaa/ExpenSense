import { supabase } from '@/lib/supabase';
import { isNetworkError, uuid } from '@/lib/offline/network';
import { optimizeReceipt } from '@/features/receipts/receipt-service';

type Attachment = { uri: string; width: number; height: number };
export type UploadResult = { ok: true; path: string } | { ok: false; message: string; offline?: boolean };

/**
 * Stores a photo in the user's private receipts folder and returns its path.
 * The same folder and format as scanned receipts, so both open the same way.
 */
export async function uploadAttachment(image: Attachment): Promise<UploadResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return { ok: false, message: 'Sign in again before attaching a photo.' };
    const optimized = await optimizeReceipt(image);
    const path = `${userId}/${uuid()}/receipt.jpg`;
    const bytes = await (await fetch(optimized.uri)).arrayBuffer();
    const { error } = await supabase.storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) return { ok: false, message: "Couldn't upload the photo.", offline: isNetworkError(error) };
    return { ok: true, path };
  } catch (error) {
    return { ok: false, message: "Couldn't upload the photo.", offline: isNetworkError(error) };
  }
}

/** Short-lived private link for viewing a stored photo; the bucket itself is never public. */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function removeAttachment(path: string) {
  await supabase.storage.from('receipts').remove([path]).catch(() => undefined);
}
