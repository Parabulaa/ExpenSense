import { nowLocalTime, todayLocalDate } from '@/features/expenses/validation';
import type { ReceiptClassification, ReceiptDraft, ReceiptImage, ReceiptItemDraft, ReceiptKind } from './types';

const money = /(?:PHP|P|₱)?\s*([0-9]{1,7}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]{1,7},[0-9]{2})/i;
const labels = /^(subtotal|sub total|tax|vat|vatable|total|cash|change|amount|balance|fee|service fee|ref|reference|transaction)/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const itemMetadata = /\b(?:tin|vat|invoice|receipt|serial|terminal|cashier|operator|table|order|date|time|address|telephone|tel\.?|permit|accreditation|official|customer|buyer)\b/i;

/** A detected type needs this much confidence before it is preselected. */
export const CLASSIFICATION_THRESHOLD = 60;

function cents(value: string) {
  // "1,234.50" → 123450; a lone comma decimal ("350,00") is treated as a point.
  const normalized = /^[0-9]+,[0-9]{2}$/.test(value) ? value.replace(',', '.') : value.replace(/,/g, '');
  return Math.round(Number(normalized) * 100);
}

/** VAT portion of a tax-inclusive Philippine peso amount. */
export function includedVatCents(totalCents: number) {
  return Math.max(0, Math.round(totalCents * 12 / 112));
}

/** VAT added to a tax-exclusive subtotal. */
export function addedVatCents(subtotalCents: number) {
  return Math.max(0, Math.round(subtotalCents * 0.12));
}

function pad(value: string | number) {
  return String(value).padStart(2, '0');
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** The printed date, or null when none is readable. */
function dateFromText(text: string) {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso && validDate(+iso[1], +iso[2], +iso[3])) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const common = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (common && validDate(+common[3], +common[1], +common[2])) return `${common[3]}-${pad(common[1])}-${pad(common[2])}`;
  const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase()) + 1;
    if (validDate(+named[3], month, +named[2])) return `${named[3]}-${pad(month)}-${pad(named[2])}`;
  }
  return null;
}

/** The printed time as `HH:MM`, or null when none is readable. */
function timeFromText(text: string) {
  const match = text.match(/\b(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*([ap]\.?m\.?)?(?![\d.,])/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const meridiem = match[3]?.toLowerCase().replace(/\./g, '');
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (hours > 23) return null;
  return `${pad(hours)}:${match[2]}`;
}

function referenceFromText(text: string) {
  const match = text.match(/\b(?:ref(?:erence)?\.?\s*(?:no\.?|number|#)?|transaction\s*(?:id|no\.?|number))\s*[:#]?\s*([A-Z0-9][A-Z0-9 -]{5,30}[A-Z0-9])/i);
  return match ? match[1].replace(/[\s-]/g, '').toUpperCase() : null;
}

export function assessReceiptStructure(rawText: string) {
  const lower = rawText.toLowerCase();
  let score = 0;
  if (/\b(receipt|invoice|official receipt)\b/.test(lower)) score += 2;
  if (/\b(total|amount due|balance due)\b/.test(lower)) score += 2;
  // E-wallet confirmations rarely say "receipt" but always carry a reference.
  if (referenceFromText(rawText) && /\b(amount|sent|received|cash[\s-]?in|transfer)\b/.test(lower)) score += 2;
  if (/\b(subtotal|tax|vat)\b/.test(lower)) score += 1;
  if (/\b(date|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/.test(lower) || dateFromText(rawText)) score += 1;
  if ((rawText.match(/[0-9]+[,.][0-9]{2}/g) ?? []).length >= 1) score += 1;
  if (rawText.split(/\r?\n/).filter(Boolean).length >= 5) score += 1;
  return score;
}

/** Rejects phone/app screenshots uploaded as if they were receipt photos. */
export function isLikelyReceiptScreenshot(rawText: string, image: ReceiptImage) {
  if (image.origin !== 'gallery') return false;
  const lower = rawText.toLowerCase();
  const aspect = Math.max(image.width, image.height) / Math.max(1, Math.min(image.width, image.height));
  const appMarkers = [
    /\breview receipt\b/, /\brecognition confidence\b/, /\btap the photo to view it\b/,
    /\btransaction type\b/, /\bselect category\b/, /\bpaid from wallet\b/,
    /\bconfirm\s*&\s*save\b/, /\bitems\s*\(\s*\d+\s*\)/,
  ].filter((pattern) => pattern.test(lower)).length;
  const screenChrome = [
    /\bsos only\b/, /\b(?:4g|5g|lte|wi-?fi)\b/, /\b\d{1,3}%\b/,
  ].filter((pattern) => pattern.test(lower)).length;
  return appMarkers >= 2 || (aspect >= 1.7 && appMarkers >= 1 && screenChrome >= 1) || (aspect >= 1.9 && screenChrome >= 2);
}

type Signal = { kind: Exclude<ReceiptKind, 'unknown'>; weight: number; label: string; test: (lower: string, context: { items: number; reference: boolean }) => boolean };

/**
 * Evidence for each transaction type. Every entry is an independent signal;
 * a type is only chosen when several distinct signals agree, so one stray
 * keyword ("transfer" in a store's footer, say) can never decide it alone.
 */
const SIGNALS: Signal[] = [
  { kind: 'expense', weight: 2, label: 'Line items listed', test: (_, c) => c.items >= 2 },
  { kind: 'expense', weight: 1, label: 'Subtotal, VAT or service charge', test: (l) => /\b(subtotal|sub total|vatable|vat exempt|vat|service charge)\b/.test(l) },
  { kind: 'expense', weight: 1, label: 'Payment tendered and change', test: (l) => /\b(change|cash tendered|amount tendered|tendered)\b/.test(l) },
  { kind: 'expense', weight: 1, label: 'Store receipt details', test: (l) => /\b(cashier|server|table|qty|quantity|sales invoice|official receipt|or no|tin|pos|terminal|order no)\b/.test(l) },
  { kind: 'expense', weight: 1, label: 'Amount due', test: (l) => /\b(amount due|total due|grand total)\b/.test(l) },

  { kind: 'cash_in', weight: 2, label: 'Cash-in wording', test: (l) => /\bcash[\s-]?in\b/.test(l) },
  { kind: 'cash_in', weight: 1, label: 'Top-up or deposit', test: (l) => /\b(top[\s-]?up|load wallet|add money|deposit(ed)?)\b/.test(l) },
  { kind: 'cash_in', weight: 1, label: 'Money received', test: (l) => /\b(received|credited|you have received)\b/.test(l) },
  { kind: 'cash_in', weight: 1, label: 'Cash-in partner', test: (l) => /\b(7-?eleven|cliqq|bayad|palawan|m ?lhuillier|cebuana|ecpay|over[\s-]the[\s-]counter)\b/.test(l) },

  { kind: 'transfer', weight: 2, label: 'Transfer wording', test: (l) => /\b(send money|sent via|express send|fund transfer|bank transfer|transfer(red)? to|instapay|pesonet)\b/.test(l) },
  { kind: 'transfer', weight: 1, label: 'Recipient account', test: (l) => /\b(to|recipient|receiver|beneficiary|account name|account no)\b[^\n]*(\*{2,}|x{3,}|\d{4})/.test(l) },
  { kind: 'transfer', weight: 1, label: 'Source account', test: (l) => /\bfrom\b[^\n]*(\*{2,}|x{3,}|account|\d{4})/.test(l) },
  { kind: 'transfer', weight: 1, label: 'Transfer fee', test: (l) => /\b(transfer fee|transaction fee|service fee|convenience fee)\b/.test(l) },

  // E-wallet structure supports either kind of money movement, never a purchase.
  { kind: 'cash_in', weight: 1, label: 'E-wallet reference number', test: (_, c) => c.reference },
  { kind: 'transfer', weight: 1, label: 'E-wallet reference number', test: (_, c) => c.reference },
];

export function classifyReceipt(rawText: string, itemCount: number): ReceiptClassification {
  const lower = rawText.toLowerCase();
  const context = { items: itemCount, reference: Boolean(referenceFromText(rawText)) };
  const scores = { expense: 0, cash_in: 0, transfer: 0 };
  const matched = { expense: [] as string[], cash_in: [] as string[], transfer: [] as string[] };
  SIGNALS.forEach((signal) => {
    if (!signal.test(lower, context)) return;
    scores[signal.kind] += signal.weight;
    matched[signal.kind].push(signal.label);
  });
  const ranked = (Object.keys(scores) as (keyof typeof scores)[]).sort((a, b) => scores[b] - scores[a]);
  const [best, second] = ranked;
  const lead = scores[best] - scores[second];
  // At least two independent signals, a real score, and a clear lead.
  const decisive = matched[best].length >= 2 && scores[best] >= 3 && lead >= 2;
  const confidence = scores[best] === 0 ? 0 : Math.round(Math.min(1, lead / scores[best]) * Math.min(1, scores[best] / 5) * 100);
  if (!decisive || confidence < CLASSIFICATION_THRESHOLD) return { kind: 'unknown', confidence, signals: matched[best] };
  return { kind: best, confidence, signals: matched[best] };
}

/** Small deterministic string hash (two FNV-1a passes), for receipt identity. */
function hash(value: string) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export function receiptFingerprint(parts: { reference: string | null; merchant: string; date: string | null; time: string | null; totalCents: number }) {
  // A printed reference number is unique on its own; otherwise the combination
  // of what was printed identifies the receipt.
  const basis = parts.reference
    ? `ref|${parts.reference}|${parts.totalCents}`
    : `txt|${parts.merchant.toLowerCase().replace(/[^a-z0-9]/g, '')}|${parts.date ?? ''}|${parts.time ?? ''}|${parts.totalCents}`;
  return hash(basis);
}

export function parseReceipt(rawText: string, image: ReceiptImage, providerConfidence = 0): ReceiptDraft {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const score = assessReceiptStructure(rawText);
  const merchant = lines.find((line) => /[a-z]{3}/i.test(line) && !labels.test(line) && !/receipt|invoice/i.test(line))?.slice(0, 80) ?? 'Receipt';
  const findLabeled = (pattern: RegExp, exclude?: RegExp) => {
    const line = [...lines].reverse().find((candidate) => pattern.test(candidate) && (!exclude || !exclude.test(candidate)) && money.test(candidate));
    const match = line?.match(money);
    return match ? cents(match[1]) : 0;
  };
  const total = findLabeled(/\b(total|amount due|balance due|grand total)\b/i, /\bsub\s?total\b/i)
    || findLabeled(/\b(amount sent|total amount sent|amount paid|cash[\s-]?in amount|amount received|amount)\b/i, /\bfee\b/i);
  const subtotal = findLabeled(/\bsub\s?total\b/i);
  const printedTax = findLabeled(/\b(tax|vat)\b/i, /\b(vatable|vat exempt|vat[\s-]?able)\b/i);
  const fee = findLabeled(/\b(fee|service fee|transfer fee|transaction fee|convenience fee)\b/i);
  const items: ReceiptItemDraft[] = lines.flatMap((line, index) => {
    if (labels.test(line)) return [];
    const matches = [...line.matchAll(new RegExp(money.source, 'ig'))];
    if (!matches.length) return [];
    const match = matches[matches.length - 1];
    let name = line.slice(0, match.index).replace(/^\d+\s*[x×]?\s*/i, '').trim();
    // OCR often splits the product name from its quantity/price line.
    if (name.length < 2 || !/[a-z]/i.test(name)) {
      const previous = lines.slice(Math.max(0, index - 2), index).reverse().find((candidate) =>
        /[a-z]{2}/i.test(candidate) && !labels.test(candidate) && !itemMetadata.test(candidate) && !money.test(candidate),
      );
      name = previous?.trim() ?? '';
    }
    if (itemMetadata.test(name)) return [];
    if (name.length < 2) return [];
    return [{ id: `${index}-${match[1]}`, name: name.slice(0, 80), quantity: Number(line.match(/^(\d+)\s*[x×]/i)?.[1] ?? 1), lineTotalCents: cents(match[1]) }];
  }).slice(0, 30);
  const detected = classifyReceipt(rawText, items.length);
  const calculated = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const defaultsToVat = detected.kind === 'expense' || detected.kind === 'unknown';
  const tax = printedTax || (defaultsToVat ? includedVatCents(total) : 0);
  const resolvedSubtotal = subtotal || Math.max(0, total - tax) || calculated;
  const resolvedTotal = total || resolvedSubtotal + tax;
  // A transfer's amount is what the recipient gets. E-wallet receipts often
  // print a "total sent" that already includes the fee; since the fee is
  // charged separately, using that total would take the fee twice.
  const plainAmount = findLabeled(/\bamount\b/i, /\b(total|fee|due)\b/i);
  const transferAmount = plainAmount || Math.max(0, resolvedTotal - fee);
  const printedDate = dateFromText(rawText);
  const printedTime = timeFromText(rawText);
  const reference = referenceFromText(rawText);
  const issues: string[] = [];
  if (!total) issues.push('Confirm the amount');
  if (total && !printedTax && defaultsToVat) issues.push('12% VAT was estimated from the total');
  if (!printedDate) issues.push('No date was printed; today was used');
  if (detected.kind === 'unknown') issues.push('Choose whether this is an expense, cash-in or transfer');
  if (detected.kind === 'expense' && !items.length) issues.push('No line items were confidently detected');
  if (detected.kind === 'expense' && resolvedSubtotal && resolvedTotal && Math.abs(resolvedSubtotal + tax - resolvedTotal) > 2) issues.push('Subtotal and tax do not match the total');
  const confidence = Math.max(0, Math.min(100, Math.round(providerConfidence * 70 + Math.min(score, 8) / 8 * 30)));
  const today = todayLocalDate();
  const transactionDate = printedDate && printedDate <= today ? printedDate : today;
  return {
    image,
    kind: detected.kind,
    detected,
    merchant: detected.kind === 'cash_in' ? merchant || 'Cash-in' : merchant,
    transactionDate,
    transactionTime: printedTime && !(transactionDate === today && printedTime > nowLocalTime()) ? printedTime : nowLocalTime(),
    items,
    subtotalCents: resolvedSubtotal,
    taxCents: tax,
    totalCents: detected.kind === 'transfer' ? transferAmount : resolvedTotal,
    // Kept even when not detected as a transfer, so switching the type on the
    // review screen starts from the printed fee. It is only ever applied to transfers.
    feeCents: fee,
    categoryId: '',
    walletId: '',
    destinationWalletId: '',
    notes: '',
    rawText,
    reference,
    fingerprint: receiptFingerprint({ reference, merchant, date: printedDate, time: printedTime, totalCents: resolvedTotal }),
    confidence,
    structureScore: score,
    issues,
  };
}
