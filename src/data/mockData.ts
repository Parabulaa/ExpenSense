export type Transaction = { id: string; merchant: string; category: string; amount: number; day: string; icon: string; color: string };
export const transactions: Transaction[] = [
  { id: 'jollibee', merchant: 'Jollibee', category: 'Food & Dining', amount: 230, day: 'Today', icon: '🍗', color: '#F9D0D0' },
  { id: 'grab', merchant: 'Grab', category: 'Transportation', amount: 175, day: 'Today', icon: '🚗', color: '#20B86A' },
  { id: 'watsons', merchant: 'Watsons', category: 'Health', amount: 420, day: 'Yesterday', icon: 'W', color: '#2BB5DF' },
  { id: 'sm', merchant: 'SM Supermarket', category: 'Groceries', amount: 690, day: 'Sep 16, 2024', icon: '🛒', color: '#5795EA' },
];
export const categories = [
  ['🍴', 'Food & Dining', '#FDE4DE'], ['🚗', 'Transportation', '#E1EDDC'], ['🛍', 'Shopping', '#FFE9D0'], ['▤', 'Bills', '#DDEBFA'],
  ['♥', 'Health', '#FBE0E3'], ['🎓', 'Education', '#FFE9D0'], ['🎮', 'Entertainment', '#DDEBFA'], ['🛒', 'Groceries', '#E1EDDC'],
  ['▰', 'Personal Care', '#FFE9D0'], ['•••', 'Other', '#E8E7EF'],
] as const;
export const budgets = [
  ['🍴', 'Food & Dining', 1500, 1200], ['🚗', 'Transportation', 1500, 680], ['🛍', 'Shopping', 2000, 1450],
  ['▤', 'Bills', 2000, 930], ['♥', 'Health', 1000, 430],
] as const;
