import { CheckCircle2, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const toneStyles = {
  success: {
    icon: CheckCircle2,
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  error: {
    icon: OctagonAlert,
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    badge: 'bg-red-100 text-red-700',
  },
  info: {
    icon: Info,
    wrapper: 'border-sky-200 bg-sky-50 text-sky-900',
    badge: 'bg-sky-100 text-sky-700',
  },
  warning: {
    icon: TriangleAlert,
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
} as const;

export default function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const style = toneStyles[toast.tone];
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-[1.5rem] border px-4 py-4 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur ${style.wrapper}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${style.badge}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm opacity-80">{toast.description}</p> : null}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="rounded-full p-1 opacity-55 transition hover:bg-black/5 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
