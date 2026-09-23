import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WalletType } from './types';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Shared wallet vocabulary. Lives outside the screens so the wallet tab, the
 * manage screen and any future picker label a wallet type identically.
 */
export const walletTypes: { id: WalletType; label: string; icon: IconName }[] = [
  { id: 'cash', label: 'Cash', icon: 'cash' },
  { id: 'gcash', label: 'GCash', icon: 'cellphone' },
  { id: 'maya', label: 'Maya', icon: 'cellphone-check' },
  { id: 'bank', label: 'Bank', icon: 'bank-outline' },
  { id: 'other', label: 'Other', icon: 'wallet-outline' },
];

/** Card face colours, deep enough that white type stays readable on every one. */
export const walletColors = ['#174D36', '#2F7D57', '#3477B8', '#7A5AA6', '#D18726', '#C85B52'];

export function walletTypeMeta(type: WalletType) {
  return walletTypes.find((item) => item.id === type) ?? walletTypes[walletTypes.length - 1];
}

export function walletAccent(color: string | null, index = 0) {
  return color ?? walletColors[index % walletColors.length];
}
