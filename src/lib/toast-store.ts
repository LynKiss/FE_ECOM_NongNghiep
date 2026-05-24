export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function showToast(input: Omit<ToastItem, 'id'>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: ToastItem = { id, ...input };

  toasts = [...toasts, toast];
  emitChange();

  window.setTimeout(() => {
    dismissToast(id);
  }, 3200);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emitChange();
}
