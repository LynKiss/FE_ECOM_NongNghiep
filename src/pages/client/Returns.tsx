import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';

type ReturnItem = {
  id?: string;
  returnId?: string;
  orderId: string;
  productName?: string | null;
  imageUrl?: string | null;
  returnQuantity: number;
  reason: string;
  reasonLabel?: string | null;
  description?: string | null;
  status: string;
  statusLabel?: string;
  inspectionStatusLabel?: string | null;
  refundAmount?: string | null;
  maxRefundableAmount?: string | null;
  returnDeadline?: string | null;
  createdAt: string;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };
type Paginated<T> = { items: T[]; meta?: Meta };

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'requested', label: 'Đã gửi yêu cầu' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'received', label: 'Đã nhận hàng trả về' },
  { value: 'inspected', label: 'Đã kiểm tra hàng' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
  { value: 'rejected', label: 'Từ chối' },
];

const statusTone: Record<string, string> = {
  requested: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-blue-200 bg-blue-50 text-blue-700',
  received: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  inspected: 'border-purple-200 bg-purple-50 text-purple-700',
  refunded: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const fallbackReason: Record<string, string> = {
  wrong_item: 'Nhận sai sản phẩm',
  damaged: 'Sản phẩm lỗi hoặc hư hỏng',
  defective: 'Sản phẩm lỗi hoặc hư hỏng',
  not_as_described: 'Không đúng mô tả',
  changed_mind: 'Không còn nhu cầu',
  other: 'Lý do khác',
};

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value?: string | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Chưa hoàn';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value));
}

function getId(item: ReturnItem) {
  return String(item.returnId ?? item.id ?? '');
}

function normalizePayload(payload: ReturnItem[] | Paginated<ReturnItem>, page: number, limit: number) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: { page, limit, total: payload.length, totalPages: Math.max(1, Math.ceil(payload.length / limit)) },
    };
  }
  return {
    items: payload.items ?? [],
    meta: payload.meta ?? { page, limit, total: payload.items?.length ?? 0, totalPages: 1 },
  };
}

export default function ClientReturns() {
  const [searchParams] = useSearchParams();
  const highlightedReturnId = searchParams.get('returnId');
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search.trim()) params.set('search', search.trim());
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    clientApi
      .get<ReturnItem[] | Paginated<ReturnItem>>(`/returns/me?${params.toString()}`)
      .then((data) => {
        const normalized = normalizePayload(data, page, limit);
        setItems(normalized.items);
        setMeta(normalized.meta);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được danh sách trả hàng'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, limit, status, from, to]);

  const sortedItems = useMemo(() => {
    if (!highlightedReturnId) return items;
    return [...items].sort((a, b) => {
      const aHit = getId(a) === highlightedReturnId ? 0 : 1;
      const bHit = getId(b) === highlightedReturnId ? 0 : 1;
      return aHit - bHit;
    });
  }, [highlightedReturnId, items]);

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <Link to="/client/account" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#006241] hover:underline">
          <ArrowLeft size={15} /> Tài khoản của tôi
        </Link>

        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]">Sau bán hàng</p>
            <h1 className="mt-1 text-3xl font-black text-[#1E3932]">Trả hàng của tôi</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Theo dõi các yêu cầu trả hàng trong vòng 7 ngày kể từ khi nhận hàng.
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#006241]/20 px-4 py-2 text-sm font-black text-[#006241] hover:bg-[#006241]/10">
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }}
                placeholder="Tìm mã yêu cầu, mã đơn, tên sản phẩm..."
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f6f1] pl-10 pr-3 text-sm outline-none focus:border-[#006241]"
              />
            </label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]" />
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]" />
            <button onClick={() => { setPage(1); load(); }} className="h-11 rounded-xl bg-[#006241] px-5 text-sm font-black text-white hover:bg-[#005234]">
              Tìm kiếm
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-white">
            <LoaderCircle className="animate-spin text-[#006241]" size={26} />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <RotateCcw className="mx-auto mb-3 text-[#006241]" size={34} />
            <h2 className="text-xl font-black text-[#1E3932]">Chưa có yêu cầu trả hàng</h2>
            <p className="mt-2 text-sm text-gray-500">Khi bạn tạo yêu cầu trả hàng, trạng thái xử lý sẽ xuất hiện tại đây.</p>
            <Link to="/client/orders" className="mt-5 inline-flex rounded-full bg-[#006241] px-5 py-2 text-sm font-black text-white">
              Xem đơn hàng
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const id = getId(item);
              const highlighted = highlightedReturnId === id;
              return (
                <article key={id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${highlighted ? 'border-[#006241] ring-2 ring-[#006241]/15' : 'border-black/5'}`}>
                  <div className="grid gap-4 md:grid-cols-[76px_1.2fr_1fr_auto] md:items-center">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#d4e9e2]">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package size={24} className="text-[#006241]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-400">Yêu cầu #{id}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusTone[item.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                          {item.statusLabel ?? item.status}
                        </span>
                      </div>
                      <h2 className="mt-2 line-clamp-2 text-base font-black text-[#1E3932]">{item.productName ?? 'Sản phẩm trong đơn hàng'}</h2>
                      <p className="mt-1 text-xs text-gray-500">Đơn #{item.orderId.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="grid gap-1.5 text-sm text-gray-600 sm:grid-cols-2 md:grid-cols-1">
                      <p>Số lượng trả: <b>{item.returnQuantity}</b></p>
                      <p>Lý do: <b>{item.reasonLabel ?? fallbackReason[item.reason] ?? item.reason}</b></p>
                      <p>Tiền hoàn: <b>{formatMoney(item.refundAmount ?? item.maxRefundableAmount)}</b></p>
                      <p>Ngày tạo: <b>{formatDate(item.createdAt)}</b></p>
                      {item.inspectionStatusLabel ? <p>Kiểm tra: <b>{item.inspectionStatusLabel}</b></p> : null}
                    </div>
                    <div className="flex flex-col gap-2 md:items-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f0eb] px-3 py-1.5 text-xs font-semibold text-[#1E3932]">
                        <CalendarClock size={13} /> Hạn trả: {formatDate(item.returnDeadline)}
                      </span>
                      <Link to={`/client/orders/${item.orderId}`} className="rounded-full border border-[#006241]/20 px-3 py-1.5 text-center text-xs font-black text-[#006241] hover:bg-[#006241]/10">
                        Xem đơn hàng
                      </Link>
                    </div>
                  </div>
                  {item.description ? <p className="mt-3 rounded-xl bg-[#f8f6f1] px-3 py-2 text-sm text-gray-600">{item.description}</p> : null}
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-gray-500">Tổng {meta.total} yêu cầu</span>
          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-black/10 px-2 py-1.5">
              {[10, 20, 50].map((value) => <option key={value} value={value}>{value}/trang</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-black/10 p-2 disabled:opacity-40">
              <ChevronLeft size={15} />
            </button>
            <span className="font-bold">Trang {meta.page}/{Math.max(1, meta.totalPages)}</span>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-black/10 p-2 disabled:opacity-40">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
