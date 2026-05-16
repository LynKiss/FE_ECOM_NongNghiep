import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  FlaskConical,
  Layers,
  Leaf,
  Loader2,
  Package,
  RefreshCw,
  TrendingDown,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../i18n/language-context';

// ─── Types khớp BE ────────────────────────────────────────────────────────────
type Batch = {
  batchId: string;
  productId: string;
  grId: string | null;
  batchCode: string;
  mfgDate: string | null;
  expDate: string | null;
  qtyReceived: number;
  qtyRemaining: number;
  unitCost: string; // decimal string
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type BatchStats = {
  totalBatches: number;
  totalQty: number;
  totalValue: number;
  breakdown: { active: number; expiringSoon: number; critical: number; expired: number };
};

type FifoLine = {
  batchId: string;
  batchCode: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  expDate: string | null;
};
type FifoResult = {
  lines: FifoLine[];
  totalQty: number;
  totalCost: number;
  avgCost: number;
  shortfall: number;
  success: boolean;
};

type Product = {
  productId: string;
  productName: string;
  unit?: string | null;
  quantityAvailable?: number;
  avgCost?: string;
};

type WriteOffResult = {
  batch: Batch;
  totalLoss: number;
  reason: string;
};

type BackfillResult = {
  created: number;
  skipped: number;
  totalProducts: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatVND(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(num);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysToExpiry(iso: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const exp = new Date(iso);
  exp.setHours(0, 0, 0, 0);
  const ref = new Date(today);
  ref.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - ref.getTime()) / 86_400_000);
}

type BatchStatus = 'active' | 'expiring_soon' | 'critical' | 'expired' | 'depleted';

function getBatchStatus(b: Batch): BatchStatus {
  if (b.qtyRemaining <= 0) return 'depleted';
  const d = daysToExpiry(b.expDate);
  if (d === null) return 'active';
  if (d < 0) return 'expired';
  if (d <= 7) return 'critical';
  if (d <= 30) return 'expiring_soon';
  return 'active';
}

const STATUS_STYLES: Record<BatchStatus, string> = {
  active: 'bg-green-100 text-green-700 ring-green-200',
  expiring_soon: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  critical: 'bg-orange-100 text-orange-700 ring-orange-200',
  expired: 'bg-red-100 text-red-700 ring-red-200',
  depleted: 'bg-gray-100 text-gray-500 ring-gray-200',
};

type TabId = 'dashboard' | 'batches' | 'expiry' | 'fifo' | 'config';
type T = (vi: string, en: string) => string;

// ─── Main component ──────────────────────────────────────────────────────────
export default function AgriInventoryPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const vi = language === 'vi';
  const t = useCallback<T>((v, e) => (vi ? v : e), [vi]);

  const [tab, setTab] = useState<TabId>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [expiring, setExpiring] = useState<Batch[]>([]);
  const [expired, setExpired] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Build productId → name map for display
  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.productId, p));
    return m;
  }, [products]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiClient.get<{ items?: Product[] } | Product[]>('/products?limit=500&includeHidden=true').catch(() => ({ items: [] })),
      apiClient.get<Batch[]>('/inventory/batches?includeDepleted=true').catch(() => []),
      apiClient.get<BatchStats>('/inventory/batches/stats').catch(() => null),
      apiClient.get<Batch[]>('/inventory/batches/expiring?daysAhead=30').catch(() => []),
      apiClient.get<Batch[]>('/inventory/batches/expired').catch(() => []),
    ]).then(([prodResp, b, s, exp, expd]) => {
      if (cancelled) return;
      const prodList = Array.isArray(prodResp) ? prodResp : (prodResp?.items ?? []);
      setProducts(prodList);
      setBatches(b ?? []);
      setStats(s);
      setExpiring(exp ?? []);
      setExpired(expd ?? []);
    }).catch((err) => {
      if (!cancelled) {
        showToast({ tone: 'error', title: t('Tải dữ liệu thất bại', 'Failed to load data'), description: err instanceof Error ? err.message : '' });
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [refreshKey, t, showToast]);

  const totalStockValue = stats?.totalValue ?? 0;

  // ─── Tabs ────────────────────────────────────────────────────────────────
  const TABS: Array<{ id: TabId; icon: typeof Package; vi: string; en: string }> = [
    { id: 'dashboard', icon: Package, vi: 'Tổng quan', en: 'Overview' },
    { id: 'batches', icon: Layers, vi: 'Lô hàng', en: 'Batches' },
    { id: 'expiry', icon: AlertTriangle, vi: 'Hết hạn', en: 'Expiry' },
    { id: 'fifo', icon: FlaskConical, vi: 'Mô phỏng FIFO', en: 'FIFO Simulator' },
    { id: 'config', icon: Database, vi: 'Cấu hình', en: 'Setup' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Leaf className="h-6 w-6 text-primary" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-on-surface">{t('Quản lý lô hàng FIFO / FEFO', 'Batch Inventory (FIFO / FEFO)')}</h1>
          <p className="text-xs text-on-surface-variant">
            {t('Lô hàng tạo từ Goods Receipt · Order checkout tự pick theo FEFO (hết hạn trước) hoặc FIFO',
              'Batches created from Goods Receipts · Order checkout auto-picks via FEFO (earliest expiry) or FIFO')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {batches.length} {t('lô', 'batches')} · {formatVND(totalStockValue)}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-primary/5 disabled:opacity-50"
            title={t('Làm mới', 'Refresh')}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('Làm mới', 'Refresh')}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <strong>{t('Lưu ý nghiệp vụ', 'Workflow note')}:</strong>{' '}
        {t('Để nhập hàng, dùng module Procurement → Goods Receipt (có thể tách 1 phiếu thành nhiều lô). Order checkout sẽ tự pick FEFO/FIFO. Trang này dùng để theo dõi, hủy lô, giảm giá hàng cận date.',
          'To receive stock, use Procurement → Goods Receipt (you may split a receipt into multiple batches). Order checkout will auto-pick FEFO/FIFO. This page is for monitoring, write-off, and price reduction.')}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-outline-variant">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="h-4 w-4" />
              {vi ? item.vi : item.en}
            </button>
          );
        })}
      </div>

      {loading && batches.length === 0 ? (
        <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-outline-variant bg-surface">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {tab === 'dashboard' && (
            <DashboardTab stats={stats} expiring={expiring} expired={expired} batches={batches} productMap={productMap} t={t} vi={vi} />
          )}
          {tab === 'batches' && <BatchesTab batches={batches} productMap={productMap} products={products} t={t} vi={vi} />}
          {tab === 'expiry' && (
            <ExpiryTab expiring={expiring} expired={expired} productMap={productMap} onRefresh={refresh} t={t} vi={vi} />
          )}
          {tab === 'fifo' && <FifoSimulatorTab products={products} t={t} />}
          {tab === 'config' && <ConfigTab onRefresh={refresh} t={t} />}
        </>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, vi }: { status: BatchStatus; vi: boolean }) {
  const labels: Record<BatchStatus, [string, string]> = {
    active: ['Bình thường', 'Active'],
    expiring_soon: ['Sắp hết hạn', 'Expiring'],
    critical: ['Cận hạn ≤7d', 'Critical'],
    expired: ['Đã hết hạn', 'Expired'],
    depleted: ['Hết hàng', 'Depleted'],
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {vi ? labels[status][0] : labels[status][1]}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab(props: {
  stats: BatchStats | null;
  expiring: Batch[];
  expired: Batch[];
  batches: Batch[];
  productMap: Map<string, Product>;
  t: T; vi: boolean;
}) {
  const { stats, expiring, expired, batches, productMap, t, vi } = props;

  const kpis = [
    { label: t('Lô đang lưu', 'Active batches'), value: stats?.totalBatches ?? 0, sub: t('lô còn hàng', 'with stock'), icon: Layers, tone: 'text-primary' },
    { label: t('Sắp hết hạn', 'Expiring soon'), value: stats?.breakdown.expiringSoon ?? 0, sub: t('≤ 30 ngày', '≤ 30 days'), icon: CalendarClock, tone: 'text-yellow-700' },
    { label: t('Cận hạn', 'Critical'), value: stats?.breakdown.critical ?? 0, sub: t('≤ 7 ngày', '≤ 7 days'), icon: AlertTriangle, tone: 'text-orange-700' },
    { label: t('Đã hết hạn', 'Expired'), value: stats?.breakdown.expired ?? 0, sub: t('cần xử lý', 'needs action'), icon: XCircle, tone: 'text-red-700' },
  ];

  // Group batches by product for "stock by product" table
  const productAgg = useMemo(() => {
    const m = new Map<string, { totalQty: number; totalValue: number; nextFifoCost: number | null; batches: Batch[] }>();
    const active = batches.filter((b) => b.qtyRemaining > 0);
    const sorted = [...active].sort((a, b) => {
      const da = a.expDate ? new Date(a.expDate).getTime() : Infinity;
      const db = b.expDate ? new Date(b.expDate).getTime() : Infinity;
      if (da !== db) return da - db;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    for (const b of sorted) {
      const cur = m.get(b.productId) ?? { totalQty: 0, totalValue: 0, nextFifoCost: null, batches: [] };
      cur.totalQty += b.qtyRemaining;
      cur.totalValue += b.qtyRemaining * Number(b.unitCost);
      if (cur.nextFifoCost === null) cur.nextFifoCost = Number(b.unitCost);
      cur.batches.push(b);
      m.set(b.productId, cur);
    }
    return Array.from(m.entries());
  }, [batches]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-outline-variant bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-on-surface-variant">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${k.tone}`}>{k.value.toLocaleString()}</p>
              <p className="text-xs text-on-surface-variant">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {(expiring.length > 0 || expired.length > 0) && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-700" />
            <h3 className="font-semibold text-yellow-800">{t('Cảnh báo hạn sử dụng', 'Expiry warnings')}</h3>
          </div>
          <div className="space-y-2">
            {[...expired, ...expiring].slice(0, 12).map((b) => {
              const days = daysToExpiry(b.expDate);
              const status = getBatchStatus(b);
              const product = productMap.get(b.productId);
              return (
                <div key={b.batchId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-4 py-2.5 shadow-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-semibold text-on-surface">{b.batchCode}</span>
                    <span className="ml-2 text-sm text-on-surface-variant">{product?.productName ?? b.productId}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-on-surface-variant">{t('Còn', 'Left')} {b.qtyRemaining.toLocaleString()}</span>
                    <StatusBadge status={status} vi={vi} />
                    {days !== null && (
                      <span className={`font-semibold ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : 'text-yellow-700'}`}>
                        {days < 0 ? t(`Quá ${-days} ngày`, `${-days}d overdue`) : days === 0 ? t('Hết hạn hôm nay', 'Today') : t(`Còn ${days} ngày`, `${days}d left`)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-on-surface">
          <Package className="h-4 w-4 text-primary" />
          {t('Tồn kho theo sản phẩm', 'Stock by product')}
        </h3>
        {productAgg.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t('Chưa có lô hàng nào — vào tab Cấu hình để tạo legacy batch cho stock có sẵn.', 'No batches yet — go to Setup to create legacy batches from existing stock.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                  <th className="pb-2 pr-4">{t('Sản phẩm', 'Product')}</th>
                  <th className="pb-2 pr-4 text-right">{t('Số lô', 'Batches')}</th>
                  <th className="pb-2 pr-4 text-right">{t('Tổng tồn', 'Total qty')}</th>
                  <th className="pb-2 pr-4 text-right">{t('Giá vốn FIFO kế tiếp', 'Next FIFO cost')}</th>
                  <th className="pb-2 text-right">{t('Tổng giá trị', 'Total value')}</th>
                </tr>
              </thead>
              <tbody>
                {productAgg.map(([pid, agg]) => {
                  const product = productMap.get(pid);
                  return (
                    <tr key={pid} className="border-b border-outline-variant/50 hover:bg-primary/5">
                      <td className="py-2.5 pr-4 font-medium text-on-surface">{product?.productName ?? pid}</td>
                      <td className="py-2.5 pr-4 text-right text-on-surface-variant">{agg.batches.length}</td>
                      <td className="py-2.5 pr-4 text-right font-medium">{agg.totalQty.toLocaleString()} {product?.unit ?? ''}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-primary">{agg.nextFifoCost !== null ? formatVND(agg.nextFifoCost) : '—'}</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{formatVND(agg.totalValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Batches Tab ──────────────────────────────────────────────────────────────
function BatchesTab(props: { batches: Batch[]; productMap: Map<string, Product>; products: Product[]; t: T; vi: boolean }) {
  const { batches, productMap, products, t, vi } = props;
  const [filterProduct, setFilterProduct] = useState('');
  const [showDepleted, setShowDepleted] = useState(false);

  const filtered = useMemo(() => {
    return batches
      .filter((b) => (filterProduct ? b.productId === filterProduct : true))
      .filter((b) => (showDepleted ? true : b.qtyRemaining > 0))
      .sort((a, b) => {
        const da = a.expDate ? new Date(a.expDate).getTime() : Infinity;
        const db = b.expDate ? new Date(b.expDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [batches, filterProduct, showDepleted]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">{t('Sản phẩm', 'Product')}</label>
            <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary">
              <option value="">{t('Tất cả', 'All')}</option>
              {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showDepleted} onChange={(e) => setShowDepleted(e.target.checked)} />
            {t('Hiện lô đã hết hàng', 'Show depleted')}
          </label>
          <span className="ml-auto text-xs text-on-surface-variant">{filtered.length} {t('lô', 'batches')}</span>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface p-5">
        <h3 className="mb-4 flex flex-wrap items-center gap-2 font-semibold text-on-surface">
          <Layers className="h-4 w-4 text-primary" />
          {t('Danh sách lô hàng', 'Batches list')}
          <span className="text-xs font-normal text-on-surface-variant">{t('FEFO — hết hạn sớm nhất ở trên', 'FEFO — earliest expiry first')}</span>
        </h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t('Không có lô nào.', 'No batches.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">{t('Số lô', 'Batch')}</th>
                  <th className="pb-2 pr-3">{t('Sản phẩm', 'Product')}</th>
                  <th className="pb-2 pr-3">{t('Ngày nhập', 'Received')}</th>
                  <th className="pb-2 pr-3">{t('HSD', 'Expiry')}</th>
                  <th className="pb-2 pr-3 text-right">{t('Còn / Nhập', 'Rem / Recv')}</th>
                  <th className="pb-2 pr-3 text-right">{t('Đơn giá', 'Unit cost')}</th>
                  <th className="pb-2">{t('Trạng thái', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const days = daysToExpiry(b.expDate);
                  const status = getBatchStatus(b);
                  const product = productMap.get(b.productId);
                  return (
                    <tr key={b.batchId} className="border-b border-outline-variant/50 hover:bg-primary/5">
                      <td className="py-2.5 pr-3 text-on-surface-variant">{i + 1}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-primary">{b.batchCode}</td>
                      <td className="py-2.5 pr-3 text-on-surface">{product?.productName ?? b.productId}</td>
                      <td className="py-2.5 pr-3 text-on-surface-variant">{formatDate(b.createdAt)}</td>
                      <td className="py-2.5 pr-3 text-on-surface-variant">
                        {formatDate(b.expDate)}
                        {days !== null && (
                          <span className={`ml-1 text-xs ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : days <= 30 ? 'text-yellow-700' : 'text-on-surface-variant'}`}>
                            ({days < 0 ? `${-days}d ${t('quá', 'over')}` : `${days}d`})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium">
                        {b.qtyRemaining.toLocaleString()} / <span className="text-on-surface-variant">{b.qtyReceived.toLocaleString()}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{formatVND(b.unitCost)}</td>
                      <td className="py-2.5"><StatusBadge status={status} vi={vi} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expiry Tab ───────────────────────────────────────────────────────────────
function ExpiryTab(props: {
  expiring: Batch[]; expired: Batch[];
  productMap: Map<string, Product>;
  onRefresh: () => void;
  t: T; vi: boolean;
}) {
  const { expiring, expired, productMap, onRefresh, t, vi } = props;
  const { showToast } = useToast();
  const [woConfirmId, setWoConfirmId] = useState<string | null>(null);
  const [woReason, setWoReason] = useState<'expired' | 'damaged' | 'quality_fail' | 'other'>('expired');
  const [woNotes, setWoNotes] = useState('');
  const [prBatchId, setPrBatchId] = useState<string | null>(null);
  const [prNewPrice, setPrNewPrice] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleWriteOff = async (batchId: string) => {
    setBusyId(batchId);
    try {
      const result = await apiClient.post<WriteOffResult>(`/inventory/batches/${batchId}/write-off`, {
        reason: woReason,
        notes: woNotes,
      });
      showToast({ tone: 'success', title: t('Đã hủy lô', 'Written off'), description: `${result.batch.batchCode} · ${t('Tổn thất', 'Loss')}: ${formatVND(result.totalLoss)}` });
      setWoConfirmId(null);
      setWoNotes('');
      onRefresh();
    } catch (err) {
      showToast({ tone: 'error', title: t('Hủy lô thất bại', 'Write-off failed'), description: err instanceof Error ? err.message : '' });
    } finally {
      setBusyId(null);
    }
  };

  const handlePriceReduction = async (batchId: string) => {
    const newPrice = Number(prNewPrice);
    if (newPrice <= 0) {
      showToast({ tone: 'error', title: t('Giá không hợp lệ', 'Invalid price') });
      return;
    }
    setBusyId(batchId);
    try {
      await apiClient.post(`/inventory/batches/${batchId}/price-reduction`, {
        newUnitCost: newPrice,
        notes: prNotes,
      });
      showToast({ tone: 'success', title: t('Đã giảm giá lô', 'Price reduced') });
      setPrBatchId(null);
      setPrNewPrice('');
      setPrNotes('');
      onRefresh();
    } catch (err) {
      showToast({ tone: 'error', title: t('Giảm giá thất bại', 'Price reduction failed'), description: err instanceof Error ? err.message : '' });
    } finally {
      setBusyId(null);
    }
  };

  const reasons: Array<{ value: 'expired' | 'damaged' | 'quality_fail' | 'other'; vi: string; en: string }> = [
    { value: 'expired', vi: 'Hết hạn sử dụng', en: 'Expired' },
    { value: 'damaged', vi: 'Hư hỏng vật lý', en: 'Damaged' },
    { value: 'quality_fail', vi: 'Không đạt chất lượng', en: 'Quality fail' },
    { value: 'other', vi: 'Lý do khác', en: 'Other' },
  ];

  const renderRow = (b: Batch) => {
    const days = daysToExpiry(b.expDate);
    const status = getBatchStatus(b);
    const isExpired = status === 'expired';
    const product = productMap.get(b.productId);
    const busy = busyId === b.batchId;

    return (
      <div key={b.batchId} className={`rounded-lg border p-4 ${isExpired ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-on-surface">{b.batchCode}</span>
              <StatusBadge status={status} vi={vi} />
            </div>
            <p className="mt-1 text-sm text-on-surface">{product?.productName ?? b.productId} · {t('Còn', 'Left')} <strong>{b.qtyRemaining.toLocaleString()}</strong> {product?.unit ?? ''} · {formatVND(b.unitCost)}</p>
            <p className="text-xs text-on-surface-variant">{t('HSD', 'Exp')} {formatDate(b.expDate)} {days !== null && <>— <span className="font-semibold">{days < 0 ? t(`Quá hạn ${-days} ngày`, `${-days}d overdue`) : t(`Còn ${days} ngày`, `${days}d left`)}</span></>}</p>
          </div>
          <div className="flex gap-2">
            {!isExpired && (
              <button onClick={() => setPrBatchId(b.batchId)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-surface px-3 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-50">
                <TrendingDown className="h-3.5 w-3.5" />
                {t('Giảm giá', 'Reduce price')}
              </button>
            )}
            <button onClick={() => setWoConfirmId(b.batchId)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" />
              {t('Hủy lô', 'Write off')}
            </button>
          </div>
        </div>

        {woConfirmId === b.batchId && (
          <div className="mt-4 rounded-lg border border-red-300 bg-surface p-4">
            <p className="mb-3 text-sm font-semibold text-red-800">{t('Xác nhận hủy lô', 'Confirm write-off')}</p>
            <div className="space-y-3">
              <Field label={t('Lý do', 'Reason')}>
                <select value={woReason} onChange={(e) => setWoReason(e.target.value as typeof woReason)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                  {reasons.map((r) => <option key={r.value} value={r.value}>{vi ? r.vi : r.en}</option>)}
                </select>
              </Field>
              <Field label={t('Ghi chú', 'Notes')}>
                <textarea value={woNotes} onChange={(e) => setWoNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              </Field>
              <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">
                {t('Tổn thất ghi nhận', 'Recorded loss')}: <strong>{formatVND(b.qtyRemaining * Number(b.unitCost))}</strong>
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleWriteOff(b.batchId)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('Xác nhận hủy', 'Confirm')}
                </button>
                <button onClick={() => setWoConfirmId(null)} disabled={busy} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface hover:bg-primary/5">{t('Hủy', 'Cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {prBatchId === b.batchId && (
          <div className="mt-4 rounded-lg border border-yellow-300 bg-surface p-4">
            <p className="mb-3 text-sm font-semibold text-yellow-800">{t('Giảm giá lô để bán nhanh', 'Reduce price to clear stock')}</p>
            <div className="space-y-3">
              <Field label={t(`Giá mới (giá cũ ${formatVND(b.unitCost)})`, `New price (was ${formatVND(b.unitCost)})`)}>
                <input type="number" value={prNewPrice} onChange={(e) => setPrNewPrice(e.target.value)} placeholder="0" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              </Field>
              <Field label={t('Ghi chú', 'Notes')}>
                <input value={prNotes} onChange={(e) => setPrNotes(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              </Field>
              {Number(prNewPrice) > 0 && Number(prNewPrice) < Number(b.unitCost) && (
                <p className="rounded-lg bg-yellow-100 px-3 py-2 text-xs text-yellow-800">
                  {t('Giảm', 'Reduction')}: <strong>{formatVND((Number(b.unitCost) - Number(prNewPrice)) * b.qtyRemaining)}</strong> ({Math.round((1 - Number(prNewPrice) / Number(b.unitCost)) * 100)}%)
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => handlePriceReduction(b.batchId)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-2 text-xs font-semibold text-white hover:bg-yellow-700 disabled:opacity-50">
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('Áp dụng', 'Apply')}
                </button>
                <button onClick={() => setPrBatchId(null)} disabled={busy} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface hover:bg-primary/5">{t('Hủy', 'Cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {expired.length === 0 && expiring.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <p className="mt-3 font-semibold text-on-surface">{t('Không có lô nào sắp/đã hết hạn', 'No batches expiring or expired')}</p>
          <p className="text-sm text-on-surface-variant">{t('Toàn bộ kho đang ở trạng thái an toàn.', 'All stock is healthy.')}</p>
        </div>
      ) : (
        <>
          {expired.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-700">
                <XCircle className="h-4 w-4" />
                {t(`Đã hết hạn (${expired.length})`, `Expired (${expired.length})`)}
              </h3>
              {expired.map(renderRow)}
            </div>
          )}
          {expiring.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-yellow-700">
                <CalendarClock className="h-4 w-4" />
                {t(`Sắp hết hạn (${expiring.length})`, `Expiring soon (${expiring.length})`)}
              </h3>
              {expiring.map(renderRow)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── FIFO Simulator Tab ───────────────────────────────────────────────────────
function FifoSimulatorTab(props: { products: Product[]; t: T }) {
  const { products, t } = props;
  const { showToast } = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [result, setResult] = useState<FifoResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].productId);
  }, [products, productId]);

  const run = async () => {
    const q = Number(qty);
    if (!productId || q <= 0) {
      showToast({ tone: 'error', title: t('Chọn sản phẩm và nhập số lượng > 0', 'Choose a product and enter qty > 0') });
      return;
    }
    setRunning(true);
    try {
      const r = await apiClient.post<FifoResult>('/inventory/batches/preview-fifo', { productId, qty: q });
      setResult(r);
    } catch (err) {
      showToast({ tone: 'error', title: t('Lỗi mô phỏng', 'Simulation error'), description: err instanceof Error ? err.message : '' });
    } finally {
      setRunning(false);
    }
  };

  const product = products.find((p) => p.productId === productId);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-outline-variant bg-surface p-5">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-on-surface">
          <FlaskConical className="h-4 w-4 text-primary" />
          {t('Mô phỏng pick FIFO / FEFO', 'FIFO / FEFO pick simulator')}
        </h3>
        <p className="mb-4 text-xs text-on-surface-variant">
          {t('Chọn sản phẩm + số lượng để xem hệ thống sẽ pick những lô nào (theo FEFO — hết hạn sớm trước, NULL last). Không thay đổi DB.',
            'Choose a product + qty to see which batches would be picked (FEFO — earliest expiry first, NULL last). Read-only.')}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label={t('Sản phẩm', 'Product')}>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary">
              {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
            </select>
          </Field>
          <Field label={t('Số lượng', 'Quantity')}>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100" min="1" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary" />
          </Field>
          <div className="flex items-end">
            <button onClick={run} disabled={running} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('Tính theo FIFO', 'Run FIFO')}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border p-5 ${result.success ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <h3 className={`mb-3 font-semibold ${result.success ? 'text-green-800' : 'text-orange-800'}`}>
            {result.success
              ? t('Đủ hàng — danh sách lô sẽ pick:', 'Sufficient — batches to pick:')
              : t(`Không đủ hàng (thiếu ${result.shortfall})`, `Insufficient (shortfall ${result.shortfall})`)}
          </h3>
          {result.lines.length > 0 ? (
            <div className="overflow-x-auto rounded-lg bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t('Số lô', 'Batch')}</th>
                    <th className="px-3 py-2">{t('HSD', 'Expiry')}</th>
                    <th className="px-3 py-2 text-right">{t('SL lấy', 'Qty')}</th>
                    <th className="px-3 py-2 text-right">{t('Đơn giá', 'Unit cost')}</th>
                    <th className="px-3 py-2 text-right">{t('Thành tiền', 'Subtotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l, i) => (
                    <tr key={l.batchId} className="border-b border-outline-variant/50">
                      <td className="px-3 py-2 text-on-surface-variant">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{l.batchCode}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{formatDate(l.expDate)}</td>
                      <td className="px-3 py-2 text-right font-medium">{l.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{formatVND(l.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">{formatVND(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/5">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-on-surface">{t('Tổng cộng', 'Total')}</td>
                    <td className="px-3 py-2 text-right font-bold">{result.totalQty.toLocaleString()} {product?.unit ?? ''}</td>
                    <td className="px-3 py-2 text-right text-xs text-on-surface-variant">{t('BQ', 'Avg')} {formatVND(result.avgCost)}</td>
                    <td className="px-3 py-2 text-right font-bold text-primary">{formatVND(result.totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">{t('Không có lô nào hợp lệ (có thể tất cả đã hết hạn hoặc hết hàng).', 'No eligible batches (all expired or depleted).')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Config / Migration Tab ───────────────────────────────────────────────────
function ConfigTab(props: { onRefresh: () => void; t: T }) {
  const { onRefresh, t } = props;
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  const runBackfill = async () => {
    if (!confirm(t('Tạo legacy batch cho tất cả product có stock chưa có batch? (Idempotent — gọi lại không có hại)', 'Create legacy batches for all products with stock that have no batches? (Idempotent — safe to re-run)'))) {
      return;
    }
    setRunning(true);
    try {
      const r = await apiClient.post<BackfillResult>('/inventory/batches/backfill-legacy');
      setResult(r);
      showToast({ tone: 'success', title: t('Migration hoàn tất', 'Migration done'), description: t(`Tạo ${r.created}, bỏ qua ${r.skipped} / ${r.totalProducts} product`, `Created ${r.created}, skipped ${r.skipped} of ${r.totalProducts} products`) });
      onRefresh();
    } catch (err) {
      showToast({ tone: 'error', title: t('Migration thất bại', 'Migration failed'), description: err instanceof Error ? err.message : '' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-outline-variant bg-surface p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-on-surface">
          <Database className="h-4 w-4 text-primary" />
          {t('Migration: tạo legacy batch cho stock có sẵn', 'Migration: create legacy batches for existing stock')}
        </h3>
        <p className="mb-4 text-sm text-on-surface-variant">
          {t('Chạy 1 lần khi mới bật FIFO tracking. Hệ thống sẽ tạo 1 batch "LEGACY-xxx" cho mỗi product có quantityAvailable > 0 mà chưa có batch nào. Batch dùng product.expiredAt (nếu có) làm HSD, product.avgCost làm đơn giá.',
            'Run once when first enabling FIFO tracking. The system creates one "LEGACY-xxx" batch per product with stock that has no batches yet. Uses product.expiredAt as expiry and product.avgCost as unit cost.')}
        </p>
        <button onClick={runBackfill} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {t('Chạy backfill', 'Run backfill')}
        </button>

        {result && (
          <div className="mt-4 rounded-lg bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-on-surface">{t('Kết quả', 'Result')}:</p>
            <ul className="mt-2 list-disc pl-5 text-on-surface-variant">
              <li>{t(`Tạo mới: ${result.created} legacy batch`, `Created: ${result.created} legacy batches`)}</li>
              <li>{t(`Bỏ qua (đã có batch hoặc stock = 0): ${result.skipped}`, `Skipped (already has batch or stock = 0): ${result.skipped}`)}</li>
              <li>{t(`Tổng product quét: ${result.totalProducts}`, `Total products scanned: ${result.totalProducts}`)}</li>
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-on-surface">
          <ClipboardList className="h-4 w-4 text-primary" />
          {t('Tham khảo — Endpoint API', 'API reference')}
        </h3>
        <ul className="space-y-1.5 text-xs font-mono text-on-surface-variant">
          <li><span className="font-semibold text-on-surface">GET</span> /inventory/batches</li>
          <li><span className="font-semibold text-on-surface">GET</span> /inventory/batches/expiring?daysAhead=30</li>
          <li><span className="font-semibold text-on-surface">GET</span> /inventory/batches/expired</li>
          <li><span className="font-semibold text-on-surface">GET</span> /inventory/batches/stats</li>
          <li><span className="font-semibold text-on-surface">POST</span> /inventory/batches/preview-fifo</li>
          <li><span className="font-semibold text-on-surface">POST</span> /inventory/batches/:id/write-off</li>
          <li><span className="font-semibold text-on-surface">POST</span> /inventory/batches/:id/price-reduction</li>
          <li><span className="font-semibold text-on-surface">POST</span> /inventory/batches/backfill-legacy</li>
        </ul>
      </div>
    </div>
  );
}
