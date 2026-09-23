import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { ExpenseResult } from '@/features/expenses/types';
import type { ReceiptDraft, ReceiptImage } from './types';

export async function optimizeReceipt(image: ReceiptImage): Promise<ReceiptImage> {
  const longest = Math.max(image.width, image.height);
  const resize = longest > 1800 ? image.width >= image.height ? { width: 1800 } : { height: 1800 } : undefined;
  const result = await manipulateAsync(image.uri, resize ? [{ resize }] : [], { compress: 0.78, format: SaveFormat.JPEG });
  const info = await FileSystem.getInfoAsync(result.uri);
  return { uri: result.uri, width: result.width, height: result.height, size: info.exists ? info.size : undefined };
}

export async function recognizeReceipt(image: ReceiptImage) {
  const imageBase64 = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.functions.invoke('process-receipt', { body: { imageBase64, mimeType: 'image/jpeg' } });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    throw new Error(error.message || 'OCR service unavailable');
  }
  if (!data?.rawText) throw new Error('No readable text was found');
  return { rawText: String(data.rawText), confidence: Number(data.confidence ?? 0) };
}

export async function saveReceiptExpense(draft: ReceiptDraft): Promise<ExpenseResult<{ id: string }>> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: 'Sign in again before saving this receipt.' };
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const path = `${auth.user.id}/${token}/receipt.jpg`;
  try {
    const bytes = await (await fetch(draft.image.uri)).arrayBuffer();
    const upload = await supabase.storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) return { ok: false, message: "Couldn't upload the receipt image. Try again." };
    const { data, error } = await supabase.rpc('save_receipt_expense', {
      p_merchant: draft.merchant.trim(), p_amount: (draft.totalCents / 100).toFixed(2), p_category_id: draft.categoryId,
      p_transaction_date: draft.transactionDate, p_notes: draft.notes.trim() || null, p_receipt_path: path,
      p_receipt_confidence: draft.confidence, p_receipt_subtotal: (draft.subtotalCents / 100).toFixed(2), p_receipt_tax: (draft.taxCents / 100).toFixed(2),
      p_items: draft.items.map((item) => ({ name: item.name, quantity: item.quantity, line_total: (item.lineTotalCents / 100).toFixed(2) })),
      p_wallet_id: draft.walletId || null,
    });
    if (error || !data) {
      await supabase.storage.from('receipts').remove([path]);
      return { ok: false, message: error?.message.includes('duplicate') ? 'This receipt may already be saved.' : "Couldn't save this receipt. Try again." };
    }
    return { ok: true, data: { id: String(data) } };
  } catch {
    await supabase.storage.from('receipts').remove([path]);
    return { ok: false, message: "Couldn't save this receipt. Check your connection and try again." };
  }
}
