import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgePercent,
  Check,
  Clock,
  Gift,
  LockKeyhole,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import {
  type Voucher,
  fetchVouchersForCart,
  getVoucherProgress,
  money,
  saveVoucherToWallet,
  sortVouchers,
  voucherExpiryDateTimeLabel,
  voucherMinOrder,
  voucherMissingAmount,
  voucherRemainingUsesLabel,
  voucherSavings,
  voucherValueLabel,
} from '../../lib/vouchers';

type FilterKey = 'all' | 'saved' | 'ready' | 'locked';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'saved', label: 'Đã nhận' },
  { key: 'ready', label: 'Dùng ngay' },
  { key: 'locked', label: 'Cần mua thêm' },
];

export default function VoucherWalletModal() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { cart } = useCart();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const subtotal = Number(cart?.totalAmount ?? 0);
  const productIds = useMemo(
    () => cart?.items.map((item) => item.productId) ?? [],
    [cart],
  );
  const voucherItems = useMemo(
    () =>
      cart?.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) ?? [],
    [cart],
  );
  const productIdsKey = productIds.join('|');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    fetchVouchersForCart({ orderValue: subtotal, productIds, items: voucherItems })
      .then((data) => {
        if (!cancelled) setVouchers(data);
      })
      .catch(() => {
        if (!cancelled) setVouchers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, subtotal, productIdsKey, voucherItems]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const sortedVouchers = useMemo(() => sortVouchers(vouchers), [vouchers]);
  const visibleVouchers = sortedVouchers.filter((voucher) => {
    if (filter === 'saved') return Boolean(voucher.isSaved);
    if (filter === 'ready') return Boolean(voucher.eligible);
    if (filter === 'locked') return !voucher.eligible;
    return true;
  });
  const savedCount = sortedVouchers.filter((voucher) => voucher.isSaved).length;
  const readyCount = sortedVouchers.filter((voucher) => voucher.eligible).length;

  const refreshVouchers = async () => {
    const next = await fetchVouchersForCart({
      orderValue: subtotal,
      productIds,
      items: voucherItems,
    });
    setVouchers(next);
  };

  const handleSave = async (voucher: Voucher) => {
    if (!session) {
      setOpen(false);
      void navigate('/client/login');
      return;
    }

    setSavingId(voucher.id);
    try {
      await saveVoucherToWallet(voucher.id);
      await refreshVouchers();
    } finally {
      setSavingId(null);
    }
  };

  const handleApply = (voucher: Voucher) => {
    setOpen(false);
    void navigate(`/client/cart?voucher=${encodeURIComponent(voucher.code)}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_6px_rgba(0,0,0,0.24),0_8px_12px_rgba(0,0,0,0.14)] transition-all hover:scale-105 active:scale-95"
        style={{ background: '#00754A' }}
        aria-label="Mở kho voucher"
        title="Kho voucher"
      >
        <Gift size={23} />
        {savedCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c82014] px-1 text-[10px] font-black text-white">
            {savedCount > 9 ? '9+' : savedCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-6">
          <section
            className="client-card flex max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Kho voucher"
          >
            <div className="flex items-start justify-between gap-4 px-5 py-5 text-white md:px-7" style={{ background: '#1E3932' }}>
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white/75">
                  <Sparkles size={14} /> Kho voucher
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight md:text-3xl">
                  Săn ưu đãi trước khi đặt hàng
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  Nhận voucher vào ví, theo dõi hạn dùng và số lượt còn lại trước khi áp dụng cho giỏ hàng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Đóng kho voucher"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-black/5 bg-[#f2f0eb] px-4 py-4 md:px-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filters.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                        filter === item.key
                          ? 'bg-[#00754A] text-white'
                          : 'border border-[#00754A]/25 bg-white text-[#1E3932] hover:bg-[#d4e9e2]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 text-xs font-bold text-[#1E3932]/70">
                  <span className="rounded-full bg-white px-3 py-2">
                    Đã nhận {savedCount}
                  </span>
                  <span className="rounded-full bg-white px-3 py-2">
                    Dùng ngay {readyCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f2f0eb] p-4 md:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
                </div>
              ) : visibleVouchers.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleVouchers.map((voucher) => (
                    <div key={voucher.id}>
                      <VoucherModalCard
                        voucher={voucher}
                        subtotal={subtotal}
                        saving={savingId === voucher.id}
                        onSave={() => void handleSave(voucher)}
                        onApply={() => handleApply(voucher)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="client-card flex flex-col items-center justify-center py-16 text-center">
                  <Gift size={48} className="mb-3 text-[#006241]/25" />
                  <h3 className="text-lg font-black text-[#1E3932]">
                    Chưa có voucher phù hợp
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-gray-500">
                    Thử đổi bộ lọc hoặc quay lại sau khi cửa hàng mở thêm chương trình ưu đãi.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function VoucherModalCard({
  voucher,
  subtotal,
  saving,
  onSave,
  onApply,
}: {
  voucher: Voucher;
  subtotal: number;
  saving: boolean;
  onSave: () => void;
  onApply: () => void;
}) {
  const eligible = Boolean(voucher.eligible);
  const progress = getVoucherProgress(voucher, subtotal);
  const missingAmount = voucherMissingAmount(voucher);

  return (
    <article className="client-card overflow-hidden">
      <div className="grid grid-cols-[92px_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 bg-[#1E3932] px-3 py-5 text-center text-white">
          <BadgePercent size={28} />
          <span className="rounded-full bg-[#d4e9e2] px-2.5 py-1 text-xs font-black text-[#006241]">
            {voucherValueLabel(voucher)}
          </span>
        </div>
        <div className="min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#1E3932]">
                {voucher.code}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-500">
                {voucher.name}
              </p>
            </div>
            {voucher.isPrivate ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4e9e2] text-[#006241]">
                <LockKeyhole size={15} />
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 text-xs font-semibold text-gray-500 sm:grid-cols-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#edebe9] px-3 py-2">
              <Clock size={13} /> {voucherExpiryDateTimeLabel(voucher.expiresAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#edebe9] px-3 py-2">
              <Users size={13} /> {voucherRemainingUsesLabel(voucher)}
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
              <span className="text-gray-500">
                Đơn tối thiểu {money(voucherMinOrder(voucher))}
              </span>
              <span className={eligible ? 'text-[#006241]' : 'text-[#8a5a00]'}>
                {eligible ? `Giảm ${money(voucherSavings(voucher))}` : `Thiếu ${money(missingAmount)}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f2f0eb]">
              <div
                className={`h-full rounded-full ${eligible ? 'bg-[#00754A]' : 'bg-[#fbbc05]'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || voucher.isSaved}
              className="client-pill-outline flex min-h-11 flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-black disabled:border-[#006241]/20 disabled:bg-[#d4e9e2]/50 disabled:text-[#006241]"
            >
              {voucher.isSaved ? (
                <>
                  <Check size={15} /> Đã nhận
                </>
              ) : saving ? (
                'Đang nhận...'
              ) : (
                <>
                  <Gift size={15} /> Nhận
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={!eligible}
              className="client-pill-primary flex min-h-11 flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-black disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
            >
              <ShoppingCart size={15} />
              {eligible ? 'Áp dụng' : 'Chưa đủ'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
