import React from 'react';
import {
  Briefcase, Camera, ClipboardCheck, GraduationCap, PencilLine, PieChart,
  ReceiptText, ScanLine, ShoppingBag, Tags, Wallet, type LucideProps,
} from 'lucide-react';

// Explicit map keeps the bundle small (no `import *` of every icon).
const icons = {
  Briefcase, Camera, ClipboardCheck, GraduationCap, PencilLine, PieChart,
  ReceiptText, ScanLine, ShoppingBag, Tags, Wallet,
} as const;

export type IconName = keyof typeof icons;

export const Icon: React.FC<{ name: string } & LucideProps> = ({ name, ...props }) => {
  const Cmp = icons[name as IconName] ?? ReceiptText;
  return <Cmp strokeWidth={2} aria-hidden="true" {...props} />;
};
