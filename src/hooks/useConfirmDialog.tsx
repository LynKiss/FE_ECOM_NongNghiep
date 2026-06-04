import { useCallback, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog, { type ConfirmDialogTone } from '../components/shared/ConfirmDialog';

type ConfirmOptions = {
  title: string;
  description?: string;
  tone?: ConfirmDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: ReactNode;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
  });

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((current) => ({ ...current, open: false }));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      tone={state.tone}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
    >
      {state.children}
    </ConfirmDialog>
  );

  return { confirm, ConfirmDialog: dialog };
}
