import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface AgingDebtItem {
  poId: string;
  poCode: string;
  supplierId: string;
  supplierName?: string | null;
  supplierCode?: string | null;
  orderDate: string | null;
  expectedDate?: string | null;
  paidDate?: string | null;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentStatusLabel?: string;
  status: string;
  statusLabel?: string;
  paymentNotes?: string | null;
  notes?: string | null;
  diffDays?: number;
  outstanding?: number;
  ageBucket?: string;
  canRecordPayment?: boolean;
  createdAt: string;
}

interface AgingSummary {
  asOf: string;
  totalPos: number;
  totalOutstanding: number;
  totalPaid?: number;
  unpaidCount?: number;
  partialCount?: number;
  paidCount?: number;
  buckets: Record<string, { count: number; total: number }>;
}

interface AgingResponse {
  summary: AgingSummary;
  items: AgingDebtItem[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

interface Supplier {
  supplierId: string;
  name: string;
  code?: string | null;
}

interface PoDetail extends AgingDebtItem {
  shippingCost?: string;
  otherCost?: string;
  items?: Array<{
    poItemId?: string;
    productId: string;
    productName?: string;
    productCode?: string | null;
    primaryImageUrl?: string | null;
    unit?: string;
    qtyOrdered: number;
    qtyReceived: number;
    unitPrice: string;
    notes?: string | null;
  }>;
}

const BUCKET_LABELS: Record<string, { label: string; color: string; bar: string }> = {
  current: { label: 'Hiện tại', color: 'text-green-600', bar: 'bg-green-500' },
  days1_7: { label: '1-7 ngày', color: 'text-blue-600', bar: 'bg-blue-500' },
  days8_30: { label: '8-30 ngày', color: 'text-yellow-600', bar: 'bg-yellow-500' },
  days31_60: { label: '31-60 ngày', color: 'text-orange-600', bar: 'bg-orange-500' },
  days61_90: { label: '61-90 ngày', color: 'text-red-500', bar: 'bg-red-500' },
  over90: { label: '>90 ngày', color: 'text-red-700', bar: 'bg-red-700' },
};

const paymentOptions = [
  { value: 'all', label: 'Tất cả thanh toán' },
  { value: 'unpaid', label: 'Chưa thanh toán' },
  { value: 'partial', label: 'Thanh toán một phần' },
  { value: 'paid', label: 'Đã thanh toán' },
];

const poStatusOptions = [
  { value: 'all', label: 'Tất cả trạng thái PO' },
  { value: 'ordered', label: 'Đã đặt hàng' },
  { value: 'partial', label: 'Nhập một phần' },
  { value: 'received', label: 'Đã nhập đủ' },
];

function fmt(n: number) {
  return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
}

function dateText(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

function paymentTone(status: string) {
  if (status === 'paid') return 'bg-green-100 text-green-700';
  if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function AgingDebtPage() {
  const [data, setData] = useState<AgingResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [poStatus, setPoStatus] = useState('all');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [asOf, setAsOf] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [payingPo, setPayingPo] = useState<AgingDebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const [detail, setDetail] = useState<PoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (asOf) params.set('asOf', asOf);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search.trim()) params.set('search', search.trim());
      if (filterSupplierId) params.set('supplierId', filterSupplierId);
      if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (poStatus !== 'all') params.set('poStatus', poStatus);
      if (onlyOutstanding) params.set('onlyOutstanding', 'true');
      const d = await apiClient.get<AgingResponse>(`/reports/aging-debt?${params.toString()}`);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf, filterSupplierId, from, limit, onlyOutstanding, page, paymentStatus, poStatus, search, to]);

  useEffect(() => {
    void apiClient.get<{ items: Supplier[] }>('/suppliers?limit=500&status=active').then((d) => setSuppliers(d.items ?? []));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const meta = data?.meta ?? { page, limit, total: items.length, totalPages: 1 };

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.supplierId === filterSupplierId),
    [filterSupplierId, suppliers],
  );

  const resetAndLoad = () => {
    setPage(1);
    void load();
  };

  const openDetail = async (po: AgingDebtItem) => {
    setDetailLoading(true);
    try {
      const d = await apiClient.get<PoDetail>(`/procurement/purchase-orders/${po.poId}`);
      const supplier = suppliers.find((s) => s.supplierId === d.supplierId);
      setDetail({
        ...po,
        ...d,
        supplierName: supplier?.name ?? po.supplierName,
        supplierCode: supplier?.code ?? po.supplierCode,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingPo) return;
    const amount = Number(payAmount);
    const outstanding = payingPo.outstanding ?? Number(payingPo.totalAmount) - Number(payingPo.paidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }
    if (amount > outstanding) {
      setPayError('Số tiền thanh toán không được vượt quá số còn nợ.');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      await apiClient.post('/reports/record-po-payment', {
        poId: payingPo.poId,
        amount: String(amount),
        notes: payNotes || undefined,
      });
      setPayingPo(null);
      setPayAmount('');
      setPayNotes('');
      void load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Không ghi được thanh toán.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-black text-on-surface">Báo cáo tuổi nợ NCC</h1>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Theo dõi toàn bộ PO, công nợ còn phải trả và lịch sử PO đã thanh toán.
          </p>
        </div>
        {summary && (
          <span className="text-sm text-on-surface-variant">
            Tính đến: <strong>{summary.asOf}</strong>
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr_0.8fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') resetAndLoad(); }}
              placeholder="Tìm mã PO, tên/mã NCC, ghi chú..."
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-10 text-sm outline-none focus:border-primary"
            />
          </label>
          <select value={filterSupplierId} onChange={(e) => { setFilterSupplierId(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm">
            <option value="">Tất cả NCC</option>
            {suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
          </select>
          <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm">
            {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={poStatus} onChange={(e) => { setPoStatus(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm">
            {poStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm" />
          <button onClick={resetAndLoad} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" /> Tải lại
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_0.8fr_auto]">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-outline-variant bg-surface px-3 text-sm" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-outline-variant bg-surface px-3 text-sm" />
          <label className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-3 text-sm font-semibold text-on-surface">
            <input type="checkbox" checked={onlyOutstanding} onChange={(e) => { setOnlyOutstanding(e.target.checked); setPage(1); }} />
            Chỉ PO còn nợ
          </label>
        </div>
        {selectedSupplier ? <p className="mt-2 text-xs text-on-surface-variant">Đang lọc NCC: <strong>{selectedSupplier.name}</strong></p> : null}
      </div>

      {summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tổng PO</p>
            <p className="mt-1 text-2xl font-black">{summary.totalPos}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{summary.unpaidCount ?? 0} chưa trả · {summary.partialCount ?? 0} một phần · {summary.paidCount ?? 0} đã trả</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Công nợ còn phải trả</p>
            <p className="mt-1 text-2xl font-black text-orange-800">{fmt(summary.totalOutstanding)}</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Đã thanh toán</p>
            <p className="mt-1 text-2xl font-black text-green-800">{fmt(summary.totalPaid ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Nguồn số liệu</p>
            <p className="mt-1 text-sm font-semibold">PO hợp lệ, không gồm nháp/hủy.</p>
            <p className="mt-1 text-xs text-on-surface-variant">Bucket tuổi nợ chỉ tính PO còn nợ.</p>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(BUCKET_LABELS).map(([key, cfg]) => {
            const bucket = summary.buckets[key];
            return (
              <div key={key} className="rounded-2xl border border-outline-variant bg-surface p-3 text-center">
                <div className={`mb-2 h-1.5 w-full rounded-full ${cfg.bar}`} />
                <p className="text-xs text-on-surface-variant">{cfg.label}</p>
                <p className={`text-base font-black ${cfg.color}`}>{fmt(bucket?.total ?? 0)}</p>
                <p className="text-xs text-on-surface-variant">{bucket?.count ?? 0} PO còn nợ</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Mã PO</th>
                <th className="px-4 py-3 text-left font-bold">NCC</th>
                <th className="px-4 py-3 text-left font-bold">Ngày đặt</th>
                <th className="px-4 py-3 text-left font-bold">Dự kiến</th>
                <th className="px-4 py-3 text-right font-bold">Tổng tiền</th>
                <th className="px-4 py-3 text-right font-bold">Đã trả</th>
                <th className="px-4 py-3 text-right font-bold">Còn nợ</th>
                <th className="px-4 py-3 text-center font-bold">Tuổi nợ</th>
                <th className="px-4 py-3 text-center font-bold">PO</th>
                <th className="px-4 py-3 text-center font-bold">Thanh toán</th>
                <th className="px-4 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={11} className="py-10 text-center text-on-surface-variant">Đang tải dữ liệu...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="py-10 text-center text-on-surface-variant">Không có PO phù hợp bộ lọc</td></tr>
              ) : items.map((po) => {
                const outstanding = po.outstanding ?? Math.max(0, Number(po.totalAmount) - Number(po.paidAmount));
                const diffDays = po.diffDays ?? 0;
                const ageColor = outstanding <= 0 ? 'text-green-600' : diffDays > 90 ? 'text-red-700 font-bold' : diffDays > 60 ? 'text-red-500' : diffDays > 30 ? 'text-orange-500' : 'text-on-surface-variant';
                return (
                  <tr key={po.poId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{po.poCode}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{po.supplierName ?? suppliers.find((s) => s.supplierId === po.supplierId)?.name ?? po.supplierId}</p>
                      <p className="text-xs text-on-surface-variant">{po.supplierCode ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{dateText(po.orderDate)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{dateText(po.expectedDate)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(Number(po.totalAmount))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(Number(po.paidAmount))}</td>
                    <td className={`px-4 py-3 text-right font-black ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(outstanding)}</td>
                    <td className={`px-4 py-3 text-center text-xs ${ageColor}`}>{outstanding > 0 ? `${diffDays} ngày` : 'Đã tất toán'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-surface-variant px-2 py-1 text-xs font-bold text-on-surface-variant">{po.statusLabel ?? po.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${paymentTone(po.paymentStatus)}`}>{po.paymentStatusLabel ?? po.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => void openDetail(po)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-bold hover:bg-surface-variant">
                          <Eye className="h-3.5 w-3.5" /> Chi tiết
                        </button>
                        {po.canRecordPayment ? (
                          <button onClick={() => { setPayingPo(po); setPayAmount(String(outstanding)); setPayNotes(''); setPayError(''); }} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-white hover:bg-primary/90">
                            Ghi thanh toán
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-outline-variant p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-on-surface-variant">Tổng {meta.total} PO</span>
          <div className="flex items-center gap-2">
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5">
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/trang</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-outline-variant p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-bold">Trang {meta.page}/{Math.max(1, meta.totalPages)}</span>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-outline-variant p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {payingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-on-surface">Ghi thanh toán - {payingPo.poCode}</h3>
              <button onClick={() => setPayingPo(null)} className="rounded-lg p-1.5 hover:bg-surface-variant"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">Còn nợ: <strong className="text-red-600">{fmt(payingPo.outstanding ?? Number(payingPo.totalAmount) - Number(payingPo.paidAmount))}</strong></p>
              <div>
                <label className="mb-1 block text-sm font-bold text-on-surface">Số tiền thanh toán</label>
                <input type="number" min="0" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-on-surface">Ghi chú/chứng từ</label>
                <input type="text" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="VD: CK 26/05, phiếu chi PC001..." />
              </div>
              {payError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{payError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setPayingPo(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-variant">Hủy</button>
                <button onClick={() => void handleRecordPayment()} disabled={paying || !payAmount} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                  {paying ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-on-surface">Chi tiết PO</h2>
                <p className="text-sm text-on-surface-variant">{detail?.poCode ?? 'Đang tải...'}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-2 hover:bg-surface-variant"><X className="h-5 w-5" /></button>
            </div>
            {detailLoading ? (
              <div className="py-16 text-center text-on-surface-variant">Đang tải chi tiết...</div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-outline-variant p-4 sm:grid-cols-2">
                  <Info label="Nhà cung cấp" value={`${detail.supplierName ?? detail.supplierId}${detail.supplierCode ? ` (${detail.supplierCode})` : ''}`} />
                  <Info label="Trạng thái PO" value={detail.statusLabel ?? detail.status} />
                  <Info label="Ngày đặt" value={dateText(detail.orderDate)} />
                  <Info label="Ngày dự kiến" value={dateText(detail.expectedDate)} />
                  <Info label="Tổng tiền" value={fmt(Number(detail.totalAmount))} />
                  <Info label="Đã trả" value={fmt(Number(detail.paidAmount))} />
                  <Info label="Còn nợ" value={fmt(detail.outstanding ?? Math.max(0, Number(detail.totalAmount) - Number(detail.paidAmount)))} />
                  <Info label="Thanh toán" value={detail.paymentStatusLabel ?? detail.paymentStatus} />
                </div>
                <div className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="mb-3 font-black">Dòng sản phẩm</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="text-on-surface-variant">
                        <tr>
                          <th className="pb-2 text-left">Sản phẩm</th>
                          <th className="pb-2 text-right">Đặt</th>
                          <th className="pb-2 text-right">Đã nhập</th>
                          <th className="pb-2 text-right">Đơn giá</th>
                          <th className="pb-2 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {(detail.items ?? []).map((item) => (
                          <tr key={item.poItemId ?? item.productId}>
                            <td className="py-2">
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 overflow-hidden rounded-xl bg-emerald-50">
                                  {item.primaryImageUrl ? (
                                    <img src={item.primaryImageUrl} alt={item.productName ?? item.productId} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">SP</div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-2 font-semibold text-on-surface">{item.productName ?? item.productId}</p>
                                  <p className="text-xs text-on-surface-variant">{item.productCode ?? item.productId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 text-right">{item.qtyOrdered} {item.unit ?? ''}</td>
                            <td className="py-2 text-right">{item.qtyReceived}</td>
                            <td className="py-2 text-right">{fmt(Number(item.unitPrice))}</td>
                            <td className="py-2 text-right font-semibold">{fmt(Number(item.unitPrice) * Number(item.qtyOrdered))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="mb-2 font-black">Ghi chú thanh toán</h3>
                  <p className="text-sm text-on-surface-variant">{detail.paymentNotes || detail.notes || 'Chưa có ghi chú.'}</p>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-semibold text-on-surface">{value}</p>
    </div>
  );
}
