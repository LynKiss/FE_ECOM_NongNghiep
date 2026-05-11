import { type ElementType, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Layers,
  Package,
  Percent,
  Printer,
  RefreshCw,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

// ── Types ─────────────────────────────────────────────────────────────────────

type DashData = {
  refreshedAt?: string;
  totals: {
    users: number; customers?: number; activeCustomers?: number;
    products: number; orders: number; pendingOrders: number;
    cancelledOrders?: number; deliveredOrders?: number; paidOrders: number;
    revenue: string; todayRevenue?: string; yesterdayRevenue?: string;
    revenueChangePct?: number; last7Revenue?: string; last30Revenue?: string;
    averageOrderValue?: string; lowStockProducts: number; outOfStockProducts?: number;
    activeDiscounts?: number; couponUsageCount?: number;
    availableUnits?: number; reservedUnits?: number;
    inventoryValue?: string; potentialRevenue?: string;
  };
  topProducts: Array<{ productId: string; productName: string; soldQuantity: string; revenue: string }>;
  salesByDay: Array<{ date: string; orders: string; revenue: string }>;
  salesByMonth?: Array<{ period: string; orders: string; revenue: string }>;
  orderStatusSummary?: Array<{ status: string; count: string; revenue: string }>;
  paymentMethodSummary?: Array<{ paymentMethod: string; count: string; revenue: string }>;
  categoryRevenue?: Array<{ categoryName: string; orders: string; soldQuantity: string; revenue: string }>;
  customerSegments?: Array<{ segment: string; count: string; revenue: string }>;
  topCustomers: Array<{ userId: string; fullName: string; phone: string; orders: string; revenue: string }>;
  couponEffectiveness?: Array<{ discountCode: string; discountName: string; discountType: string; discountValue: number; timesUsed: number; discountGiven: string; orderRevenue: string }>;
  stockHealth?: Array<{ level: string; count: string; quantity: string }>;
  lowStockProductList?: Array<{ productId: string; productName: string; quantityAvailable: string | number; productPrice: string }>;
  newCustomersByDay?: Array<{ date: string; customers: string }>;
};

type SalesSummaryData = {
  filters: { from: string | null; to: string | null };
  summary: { orders: number; revenue: string; discountAmount: string; deliveryRevenue: string };
  orderStatusSummary: Array<{ status: string; count: string }>;
  salesByDay: Array<{ date: string; orders: string; revenue: string }>;
  topCustomers: Array<{ userId: string; fullName: string; phone: string; orders: string; revenue: string }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_OPTS = [
  { id: 'today',      label: 'Hôm nay' },
  { id: '7d',         label: '7 ngày' },
  { id: '30d',        label: '30 ngày' },
  { id: 'this_month', label: 'Tháng này' },
  { id: 'this_year',  label: 'Năm nay' },
  { id: 'custom',     label: 'Tùy chỉnh' },
];

const STATUS_VI: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', processing: 'Đang xử lý',
  shipping: 'Đang giao', delivered: 'Đã giao hàng', cancelled: 'Đã hủy',
  returned: 'Đã hoàn trả', refunded: 'Đã hoàn tiền', partial_delivered: 'Giao một phần',
};
const SEGMENT_VI: Record<string, string> = {
  new: 'Khách mới', one_time: 'Mua 1 lần', repeat: 'Mua lặp lại', loyal: 'Thân thiết',
};
const PAYMENT_VI: Record<string, string> = {
  COD: 'Tiền mặt (COD)', VNPAY: 'VNPAY', MOMO: 'MoMo', BANK_TRANSFER: 'Chuyển khoản',
};
const STOCK_VI: Record<string, string> = {
  out_of_stock: 'Hết hàng', low: 'Sắp hết', medium: 'Trung bình', adequate: 'Đủ hàng',
};
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  shipping: '#06b6d4', delivered: '#10b981', cancelled: '#ef4444',
  returned: '#6b7280', refunded: '#f97316', partial_delivered: '#84cc16',
};
const STOCK_COLOR: Record<string, string> = {
  out_of_stock: '#ef4444', low: '#f97316', medium: '#f59e0b', adequate: '#10b981',
};
const PALETTE = ['#1b5e20','#2e7d32','#43a047','#66bb6a','#a5d6a7','#81c784','#4caf50','#388e3c'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
const fmtFull = (v: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(v));
const fmtNum = (v: number | string) => new Intl.NumberFormat('vi-VN').format(Number(v));
const n = (v: string | number | undefined | null) => Number(v ?? 0);

function getPeriodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  switch (period) {
    case 'today':       return { from: toDate, to: toDate };
    case '7d': {        const d = new Date(now); d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0, 10), to: toDate }; }
    case '30d': {       const d = new Date(now); d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0, 10), to: toDate }; }
    case 'this_month':  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: toDate };
    case 'this_year':   return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: toDate };
    default:            return { from: '', to: '' };
  }
}

function periodLabel(period: string, customFrom: string, customTo: string) {
  if (period === 'custom') return `${customFrom} → ${customTo}`;
  return PERIOD_OPTS.find(p => p.id === period)?.label ?? '';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, trend, color = '#1b5e20' }: {
  icon: ElementType; label: string; value: string; sub?: string;
  trend?: number; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container p-5 print:border print:rounded-none print:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
          <p className="mt-1.5 text-2xl font-black text-on-surface">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend).toFixed(1)}% so với hôm qua
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action }: {
  title: string; icon?: ElementType; children: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container print:border print:mb-6 print:rounded-none">
      <div className="flex items-center justify-between border-b border-on-surface-variant/6 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-on-surface-variant" />}
          <span className="text-sm font-bold text-on-surface">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Print Section ─────────────────────────────────────────────────────────────

function PrintReport({ dash, summary, period, customFrom, customTo }: {
  dash: DashData | null; summary: SalesSummaryData | null;
  period: string; customFrom: string; customTo: string;
}) {
  if (!dash) return null;
  const revenue = summary ? n(summary.summary.revenue) : n(dash.totals.last30Revenue ?? dash.totals.revenue);
  const orders  = summary ? summary.summary.orders : dash.totals.orders;
  const aov     = orders ? revenue / orders : 0;
  const discount= summary ? n(summary.summary.discountAmount) : 0;
  const delivery= summary ? n(summary.summary.deliveryRevenue) : 0;
  const topProd = dash.topProducts.slice(0, 10);
  const salesRows = (summary?.salesByDay ?? dash.salesByDay).slice(-14);

  return (
    <div className="hidden print:block text-black text-sm font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
        <div>
          <p className="text-xl font-black">BÁO CÁO KINH DOANH</p>
          <p className="text-base font-bold mt-0.5">Cultivated Ledger — Vật Tư Nông Nghiệp</p>
          <p className="text-xs mt-1 text-gray-600">Kỳ báo cáo: {periodLabel(period, customFrom, customTo)}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Ngày in: {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          {dash.refreshedAt && <p>Dữ liệu cập nhật: {new Date(dash.refreshedAt).toLocaleString('vi-VN')}</p>}
          <p className="mt-1 italic">Tài liệu nội bộ — không phát hành</p>
        </div>
      </div>

      {/* Summary */}
      <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">I. KẾT QUẢ TỔNG QUAN</p>
      <table className="w-full text-xs mb-6 border-collapse">
        <tbody>
          {[
            ['Tổng doanh thu', fmtFull(revenue), 'Tổng đơn hàng', fmtNum(orders)],
            ['Giá trị đơn TB', fmtFull(aov), 'Đơn chờ xử lý', fmtNum(dash.totals.pendingOrders)],
            ['Giảm giá đã cấp', fmtFull(discount), 'Doanh thu giao hàng', fmtFull(delivery)],
            ['Tổng khách hàng', fmtNum(dash.totals.customers ?? dash.totals.users), 'Đơn đã giao', fmtNum(dash.totals.deliveredOrders ?? 0)],
            ['Sản phẩm sắp hết', fmtNum(dash.totals.lowStockProducts), 'Giá trị tồn kho', fmtFull(n(dash.totals.inventoryValue ?? 0))],
          ].map(([k1, v1, k2, v2], i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="border border-gray-300 px-2 py-1 font-semibold w-1/4">{k1}</td>
              <td className="border border-gray-300 px-2 py-1 w-1/4">{v1}</td>
              <td className="border border-gray-300 px-2 py-1 font-semibold w-1/4">{k2}</td>
              <td className="border border-gray-300 px-2 py-1 w-1/4">{v2}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sales by day */}
      <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">II. DOANH THU THEO NGÀY (14 ngày gần nhất)</p>
      <table className="w-full text-xs mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left">Ngày</th>
            <th className="border border-gray-300 px-2 py-1 text-right">Số đơn</th>
            <th className="border border-gray-300 px-2 py-1 text-right">Doanh thu</th>
            <th className="border border-gray-300 px-2 py-1 text-right">DT trung bình/đơn</th>
          </tr>
        </thead>
        <tbody>
          {salesRows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="border border-gray-300 px-2 py-1">{r.date}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(r.orders)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtFull(r.revenue)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{n(r.orders) > 0 ? fmtFull(n(r.revenue) / n(r.orders)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Top products */}
      <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">III. TOP SẢN PHẨM BÁN CHẠY</p>
      <table className="w-full text-xs mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left">#</th>
            <th className="border border-gray-300 px-2 py-1 text-left">Sản phẩm</th>
            <th className="border border-gray-300 px-2 py-1 text-right">SL bán</th>
            <th className="border border-gray-300 px-2 py-1 text-right">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {topProd.map((p, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="border border-gray-300 px-2 py-1 text-gray-500">{i + 1}</td>
              <td className="border border-gray-300 px-2 py-1 font-medium">{p.productName}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(p.soldQuantity)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtFull(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Category revenue */}
      {dash.categoryRevenue && dash.categoryRevenue.length > 0 && (
        <>
          <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">IV. DOANH THU THEO DANH MỤC</p>
          <table className="w-full text-xs mb-6 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Danh mục</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Số đơn</th>
                <th className="border border-gray-300 px-2 py-1 text-right">SL bán</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {dash.categoryRevenue.map((c, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{c.categoryName}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(c.orders)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(c.soldQuantity)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmtFull(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Order status */}
      {dash.orderStatusSummary && dash.orderStatusSummary.length > 0 && (
        <>
          <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">V. TRẠNG THÁI ĐƠN HÀNG</p>
          <table className="w-full text-xs mb-6 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Trạng thái</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Số đơn</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Doanh thu</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = dash.orderStatusSummary!.reduce((s, x) => s + n(x.count), 0);
                return dash.orderStatusSummary!.map((s, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="border border-gray-300 px-2 py-1">{STATUS_VI[s.status] ?? s.status}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(s.count)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{fmtFull(s.revenue)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{total > 0 ? ((n(s.count) / total) * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </>
      )}

      {/* Top customers */}
      <p className="font-black uppercase tracking-wider text-xs mb-2 border-b pb-1">VI. KHÁCH HÀNG HÀNG ĐẦU</p>
      <table className="w-full text-xs mb-8 border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left">#</th>
            <th className="border border-gray-300 px-2 py-1 text-left">Khách hàng</th>
            <th className="border border-gray-300 px-2 py-1 text-left">SĐT</th>
            <th className="border border-gray-300 px-2 py-1 text-right">Số đơn</th>
            <th className="border border-gray-300 px-2 py-1 text-right">Chi tiêu</th>
          </tr>
        </thead>
        <tbody>
          {(summary?.topCustomers ?? dash.topCustomers).slice(0, 10).map((c, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="border border-gray-300 px-2 py-1 text-gray-500">{i + 1}</td>
              <td className="border border-gray-300 px-2 py-1 font-medium">{c.fullName}</td>
              <td className="border border-gray-300 px-2 py-1 text-gray-600">{c.phone}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtNum(c.orders)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmtFull(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="border-t-2 border-black pt-3 text-xs text-gray-500 text-center">
        <p>Cultivated Ledger — Hệ thống quản lý vật tư nông nghiệp</p>
        <p className="mt-0.5">Báo cáo tự động, có giá trị tham khảo nội bộ</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);
  const [summary, setSummary] = useState<SalesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartGranularity, setChartGranularity] = useState<'day' | 'month'>('day');

  const loadDash = useCallback(async () => {
    const data = await apiClient.get<DashData>('/reports/dashboard');
    setDash(data);
  }, []);

  const loadSummary = useCallback(async (p: string, cfrom?: string, cto?: string) => {
    const range = p === 'custom' ? { from: cfrom ?? '', to: cto ?? '' } : getPeriodRange(p);
    if (!range.from || !range.to) return;
    const data = await apiClient.get<SalesSummaryData>(`/reports/sales-summary?from=${range.from}&to=${range.to}`);
    setSummary(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDash(), loadSummary('30d')])
      .catch(() => showToast({ tone: 'error', title: 'Không thể tải dữ liệu báo cáo' }))
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = useCallback(async (p: string) => {
    setPeriod(p);
    if (p === 'custom') return;
    setLoading(true);
    try { await loadSummary(p); } catch { /* noop */ }
    setLoading(false);
  }, [loadSummary]);

  const handleApplyCustom = useCallback(async () => {
    if (!customFrom || !customTo) return;
    setLoading(true);
    try { await loadSummary('custom', customFrom, customTo); } catch { /* noop */ }
    setLoading(false);
  }, [customFrom, customTo, loadSummary]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadDash(), loadSummary(period, customFrom, customTo)]); } catch { /* noop */ }
    setLoading(false);
  }, [loadDash, loadSummary, period, customFrom, customTo]);

  // ── Derived values ────────────────────────────────────────────────────────

  const kpiRevenue = summary
    ? n(summary.summary.revenue)
    : period === 'today' ? n(dash?.totals.todayRevenue)
    : period === '7d'   ? n(dash?.totals.last7Revenue)
    : n(dash?.totals.last30Revenue ?? dash?.totals.revenue);

  const kpiOrders   = summary ? summary.summary.orders : (dash?.totals.orders ?? 0);
  const kpiAov      = kpiOrders > 0 ? kpiRevenue / kpiOrders : 0;
  const kpiDiscount = summary ? n(summary.summary.discountAmount) : 0;
  const kpiDelivery = summary ? n(summary.summary.deliveryRevenue) : 0;
  const revenueChangePct = dash?.totals.revenueChangePct ?? 0;

  const chartData = useMemo(() => {
    if (chartGranularity === 'month') {
      return (dash?.salesByMonth ?? []).map(r => ({
        label: r.period,
        orders: n(r.orders),
        revenue: n(r.revenue),
      }));
    }
    const src = summary?.salesByDay?.length ? summary.salesByDay : (dash?.salesByDay ?? []);
    return src.map(r => ({ label: r.date, orders: n(r.orders), revenue: n(r.revenue) }));
  }, [dash, summary, chartGranularity]);

  const orderStatusData = useMemo(() =>
    (dash?.orderStatusSummary ?? []).map(s => ({
      name: STATUS_VI[s.status] ?? s.status,
      value: n(s.count),
      revenue: n(s.revenue),
      color: STATUS_COLOR[s.status] ?? '#94a3b8',
    })),
  [dash]);

  const paymentData = useMemo(() =>
    (dash?.paymentMethodSummary ?? []).map((p, i) => ({
      name: PAYMENT_VI[p.paymentMethod] ?? p.paymentMethod,
      value: n(p.count),
      revenue: n(p.revenue),
      color: PALETTE[i % PALETTE.length],
    })),
  [dash]);

  const stockHealthData = useMemo(() =>
    (dash?.stockHealth ?? []).map(s => ({
      name: STOCK_VI[s.level] ?? s.level,
      value: n(s.count),
      color: STOCK_COLOR[s.level] ?? '#94a3b8',
    })),
  [dash]);

  const totalOrderStatusCount = orderStatusData.reduce((s, x) => s + x.value, 0);
  const totalPaymentCount     = paymentData.reduce((s, x) => s + x.value, 0);
  const maxProductRevenue     = Math.max(...(dash?.topProducts ?? []).map(p => n(p.revenue)), 1);

  if (loading && !dash) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-on-surface-variant" />
        <span className="ml-3 text-sm text-on-surface-variant">Đang tải dữ liệu...</span>
      </div>
    );
  }

  return (
    <>
      {/* Print-only page style */}
      <style>{`@media print { @page { margin: 12mm; size: A4 portrait; } body { font-size: 12px; } }`}</style>

      {/* ── Interactive UI (hidden on print) ─────────────────────────────── */}
      <div className="space-y-6 pb-16 print:hidden">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[2.5rem] font-black leading-none tracking-tight text-primary">Báo cáo</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Thống kê doanh thu, sản phẩm, đơn hàng và khách hàng toàn diện.
              {dash?.refreshedAt && (
                <span className="ml-2 text-on-surface-variant/50">
                  Cập nhật {new Date(dash.refreshedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-on-surface-variant/12 bg-surface-container px-3.5 text-sm font-semibold text-on-surface-variant transition hover:bg-on-surface-variant/8 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:opacity-90"
            >
              <Printer size={14} />
              In báo cáo
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-on-surface-variant/10 bg-surface-container p-1">
            {PERIOD_OPTS.map(opt => (
              <button
                key={opt.id}
                onClick={() => void handlePeriodChange(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  period === opt.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-9 rounded-xl border border-on-surface-variant/15 bg-surface-container px-3 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
              <span className="text-xs text-on-surface-variant">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-9 rounded-xl border border-on-surface-variant/15 bg-surface-container px-3 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
              <button onClick={() => void handleApplyCustom()}
                disabled={!customFrom || !customTo}
                className="h-9 rounded-xl bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">
                Áp dụng
              </button>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={DollarSign} label="Doanh thu" value={fmt(kpiRevenue)}
            sub={`Chiết khấu: ${fmt(kpiDiscount)}`}
            trend={revenueChangePct} color="#1b5e20"
          />
          <KpiCard
            icon={ShoppingCart} label="Tổng đơn hàng" value={fmtNum(kpiOrders)}
            sub={`${fmtNum(dash?.totals.pendingOrders ?? 0)} chờ xử lý`}
            color="#2e7d32"
          />
          <KpiCard
            icon={TrendingUp} label="Giá trị đơn TB" value={fmt(kpiAov)}
            sub={`Giao hàng: ${fmt(kpiDelivery)}`}
            color="#43a047"
          />
          <KpiCard
            icon={Users} label="Khách hàng" value={fmtNum(dash?.totals.customers ?? dash?.totals.users ?? 0)}
            sub={`${fmtNum(dash?.totals.activeCustomers ?? 0)} đang hoạt động`}
            color="#66bb6a"
          />
        </div>

        {/* Secondary KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container px-4 py-3">
            <p className="text-xs text-on-surface-variant">Doanh thu hôm nay</p>
            <p className="mt-1 text-lg font-black text-on-surface">{fmt(dash?.totals.todayRevenue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container px-4 py-3">
            <p className="text-xs text-on-surface-variant">Tổng doanh thu toàn thời gian</p>
            <p className="mt-1 text-lg font-black text-on-surface">{fmt(dash?.totals.revenue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container px-4 py-3">
            <p className="text-xs text-on-surface-variant">Giá trị tồn kho</p>
            <p className="mt-1 text-lg font-black text-on-surface">{fmt(dash?.totals.inventoryValue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-on-surface-variant/8 bg-surface-container px-4 py-3">
            <p className="text-xs text-on-surface-variant">Doanh thu tiềm năng</p>
            <p className="mt-1 text-lg font-black text-on-surface">{fmt(dash?.totals.potentialRevenue ?? 0)}</p>
          </div>
        </div>

        {/* Revenue Chart */}
        <SectionCard
          title="Doanh thu & Đơn hàng"
          icon={BarChart3}
          action={
            <div className="flex gap-1 rounded-lg border border-on-surface-variant/10 p-0.5">
              {(['day', 'month'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setChartGranularity(g)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${chartGranularity === g ? 'bg-primary text-white' : 'text-on-surface-variant'}`}
                >
                  {g === 'day' ? 'Theo ngày' : 'Theo tháng'}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={v => chartGranularity === 'month' ? v.slice(5) : v.slice(5)}
                stroke="transparent" />
              <YAxis yAxisId="rev" orientation="left" tick={{ fontSize: 10 }}
                tickFormatter={v => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 0 }).format(v)}
                stroke="transparent" />
              <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10 }} stroke="transparent" />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'Doanh thu' ? [fmtFull(v), name] : [fmtNum(v), name]
                }
                labelStyle={{ fontSize: 11, fontWeight: 600 }}
                contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Doanh thu"
                fill="#1b5e2018" stroke="#1b5e20" strokeWidth={2} dot={false} />
              <Bar yAxisId="ord" dataKey="orders" name="Đơn hàng" fill="#43a047" radius={[3, 3, 0, 0]} barSize={14} />
            </ComposedChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Order status + Payment methods */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Trạng thái đơn hàng" icon={CheckCircle2}>
            <div className="flex items-start gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {orderStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmtNum(v), 'Đơn']}
                    contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {orderStatusData.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-on-surface-variant">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-on-surface">{fmtNum(s.value)}</span>
                      <span className="w-10 text-right text-on-surface-variant/60">
                        {totalOrderStatusCount > 0 ? ((s.value / totalOrderStatusCount) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Phương thức thanh toán" icon={Tag}>
            <div className="flex items-start gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={paymentData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {paymentData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmtNum(v), 'Đơn']}
                    contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {paymentData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      <span className="text-on-surface-variant">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-on-surface">{fmtNum(p.value)}</span>
                      <span className="text-xs text-on-surface-variant/60">{fmt(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Top products */}
        <SectionCard title="Top sản phẩm bán chạy" icon={Package}>
          <div className="space-y-2">
            {(dash?.topProducts ?? []).slice(0, 10).map((p, i) => {
              const pct = (n(p.revenue) / maxProductRevenue) * 100;
              return (
                <div key={p.productId} className="flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 text-xs font-black text-on-surface-variant/50 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-on-surface">{p.productName}</p>
                    <div className="mt-0.5 h-1.5 w-full rounded-full bg-on-surface-variant/8">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-on-surface">{fmtNum(p.soldQuantity)} sp</p>
                    <p className="text-xs text-on-surface-variant">{fmt(p.revenue)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Category revenue */}
        {(dash?.categoryRevenue ?? []).length > 0 && (
          <SectionCard title="Doanh thu theo danh mục" icon={Layers}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-on-surface-variant/8 text-left text-xs text-on-surface-variant">
                    <th className="pb-2.5 font-semibold">Danh mục</th>
                    <th className="pb-2.5 text-right font-semibold">Số đơn</th>
                    <th className="pb-2.5 text-right font-semibold">SL bán</th>
                    <th className="pb-2.5 text-right font-semibold">Doanh thu</th>
                    <th className="pb-2.5 text-right font-semibold">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalRev = (dash?.categoryRevenue ?? []).reduce((s, c) => s + n(c.revenue), 0);
                    return (dash?.categoryRevenue ?? []).map((c, i) => (
                      <tr key={i} className="border-b border-on-surface-variant/5 last:border-0">
                        <td className="py-2.5 font-medium text-on-surface">{c.categoryName}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">{fmtNum(c.orders)}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">{fmtNum(c.soldQuantity)}</td>
                        <td className="py-2.5 text-right font-semibold text-on-surface">{fmt(c.revenue)}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-on-surface-variant/8">
                              <div className="h-1.5 rounded-full bg-primary"
                                style={{ width: `${totalRev > 0 ? (n(c.revenue) / totalRev) * 100 : 0}%` }} />
                            </div>
                            <span className="text-xs text-on-surface-variant/60 w-10 text-right">
                              {totalRev > 0 ? ((n(c.revenue) / totalRev) * 100).toFixed(1) + '%' : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Customer segments + Top customers */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Phân khúc khách hàng" icon={Users}>
            {(dash?.customerSegments ?? []).length > 0 ? (
              <div className="flex items-start gap-4">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={(dash?.customerSegments ?? []).map((s, i) => ({
                        name: SEGMENT_VI[s.segment] ?? s.segment,
                        value: n(s.count),
                        color: PALETTE[i % PALETTE.length],
                      }))}
                      dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}
                    >
                      {(dash?.customerSegments ?? []).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmtNum(v), 'KH']} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {(dash?.customerSegments ?? []).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="text-on-surface-variant">{SEGMENT_VI[s.segment] ?? s.segment}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-on-surface">{fmtNum(s.count)}</span>
                        <span className="ml-1.5 text-on-surface-variant/60">{fmt(s.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">Không có dữ liệu</p>
            )}
          </SectionCard>

          <SectionCard title="Khách hàng hàng đầu" icon={Users}>
            <div className="space-y-2">
              {(summary?.topCustomers ?? dash?.topCustomers ?? []).slice(0, 8).map((c, i) => (
                <div key={c.userId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{i + 1}</span>
                    <span className="truncate font-medium text-on-surface">{c.fullName || c.phone}</span>
                  </div>
                  <div className="shrink-0 text-right ml-2">
                    <p className="font-bold text-on-surface">{fmt(c.revenue)}</p>
                    <p className="text-on-surface-variant/60">{fmtNum(c.orders)} đơn</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Voucher effectiveness */}
        {(dash?.couponEffectiveness ?? []).length > 0 && (
          <SectionCard title="Hiệu quả mã giảm giá" icon={Percent}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-on-surface-variant/8 text-left text-xs text-on-surface-variant">
                    <th className="pb-2.5 font-semibold">Mã</th>
                    <th className="pb-2.5 font-semibold">Tên chương trình</th>
                    <th className="pb-2.5 text-right font-semibold">Lượt dùng</th>
                    <th className="pb-2.5 text-right font-semibold">Giảm giá</th>
                    <th className="pb-2.5 text-right font-semibold">DT kéo theo</th>
                    <th className="pb-2.5 text-right font-semibold">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {(dash?.couponEffectiveness ?? []).map((c, i) => {
                    const roi = n(c.discountGiven) > 0 ? n(c.orderRevenue) / n(c.discountGiven) : 0;
                    return (
                      <tr key={i} className="border-b border-on-surface-variant/5 last:border-0">
                        <td className="py-2.5">
                          <span className="rounded-lg bg-primary/8 px-2 py-0.5 text-xs font-black text-primary">{c.discountCode}</span>
                        </td>
                        <td className="py-2.5 text-on-surface-variant">{c.discountName}</td>
                        <td className="py-2.5 text-right font-semibold text-on-surface">{fmtNum(c.timesUsed)}</td>
                        <td className="py-2.5 text-right text-red-500">−{fmt(c.discountGiven)}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">{fmt(c.orderRevenue)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-xs font-bold ${roi >= 5 ? 'text-emerald-600' : roi >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
                            {roi.toFixed(1)}×
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Inventory health + Low stock alert */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Sức khỏe tồn kho" icon={Package}>
            <div className="flex items-start gap-4">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={stockHealthData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {stockHealthData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmtNum(v), 'SP']} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {stockHealthData.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-on-surface-variant">{s.name}</span>
                    </div>
                    <span className="font-bold text-on-surface">{fmtNum(s.value)} SP</span>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-on-surface-variant/8 space-y-1 text-xs text-on-surface-variant">
                  <p>Tồn khả dụng: <b className="text-on-surface">{fmtNum(dash?.totals.availableUnits ?? 0)}</b> đơn vị</p>
                  <p>Đang giữ: <b className="text-on-surface">{fmtNum(dash?.totals.reservedUnits ?? 0)}</b> đơn vị</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Sản phẩm cần nhập hàng" icon={AlertTriangle}>
            {(dash?.lowStockProductList ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(dash?.lowStockProductList ?? []).slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex-1 truncate text-on-surface">{p.productName}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${
                        n(p.quantityAvailable) === 0
                          ? 'bg-red-100 text-red-600'
                          : n(p.quantityAvailable) <= 5
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}>
                        {n(p.quantityAvailable) === 0 ? 'Hết hàng' : `${p.quantityAvailable} còn`}
                      </span>
                      <span className="text-on-surface-variant/60">{fmt(p.productPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 size={16} />
                Tồn kho đang ở mức tốt
              </div>
            )}
          </SectionCard>
        </div>

        {/* 12-month trend table */}
        {(dash?.salesByMonth ?? []).length > 0 && (
          <SectionCard title="Doanh thu 12 tháng gần nhất" icon={TrendingUp}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-on-surface-variant/8 text-xs text-on-surface-variant">
                    <th className="pb-2.5 text-left font-semibold">Tháng</th>
                    <th className="pb-2.5 text-right font-semibold">Số đơn</th>
                    <th className="pb-2.5 text-right font-semibold">Doanh thu</th>
                    <th className="pb-2.5 text-right font-semibold">AOV</th>
                    <th className="pb-2.5 text-right font-semibold">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody>
                  {(dash?.salesByMonth ?? []).map((m, i, arr) => {
                    const prev = i > 0 ? n(arr[i - 1].revenue) : null;
                    const cur  = n(m.revenue);
                    const growth = prev !== null && prev > 0 ? ((cur - prev) / prev) * 100 : null;
                    const aov = n(m.orders) > 0 ? cur / n(m.orders) : 0;
                    return (
                      <tr key={i} className="border-b border-on-surface-variant/5 last:border-0">
                        <td className="py-2 font-medium text-on-surface">{m.period}</td>
                        <td className="py-2 text-right text-on-surface-variant">{fmtNum(m.orders)}</td>
                        <td className="py-2 text-right font-semibold text-on-surface">{fmt(m.revenue)}</td>
                        <td className="py-2 text-right text-on-surface-variant">{fmt(aov)}</td>
                        <td className="py-2 text-right">
                          {growth !== null ? (
                            <span className={`flex items-center justify-end gap-0.5 text-xs font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {Math.abs(growth).toFixed(1)}%
                            </span>
                          ) : <span className="text-xs text-on-surface-variant/40">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Print-only section ────────────────────────────────────────────── */}
      <PrintReport dash={dash} summary={summary} period={period} customFrom={customFrom} customTo={customTo} />
    </>
  );
}
