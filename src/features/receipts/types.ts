export type ReceiptItemDraft = {
  id: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
};

export type ReceiptImage = {
  uri: string;
  width: number;
  height: number;
  size?: number;
};

/** What a confirmed receipt will record. `unknown` must be resolved by the user. */
export type ReceiptKind = 'expense' | 'cash_in' | 'transfer' | 'unknown';

export type ReceiptClassification = {
  kind: ReceiptKind;
  /** 0–100. Below the review threshold the user must pick the type. */
  confidence: number;
  /** Human-readable evidence, shown on the review screen. */
  signals: string[];
};

export type ReceiptDraft = {
  image: ReceiptImage;
  /** Detected by the parser; the user can change it before confirming. */
  kind: ReceiptKind;
  detected: ReceiptClassification;
  /** Merchant for expenses, source for cash-in, description for transfers. */
  merchant: string;
  transactionDate: string;
  /** `HH:MM`; read from the receipt when printed, otherwise the scan time. */
  transactionTime: string;
  items: ReceiptItemDraft[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Transfer fee printed on the receipt; leaves the source wallet only. */
  feeCents: number;
  categoryId: string;
  /** Expense: paying wallet. Cash-in: receiving wallet. Transfer: source wallet. */
  walletId: string;
  /** Transfer destination wallet. */
  destinationWalletId: string;
  notes: string;
  rawText: string;
  /** Reference / transaction number printed on e-wallet receipts, if any. */
  reference: string | null;
  /**
   * Identity of the physical receipt, taken from what was printed on it (not
   * from later edits), so scanning the same receipt twice is rejected.
   */
  fingerprint: string;
  confidence: number;
  structureScore: number;
  issues: string[];
};

export type ReceiptProgress =
  | 'Preparing image'
  | 'Checking image quality'
  | 'Reading receipt'
  | 'Checking receipt structure'
  | 'Extracting details'
  | 'Checking totals';

export type ReceiptFailureKind = 'permission' | 'quality' | 'not-receipt' | 'network' | 'provider' | 'unknown';
