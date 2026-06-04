import type { ReactNode } from 'react';
import { CheckCircle2, Info, LoaderCircle, OctagonAlert, TriangleAlert } from 'lucide-react';
import Modal from './Modal';

export type ConfirmDialogTone = 'danger' | 'warning' | 'info' | 'success';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  tone?: ConfirmDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const toneConfig: Record<
  ConfirmDialogTone,
  {
    icon: typeof TriangleAlert;
    iconClass: string;
    confirmClass: string;
  }
> = {
  danger: {
    icon: OctagonAlert,
    iconClass: 'bg-red-50 text-red-600 ring-red-100',
    confirmClass: 'bg-red-600 text-white hover:bg-red-700',
  },
  warning: {
    icon: TriangleAlert,
    iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
    confirmClass: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  info: {
    icon: Info,
    iconClass: 'bg-sky-50 text-sky-600 ring-sky-100',
    confirmClass: 'bg-primary text-white hover:bg-primary/90',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    confirmClass: 'bg-primary text-white hover:bg-primary/90',
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  tone = 'warning',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  loading = false,
  disabled = false,
  children,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const cfg = toneConfig[tone];
  const Icon = cfg.icon;

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={loading ? () => undefined : onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading || disabled}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50 ${cfg.confirmClass}`}
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${cfg.iconClass}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1 text-sm leading-6 text-on-surface-variant">
          {children ?? (
            <p>
              Thao tác này sẽ được ghi nhận vào hệ thống. Vui lòng kiểm tra lại
              trước khi xác nhận.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
