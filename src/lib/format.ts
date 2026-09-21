const PESO = '₱';

/**
 * Percentage of `whole` that `part` represents, or null when the question has
 * no meaningful answer — a zero, missing or non-finite denominator. Callers are
 * forced to handle the null case, which is what stops "2500%" style values from
 * a budget that was never really set.
 *
 * A genuine over-budget result (>100%) is returned as-is: that is real
 * information, not a glitch.
 */
export function percentOf(part: number, whole: number | null | undefined): number | null {
  if (whole === null || whole === undefined) return null;
  if (!Number.isFinite(part) || !Number.isFinite(whole)) return null;
  if (whole <= 0) return null;

  const value = Math.round((part / whole) * 100);
  return Number.isFinite(value) ? value : null;
}

/** "67%" — never "NaN%", "Infinity%" or "30.000000%". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

/**
 * Peso amounts from integer cents. Decimals are shown only when the value has
 * them, so a list reads "₱7,500" rather than "₱7,500.00" while still keeping
 * "₱230.50" exact.
 */
export function formatPeso(cents: number, options?: { alwaysShowDecimals?: boolean }): string {
  if (!Number.isFinite(cents)) return `${PESO}0`;

  const amount = cents / 100;
  const hasFraction = Math.round(cents) % 100 !== 0;
  const fractionDigits = options?.alwaysShowDecimals || hasFraction ? 2 : 0;

  return `${PESO}${amount.toLocaleString('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Font size for a currency figure that has to share a fixed-width card. Long
 * values step down in a few predictable stages rather than scaling smoothly,
 * so the same amount always renders at the same size.
 */
export function currencyFontSize(formatted: string, base: number): number {
  const length = formatted.length;
  if (length <= 8) return base;
  if (length <= 11) return Math.round(base * 0.82);
  if (length <= 14) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}
