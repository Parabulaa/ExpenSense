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

export type ReceiptDraft = {
  image: ReceiptImage;
  merchant: string;
  transactionDate: string;
  items: ReceiptItemDraft[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  categoryId: string;
  walletId: string;
  notes: string;
  rawText: string;
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
