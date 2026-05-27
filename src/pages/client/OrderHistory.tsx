import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Leaf,
  LoaderCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentDeadline?: string | null;
  paymentTimeRemainingSeconds?: number | null;
  canRetryPayment?: boolean;
  canCancelUnpaid?: boolean;
  paymentBlockedReason?: string | null;
  totalPayment: string;
  totalQuantity: number;
  fullName: string;
  phone: string;
  address: string;
  createdAt: string;
};

type OrdersResponse = {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const STATUS_TABS: SelectOption[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'partial_delivered', label: 'Giao một phần' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'returned', label: 'Đã trả hàng' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7' },
  backordered: { label: 'Chờ nhập hàng', color: '#7c2d12', bg: '#ffedd5' },
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#dbeafe' },
  processing: { label: 'Đang xử lý', color: '#6d28d9', bg: '#ede9fe' },
  shipping: { label: 'Đang giao', color: '#0369a1', bg: '#e0f2fe' },
  delivered: { label: 'Đã giao', color: '#15803d', bg: '#dcfce7' },
  partial_delivered: { label: 'Giao một phần', color: '#0f766e', bg: '#ccfbf1' },
  partial_returned: { label: 'Trả một phần', color: '#9a3412', bg: '#ffedd5' },
  cancelled: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2' },
  returned: { label: 'Đã trả hàng', color: '#9f1239', bg: '#ffe4e6' },
};

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'all', label: 'Tất cả phương thức' },
  { value: 'cod', label: 'COD' },
  { value: 'momo', label: 'MoMo' },
  { value: 'vnpay', label: 'VNPay' },
  { value: 'zalopay', label: 'ZaloPay' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'credit', label: 'Công nợ' },
];

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'COD',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  paypal: 'PayPal',
  credit: 'Công nợ',
};

const PAYMENT_STATUSES: SelectOption[] = [
  { value: 'all', label: 'Tất cả thanh toán' },
  { value: 'unpaid', label: 'Chưa thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'partial_refunded', label: 'Hoàn một phần' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  partial_refunded: 'Hoàn tiền một phần',
  refunded: 'Đã hoàn tiền',
};

function formatPrice(val: number | string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getVisiblePages(page: number, totalPages: number) {
  return Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);
}

function formatCountdown(seconds?: number | null) {
  const safeSeconds = Math.max(0, Number(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes <= 0) return `${remainingSeconds} giây`;
  return `${minutes} phút ${remainingSeconds.toString().padStart(2, '0')} giây`;
}

function getPaymentDisplay(order: Order) {
  if (
    ['momo', 'vnpay', 'zalopay'].includes(order.paymentMethod) &&
    ['unpaid', 'failed'].includes(order.paymentStatus)
  ) {
    if (order.paymentBlockedReason === 'PAYMENT_EXPIRED') {
      return 'Quá hạn thanh toán';
    }
    if (order.paymentStatus === 'failed') {
      return order.canRetryPayment
        ? `Thanh toán thất bại - còn ${formatCountdown(order.paymentTimeRemainingSeconds)}`
        : 'Thanh toán thất bại';
    }
    return order.canRetryPayment
      ? `Chờ thanh toán - còn ${formatCountdown(order.paymentTimeRemainingSeconds)}`
      : 'Chờ thanh toán';
  }
  return PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus;
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [retryingPaymentId, setRetryingPaymentId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (status !== 'all') params.set('status', status);
    if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
    if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
    if (search.trim()) params.set('search', search.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const res = await clientApi.get<OrdersResponse>(`/users/me/orders?${params.toString()}`);
      setData(res);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [from, limit, page, paymentMethod, paymentStatus, search, status]);

  useEffect(() => {
    if (!session) {
      void navigate('/client/login');
      return;
    }
    void loadOrders();
  }, [loadOrders, navigate, session]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setStatus('all');
    setPaymentStatus('all');
    setPaymentMethod('all');
    setSearchInput('');
    setSearch('');
    setFrom('');
    setTo('');
    setLimit(10);
    setPage(1);
  };

  const handleFilterChange = (nextStatus: string) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const handleReorder = async (orderId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReorderingId(orderId);
    try {
      const order = await clientApi.get<{ items: { productId: string; quantity: number }[] }>(
        `/users/me/orders/${orderId}`,
      );
      const items = order.items ?? [];
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        try {
          await addItem(item.productId, item.quantity);
          added++;
        } catch {
          skipped++;
        }
      }
      if (added > 0 && skipped === 0) {
        showToast({
          tone: 'success',
          title: 'Đã thêm vào giỏ hàng',
          description: `${added} sản phẩm đã được thêm.`,
        });
      } else if (added > 0) {
        showToast({
          tone: 'warning',
          title: 'Thêm một phần',
          description: `${added} sản phẩm thêm thành công, ${skipped} sản phẩm không còn khả dụng.`,
        });
      } else {
        showToast({
          tone: 'error',
          title: 'Không thể thêm',
          description: 'Sản phẩm trong đơn này hiện không còn bán.',
        });
      }
      if (added > 0) void navigate('/client/cart');
    } catch {
      showToast({
        tone: 'error',
        title: 'Không thể mua lại',
        description: 'Không thể lấy thông tin đơn hàng. Vui lòng thử lại sau.',
      });
    } finally {
      setReorderingId(null);
    }
  };

  const handleRetryPayment = async (orderId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRetryingPaymentId(orderId);
    try {
      const returnUrl = `${window.location.origin}/client/orders/${orderId}`;
      const paymentTransaction = await clientApi.post<{
        transactionRef: string;
        paymentUrl: string;
        expiresAt?: string;
      }>(`/payments/orders/${orderId}/initiate`, { returnUrl });

      if (
        paymentTransaction.paymentUrl &&
        !paymentTransaction.paymentUrl.includes('payment-gateway.local')
      ) {
        window.location.href = paymentTransaction.paymentUrl;
        return;
      }

      showToast({
        tone: 'warning',
        title: 'Cổng thanh toán chưa sẵn sàng',
        description: 'Không lấy được đường dẫn thanh toán. Vui lòng thử lại sau.',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể thanh toán lại',
        description:
          error instanceof Error
            ? error.message
            : 'Đơn hàng đã quá hạn hoặc hiện không thể thanh toán lại.',
      });
      void loadOrders();
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const orders = data?.items ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const total = data?.total ?? 0;
  const visiblePages = useMemo(() => getVisiblePages(page, totalPages), [page, totalPages]);

  if (loading && !data) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-[#006241]" size={32} />
      </div>
    );
  }

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
              Cá nhân
            </p>
            <h1 className="mt-1 text-2xl font-black text-[#1E3932]">
              Đơn hàng của tôi
              {total > 0 && <span className="ml-2 text-base font-semibold text-gray-400">({total})</span>}
            </h1>
          </div>
          <Link to="/client/account" className="text-sm font-semibold text-[#006241] hover:underline">
            ← Tài khoản
          </Link>
        </div>

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleFilterChange(tab.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                status === tab.value
                  ? 'bg-[#006241] text-white'
                  : 'bg-white text-[#1E3932] hover:bg-[#006241]/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="client-card mb-5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E3932]">
            <SlidersHorizontal size={17} className="text-[#006241]" />
            Bộ lọc đơn hàng
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
                placeholder="Tìm mã đơn, sản phẩm, người nhận, số điện thoại..."
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f6f1] pl-10 pr-3 text-sm outline-none focus:border-[#006241]"
              />
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]"
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]"
            >
              {PAYMENT_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto_auto]">
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f6f1] pl-10 pr-3 text-sm outline-none focus:border-[#006241]"
              />
            </label>
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f6f1] pl-10 pr-3 text-sm outline-none focus:border-[#006241]"
              />
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]"
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>{value}/trang</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applySearch}
              className="h-11 rounded-xl bg-[#006241] px-5 text-sm font-black text-white hover:bg-[#005234]"
            >
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#006241]/20 px-4 text-sm font-black text-[#006241] hover:bg-[#006241]/10"
            >
              <RefreshCw size={15} />
              Đặt lại
            </button>
          </div>
        </section>

        {error ? (
          <div className="client-card border border-red-100 bg-red-50 p-6 text-sm font-semibold text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-3 rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white"
            >
              Tải lại
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="animate-spin text-[#006241]" size={28} />
          </div>
        ) : orders.length === 0 ? (
          <div className="client-card flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="mb-4 text-[#006241]/20" />
            <h2 className="font-black text-[#1E3932]">Không có đơn hàng phù hợp</h2>
            <p className="mt-1 text-sm text-gray-500">Thử đổi bộ lọc hoặc tiếp tục mua sắm để tạo đơn mới.</p>
            <Link
              to="/client/products"
              className="client-pill-primary mt-5 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold"
            >
              <Leaf size={16} /> Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => {
                const statusInfo = STATUS_LABELS[order.status] ?? {
                  label: order.status,
                  color: '#374151',
                  bg: '#f3f4f6',
                };
                const shortId = order.id.slice(-8).toUpperCase();
                const canReorder = ['delivered', 'partial_delivered', 'cancelled', 'returned'].includes(order.status);
                const isReordering = reorderingId === order.id;
                return (
                  <div key={order.id} className="client-card overflow-hidden transition-all">
                    <div
                      className="cursor-pointer"
                      onClick={() => void navigate(`/client/orders/${order.id}`)}
                    >
                      <div className="flex items-center justify-between border-b border-black/5 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                            style={{ background: statusInfo.bg }}
                          >
                            <Package size={18} style={{ color: statusInfo.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-[#1E3932]">Đơn #{shortId}</p>
                            <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black"
                          style={{ background: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="min-w-0 text-sm text-gray-500">
                          <p>
                            Thanh toán:{' '}
                            <span className="font-semibold text-[#1E3932]">
                              {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                            <span className="mx-2 text-gray-300">•</span>
                            <span className="font-semibold text-[#1E3932]">
                              {getPaymentDisplay(order)}
                            </span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs">
                            {order.fullName} · {order.phone} · {order.address}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3 md:justify-end">
                          <div className="text-right">
                            <p className="font-black text-[#006241]">{formatPrice(order.totalPayment)}</p>
                            <p className="text-xs text-gray-400">{order.totalQuantity} sản phẩm</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </div>
                    </div>

                    {(canReorder || order.canRetryPayment) && (
                      <div className="border-t border-black/5 px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          {order.canRetryPayment ? (
                            <button
                              type="button"
                              onClick={(e) => void handleRetryPayment(order.id, e)}
                              disabled={retryingPaymentId === order.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#006241] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#005234] disabled:opacity-50"
                            >
                              {retryingPaymentId === order.id ? (
                                <LoaderCircle size={12} className="animate-spin" />
                              ) : (
                                <CreditCard size={12} />
                              )}
                              Thanh toán lại
                            </button>
                          ) : null}
                          {canReorder ? (
                            <button
                              type="button"
                              onClick={(e) => void handleReorder(order.id, e)}
                              disabled={isReordering}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#006241]/30 px-4 py-1.5 text-xs font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white disabled:opacity-50"
                            >
                              {isReordering ? (
                                <LoaderCircle size={12} className="animate-spin" />
                              ) : (
                                <RotateCcw size={12} />
                              )}
                              Mua lại
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-gray-500">
                Hiển thị {orders.length} / {total} đơn · Trang {page}/{totalPages}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f6f1] text-[#1E3932] transition hover:bg-[#006241] hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>

                {visiblePages.map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400">...</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                        page === p
                          ? 'bg-[#006241] text-white shadow-sm'
                          : 'bg-[#f8f6f1] text-[#1E3932] hover:bg-[#006241]/10'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f6f1] text-[#1E3932] transition hover:bg-[#006241] hover:text-white disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

