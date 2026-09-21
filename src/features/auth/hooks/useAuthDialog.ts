import { useCallback, useState } from 'react';

import type { AuthDialogProps } from '../components/AuthDialog';

type DialogConfig = Omit<AuthDialogProps, 'visible' | 'onRequestClose'>;

export function useAuthDialog() {
  const [config, setConfig] = useState<DialogConfig | null>(null);

  const showDialog = useCallback((next: DialogConfig) => setConfig(next), []);
  const hideDialog = useCallback(() => setConfig(null), []);

  const dialogProps: AuthDialogProps | null = config
    ? { ...config, visible: true, onRequestClose: hideDialog }
    : null;

  return { dialogProps, showDialog, hideDialog };
}
