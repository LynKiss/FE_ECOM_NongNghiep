import { type MouseEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Leaf, ChevronLeft, RotateCcw, LoaderCircle } from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7' },
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#dbeafe' },
  processing: { label: 'Đang xử lý', color: '#6d28d9', bg: '#ede9fe' },
  shipping: { label: 'Đang giao', color: '#0369a1', bg: '#e0f2fe' },
  delivered: { label: 'Đã giao', color: '#15803d', bg: '#dcfce7' },
  cancelled: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2' },
  returned: { label: 'Đã trả hàng', color: '#9f1239', bg: '#ffe4e6' },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'COD',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
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

const LIMIT = 10;

export default function OrderHistory() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const handleReorder = async (orderId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReorderingId(orderId);
    try {
      const order = await clientApi.get<{ items: { productId: string; quantity: number }[] }>(`/orders/${orderId}`);
      const items = order.items ?? [];
      let added = 0; let skipped = 0;
      for (const item of items) {
        try { await addItem(item.productId, item.quantity); added++; }
        catch { skipped++; }
      }
      if (added > 0 && skipped === 0) {
        showToast({ tone: 'success', title: 'Đã thêm vào giỏ hàng', description: `${added} sản phẩm đã được thêm.` });
      } else if (added > 0) {
        showToast({ tone: 'warning', title: 'Thêm một phần', description: `${added} thêm thành công, ${skipped} không còn khả dụng.` });
      } else {
        showToast({ tone: 'error', title: 'Không thể thêm', description: 'Sản phẩm trong đơn này hiện không còn bán.' });
      }
      if (added > 0) void navigate('/client/cart');
    } catch {
      showToast({ tone: 'error', title: 'Lỗi', description: 'Không thể lấy thông tin đơn hàng.' });
    } finally {
      setReorderingId(null);
    }
  };

  const loadOrders = (pg: number, status: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) });
    if (status !== 'all') params.set('status', status);
    void clientApi
      .get<OrdersResponse>(`/users/me/orders?${params}`)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    loadOrders(page, filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, page, filter]);

  const handleFilterChange = (status: string) => {
    setFilter(status);
    setPage(1);
  };

  const orders = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  if (loading && !data) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
              Cá nhân
            </p>
            <h1 className="mt-1 text-2xl font-black text-[#1E3932]">
              Đơn hàng của tôi
              {total > 0 && (
                <span className="ml-2 text-base font-semibold text-gray-400">({total})</span>
              )}
            </h1>
          </div>
          <Link to="/client/account" className="text-sm font-semibold text-[#006241] hover:underline">
            ← Tài khoản
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xử lý' },
            { key: 'shipping', label: 'Đang giao' },
            { key: 'delivered', label: 'Đã giao' },
            { key: 'cancelled', label: 'Đã hủy' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === tab.key
                  ? 'bg-[#006241] text-white'
                  : 'bg-white text-[#1E3932] hover:bg-[#006241]/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="client-card flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="mb-4 text-[#006241]/20" />
            <h2 className="font-black text-[#1E3932]">
              {filter === 'all' ? 'Chưa có đơn hàng' : 'Không có đơn hàng'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">Hãy khám phá và đặt hàng ngay!</p>
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
                const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: '#374151', bg: '#f3f4f6' };
                const shortId = order.id.slice(-8).toUpperCase();
                const canReorder = order.status === 'delivered' || order.status === 'cancelled' || order.status === 'returned';
                const isReordering = reorderingId === order.id;
                return (
                  <div
                    key={order.id}
                    className="client-card overflow-hidden transition-all"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => void navigate(`/client/orders/${order.id}`)}
                    >
                      <div className="flex items-center justify-between border-b border-black/5 p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full"
                            style={{ background: statusInfo.bg }}
                          >
                            <Package size={18} style={{ color: statusInfo.color }} />
                          </div>
                          <div>
                            <p className="font-black text-[#1E3932]">Đơn #{shortId}</p>
                            <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-black"
                          style={{ background: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4">
                        <div className="text-sm text-gray-500">
                          <p>
                            Thanh toán:{' '}
                            <span className="font-semibold text-[#1E3932]">
                              {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 max-w-xs text-xs">{order.address}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-black text-[#006241]">{formatPrice(order.totalPayment)}</p>
                            <p className="text-xs text-gray-400">{order.totalQuantity} sản phẩm</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </div>
                    </div>
                    {canReorder && (
                      <div className="border-t border-black/5 px-4 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => void handleReorder(order.id, e)}
                          disabled={isReordering}
                          className="flex items-center gap-1.5 rounded-full border border-[#006241]/30 px-4 py-1.5 text-xs font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white disabled:opacity-50"
                        >
                          {isReordering
                            ? <LoaderCircle size={12} className="animate-spin" />
                            : <RotateCcw size={12} />
                          }
                          Mua lại
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1E3932] shadow-sm transition hover:bg-[#006241] hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                          page === p
                            ? 'bg-[#006241] text-white shadow-sm'
                            : 'bg-white text-[#1E3932] shadow-sm hover:bg-[#006241]/10'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1E3932] shadow-sm transition hover:bg-[#006241] hover:text-white disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <p className="mt-3 text-center text-xs text-gray-400">
              Trang {page}/{totalPages} · {total} đơn hàng
            </p>
          </>
        )}
      </div>
    </div>
  );
}
