import {
  ClipboardList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = { supplierId: string; name: string; code: string | null };
type Product = { productId: string; productName: string; unit: string | null };

type PoStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
type GrStatus = 'draft' | 'confirmed' | 'cancelled';
type SrStatus = 'draft' | 'confirmed' | 'cancelled';

type PoItem = {
  productId: string;
  productName?: string | null;
  productCode?: string | null;
  primaryImageUrl?: string | null;
  unit: string;
  unitPerBase: number;
  qtyOrdered: number;
  qtyReceived?: number;
  unitPrice: number;
  notes: string;
};

type GrItem = {
  productId: string;
  unit: string;
  unitPerBase: number;
  qtyOrdered: number;
  qtyReceived: number;
  qtyDefective: number;
  qtyReturned: number;
  hasRefund: boolean;
  refundAmount: number;
  unitPrice: number;
  notes: string;
};

type SrItem = {
  productId: string;
  qtyReturned: number;
  unitPrice: number;
  hasRefund: boolean;
  refundAmount: number;
  reason: string;
};

type Po = {
  poId: string;
  poCode: string;
  supplierId: string;
  status: PoStatus;
  orderDate: string | null;
  expectedDate: string | null;
  shippingCost: string;
  otherCost: string;
  totalAmount: string;
  notes: string | null;
  createdAt: string;
};

type Gr = {
  grId: string;
  grCode: string;
  poId: string | null;
  supplierId: string;
  status: GrStatus;
  receiptDate: string;
  shippingCost: string;
  otherCost: string;
  notes: string | null;
  createdAt: string;
};

type Sr = {
  srId: string;
  srCode: string;
  grId: string | null;
  supplierId: string;
  status: SrStatus;
  returnDate: string;
  totalRefund: string;
  notes: string | null;
  createdAt: string;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

type GrCostPreviewItem = {
  productId: string;
  qtyReceived: number;
  qtyReturned: number;
  qtyGood: number;
  unitPrice: number;
  allocatedExtraCost: number;
  landedCost: number;
  totalLandedCost: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: string | number) =>
  Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + '₫';

const today = () => new Date().toISOString().slice(0, 10);

const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Nháp',
  ordered: 'Đã đặt',
  partial: 'Nhận một phần',
  received: 'Đã nhận đủ',
  cancelled: 'Đã hủy',
};

const PO_STATUS_COLOR: Record<PoStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  ordered: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const GR_STATUS_LABEL: Record<GrStatus, string> = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
};

const GR_STATUS_COLOR: Record<GrStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const SR_STATUS_LABEL: Record<SrStatus, string> = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
};

const SR_STATUS_COLOR: Record<SrStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

function emptyPoItem(): PoItem {
  return { productId: '', unit: 'cái', unitPerBase: 1, qtyOrdered: 1, unitPrice: 0, notes: '' };
}
function emptyGrItem(): GrItem {
  return { productId: '', unit: 'cái', unitPerBase: 1, qtyOrdered: 0, qtyReceived: 1, qtyDefective: 0, qtyReturned: 0, hasRefund: true, refundAmount: 0, unitPrice: 0, notes: '' };
}
function emptySrItem(): SrItem {
  return { productId: '', qtyReturned: 1, unitPrice: 0, hasRefund: true, refundAmount: 0, reason: '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabelCls({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
      {children}
    </span>
  );
}

function InfoLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-on-surface-variant/70">{label}</p>
      <p className={`mt-1 ${strong ? 'text-lg font-black text-primary' : 'font-semibold text-on-surface'}`}>{value}</p>
    </div>
  );
}

function FieldWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <LabelCls>{label}</LabelCls>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';
const selectCls =
  'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'po' | 'gr' | 'sr'>('po');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void apiClient.get<{ items: Supplier[] }>('/suppliers?limit=500&status=active').then((d) =>
      setSuppliers(d.items ?? []),
    );
    void apiClient
      .get<{ items: Product[] }>('/products?limit=500&includeHidden=true')
      .then((d) => setProducts(d.items ?? []));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">Mua hàng</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Quản lý đơn đặt hàng, phiếu nhận hàng và trả hàng nhà cung cấp.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-on-surface/8 bg-white p-1.5 w-fit shadow-sm">
        {(
          [
            { key: 'po', label: 'Đơn đặt hàng (PO)' },
            { key: 'gr', label: 'Nhận hàng (GR)' },
            { key: 'sr', label: 'Trả hàng NCC (SR)' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              tab === t.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-on-surface-variant hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'po' && <PoTab suppliers={suppliers} products={products} showToast={showToast} />}
      {tab === 'gr' && <GrTab suppliers={suppliers} products={products} showToast={showToast} />}
      {tab === 'sr' && <SrTab suppliers={suppliers} products={products} showToast={showToast} />}
    </div>
  );
}

// ─── PO Tab ───────────────────────────────────────────────────────────────────

function PoTab({
  suppliers,
  products,
  showToast,
}: {
  suppliers: Supplier[];
  products: Product[];
  showToast: (opts: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [items, setItems] = useState<Po[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Po & { items: PoItem[] }) | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PoItem[]>([emptyPoItem()]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    if (search.trim()) q.set('search', search.trim());
    void apiClient
      .get<{ items: Po[]; meta: Meta }>(`/procurement/purchase-orders?${q}`)
      .then((d) => {
        if (!cancelled) { setItems(d.items); setMeta(d.meta); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, statusFilter, page, reloadKey]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    void apiClient
      .get<Po & { items: PoItem[] }>(`/procurement/purchase-orders/${detailId}`)
      .then(setDetail);
  }, [detailId]);

  function openCreate() {
    setSupplierId('');
    setOrderDate(today());
    setExpectedDate('');
    setShippingCost(0);
    setOtherCost(0);
    setNotes('');
    setLines([emptyPoItem()]);
    setModalOpen(true);
  }

  function setLine(idx: number, patch: Partial<PoItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function handleSave() {
    if (!supplierId) {
      showToast({ tone: 'error', title: 'Chọn nhà cung cấp' });
      return;
    }
    if (lines.some((l) => !l.productId || l.qtyOrdered < 1 || l.unitPrice <= 0)) {
      showToast({ tone: 'error', title: 'Điền đầy đủ thông tin các dòng hàng' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/procurement/purchase-orders', {
        supplierId,
        orderDate,
        expectedDate: expectedDate || undefined,
        shippingCost,
        otherCost,
        notes: notes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          unit: l.unit,
          unitPerBase: l.unitPerBase,
          qtyOrdered: l.qtyOrdered,
          unitPrice: l.unitPrice,
          notes: l.notes || undefined,
        })),
      });
      showToast({ tone: 'success', title: 'Đã tạo đơn đặt hàng' });
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(id: string, status: PoStatus) {
    try {
      await apiClient.patch(`/procurement/purchase-orders/${id}/status`, { status });
      showToast({ tone: 'success', title: 'Đã cập nhật trạng thái' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(id); // refresh detail
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  const totalAmount = lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0);

  return (
    <>
      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo mã PO..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(PO_STATUS_LABEL) as PoStatus[]).map((s) => (
              <option key={s} value={s}>{PO_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
          >
            <Plus size={15} />
            Tạo PO
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Mã PO</th>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Ngày đặt</th>
                <th className="px-5 py-4">Tổng tiền</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant"><ClipboardList size={28} className="mx-auto mb-3 text-primary/30" />Chưa có đơn đặt hàng</td></tr>
              ) : items.map((po) => {
                const sup = suppliers.find((s) => s.supplierId === po.supplierId);
                return (
                  <tr key={po.poId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-bold text-on-surface">{po.poCode}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{sup?.name ?? po.supplierId}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-on-surface">{fmt(po.totalAmount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${PO_STATUS_COLOR[po.status]}`}>
                        {PO_STATUS_LABEL[po.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailId(detailId === po.poId ? null : po.poId)}
                          className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8"
                        >
                          {detailId === po.poId ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {po.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => void handleChangeStatus(po.poId, 'ordered')}
                            className="rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                          >
                            Đặt hàng
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'ordered') && (
                          <button
                            type="button"
                            onClick={() => void handleChangeStatus(po.poId, 'cancelled')}
                            className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail row */}
        {false && detailId && detail && (
          <div className="border-t border-on-surface/8 bg-surface/40 px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant/50">Chi tiết dòng hàng — {detail.poCode}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">
                  <tr>
                    <th className="pb-2 pr-6 text-left">Sản phẩm</th>
                    <th className="pb-2 pr-6 text-right">ĐVT</th>
                    <th className="pb-2 pr-6 text-right">SL đặt</th>
                    <th className="pb-2 pr-6 text-right">SL nhận</th>
                    <th className="pb-2 pr-6 text-right">Đơn giá</th>
                    <th className="pb-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6">
                  {(detail.items as any[]).map((item: any, idx: number) => {
                    const prod = products.find((p) => p.productId === item.productId);
                    return (
                      <tr key={idx}>
                        <td className="py-2 pr-6">{prod?.productName ?? item.productId}</td>
                        <td className="py-2 pr-6 text-right text-on-surface-variant">{item.unit}</td>
                        <td className="py-2 pr-6 text-right">{item.qtyOrdered}</td>
                        <td className="py-2 pr-6 text-right">{item.qtyReceived}</td>
                        <td className="py-2 pr-6 text-right">{fmt(item.unitPrice)}</td>
                        <td className="py-2 text-right font-semibold">{fmt(item.qtyOrdered * Number(item.unitPrice))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <p><span className="text-on-surface-variant">Phí vận chuyển:</span> {fmt(detail.shippingCost)}</p>
              <p><span className="text-on-surface-variant">Chi phí khác:</span> {fmt(detail.otherCost)}</p>
              <p className="font-bold"><span className="text-on-surface-variant font-normal">Tổng:</span> {fmt(detail.totalAmount)}</p>
            </div>
            {detail.notes && <p className="mt-2 text-sm text-on-surface-variant">Ghi chú: {detail.notes}</p>}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} phiếu</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {(detailId || detail) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <aside className="h-full w-full max-w-3xl overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-on-surface">Chi tiết PO</h2>
                <p className="text-sm text-on-surface-variant">{detail?.poCode ?? 'Đang tải...'}</p>
              </div>
              <button type="button" onClick={() => setDetailId(null)} className="rounded-lg p-2 hover:bg-surface-variant">
                <X size={20} />
              </button>
            </div>

            {!detail ? (
              <div className="py-16 text-center text-on-surface-variant">Đang tải chi tiết...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-outline-variant p-4 sm:grid-cols-2">
                  <InfoLine label="Mã PO" value={detail.poCode} />
                  <InfoLine label="Trạng thái" value={PO_STATUS_LABEL[detail.status]} />
                  <InfoLine label="Ngày đặt" value={detail.orderDate ? new Date(detail.orderDate).toLocaleDateString('vi-VN') : '-'} />
                  <InfoLine label="Ngày dự kiến" value={detail.expectedDate ? new Date(detail.expectedDate).toLocaleDateString('vi-VN') : '-'} />
                  <InfoLine label="Phí vận chuyển" value={fmt(detail.shippingCost)} />
                  <InfoLine label="Chi phí khác" value={fmt(detail.otherCost)} />
                </div>

                <div className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="mb-3 font-black text-on-surface">Dòng sản phẩm</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead className="text-on-surface-variant">
                        <tr>
                          <th className="pb-2 text-left">Sản phẩm</th>
                          <th className="pb-2 text-right">ĐVT</th>
                          <th className="pb-2 text-right">SL đặt</th>
                          <th className="pb-2 text-right">SL nhập</th>
                          <th className="pb-2 text-right">Đơn giá</th>
                          <th className="pb-2 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {(detail.items as PoItem[]).map((item, idx) => {
                          const fallbackProduct = products.find((p) => p.productId === item.productId);
                          const productName = item.productName ?? fallbackProduct?.productName ?? item.productId;
                          const progress = item.qtyOrdered > 0 ? Math.min(100, ((item.qtyReceived ?? 0) / item.qtyOrdered) * 100) : 0;
                          return (
                            <tr key={`${item.productId}-${idx}`}>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-emerald-50">
                                    {item.primaryImageUrl ? (
                                      <img src={item.primaryImageUrl} alt={productName} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">SP</div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="line-clamp-2 font-bold text-on-surface">{productName}</p>
                                    <p className="text-xs text-on-surface-variant">{item.productCode ?? item.productId}</p>
                                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-variant">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">{item.unit}</td>
                              <td className="py-3 text-right">{item.qtyOrdered}</td>
                              <td className="py-3 text-right">{item.qtyReceived ?? 0}</td>
                              <td className="py-3 text-right">{fmt(item.unitPrice)}</td>
                              <td className="py-3 text-right font-black">{fmt(item.qtyOrdered * Number(item.unitPrice))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-outline-variant p-4 sm:grid-cols-3">
                  <InfoLine label="Tiền hàng" value={fmt(Number(detail.totalAmount) - Number(detail.shippingCost ?? 0) - Number(detail.otherCost ?? 0))} />
                  <InfoLine label="Tổng chi phí" value={fmt(Number(detail.shippingCost ?? 0) + Number(detail.otherCost ?? 0))} />
                  <InfoLine label="Tổng PO" value={fmt(detail.totalAmount)} strong />
                </div>
                {detail.notes ? (
                  <div className="rounded-2xl border border-outline-variant p-4">
                    <h3 className="mb-2 font-black text-on-surface">Ghi chú</h3>
                    <p className="text-sm text-on-surface-variant">{detail.notes}</p>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Create PO Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-sm" style={{ maxHeight: '90vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black text-on-surface">Tạo đơn đặt hàng mới</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Nhà cung cấp *">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn NCC —</option>
                    {suppliers.map((s) => (
                      <option key={s.supplierId} value={s.supplierId}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                    ))}
                  </select>
                </FieldWrap>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldWrap label="Ngày đặt">
                    <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
                  </FieldWrap>
                  <FieldWrap label="Ngày nhận dự kiến">
                    <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
                  </FieldWrap>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Phí vận chuyển (₫)">
                  <input type="number" min={0} value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="Chi phí khác (₫)">
                  <input type="number" min={0} value={otherCost} onChange={(e) => setOtherCost(Number(e.target.value))} className={inputCls} />
                </FieldWrap>
              </div>

              {/* Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <LabelCls>Dòng hàng</LabelCls>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, emptyPoItem()])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 rounded-xl border border-on-surface/8 bg-surface/50 p-3 sm:grid-cols-[1fr_80px_80px_100px_80px_32px]">
                      <select
                        value={line.productId}
                        onChange={(e) => setLine(idx, { productId: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">— Sản phẩm —</option>
                        {products.map((p) => (
                          <option key={p.productId} value={p.productId}>{p.productName}</option>
                        ))}
                      </select>
                      <input
                        placeholder="ĐVT"
                        value={line.unit}
                        onChange={(e) => setLine(idx, { unit: e.target.value })}
                        className={inputCls}
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="SL đặt"
                        value={line.qtyOrdered}
                        onChange={(e) => setLine(idx, { qtyOrdered: Number(e.target.value) })}
                        className={inputCls}
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Đơn giá ₫"
                        value={line.unitPrice}
                        onChange={(e) => setLine(idx, { unitPrice: Number(e.target.value) })}
                        className={inputCls}
                      />
                      <p className="flex items-center justify-end text-xs font-semibold text-on-surface-variant">
                        {fmt(line.qtyOrdered * line.unitPrice)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={lines.length === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-red-500 disabled:opacity-30"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm font-bold text-on-surface">
                  Tổng hàng: {fmt(totalAmount)}
                  {shippingCost + otherCost > 0 && (
                    <span className="ml-3 text-on-surface-variant font-normal text-xs">
                      + phí: {fmt(shippingCost + otherCost)} → {fmt(totalAmount + shippingCost + otherCost)}
                    </span>
                  )}
                </p>
              </div>

              <FieldWrap label="Ghi chú">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </FieldWrap>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}
                Lưu đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── GR Tab ───────────────────────────────────────────────────────────────────

function GrTab({
  suppliers,
  products,
  showToast,
}: {
  suppliers: Supplier[];
  products: Product[];
  showToast: (opts: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [items, setItems] = useState<Gr[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Gr & { items: any[] }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GrCostPreviewItem[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [availablePos, setAvailablePos] = useState<Po[]>([]);

  // Form
  const [supplierId, setSupplierId] = useState('');
  const [poId, setPoId] = useState('');
  const [receiptDate, setReceiptDate] = useState(today());
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GrItem[]>([emptyGrItem()]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    if (search.trim()) q.set('search', search.trim());
    void apiClient
      .get<{ items: Gr[]; meta: Meta }>(`/procurement/goods-receipts?${q}`)
      .then((d) => { if (!cancelled) { setItems(d.items); setMeta(d.meta); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, statusFilter, page, reloadKey]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    void apiClient.get<Gr & { items: any[] }>(`/procurement/goods-receipts/${detailId}`).then(setDetail);
  }, [detailId]);

  function setLine(idx: number, patch: Partial<GrItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    triggerPreview();
  }

  function triggerPreview() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => void fetchPreview(), 600);
  }

  async function fetchPreview() {
    const validLines = lines.filter((l) => l.productId && l.qtyReceived > 0 && l.unitPrice > 0);
    if (!validLines.length) { setPreview([]); return; }
    setPreviewing(true);
    try {
      const result = await apiClient.post<GrCostPreviewItem[]>('/procurement/goods-receipts/preview-cost', {
        supplierId: supplierId || 'preview',
        receiptDate,
        shippingCost,
        otherCost,
        items: validLines.map((l) => ({
          productId: l.productId,
          unit: l.unit,
          unitPerBase: l.unitPerBase,
          qtyOrdered: l.qtyOrdered,
          qtyReceived: l.qtyReceived,
          qtyDefective: l.qtyDefective,
          qtyReturned: l.qtyReturned,
          hasRefund: l.hasRefund,
          refundAmount: l.refundAmount,
          unitPrice: l.unitPrice,
        })),
      });
      setPreview(result);
    } catch {
      // ignore preview errors
    } finally {
      setPreviewing(false);
    }
  }

  function openCreate() {
    setSupplierId('');
    setPoId('');
    setReceiptDate(today());
    setShippingCost(0);
    setOtherCost(0);
    setNotes('');
    setLines([emptyGrItem()]);
    setPreview([]);
    void apiClient
      .get<{ items: Po[] }>('/procurement/purchase-orders?limit=200&status=ordered')
      .then((d) => setAvailablePos(d.items ?? []));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!supplierId) { showToast({ tone: 'error', title: 'Chọn nhà cung cấp' }); return; }
    if (lines.some((l) => !l.productId || l.qtyReceived < 1 || l.unitPrice <= 0)) {
      showToast({ tone: 'error', title: 'Điền đầy đủ thông tin các dòng hàng' });
      return;
    }
    const overReceivedLines = lines.filter((l) => l.qtyOrdered > 0 && l.qtyReceived > l.qtyOrdered);
    if (overReceivedLines.length > 0) {
      showToast({
        tone: 'warning',
        title: `${overReceivedLines.length} dòng nhập thừa so với PO`,
        description: 'Hệ thống vẫn lưu bình thường. Kiểm tra lại nếu không có thỏa thuận với NCC.',
      });
    }
    setSaving(true);
    try {
      await apiClient.post('/procurement/goods-receipts', {
        supplierId,
        poId: poId || undefined,
        receiptDate,
        shippingCost,
        otherCost,
        notes: notes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          unit: l.unit,
          unitPerBase: l.unitPerBase,
          qtyOrdered: l.qtyOrdered,
          qtyReceived: l.qtyReceived,
          qtyDefective: l.qtyDefective,
          qtyReturned: l.qtyReturned,
          hasRefund: l.hasRefund,
          refundAmount: l.refundAmount,
          unitPrice: l.unitPrice,
          notes: l.notes || undefined,
        })),
      });
      showToast({ tone: 'success', title: 'Đã tạo phiếu nhận hàng' });
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(id: string) {
    try {
      await apiClient.patch(`/procurement/goods-receipts/${id}/confirm`, {});
      showToast({ tone: 'success', title: 'Đã xác nhận nhập kho' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(id);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleCancel(id: string) {
    try {
      await apiClient.patch(`/procurement/goods-receipts/${id}/cancel`, {});
      showToast({ tone: 'success', title: 'Đã hủy phiếu nhận hàng' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(null);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <>
      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo mã GR..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(GR_STATUS_LABEL) as GrStatus[]).map((s) => (
              <option key={s} value={s}>{GR_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Làm mới
          </button>
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
            <Plus size={15} />Tạo GR
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Mã GR</th>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Ngày nhận</th>
                <th className="px-5 py-4">Phí VC + Khác</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant"><ClipboardList size={28} className="mx-auto mb-3 text-primary/30" />Chưa có phiếu nhận hàng</td></tr>
              ) : items.map((gr) => {
                const sup = suppliers.find((s) => s.supplierId === gr.supplierId);
                return (
                  <tr key={gr.grId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-bold">{gr.grCode}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{sup?.name ?? gr.supplierId}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{new Date(gr.receiptDate).toLocaleDateString('vi-VN')}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{fmt(Number(gr.shippingCost) + Number(gr.otherCost))}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${GR_STATUS_COLOR[gr.status]}`}>
                        {GR_STATUS_LABEL[gr.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setDetailId(detailId === gr.grId ? null : gr.grId)}
                          className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8">
                          {detailId === gr.grId ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {gr.status === 'draft' && (
                          <>
                            <button type="button" onClick={() => void handleConfirm(gr.grId)}
                              className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                              Xác nhận
                            </button>
                            <button type="button" onClick={() => void handleCancel(gr.grId)}
                              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                              Hủy
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detailId && detail && (
          <div className="border-t border-on-surface/8 bg-surface/40 px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant/50">Chi tiết dòng hàng — {detail.grCode}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">
                  <tr>
                    <th className="pb-2 pr-4 text-left">Sản phẩm</th>
                    <th className="pb-2 pr-4 text-right">SL nhận</th>
                    <th className="pb-2 pr-4 text-right">SL lỗi</th>
                    <th className="pb-2 pr-4 text-right">SL trả</th>
                    <th className="pb-2 pr-4 text-right">Đơn giá</th>
                    <th className="pb-2 pr-4 text-right">NCC hoàn</th>
                    <th className="pb-2 text-right">Giá vốn/cái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6">
                  {detail.items.map((item: any, idx: number) => {
                    const prod = products.find((p) => p.productId === item.productId);
                    return (
                      <tr key={idx}>
                        <td className="py-2 pr-4">{prod?.productName ?? item.productId}</td>
                        <td className="py-2 pr-4 text-right">{item.qtyReceived}</td>
                        <td className="py-2 pr-4 text-right text-amber-600">{item.qtyDefective}</td>
                        <td className="py-2 pr-4 text-right text-red-500">{item.qtyReturned}</td>
                        <td className="py-2 pr-4 text-right">{fmt(item.unitPrice)}</td>
                        <td className="py-2 pr-4 text-right">{item.hasRefund ? fmt(item.refundAmount) : '—'}</td>
                        <td className="py-2 text-right font-bold text-primary">{fmt(item.landedCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {detail.notes && <p className="mt-3 text-sm text-on-surface-variant">Ghi chú: {detail.notes}</p>}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} phiếu</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create GR Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-sm" style={{ maxHeight: '92vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black">Tạo phiếu nhận hàng</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldWrap label="Nhà cung cấp *">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn NCC —</option>
                    {suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name}</option>)}
                  </select>
                </FieldWrap>
                <FieldWrap label="Ngày nhận *">
                  <input type="date" value={receiptDate} onChange={(e) => { setReceiptDate(e.target.value); triggerPreview(); }} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="PO liên kết (tùy chọn)">
                  <select
                    value={poId}
                    onChange={(e) => {
                      const selectedPoId = e.target.value;
                      setPoId(selectedPoId);
                      if (selectedPoId) {
                        void apiClient
                          .get<Po & { items: PoItem[] }>(`/procurement/purchase-orders/${selectedPoId}`)
                          .then((po) => {
                            // Auto-fill NCC từ PO
                            setSupplierId(po.supplierId);
                            if (po.items?.length) {
                              setLines(
                                po.items.map((item) => ({
                                  ...emptyGrItem(),
                                  productId: item.productId,
                                  unit: item.unit,
                                  unitPerBase: item.unitPerBase,
                                  qtyOrdered: item.qtyOrdered,
                                  qtyReceived: item.qtyOrdered,
                                  unitPrice: Number(item.unitPrice),
                                })),
                              );
                              triggerPreview();
                            }
                          });
                      } else {
                        setSupplierId('');
                      }
                    }}
                    className={selectCls}
                  >
                    <option value="">— Không liên kết PO —</option>
                    {availablePos
                      .filter((p) => !supplierId || p.supplierId === supplierId)
                      .map((p) => (
                        <option key={p.poId} value={p.poId}>{p.poCode}</option>
                      ))}
                  </select>
                </FieldWrap>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Phí vận chuyển (₫)">
                  <input type="number" min={0} value={shippingCost} onChange={(e) => { setShippingCost(Number(e.target.value)); triggerPreview(); }} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="Chi phí khác (₫)">
                  <input type="number" min={0} value={otherCost} onChange={(e) => { setOtherCost(Number(e.target.value)); triggerPreview(); }} className={inputCls} />
                </FieldWrap>
              </div>

              {/* Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <LabelCls>Dòng hàng nhận</LabelCls>
                  <button type="button" onClick={() => { setLines((p) => [...p, emptyGrItem()]); }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const validLineIndices = lines.reduce<number[]>((acc, l, i) => {
                      if (l.productId && l.qtyReceived > 0 && l.unitPrice > 0) acc.push(i);
                      return acc;
                    }, []);
                    return lines.map((line, idx) => {
                    const validIdx = validLineIndices.indexOf(idx);
                    const prev = validIdx >= 0 ? preview[validIdx] : undefined;
                    return (
                      <div key={idx} className="rounded-xl border border-on-surface/8 bg-surface/50 p-4 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_80px_80px]">
                          <FieldWrap label="Sản phẩm *">
                            <select value={line.productId} onChange={(e) => setLine(idx, { productId: e.target.value })} className={selectCls}>
                              <option value="">— Chọn sản phẩm —</option>
                              {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
                            </select>
                          </FieldWrap>
                          <FieldWrap label="Đơn giá nhập (₫) *">
                            <input type="number" min={0} value={line.unitPrice} onChange={(e) => setLine(idx, { unitPrice: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                          <FieldWrap label="ĐVT">
                            <input value={line.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} className={inputCls} />
                          </FieldWrap>
                          <FieldWrap label="SL/hộp">
                            <input type="number" min={1} value={line.unitPerBase} onChange={(e) => setLine(idx, { unitPerBase: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <FieldWrap label="SL nhận *">
                            <input type="number" min={1} value={line.qtyReceived} onChange={(e) => setLine(idx, { qtyReceived: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                          <FieldWrap label="SL lỗi">
                            <input type="number" min={0} value={line.qtyDefective} onChange={(e) => setLine(idx, { qtyDefective: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                          <FieldWrap label="SL trả NCC">
                            <input type="number" min={0} value={line.qtyReturned} onChange={(e) => setLine(idx, { qtyReturned: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                          <div className="flex items-end gap-3">
                            <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                              <input
                                type="checkbox"
                                checked={line.hasRefund}
                                onChange={(e) => setLine(idx, { hasRefund: e.target.checked })}
                                className="h-4 w-4 rounded accent-primary"
                              />
                              <span className="text-xs font-semibold text-on-surface-variant">NCC hoàn tiền</span>
                            </label>
                          </div>
                        </div>
                        {line.hasRefund && line.qtyReturned > 0 && (
                          <FieldWrap label="Số tiền NCC hoàn (₫)">
                            <input type="number" min={0} value={line.refundAmount} onChange={(e) => setLine(idx, { refundAmount: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                        )}
                        {/* Cảnh báo nhận thừa */}
                        {line.qtyOrdered > 0 && line.qtyReceived > line.qtyOrdered && (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <span className="font-black">⚠</span>
                            <span>Nhận thừa: đặt <strong>{line.qtyOrdered}</strong>, nhập <strong>{line.qtyReceived}</strong> (+{line.qtyReceived - line.qtyOrdered}). Hệ thống vẫn cho phép nhưng cần xác nhận với NCC.</span>
                          </div>
                        )}
                        {/* Preview row */}
                        {prev && (
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-primary/5 px-4 py-2 text-xs">
                            {previewing && <LoaderCircle size={12} className="animate-spin text-primary" />}
                            <span className="text-on-surface-variant">SL đạt: <strong className="text-on-surface">{prev.qtyGood}</strong></span>
                            <span className="text-on-surface-variant">Phí VC phân bổ: <strong className="text-on-surface">{fmt(prev.allocatedExtraCost)}</strong></span>
                            <span className="text-on-surface-variant">Giá vốn/cái: <strong className="text-primary">{fmt(prev.landedCost)}</strong></span>
                            <span className="text-on-surface-variant">Tổng giá vốn: <strong className="text-on-surface">{fmt(prev.totalLandedCost)}</strong></span>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))} disabled={lines.length === 1}
                            className="text-xs font-bold text-red-400 hover:text-red-600 disabled:opacity-30">
                            Xóa dòng
                          </button>
                        </div>
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>

              <FieldWrap label="Ghi chú">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </FieldWrap>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}
                Lưu phiếu nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── SR Tab ───────────────────────────────────────────────────────────────────

function SrTab({
  suppliers,
  products,
  showToast,
}: {
  suppliers: Supplier[];
  products: Product[];
  showToast: (opts: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [items, setItems] = useState<Sr[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Sr & { items: any[] }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableGrs, setAvailableGrs] = useState<Gr[]>([]);

  // Form
  const [supplierId, setSupplierId] = useState('');
  const [grId, setGrId] = useState('');
  const [returnDate, setReturnDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<SrItem[]>([emptySrItem()]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    if (search.trim()) q.set('search', search.trim());
    void apiClient
      .get<{ items: Sr[]; meta: Meta }>(`/procurement/supplier-returns?${q}`)
      .then((d) => { if (!cancelled) { setItems(d.items); setMeta(d.meta); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, statusFilter, page, reloadKey]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    void apiClient.get<Sr & { items: any[] }>(`/procurement/supplier-returns/${detailId}`).then(setDetail);
  }, [detailId]);

  function setLine(idx: number, patch: Partial<SrItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function handleSave() {
    if (!supplierId) { showToast({ tone: 'error', title: 'Chọn nhà cung cấp' }); return; }
    if (lines.some((l) => !l.productId || l.qtyReturned < 1 || l.unitPrice <= 0)) {
      showToast({ tone: 'error', title: 'Điền đầy đủ thông tin dòng hàng' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/procurement/supplier-returns', {
        supplierId,
        grId: grId || undefined,
        returnDate,
        notes: notes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          qtyReturned: l.qtyReturned,
          unitPrice: l.unitPrice,
          hasRefund: l.hasRefund,
          refundAmount: l.hasRefund ? l.refundAmount : 0,
          reason: l.reason || undefined,
        })),
      });
      showToast({ tone: 'success', title: 'Đã tạo phiếu trả hàng NCC' });
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmSr(id: string) {
    try {
      await apiClient.patch(`/procurement/supplier-returns/${id}/confirm`, {});
      showToast({ tone: 'success', title: 'Đã xác nhận trả hàng NCC, tồn kho đã điều chỉnh' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(id);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  const totalRefund = lines.reduce(
    (s, l) => s + (l.hasRefund ? (l.refundAmount || l.qtyReturned * l.unitPrice) : 0),
    0,
  );

  return (
    <>
      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo mã SR..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none">
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(SR_STATUS_LABEL) as SrStatus[]).map((s) => (
              <option key={s} value={s}>{SR_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Làm mới
          </button>
          <button type="button" onClick={() => {
            setSupplierId(''); setGrId(''); setReturnDate(today()); setNotes(''); setLines([emptySrItem()]);
            void apiClient.get<{ items: Gr[] }>('/procurement/goods-receipts?limit=200&status=confirmed')
              .then((d) => setAvailableGrs(d.items ?? []));
            setModalOpen(true);
          }}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
            <Plus size={15} />Tạo SR
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Mã SR</th>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Ngày trả</th>
                <th className="px-5 py-4">Tiền hoàn</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant"><ClipboardList size={28} className="mx-auto mb-3 text-primary/30" />Chưa có phiếu trả hàng</td></tr>
              ) : items.map((sr) => {
                const sup = suppliers.find((s) => s.supplierId === sr.supplierId);
                return (
                  <tr key={sr.srId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-bold">{sr.srCode}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{sup?.name ?? sr.supplierId}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{new Date(sr.returnDate).toLocaleDateString('vi-VN')}</td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-700">{fmt(sr.totalRefund)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${SR_STATUS_COLOR[sr.status]}`}>
                        {SR_STATUS_LABEL[sr.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setDetailId(detailId === sr.srId ? null : sr.srId)}
                          className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8">
                          {detailId === sr.srId ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {sr.status === 'draft' && (
                          <button type="button" onClick={() => void handleConfirmSr(sr.srId)}
                            className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                            Xác nhận
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detailId && detail && (
          <div className="border-t border-on-surface/8 bg-surface/40 px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant/50">Chi tiết — {detail.srCode}</p>
            <table className="min-w-full text-sm">
              <thead className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">
                <tr>
                  <th className="pb-2 pr-6 text-left">Sản phẩm</th>
                  <th className="pb-2 pr-6 text-right">SL trả</th>
                  <th className="pb-2 pr-6 text-right">Đơn giá</th>
                  <th className="pb-2 pr-6 text-right">NCC hoàn</th>
                  <th className="pb-2 text-left">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface/6">
                {detail.items.map((item: any, idx: number) => {
                  const prod = products.find((p) => p.productId === item.productId);
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-6">{prod?.productName ?? item.productId}</td>
                      <td className="py-2 pr-6 text-right">{item.qtyReturned}</td>
                      <td className="py-2 pr-6 text-right">{fmt(item.unitPrice)}</td>
                      <td className="py-2 pr-6 text-right">{item.hasRefund ? fmt(item.refundAmount) : '—'}</td>
                      <td className="py-2 text-on-surface-variant">{item.reason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.notes && <p className="mt-3 text-sm text-on-surface-variant">Ghi chú: {detail.notes}</p>}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} phiếu</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create SR Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-sm" style={{ maxHeight: '90vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black">Tạo phiếu trả hàng NCC</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldWrap label="Nhà cung cấp *">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn NCC —</option>
                    {suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name}</option>)}
                  </select>
                </FieldWrap>
                <FieldWrap label="Ngày trả *">
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="GR liên kết (tùy chọn)">
                  <select value={grId} onChange={(e) => setGrId(e.target.value)} className={selectCls}>
                    <option value="">— Không liên kết GR —</option>
                    {availableGrs
                      .filter((g) => !supplierId || g.supplierId === supplierId)
                      .map((g) => (
                        <option key={g.grId} value={g.grId}>
                          {g.grCode} ({new Date(g.receiptDate).toLocaleDateString('vi-VN')})
                        </option>
                      ))}
                  </select>
                </FieldWrap>
              </div>

              {/* Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <LabelCls>Dòng hàng trả</LabelCls>
                  <button type="button" onClick={() => setLines((p) => [...p, emptySrItem()])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="rounded-xl border border-on-surface/8 bg-surface/50 p-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_100px_120px]">
                        <FieldWrap label="Sản phẩm *">
                          <select value={line.productId} onChange={(e) => setLine(idx, { productId: e.target.value })} className={selectCls}>
                            <option value="">— Chọn sản phẩm —</option>
                            {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
                          </select>
                        </FieldWrap>
                        <FieldWrap label="SL trả *">
                          <input type="number" min={1} value={line.qtyReturned} onChange={(e) => setLine(idx, { qtyReturned: Number(e.target.value) })} className={inputCls} />
                        </FieldWrap>
                        <FieldWrap label="Đơn giá (₫) *">
                          <input type="number" min={0} value={line.unitPrice} onChange={(e) => setLine(idx, { unitPrice: Number(e.target.value) })} className={inputCls} />
                        </FieldWrap>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input type="checkbox" checked={line.hasRefund} onChange={(e) => setLine(idx, { hasRefund: e.target.checked })} className="h-4 w-4 rounded accent-primary" />
                          <span className="text-xs font-semibold text-on-surface-variant">NCC hoàn tiền</span>
                        </label>
                        {line.hasRefund && (
                          <FieldWrap label="Số tiền hoàn (₫)">
                            <input type="number" min={0} value={line.refundAmount || line.qtyReturned * line.unitPrice}
                              onChange={(e) => setLine(idx, { refundAmount: Number(e.target.value) })} className={inputCls} />
                          </FieldWrap>
                        )}
                        <FieldWrap label="Lý do trả">
                          <input value={line.reason} onChange={(e) => setLine(idx, { reason: e.target.value })}
                            placeholder="Hàng lỗi, sai quy cách..." className={inputCls} />
                        </FieldWrap>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))} disabled={lines.length === 1}
                          className="text-xs font-bold text-red-400 hover:text-red-600 disabled:opacity-30">Xóa dòng</button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalRefund > 0 && (
                  <p className="mt-3 text-right text-sm font-bold text-emerald-700">
                    Tổng tiền NCC hoàn: {fmt(totalRefund)}
                  </p>
                )}
              </div>

              <FieldWrap label="Ghi chú">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </FieldWrap>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}
                Lưu phiếu trả
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
