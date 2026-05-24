import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CheckCircle2, Search, TicketPercent, X } from 'lucide-react';
import {
  type Voucher,
  getVoucherProgress,
  money,
  sortVouchers,
  voucherMinOrder,
  voucherMissingAmount,
  voucherScopeLabel,
  voucherShortMeta,
  voucherSavings,
  voucherValueLabel,
} from '../../lib/vouchers';

type VoucherFilter = 'all' | 'ready' | 'locked' | 'saved';

type Props = {
  open: boolean;
  vouchers: Voucher[];
  loading?: boolean;
  subtotal: number;
  selectedCode?: string;
  onApply: (code: string) => void;
  onClose: () => void;
};

const FILTERS: Array<{ key: VoucherFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'ready', label: 'Dùng được' },
  { key: 'locked', label: 'Cần mua thêm' },
  { key: 'saved', label: 'Đã nhận' },
];

export default function VoucherSelectorModal({
  open,
  vouchers,
  loading = false,
  subtotal,
  selectedCode,
  onApply,
  onClose,
}: Props) {
  const [filter, setFilter] = useState<VoucherFilter>('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setFilter('all');
      setKeyword('');
    }
  }, [open]);

  const sorted = useMemo(() => sortVouchers(vouchers), [vouchers]);
  const readyCount = sorted.filter((voucher) => voucher.eligible).length;
  const visible = sorted.filter((voucher) => {
    if (filter === 'ready' && !voucher.eligible) return false;
    if (filter === 'locked' && voucher.eligible) return false;
    if (filter === 'saved' && !voucher.isSaved) return false;
    const text = `${voucher.code} ${voucher.name}`.toLowerCase();
    return text.includes(keyword.trim().toLowerCase());
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Chọn voucher"
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[1.5rem] bg-[#f7f4ef] shadow-2xl sm:max-w-3xl sm:rounded-[1.5rem]"
      >
        <div className="flex items-start justify-between gap-4 bg-[#1E3932] px-5 py-5 text-white">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white/75">
              <TicketPercent size={14} /> Chọn voucher
            </p>
            <h2 className="mt-3 text-2xl font-black">Ưu đãi cho đơn hàng</h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {readyCount} voucher dùng được với giỏ hiện tại.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-black/5 bg-white px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm mã hoặc tên voucher"
                className="w-full rounded-xl border border-black/10 bg-[#f7f4ef] py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#00754A]"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition ${
                    filter === item.key
                      ? 'bg-[#00754A] text-white'
                      : 'border border-[#00754A]/20 bg-white text-[#1E3932] hover:bg-[#d4e9e2]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
            </div>
          ) : visible.length ? (
            <div className="space-y-3">
              {visible.map((voucher) => (
                <VoucherOption
                  key={voucher.id}
                  voucher={voucher}
                  subtotal={subtotal}
                  selected={selectedCode === voucher.code}
                  onApply={() => {
                    onApply(voucher.code);
                    onClose();
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white px-5 py-12 text-center">
              <TicketPercent size={44} className="mx-auto mb-3 text-[#006241]/25" />
              <p className="text-base font-black text-[#1E3932]">Không có voucher phù hợp</p>
              <p className="mt-1 text-sm text-gray-500">Thử đổi bộ lọc hoặc nhập mã thủ công ở giỏ hàng.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function VoucherOption({
  voucher,
  subtotal,
  selected,
  onApply,
}: {
  voucher: Voucher;
  subtotal: number;
  selected: boolean;
  onApply: () => void;
}) {
  const eligible = Boolean(voucher.eligible);
  const progress = getVoucherProgress(voucher, subtotal);
  const missingAmount = voucherMissingAmount(voucher);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white ${
        selected ? 'border-[#00754A] ring-2 ring-[#00754A]/10' : 'border-black/8'
      }`}
    >
      <div className="grid grid-cols-[86px_1fr] sm:grid-cols-[112px_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 bg-[#006241] p-3 text-center text-white">
          <BadgePercent size={26} />
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-black text-[#006241]">
            {voucherValueLabel(voucher)}
          </span>
        </div>
        <div className="min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-black text-[#1E3932]">{voucher.code}</p>
                <span className="rounded-full bg-[#eef5f1] px-2 py-0.5 text-[10px] font-black text-[#006241]">
                  {voucherScopeLabel(voucher)}
                </span>
                {voucher.isSaved ? (
                  <span className="rounded-full bg-[#d4e9e2] px-2 py-0.5 text-[10px] font-black text-[#006241]">
                    Đã nhận
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-500">{voucher.name}</p>
            </div>
            {selected ? <CheckCircle2 size={20} className="shrink-0 text-[#00754A]" /> : null}
          </div>

          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
              <span className="text-gray-500">Đơn tối thiểu {money(voucherMinOrder(voucher))}</span>
              <span className={eligible ? 'text-[#006241]' : 'text-[#8a5a00]'}>
                {eligible ? `Tiết kiệm ${money(voucherSavings(voucher))}` : `Thiếu ${money(missingAmount)}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f0eee9]">
              <div
                className={`h-full rounded-full ${eligible ? 'bg-[#00754A]' : 'bg-[#fbbc05]'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-400">
              {voucherShortMeta(voucher)}
            </p>
            <button
              type="button"
              onClick={onApply}
              disabled={!eligible || selected}
              className="rounded-full bg-[#00754A] px-4 py-2 text-xs font-black text-white transition hover:bg-[#006241] disabled:bg-gray-200 disabled:text-gray-500"
            >
              {selected ? 'Đã chọn' : eligible ? 'Áp dụng' : 'Chưa đủ'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
