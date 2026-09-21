export type Transaction = { id: string; merchant: string; category: string; amount: number; day: string; icon: string; color: string };

export const transactions: Transaction[] = [
  { id: 'jollibee', merchant: 'Jollibee', category: 'Food & Dining', amount: 230, day: 'Today', icon: 'food', color: '#F9D0D0' },
  { id: 'grab', merchant: 'Grab', category: 'Transportation', amount: 175, day: 'Today', icon: 'car', color: '#20B86A' },
  { id: 'watsons', merchant: 'Watsons', category: 'Health', amount: 420, day: 'Yesterday', icon: 'medical-bag', color: '#2BB5DF' },
  { id: 'sm', merchant: 'SM Supermarket', category: 'Groceries', amount: 690, day: 'Sep 16, 2024', icon: 'cart', color: '#5795EA' },
];

export const categories = [
  ['food-fork-drink', 'Food & Dining', '#FDE4DE'], ['car', 'Transportation', '#E1EDDC'], ['shopping', 'Shopping', '#FFE9D0'], ['receipt-text', 'Bills', '#DDEBFA'],
  ['heart-pulse', 'Health', '#FBE0E3'], ['school', 'Education', '#FFE9D0'], ['gamepad-variant', 'Entertainment', '#DDEBFA'], ['cart', 'Groceries', '#E1EDDC'],
  ['lotion', 'Personal Care', '#FFE9D0'], ['dots-horizontal', 'Other', '#E8E7EF'],
] as const;

export const budgets = [
  ['food-fork-drink', 'Food & Dining', 1500, 1200], ['car', 'Transportation', 1500, 680], ['shopping', 'Shopping', 2000, 1450],
  ['receipt-text', 'Bills', 2000, 930], ['heart-pulse', 'Health', 1000, 430],
] as const;
