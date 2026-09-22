import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { assessReceiptStructure, parseReceipt } from './receipt-parser';
import { optimizeReceipt, recognizeReceipt, saveReceiptExpense } from './receipt-service';
import type { ReceiptDraft, ReceiptFailureKind, ReceiptImage, ReceiptProgress } from './types';

type ContextValue = {
  source: ReceiptImage | null; draft: ReceiptDraft | null; progress: ReceiptProgress | null; completed: ReceiptProgress[];
  failure: ReceiptFailureKind | null; failureMessage: string | null; saving: boolean;
  setSource: (image: ReceiptImage) => void; process: () => Promise<'review' | 'failed'>; updateDraft: (patch: Partial<ReceiptDraft>) => void;
  save: () => ReturnType<typeof saveReceiptExpense>; reset: () => void;
};
const ReceiptContext = createContext<ContextValue | null>(null);
const steps: ReceiptProgress[] = ['Preparing image', 'Checking image quality', 'Reading receipt', 'Checking receipt structure', 'Extracting details', 'Checking totals'];

export function ReceiptProvider({ children }: PropsWithChildren) {
  const [source, setSourceState] = useState<ReceiptImage | null>(null); const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [progress, setProgress] = useState<ReceiptProgress | null>(null); const [completed, setCompleted] = useState<ReceiptProgress[]>([]);
  const [failure, setFailure] = useState<ReceiptFailureKind | null>(null); const [failureMessage, setFailureMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const processing = useRef(false);
  const reset = useCallback(() => { setSourceState(null); setDraft(null); setProgress(null); setCompleted([]); setFailure(null); setFailureMessage(null); processing.current = false; }, []);
  const setSource = useCallback((image: ReceiptImage) => { reset(); setSourceState(image); }, [reset]);
  const process = useCallback(async () => {
    if (!source || processing.current) return draft ? 'review' : 'failed';
    processing.current = true; setCompleted([]); setFailure(null);
    try {
      setProgress(steps[0]); const optimized = await optimizeReceipt(source); setCompleted([steps[0]]);
      setProgress(steps[1]); if (Math.min(optimized.width, optimized.height) < 500) throw Object.assign(new Error('The image is too small. Try a clearer, closer photo.'), { kind: 'quality' }); setCompleted(steps.slice(0, 2));
      setProgress(steps[2]); const ocr = await recognizeReceipt(optimized); setCompleted(steps.slice(0, 3));
      setProgress(steps[3]); const structure = assessReceiptStructure(ocr.rawText); if (structure < 4) throw Object.assign(new Error("We couldn't find enough receipt details in this image."), { kind: 'not-receipt' }); setCompleted(steps.slice(0, 4));
      setProgress(steps[4]); const parsed = parseReceipt(ocr.rawText, optimized, ocr.confidence); setCompleted(steps.slice(0, 5));
      setProgress(steps[5]); if (!parsed.totalCents) throw Object.assign(new Error("We couldn't find a receipt total."), { kind: 'not-receipt' }); setDraft(parsed); setCompleted(steps); setProgress(null); processing.current = false; return 'review';
    } catch (error) {
      const item = error as Error & { kind?: ReceiptFailureKind }; const kind = item.kind ?? (/network|fetch|function/i.test(item.message) ? 'network' : 'provider');
      setFailure(kind); setFailureMessage(item.message); setProgress(null); processing.current = false; return 'failed';
    }
  }, [draft, source]);
  const updateDraft = useCallback((patch: Partial<ReceiptDraft>) => setDraft((current) => current ? { ...current, ...patch } : current), []);
  const save = useCallback(async () => { if (!draft) return { ok: false as const, message: 'No receipt is ready to save.' }; setSaving(true); const result = await saveReceiptExpense(draft); setSaving(false); return result; }, [draft]);
  const value = useMemo(() => ({ source, draft, progress, completed, failure, failureMessage, saving, setSource, process, updateDraft, save, reset }), [source, draft, progress, completed, failure, failureMessage, saving, setSource, process, updateDraft, save, reset]);
  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
}
export function useReceipt() { const value = useContext(ReceiptContext); if (!value) throw new Error('useReceipt must be used within ReceiptProvider'); return value; }
