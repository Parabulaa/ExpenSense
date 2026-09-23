import type { ReceiptDraft, ReceiptImage, ReceiptItemDraft } from './types';

const money = /(?:PHP|P|₱)?\s*([0-9]{1,7}(?:[,.][0-9]{2}))/i;
const labels = /^(subtotal|tax|vat|total|cash|change|amount due|balance)/i;

function cents(value: string) {
  return Math.round(Number(value.replace(/,/g, '')) * 100);
}

function dateFromText(text: string) {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const common = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (common) return `${common[3]}-${common[1].padStart(2, '0')}-${common[2].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

export function assessReceiptStructure(rawText: string) {
  const lower = rawText.toLowerCase();
  let score = 0;
  if (/\b(receipt|invoice|official receipt)\b/.test(lower)) score += 2;
  if (/\b(total|amount due|balance due)\b/.test(lower)) score += 2;
  if (/\b(subtotal|tax|vat)\b/.test(lower)) score += 1;
  if (/\b(date|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/.test(lower)) score += 1;
  if ((rawText.match(money) ?? []).length || (rawText.match(/[0-9]+[,.][0-9]{2}/g) ?? []).length >= 2) score += 1;
  if (rawText.split(/\r?\n/).filter(Boolean).length >= 5) score += 1;
  return score;
}

export function parseReceipt(rawText: string, image: ReceiptImage, providerConfidence = 0): ReceiptDraft {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const score = assessReceiptStructure(rawText);
  const merchant = lines.find((line) => /[a-z]{3}/i.test(line) && !labels.test(line) && !/receipt|invoice/i.test(line))?.slice(0, 80) ?? 'Receipt expense';
  const findLabeled = (pattern: RegExp) => {
    const line = [...lines].reverse().find((candidate) => pattern.test(candidate) && money.test(candidate));
    const match = line?.match(money);
    return match ? cents(match[1]) : 0;
  };
  const total = findLabeled(/\b(total|amount due|balance due)\b/i);
  const subtotal = findLabeled(/\bsubtotal\b/i);
  const tax = findLabeled(/\b(tax|vat)\b/i);
  const items: ReceiptItemDraft[] = lines.flatMap((line, index) => {
    if (labels.test(line)) return [];
    const match = line.match(money);
    if (!match) return [];
    const name = line.slice(0, match.index).replace(/^\d+\s*[x×]?\s*/i, '').trim();
    if (name.length < 2) return [];
    return [{ id: `${index}-${match[1]}`, name: name.slice(0, 80), quantity: Number(line.match(/^(\d+)\s*[x×]/i)?.[1] ?? 1), lineTotalCents: cents(match[1]) }];
  }).slice(0, 30);
  const calculated = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const resolvedSubtotal = subtotal || Math.max(0, total - tax) || calculated;
  const resolvedTotal = total || resolvedSubtotal + tax;
  const issues: string[] = [];
  if (!total) issues.push('Confirm the total');
  if (!items.length) issues.push('No line items were confidently detected');
  if (resolvedSubtotal && resolvedTotal && Math.abs(resolvedSubtotal + tax - resolvedTotal) > 2) issues.push('Subtotal and tax do not match the total');
  const confidence = Math.max(0, Math.min(100, Math.round(providerConfidence * 70 + Math.min(score, 8) / 8 * 30)));
  return { image, merchant, transactionDate: dateFromText(rawText), items, subtotalCents: resolvedSubtotal, taxCents: tax, totalCents: resolvedTotal, categoryId: '', walletId: '', notes: '', rawText, confidence, structureScore: score, issues };
}
