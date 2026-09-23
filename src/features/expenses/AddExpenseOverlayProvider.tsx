import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { AddExpenseSheet } from '@/screens/expense-screens';

type AddExpenseOverlayValue = {
  openAddExpense: () => void;
  closeAddExpense: () => void;
};

const AddExpenseOverlayContext = createContext<AddExpenseOverlayValue | null>(null);

export function AddExpenseOverlayProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const openAddExpense = useCallback(() => setVisible(true), []);
  const closeAddExpense = useCallback(() => setVisible(false), []);
  const navigate = useCallback((route: '/scanner' | '/manual-expense' | '/processing') => {
    setVisible(false);
    requestAnimationFrame(() => router.push(route));
  }, []);
  const value = useMemo(() => ({ openAddExpense, closeAddExpense }), [closeAddExpense, openAddExpense]);

  return (
    <AddExpenseOverlayContext.Provider value={value}>
      {children}
      <AddExpenseSheet visible={visible} onClose={closeAddExpense} onNavigate={navigate} />
    </AddExpenseOverlayContext.Provider>
  );
}

export function useAddExpenseOverlay() {
  const value = useContext(AddExpenseOverlayContext);
  if (!value) throw new Error('useAddExpenseOverlay must be used within AddExpenseOverlayProvider');
  return value;
}
