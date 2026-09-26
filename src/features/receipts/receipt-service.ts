import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { ExpenseResult } from '@/features/expenses/types';
import type { ReceiptDraft, ReceiptImage } from './types';

/** Just under the free OCR tier's 1 MB image limit. */
const MAX_UPLOAD_BYTES = 950_000;

export async function optimizeReceipt(image: ReceiptImage): Promise<ReceiptImage> {
  const longest = Math.max(image.width, image.height);
  const resize = longest > 1800 ? image.width >= image.height ? { width: 1800 } : { height: 1800 } : undefined;
  let result = await manipulateAsync(image.uri, resize ? [{ resize }] : [], { compress: 0.78, format: SaveFormat.JPEG });
  let info = await FileSystem.getInfoAsync(result.uri);
  // The free OCR service accepts about 1 MB per image. Step down until the
  // photo fits, keeping enough resolution for small receipt print.
  for (const [longestSide, compress] of [[1500, 0.7], [1280, 0.6]] as const) {
    if (!info.exists || (info.size ?? 0) <= MAX_UPLOAD_BYTES) break;
    const smaller = result.width >= result.height ? { width: Math.min(longestSide, result.width) } : { height: Math.min(longestSide, result.height) };
    result = await manipulateAsync(result.uri, [{ resize: smaller }], { compress, format: SaveFormat.JPEG });
    info = await FileSystem.getInfoAsync(result.uri);
  }
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

const DUPLICATE_MESSAGE = 'This receipt has already been saved, so your wallet was not changed again. If it is a different purchase, enter it manually.';

/**
 * Saves a confirmed receipt as an expense, cash-in or transfer through one
 * database call, so the wallet change, budget effect and duplicate check
 * happen together or not at all.
 */
export async function saveReceiptTransaction(draft: ReceiptDraft): Promise<ExpenseResult<{ id: string }>> {
  if (draft.kind === 'unknown') return { ok: false, message: 'Choose whether this receipt is an expense, cash-in or transfer.' };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: 'Sign in again before saving this receipt.' };
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const path = `${auth.user.id}/${token}/receipt.jpg`;
  const expense = draft.kind === 'expense';
  try {
    const bytes = await (await fetch(draft.image.uri)).arrayBuffer();
    const upload = await supabase.storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) return { ok: false, message: "Couldn't upload the receipt image. Try again." };
    const { data, error } = await supabase.rpc('save_receipt_transaction', {
      p_type: draft.kind,
      p_amount: (draft.totalCents / 100).toFixed(2),
      p_fee: draft.kind === 'transfer' ? (draft.feeCents / 100).toFixed(2) : '0.00',
      p_merchant: draft.merchant.trim(),
      p_category_id: expense ? draft.categoryId : null,
      p_wallet_id: draft.walletId || null,
      p_destination_wallet_id: draft.kind === 'transfer' ? draft.destinationWalletId || null : null,
      p_transaction_date: draft.transactionDate,
      p_transaction_time: draft.transactionTime,
      p_notes: draft.notes.trim() || null,
      p_receipt_path: path,
      p_receipt_confidence: draft.confidence,
      p_receipt_subtotal: expense ? (draft.subtotalCents / 100).toFixed(2) : null,
      p_receipt_tax: expense ? (draft.taxCents / 100).toFixed(2) : null,
      p_items: expense ? draft.items.map((item) => ({ name: item.name, quantity: item.quantity, line_total: (item.lineTotalCents / 100).toFixed(2) })) : [],
      p_fingerprint: draft.fingerprint,
    });
    if (error || !data) {
      await supabase.storage.from('receipts').remove([path]);
      return { ok: false, message: /duplicate/i.test(error?.message ?? '') ? DUPLICATE_MESSAGE : "Couldn't save this receipt. Try again." };
    }
    return { ok: true, data: { id: String(data) } };
  } catch {
    await supabase.storage.from('receipts').remove([path]);
    return { ok: false, message: "Couldn't save this receipt. Check your connection and try again." };
  }
}
