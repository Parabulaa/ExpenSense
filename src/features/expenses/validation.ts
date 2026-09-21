import type { CreateExpenseInput, ExpenseFormErrors, ExpenseFormValues } from './types';

export const MAX_AMOUNT_CENTS = 999_999_999;
export const MAX_MERCHANT_LENGTH = 120;
export const MAX_NOTES_LENGTH = 500;

export function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function localDateToDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function dateToLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatExpenseDate(value: string) {
  if (!isValidLocalDate(value)) return value;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(localDateToDate(value));
}

export function normalizeAmountInput(value: string, previous = '') {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return '';
  // Reject invalid keystrokes instead of silently turning a negative value
  // into a positive expense or merging malformed decimal strings.
  if (!/^\d{0,7}(\.\d{0,2})?$/.test(cleaned)) return previous;
  const [whole = '', decimal] = cleaned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  return decimal !== undefined ? `${normalizedWhole || '0'}.${decimal}` : normalizedWhole;
}

function parseAmountCents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function validateExpenseForm(values: ExpenseFormValues): {
  errors: ExpenseFormErrors;
  input: CreateExpenseInput | null;
} {
  const errors: ExpenseFormErrors = {};
  const amountCents = parseAmountCents(values.amount.trim());
  const merchant = values.merchant.trim();
  const notes = values.notes.trim();

  if (!values.amount.trim()) errors.amount = 'Enter an amount.';
  else if (amountCents === null) errors.amount = 'Use a valid amount with up to 2 decimal places.';
  else if (amountCents <= 0) errors.amount = 'Amount must be greater than zero.';
  else if (amountCents > MAX_AMOUNT_CENTS) errors.amount = 'Amount is above the supported limit.';

  if (!merchant) errors.merchant = 'Enter a merchant or description.';
  else if (merchant.length > MAX_MERCHANT_LENGTH) errors.merchant = `Use ${MAX_MERCHANT_LENGTH} characters or fewer.`;

  if (!values.categoryId.trim()) {
    errors.categoryId = 'Choose a category.';
  }

  if (!isValidLocalDate(values.transactionDate)) errors.transactionDate = 'Choose a valid date.';
  else if (values.transactionDate > todayLocalDate()) errors.transactionDate = 'Expense date cannot be in the future.';

  if (notes.length > MAX_NOTES_LENGTH) errors.notes = `Use ${MAX_NOTES_LENGTH} characters or fewer.`;

  if (Object.keys(errors).length > 0 || amountCents === null) return { errors, input: null };

  return {
    errors,
    input: {
      amountCents,
      merchant,
      categoryId: values.categoryId,
      transactionDate: values.transactionDate,
      notes,
    },
  };
}
