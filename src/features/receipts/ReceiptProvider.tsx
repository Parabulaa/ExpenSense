import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { assessReceiptStructure, parseReceipt } from './receipt-parser';
import { useAuth } from '@/features/auth/AuthProvider';
import { nowLocalTime, todayLocalDate } from '@/features/expenses/validation';
import { uuid } from '@/lib/offline/network';
import { getScansRemaining, optimizeReceipt, recognizeReceipt, saveReceiptTransaction } from './receipt-service';
import type { ReceiptDraft, ReceiptFailureKind, ReceiptImage, ReceiptProgress } from './types';

type ContextValue = {
  source: ReceiptImage | null; draft: ReceiptDraft | null; progress: ReceiptProgress | null; completed: ReceiptProgress[];
  failure: ReceiptFailureKind | null; failureMessage: string | null; saving: boolean;
  setSource: (image: ReceiptImage) => void; process: () => Promise<'review' | 'failed'>; updateDraft: (patch: Partial<ReceiptDraft>) => void;
  save: () => ReturnType<typeof saveReceiptTransaction>; reset: () => void;
  /** Keeps the photo but lets the user type the details when it could not be read. */
  startManualDraft: () => boolean;
  /** Receipt scans left on this account; null until known or while offline. */
  scansRemaining: number | null;
  refreshScansRemaining: () => Promise<void>;
};
const ReceiptContext = createContext<ContextValue | null>(null);
const steps: ReceiptProgress[] = ['Preparing image', 'Checking image quality', 'Reading receipt', 'Checking receipt structure', 'Extracting details', 'Checking totals'];

export function ReceiptProvider({ children }: PropsWithChildren) {
  const [source, setSourceState] = useState<ReceiptImage | null>(null); const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [progress, setProgress] = useState<ReceiptProgress | null>(null); const [completed, setCompleted] = useState<ReceiptProgress[]>([]);
  const [failure, setFailure] = useState<ReceiptFailureKind | null>(null); const [failureMessage, setFailureMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const processing = useRef(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [scans, setScans] = useState<{ userId: string; remaining: number | null } | null>(null);
  const scansRemaining = scans && scans.userId === userId ? scans.remaining : null;
  const refreshScansRemaining = useCallback(async () => {
    if (!userId) return;
    const remaining = await getScansRemaining();
    setScans({ userId, remaining });
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getScansRemaining().then((remaining) => {
      if (!cancelled) setScans({ userId, remaining });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const reset = useCallback(() => { setSourceState(null); setDraft(null); setProgress(null); setCompleted([]); setFailure(null); setFailureMessage(null); processing.current = false; }, []);
  const setSource = useCallback((image: ReceiptImage) => { reset(); setSourceState(image); }, [reset]);
  const startManualDraft = useCallback(() => {
    if (!source) return false;
    // Nothing was read, so there is nothing printed to identify the receipt by;
    // a one-off id keeps the duplicate check from matching unrelated receipts.
    setDraft({ image: source, documentType: source.origin === 'online' ? 'online_receipt' : 'paper_receipt', kind: 'unknown', detected: { kind: 'unknown', confidence: 0, signals: [] }, merchant: '', transactionDate: todayLocalDate(), transactionTime: nowLocalTime(), items: [], subtotalCents: 0, taxCents: 0, totalCents: 0, feeCents: 0, categoryId: '', walletId: '', destinationWalletId: '', notes: '', rawText: '', reference: null, fingerprint: 'manual|' + uuid(), confidence: 0, structureScore: 0, issues: ['Enter the details from your receipt'] });
    setFailure(null); setFailureMessage(null);
    return true;
  }, [source]);
  const process = useCallback(async () => {
    if (!source || processing.current) return draft ? 'review' : 'failed';
    processing.current = true; setCompleted([]); setFailure(null);
    try {
      setProgress(steps[0]); const optimized = await optimizeReceipt(source); setCompleted([steps[0]]);
      setProgress(steps[1]); if (Math.min(optimized.width, optimized.height) < 500) throw Object.assign(new Error('The image is too small. Try a clearer, closer photo.'), { kind: 'quality' }); setCompleted(steps.slice(0, 2));
      setProgress(steps[2]); const ocr = await recognizeReceipt(optimized).finally(() => void refreshScansRemaining()); setCompleted(steps.slice(0, 3));
      setProgress(steps[3]); const structure = assessReceiptStructure(ocr.rawText); if (structure < 4) throw Object.assign(new Error("We couldn't find enough receipt details in this image."), { kind: 'not-receipt' }); setCompleted(steps.slice(0, 4));
      setProgress(steps[4]); const parsed = parseReceipt(ocr.rawText, optimized, ocr.confidence); setCompleted(steps.slice(0, 5));
      setProgress(steps[5]); if (!parsed.totalCents) throw Object.assign(new Error("We couldn't find an amount on this receipt."), { kind: 'not-receipt' }); setDraft(parsed); setCompleted(steps); setProgress(null); processing.current = false; return 'review';
    } catch (error) {
      const item = error as Error & { kind?: ReceiptFailureKind }; const kind = item.kind ?? (/network|fetch|function/i.test(item.message) ? 'network' : 'provider');
      setFailure(kind); setFailureMessage(item.message); setProgress(null); processing.current = false; return 'failed';
    }
  }, [draft, refreshScansRemaining, source]);
  const updateDraft = useCallback((patch: Partial<ReceiptDraft>) => setDraft((current) => current ? { ...current, ...patch } : current), []);
  // A ref, not state, guards against a double tap saving before `saving` renders.
  const saveInFlight = useRef(false);
  const save = useCallback(async () => {
    if (!draft) return { ok: false as const, message: 'No receipt is ready to save.' };
    if (saveInFlight.current) return { ok: false as const, message: 'This receipt is already being saved.' };
    saveInFlight.current = true; setSaving(true);
    const result = await saveReceiptTransaction(draft);
    saveInFlight.current = false; setSaving(false);
    return result;
  }, [draft]);
  const value = useMemo(() => ({ source, draft, progress, completed, failure, failureMessage, saving, setSource, process, updateDraft, save, reset , startManualDraft, scansRemaining, refreshScansRemaining }), [source, draft, progress, completed, failure, failureMessage, saving, setSource, process, updateDraft, save, reset, startManualDraft, scansRemaining, refreshScansRemaining]);
  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
}
export function useReceipt() { const value = useContext(ReceiptContext); if (!value) throw new Error('useReceipt must be used within ReceiptProvider'); return value; }
