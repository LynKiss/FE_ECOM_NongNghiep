import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  Package,
  Percent,
  Radio,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wheat,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'motion/react';
import { apiClient } from '../lib/api';
import { createDashboardSocket } from '../lib/dashboard-realtime';
import { useLanguage } from '../i18n/language-context';
import { useAdminSession } from '../hooks/useAdminSession';

type NumericValue = string | number | null | undefined;

type ProductItem = {
  productId: string;
  productName: string;
  quantityAvailable: number;
};

type ProductsResponse = {
  items: ProductItem[];
  meta: {
    total: number;
  };
};

type ProductsPayload = ProductItem[] | ProductsResponse;

type RecentOrder = {
  id: string;
  orderId?: string;
  fullName: string;
  totalPayment: string;
  status: string;
  paymentStatus?: string;
  createdAt?: string;
};

type DashboardResponse = {
  refreshedAt?: string;
  totals: {
    users: number;
    customers?: number;
    activeCustomers?: number;
    products: number;
    categories?: number;
    orders: number;
    pendingOrders: number;
    cancelledOrders?: number;
    deliveredOrders?: number;
    paidOrders: number;
    revenue: string;
    todayOrders?: number;
    todayRevenue?: string;
    yesterdayRevenue?: string;
    revenueChangePct?: number;
    last7Revenue?: string;
    last30Revenue?: string;
    averageOrderValue?: string;
    lowStockProducts: number;
    outOfStockProducts?: number;
    expiredSoonProducts?: number;
    activeDiscounts?: number;
    couponUsageCount?: number;
    availableUnits?: number;
    reservedUnits?: number;
    inventoryValue?: string;
    potentialRevenue?: string;
    visibleReviews?: number;
    averageRating?: string;
    totalDiagnoses?: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    soldQuantity: string;
    revenue: string;
  }>;
  inventorySummary: Array<{
    transactionType: string;
    count: string;
  }>;
  salesByDay: Array<{
    date: string;
    orders: string;
    revenue: string;
  }>;
  salesByMonth?: Array<{
    period: string;
    orders: string;
    revenue: string;
  }>;
  salesByHour?: Array<{
    hour: string;
    orders: string;
    revenue: string;
  }>;
  orderStatusSummary?: Array<{
    status: string;
    count: string;
    revenue: string;
  }>;
  paymentSummary?: Array<{
    paymentStatus: string;
    count: string;
    revenue: string;
  }>;
  paymentMethodSummary?: Array<{
    paymentMethod: string;
    count: string;
    revenue: string;
  }>;
  categoryRevenue?: Array<{
    categoryName: string;
    orders: string;
    soldQuantity: string;
    revenue: string;
  }>;
  inventoryByCategory?: Array<{
    categoryName: string;
    products: string;
    availableUnits: string;
    reservedUnits: string;
    inventoryValue: string;
  }>;
  stockHealth?: Array<{
    level: string;
    count: string;
    quantity: string;
  }>;
  lowStockProductList?: Array<{
    productId: string;
    productName: string;
    quantityAvailable: number | string;
    quantityReserved: number | string;
    productPrice: string;
  }>;
  stockRiskProducts?: Array<{
    productId: string;
    productName: string;
    quantityAvailable: number | string;
    soldLast30: string;
    daysOfCover: string | null;
  }>;
  topCustomers: Array<{
    userId: string;
    fullName: string;
    phone: string;
    orders: string;
    revenue: string;
  }>;
  customerSegments?: Array<{
    segment: string;
    count: number | string;
    revenue: string;
  }>;
  newCustomersByDay?: Array<{
    date: string;
    customers: string;
  }>;
  couponEffectiveness?: Array<{
    discountId: string;
    discountCode: string;
    discountName: string;
    discountType: string;
    discountValue: string;
    timesUsed: string;
    discountGiven: string;
    orderRevenue: string;
  }>;
  reviewSummary?: Array<{
    rating: string;
    count: string;
  }>;
  diagnosesByDisease?: Array<{
    disease: string;
    count: string;
    avgConfidence: string;
  }>;
  recentOrders?: RecentOrder[];
};

type DashboardSocketPayload = {
  reason?: string;
  refreshedAt?: string;
  dashboard?: DashboardResponse;
};

type OrdersResponse = RecentOrder[] | {
  items: RecentOrder[];
};

type SocketState = 'connecting' | 'live' | 'polling' | 'offline';

const CHART_COLORS = [
  '#1b5e20',
  '#2f8f46',
  '#7abf45',
  '#d6a51d',
  '#e26d3d',
  '#2a7f9e',
  '#8367c7',
  '#607162',
];

const tooltipStyle = {
  border: '1px solid rgba(22, 49, 31, 0.08)',
  borderRadius: '16px',
  boxShadow: '0 18px 45px -24px rgba(12, 34, 25, 0.45)',
  background: 'var(--theme-surface-container)',
  color: 'var(--theme-on-surface)',
};

function listFromPayload<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

export default function Dashboard() {
  const { language } = useLanguage();
  const { session } = useAdminSession();
  const isVietnamese = language === 'vi';
  const canViewReports =
    session?.user?.permissions?.some(
      (permission) => permission.key === 'manage_reports',
    ) ?? false;
  const canViewOrders =
    session?.user?.permissions?.some(
      (permission) => permission.key === 'manage_orders',
    ) ?? false;

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }),
    [language],
  );

  const compactNumber = useMemo(
    () =>
      new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [language],
  );

  const [publicProducts, setPublicProducts] = useState<ProductItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<SocketState>('offline');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hiddenBlocks] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('admin_blocks_config');
      if (!raw) return new Set<string>();
      const cfg = JSON.parse(raw) as Array<{ id: string; status: string }>;
      return new Set(cfg.filter((b) => b.status === 'hidden').map((b) => b.id));
    } catch { return new Set<string>(); }
  });
  const blockVisible = (id: string) => !hiddenBlocks.has(id);

  async function refreshDashboard(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const productRequest = apiClient.get<ProductsPayload>('/products?limit=8');
      const reportRequest = canViewReports
        ? apiClient.get<DashboardResponse>('/reports/dashboard')
        : Promise.resolve(null);
      const ordersRequest = canViewOrders
        ? apiClient.get<OrdersResponse>('/orders?limit=8')
        : Promise.resolve(null);

      const [productData, dashboardData, ordersData] = await Promise.all([
        productRequest,
        reportRequest,
        ordersRequest,
      ]);

      setPublicProducts(listFromPayload<ProductItem>(productData));
      setDashboard(dashboardData);
      setRecentOrders(listFromPayload<RecentOrder>(ordersData));
      setLastUpdated(
        dashboardData?.refreshedAt ??
          (dashboardData ? new Date().toISOString() : null),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : isVietnamese
            ? 'Không tải được dữ liệu dashboard'
            : 'Unable to load dashboard data',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const productRequest = apiClient.get<ProductsPayload>('/products?limit=8');
        const reportRequest = canViewReports
          ? apiClient.get<DashboardResponse>('/reports/dashboard')
          : Promise.resolve(null);
        const ordersRequest = canViewOrders
          ? apiClient.get<OrdersResponse>('/orders?limit=8')
          : Promise.resolve(null);

        const [productData, dashboardData, ordersData] = await Promise.all([
          productRequest,
          reportRequest,
          ordersRequest,
        ]);

        if (!cancelled) {
          setPublicProducts(listFromPayload<ProductItem>(productData));
          setDashboard(dashboardData);
          setRecentOrders(listFromPayload<RecentOrder>(ordersData));
          setLastUpdated(
            dashboardData?.refreshedAt ??
              (dashboardData ? new Date().toISOString() : null),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
            ? 'Không tải được dữ liệu dashboard'
                : 'Unable to load dashboard data',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [canViewOrders, canViewReports, isVietnamese]);

  useEffect(() => {
    if (!canViewReports || !session?.accessToken) {
      setSocketState('offline');
      return;
    }

    const socket = createDashboardSocket(session.accessToken);
    setSocketState('connecting');

    const handlePayload = (payload: DashboardSocketPayload) => {
      if (payload.dashboard) {
        setDashboard(payload.dashboard);
        setLastUpdated(
          payload.refreshedAt ??
            payload.dashboard.refreshedAt ??
            new Date().toISOString(),
        );
        setError(null);
        setLoading(false);
      }
    };

    socket.on('connect', () => {
      setSocketState('live');
      socket.emit('dashboard:refresh');
    });
    socket.on('disconnect', () => setSocketState('polling'));
    socket.on('connect_error', () => setSocketState('polling'));
    socket.on('dashboard:snapshot', handlePayload);
    socket.on('dashboard:updated', handlePayload);
    socket.on('dashboard:error', (payload: { message?: string }) => {
      const message =
        payload?.message ?? (isVietnamese ? 'Realtime dashboard gặp lỗi' : 'Realtime dashboard failed');
      setError(message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [canViewReports, isVietnamese, session?.accessToken]);

  useEffect(() => {
    if (!canViewReports) {
      return;
    }

    const interval = window.setInterval(() => {
      if (socketState !== 'live') {
        void refreshDashboard(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [canViewReports, canViewOrders, socketState]);

  const money = (value: NumericValue) => currency.format(toNumber(value));
  const moneyCompact = (value: NumericValue) => {
    const amount = toNumber(value);

    if (Math.abs(amount) >= 1_000_000_000) {
      return `${compactNumber.format(amount / 1_000_000_000)} ${isVietnamese ? 'tỷ' : 'B'}`;
    }

    if (Math.abs(amount) >= 1_000_000) {
      return `${compactNumber.format(amount / 1_000_000)} ${isVietnamese ? 'tr' : 'M'}`;
    }

    return currency.format(amount);
  };
  const numberCompact = (value: NumericValue) => compactNumber.format(toNumber(value));

  const dailyRevenue = useMemo(
    () =>
      dashboard?.salesByDay?.map((item, index) => ({
        name: formatDateLabel(item.date, language) || `#${index + 1}`,
        orders: toNumber(item.orders),
        revenue: toNumber(item.revenue),
      })) ?? [],
    [dashboard, language],
  );

  const topProducts = useMemo(
    () =>
      dashboard?.topProducts?.slice(0, 8).map((item) => ({
        name: shortLabel(item.productName, 24),
        fullName: item.productName,
        sold: toNumber(item.soldQuantity),
        revenue: toNumber(item.revenue),
      })) ?? [],
    [dashboard],
  );

  const orderStatusData = useMemo(
    () =>
      dashboard?.orderStatusSummary?.map((item) => ({
        name: translateOrderStatus(item.status, isVietnamese),
        raw: item.status,
        value: toNumber(item.count),
        revenue: toNumber(item.revenue),
      })) ?? [],
    [dashboard, isVietnamese],
  );

  const paymentMethodData = useMemo(
    () =>
      dashboard?.paymentMethodSummary?.map((item) => ({
        name: translatePaymentMethod(item.paymentMethod, isVietnamese),
        value: toNumber(item.count),
        revenue: toNumber(item.revenue),
      })) ?? [],
    [dashboard, isVietnamese],
  );

  const categoryRevenue = useMemo(
    () =>
      dashboard?.categoryRevenue?.map((item) => ({
        name: shortLabel(item.categoryName, 18),
        fullName: item.categoryName,
        revenue: toNumber(item.revenue),
        sold: toNumber(item.soldQuantity),
      })) ?? [],
    [dashboard],
  );

  const inventoryByCategory = useMemo(
    () =>
      dashboard?.inventoryByCategory?.map((item) => ({
        name: shortLabel(item.categoryName, 18),
        fullName: item.categoryName,
        products: toNumber(item.products),
        stock: toNumber(item.availableUnits),
        value: toNumber(item.inventoryValue),
      })) ?? [],
    [dashboard],
  );

  const stockHealth = useMemo(
    () =>
      dashboard?.stockHealth?.map((item) => ({
        name: translateStockLevel(item.level, isVietnamese),
        raw: item.level,
        value: toNumber(item.count),
        quantity: toNumber(item.quantity),
      })) ?? [],
    [dashboard, isVietnamese],
  );

  const customerSegments = useMemo(
    () =>
      dashboard?.customerSegments?.map((item) => ({
        name: translateCustomerSegment(item.segment, isVietnamese),
        value: toNumber(item.count),
        revenue: toNumber(item.revenue),
      })) ?? [],
    [dashboard, isVietnamese],
  );

  const couponEffectiveness = useMemo(
    () =>
      dashboard?.couponEffectiveness?.slice(0, 8).map((item) => ({
        name: item.discountCode,
        fullName: item.discountName,
        used: toNumber(item.timesUsed),
        revenue: toNumber(item.orderRevenue),
        discount: toNumber(item.discountGiven),
      })) ?? [],
    [dashboard],
  );

  const newCustomersByDay = useMemo(
    () =>
      dashboard?.newCustomersByDay?.map((item, index) => ({
        name: formatDateLabel(item.date, language) || `#${index + 1}`,
        customers: toNumber(item.customers),
      })) ?? [],
    [dashboard, language],
  );

  const reviewSummary = useMemo(
    () =>
      dashboard?.reviewSummary?.map((item) => ({
        name: `${item.rating}★`,
        value: toNumber(item.count),
      })) ?? [],
    [dashboard],
  );

  const diagnosisData = useMemo(
    () =>
      dashboard?.diagnosesByDisease?.map((item) => ({
        name: shortLabel(item.disease, 22),
        fullName: item.disease,
        count: toNumber(item.count),
        confidence: Math.round(toNumber(item.avgConfidence) * 100),
      })) ?? [],
    [dashboard],
  );

  const hourCells = useMemo(() => {
    const hourMap = new Map<number, { orders: number; revenue: number }>(
      dashboard?.salesByHour?.map((item) => [
        Number(item.hour),
        {
          orders: toNumber(item.orders),
          revenue: toNumber(item.revenue),
        },
      ]) ?? [],
    );
    const maxRevenue = Math.max(
      ...Array.from(hourMap.values()).map((item) => item.revenue),
      1,
    );

    return Array.from({ length: 24 }, (_, hour) => {
      const item = hourMap.get(hour) ?? { orders: 0, revenue: 0 };
      return {
        hour,
        ...item,
        intensity: item.revenue / maxRevenue,
      };
    });
  }, [dashboard]);

  const dashboardRecentOrders = dashboard?.recentOrders ?? [];
  const orderRows = dashboardRecentOrders.length ? dashboardRecentOrders : recentOrders;
  const totals = dashboard?.totals;
  const hasReportData = Boolean(totals);
  const isLive = socketState === 'live';
  const changePct = totals?.revenueChangePct ?? 0;

  const fallbackProducts = dashboard?.topProducts?.length
    ? dashboard.topProducts?.slice(0, 4).map((item) => ({
        name: item.productName,
        meta: isVietnamese
          ? `Đã bán ${formatNumber(item.soldQuantity || 0)}`
          : `${item.soldQuantity} sold`,
      })) ?? []
    : publicProducts.slice(0, 4).map((item) => ({
        name: item.productName,
        meta: isVietnamese
          ? `Tồn ${formatNumber(item.quantityAvailable ?? 0)}`
          : `${item.quantityAvailable} in stock`,
      }));

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-xl border border-[#1E3932] bg-[#1E3932] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] backdrop-blur">
              <Radio size={14} className={isLive ? 'animate-pulse' : ''} />
              {socketState === 'live'
                ? isVietnamese
                  ? 'Realtime đang chạy'
                  : 'Realtime live'
                : socketState === 'connecting'
                  ? isVietnamese
                    ? 'Đang kết nối realtime'
                    : 'Connecting realtime'
                  : 'Fallback polling'}
            </div>
            <h2 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
              {isVietnamese
                ? 'Tổng quan điều hành'
                : 'Agriculture commerce command dashboard'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-white/78">
              {isVietnamese
                ? 'Theo dõi doanh thu thực, tồn kho, đơn hàng, voucher, AI bệnh lúa và cảnh báo vận hành.'
                : 'Track revenue, orders, inventory, customers, vouchers, reviews and rice diagnosis in one screen. Charts update when the backend emits data-change events.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm font-bold backdrop-blur">
              <span className="block text-[10px] uppercase tracking-widest text-white/65">
                {isVietnamese ? 'Cập nhật' : 'Updated'}
              </span>
              {lastUpdated
                ? new Date(lastUpdated).toLocaleTimeString(
                    language === 'vi' ? 'vi-VN' : 'en-US',
                    { hour: '2-digit', minute: '2-digit', second: '2-digit' },
                  )
                : '--:--'}
            </div>
            <button
              type="button"
              onClick={() => void refreshDashboard(false)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {isVietnamese ? 'Làm mới' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {!canViewReports ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
          {isVietnamese
            ? 'Tài khoản hiện tại chưa có quyền xem báo cáo tổng quan. Vui lòng liên hệ quản trị viên.'
            : 'The current account does not have manage_reports permission, so only basic public data is shown.'}
        </div>
      ) : null}

      {blockVisible('metric_cards') && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={isVietnamese ? 'Tổng doanh thu' : 'Total Revenue'}
            value={hasReportData ? money(totals?.revenue) : '-'}
            helper={hasReportData ? (isVietnamese ? '30 ngày gần nhất' : 'Last 30 days') : isVietnamese ? 'Đang chờ dữ liệu' : 'Waiting for data'}
            icon={TrendingUp}
            tone="green"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Hôm nay' : 'Today'}
            value={hasReportData ? money(totals?.todayRevenue) : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.todayOrders)} đơn mới` : `${formatNumber(totals?.todayOrders)} new orders`) : '-'}
            icon={changePct >= 0 ? TrendingUp : TrendingDown}
            tone={changePct >= 0 ? 'emerald' : 'orange'}
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Đơn hàng' : 'Orders'}
            value={hasReportData ? numberCompact(totals?.orders) : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.pendingOrders)} đơn chờ xử lý` : `${formatNumber(totals?.pendingOrders)} pending`) : '-'}
            icon={ShoppingCart}
            tone="blue"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Tồn kho' : 'Inventory'}
            value={hasReportData ? numberCompact(totals?.availableUnits) : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.lowStockProducts)} cảnh báo tồn thấp` : `${formatNumber(totals?.lowStockProducts)} low stock alerts`) : '-'}
            icon={Boxes}
            tone="amber"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Giá trị kho' : 'Inventory Value'}
            value={hasReportData ? moneyCompact(totals?.inventoryValue) : '-'}
            helper={hasReportData ? (isVietnamese ? `Tiềm năng bán: ${moneyCompact(totals?.potentialRevenue)}` : `Sales potential: ${moneyCompact(totals?.potentialRevenue)}`) : '-'}
            icon={Package}
            tone="green"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Khách hàng' : 'Customers'}
            value={hasReportData ? numberCompact(totals?.customers) : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.activeCustomers)} đang hoạt động` : `${formatNumber(totals?.activeCustomers)} active`) : '-'}
            icon={Users}
            tone="blue"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Voucher' : 'Vouchers'}
            value={hasReportData ? numberCompact(totals?.activeDiscounts) : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.couponUsageCount)} lượt dùng` : `${formatNumber(totals?.couponUsageCount)} usages`) : '-'}
            icon={Percent}
            tone="orange"
            loading={loading}
          />
          <MetricCard
            title={isVietnamese ? 'Đánh giá / AI lúa' : 'Reviews / Rice AI'}
            value={hasReportData ? `${formatNumber(totals?.averageRating || 0)}★ / ${formatNumber(totals?.totalDiagnoses || 0)}` : '-'}
            helper={hasReportData ? (isVietnamese ? `${formatNumber(totals?.visibleReviews)} đánh giá hiển thị` : `${formatNumber(totals?.visibleReviews)} visible reviews`) : '-'}
            icon={Wheat}
            tone="emerald"
            loading={loading}
          />
        </div>
      )}

      {(blockVisible('revenue_chart') || blockVisible('order_status_chart')) && <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {blockVisible('revenue_chart') && <ChartCard
          title={isVietnamese ? 'Doanh thu & đơn hoàn tất 30 ngày' : '30-day recognized revenue and fulfilled orders'}
          subtitle={isVietnamese ? 'Ghi nhận theo ngày giao/nhận hoàn tất; area = doanh thu, cột = số đơn' : 'Recognized by fulfillment date; area = revenue, bars = orders'}
          className="xl:col-span-3"
        >
          <EmptyState show={!dailyRevenue.length && !loading} label={isVietnamese ? 'Chưa có doanh thu ghi nhận từ đơn đã hoàn tất trong 30 ngày.' : 'No recognized revenue from fulfilled orders in the last 30 days.'}>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f8f46" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#2f8f46" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.18)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} tickFormatter={moneyCompact} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'revenue' ? money(value as NumericValue) : numberCompact(value as NumericValue)} />
                <Legend />
                <Bar yAxisId="right" dataKey="orders" name={isVietnamese ? 'Đơn hoàn tất' : 'Fulfilled orders'} fill="#d6a51d" radius={[8, 8, 0, 0]} barSize={18} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name={isVietnamese ? 'Doanh thu' : 'Revenue'} stroke="#1b5e20" strokeWidth={3} fill="url(#revenueFill)" />
              </ComposedChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}

        {blockVisible('order_status_chart') && <ChartCard
          title={isVietnamese ? 'Tỷ lệ trạng thái đơn' : 'Order Status Mix'}
          subtitle={isVietnamese ? 'Phát hiện backlog xử lý' : 'Spot processing backlog'}
        >
          {orderStatusData.length === 0 ? (
            <EmptyChart message={isVietnamese ? 'Chưa có đơn hàng.' : 'No orders yet.'} />
          ) : (
            <DonutChart data={orderStatusData} valueFormatter={numberCompact} />
          )}
          <div className="mt-4 space-y-2">
            {orderStatusData.slice(0, 5).map((item, index) => (
              <div key={item.raw}>
                <LegendRow
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                  label={item.name}
                  value={numberCompact(item.value)}
                />
              </div>
            ))}
          </div>
        </ChartCard>}
      </div>}

      {(blockVisible('top_products_chart') || blockVisible('category_revenue')) && <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {blockVisible('top_products_chart') && <ChartCard
          title={isVietnamese ? 'Top sản phẩm bán chạy' : 'Top Selling Products'}
          subtitle={isVietnamese ? 'Xếp theo số lượng bán' : 'Ranked by sold quantity'}
          className="xl:col-span-2"
        >
          <EmptyState show={!topProducts.length} label={isVietnamese ? 'Chưa có dữ liệu sản phẩm.' : 'No product data yet.'}>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart layout="vertical" data={topProducts} margin={{ top: 0, right: 24, left: 18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(96,113,98,0.16)" />
                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={numberCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={145} tick={{ fontSize: 12, fill: '#16311f', fontWeight: 700 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'revenue' ? money(value as NumericValue) : numberCompact(value as NumericValue)} />
                <Bar dataKey="sold" name={isVietnamese ? 'Đã bán' : 'Sold'} fill="#1b5e20" radius={[0, 12, 12, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}

        {blockVisible('category_revenue') && <ChartCard
          title={isVietnamese ? 'Doanh thu theo danh mục' : 'Category Revenue'}
          subtitle={isVietnamese ? 'Danh mục nào kéo doanh thu' : 'Which categories drive revenue'}
        >
          <EmptyState show={!categoryRevenue.length} label={isVietnamese ? 'Chưa có doanh thu danh mục.' : 'No category revenue.'}>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={categoryRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} angle={-18} textAnchor="end" tick={{ fontSize: 11, fill: '#607162' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={moneyCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => money(value as NumericValue)} />
                <Bar dataKey="revenue" name={isVietnamese ? 'Doanh thu' : 'Revenue'} fill="#2f8f46" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}
      </div>}

      {(blockVisible('shopping_hours') || blockVisible('payment_mix') || blockVisible('stock_health')) && <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {blockVisible('shopping_hours') && <ChartCard
          title={isVietnamese ? 'Giờ vàng mua sắm' : 'Shopping Heatmap'}
          subtitle={isVietnamese ? 'Nhiệt doanh thu theo 24 giờ gần đây' : 'Revenue heat by hour'}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
            {hourCells.map((item) => (
              <div
                key={item.hour}
                className="rounded-2xl border border-on-surface/5 p-3 text-center transition-transform hover:-translate-y-0.5"
                style={{
                  background: `color-mix(in srgb, #1b5e20 ${Math.max(item.intensity * 88, 8)}%, white)`,
                  color: item.intensity > 0.45 ? 'white' : 'var(--theme-on-surface)',
                }}
                title={`${item.hour}:00 - ${money(item.revenue)} - ${item.orders} orders`}
              >
                <div className="text-xs font-black">{String(item.hour).padStart(2, '0')}h</div>
                <div className="mt-1 text-[11px] font-bold opacity-80">{numberCompact(item.orders)}</div>
              </div>
            ))}
          </div>
        </ChartCard>}

        {blockVisible('payment_mix') && <ChartCard
          title={isVietnamese ? 'Cơ cấu thanh toán' : 'Payment Mix'}
          subtitle={isVietnamese ? 'COD, ví, chuyển khoản...' : 'COD, wallets, bank...'}
        >
          <DonutChart
            data={paymentMethodData}
            valueFormatter={numberCompact}
            emptyLabel={isVietnamese ? 'Chưa có thanh toán.' : 'No payment data.'}
          />
        </ChartCard>}

        {blockVisible('stock_health') && <ChartCard
          title={isVietnamese ? 'Sức khỏe tồn kho' : 'Inventory Health'}
          subtitle={isVietnamese ? 'Hết, thấp, trung bình, tốt' : 'Out, low, medium, healthy'}
        >
          <DonutChart
            data={stockHealth}
            valueFormatter={numberCompact}
            emptyLabel={isVietnamese ? 'Chưa có dữ liệu kho.' : 'No inventory data.'}
          />
        </ChartCard>}
      </div>}

      {(blockVisible('inventory_chart') || blockVisible('customer_segments')) && <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {blockVisible('inventory_chart') && <ChartCard
          title={isVietnamese ? 'Giá trị tồn kho theo danh mục' : 'Inventory Value by Category'}
          subtitle={isVietnamese ? 'So sánh vốn đang nằm trong kho' : 'Capital tied in stock'}
          className="xl:col-span-2"
        >
          <EmptyState show={!inventoryByCategory.length} label={isVietnamese ? 'Chưa có dữ liệu kho.' : 'No inventory value data.'}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={inventoryByCategory} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} angle={-18} textAnchor="end" tick={{ fontSize: 11, fill: '#607162' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={moneyCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={numberCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'value' ? money(value as NumericValue) : numberCompact(value as NumericValue)} />
                <Legend />
                <Bar dataKey="value" name={isVietnamese ? 'Giá trị kho' : 'Stock value'} fill="#0b6b43" radius={[10, 10, 0, 0]} />
                <Line type="monotone" dataKey="quantity" name={isVietnamese ? 'Tồn khả dụng' : 'Available stock'} stroke="#f97316" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}

        {blockVisible('customer_segments') && <ChartCard
          title={isVietnamese ? 'Phân khúc khách hàng' : 'Customer Segments'}
          subtitle={isVietnamese ? 'Chưa mua, mua 1 lần, lặp lại, thân thiết' : 'Prospects, first-time, repeat, loyal'}
        >
          <DonutChart
            data={customerSegments}
            valueFormatter={numberCompact}
            emptyLabel={isVietnamese ? 'Chưa có khách hàng.' : 'No customer segment data.'}
          />
          <div className="mt-4 space-y-2">
            {customerSegments.map((item, index) => (
              <div key={item.name}>
                <LegendRow
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                  label={item.name}
                  value={numberCompact(item.value)}
                />
              </div>
            ))}
          </div>
        </ChartCard>}
      </div>}

      {(blockVisible('voucher_chart') || blockVisible('new_customers')) && <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {blockVisible('voucher_chart') && <ChartCard
          title={isVietnamese ? 'Hiệu quả voucher' : 'Voucher Performance'}
          subtitle={isVietnamese ? 'Lượt dùng và doanh thu kéo theo' : 'Usage and revenue impact'}
        >
          <EmptyState show={!couponEffectiveness.length} label={isVietnamese ? 'Chưa có voucher được dùng.' : 'No voucher usage yet.'}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={couponEffectiveness} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#607162' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={numberCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'revenue' ? money(value as NumericValue) : numberCompact(value as NumericValue)} />
                <Bar dataKey="usageCount" name={isVietnamese ? 'Lượt dùng' : 'Usage'} fill="#0b6b43" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}

        {blockVisible('new_customers') && <ChartCard
          title={isVietnamese ? 'Khách mới 30 ngày' : 'New Customers'}
          subtitle={isVietnamese ? 'Tốc độ tăng khách hàng' : 'Customer acquisition pace'}
        >
          <EmptyState show={!newCustomersByDay.length} label={isVietnamese ? 'Chưa có khách mới.' : 'No new customers.'}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={newCustomersByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#607162' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={numberCompact} tick={{ fontSize: 12, fill: '#607162' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => numberCompact(value as NumericValue)} />
                <Line type="monotone" dataKey="count" name={isVietnamese ? 'Khách mới' : 'New customers'} stroke="#0b6b43" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </EmptyState>
        </ChartCard>}

        <ChartCard
          title={isVietnamese ? 'Đánh giá & chẩn đoán lúa' : 'Reviews & Rice Diagnosis'}
          subtitle={isVietnamese ? 'Tín hiệu chất lượng sản phẩm và AI' : 'Product quality and AI signals'}
        >
          <div className="grid gap-4">
            <MiniBarList
              title={isVietnamese ? 'Phân bố sao' : 'Rating distribution'}
              data={reviewSummary}
              valueFormatter={numberCompact}
            />
            <MiniBarList
              title={isVietnamese ? 'Bệnh lúa thường gặp' : 'Common rice diseases'}
              data={diagnosisData.map((item) => ({
                name: item.name,
                value: item.count,
              }))}
              valueFormatter={numberCompact}
            />
          </div>
        </ChartCard>
      </div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DataPanel
          title={isVietnamese ? 'Dự báo ngày còn hàng' : 'Stockout Forecast'}
          subtitle={isVietnamese ? 'Dựa trên bán ra 30 ngày' : 'Based on last 30-day sales'}
          icon={CalendarClock}
        >
          <div className="space-y-3">
            {(dashboard?.stockRiskProducts ?? []).slice(0, 6).map((product) => (
              <div key={product.productId}>
                <RiskRow
                  name={product.productName}
                  primary={
                    product.daysOfCover
                      ? `${Math.round(toNumber(product.daysOfCover))} ${isVietnamese ? 'ngày' : 'days'}`
                      : isVietnamese
                        ? 'Không đủ dữ liệu'
                        : 'Not enough data'
                  }
                  secondary={`${isVietnamese ? 'Tồn' : 'Stock'} ${formatNumber(product.quantityAvailable)} · ${isVietnamese ? 'Bán 30 ngày' : '30d sold'} ${formatNumber(product.soldLast30)}`}
                  danger={toNumber(product.daysOfCover) <= 7}
                />
              </div>
            ))}
            {!dashboard?.stockRiskProducts?.length ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                {isVietnamese ? 'Chưa có dữ liệu dự báo.' : 'No forecast data yet.'}
              </p>
            ) : null}
          </div>
        </DataPanel>

        <DataPanel
          title={isVietnamese ? 'Sản phẩm sắp hết hàng' : 'Low Stock Products'}
          subtitle={isVietnamese ? 'Ưu tiên nhập hàng' : 'Prioritize replenishment'}
          icon={AlertTriangle}
        >
          <div className="space-y-3">
            {(dashboard?.lowStockProductList ?? []).slice(0, 6).map((product) => (
              <div key={product.productId}>
                <RiskRow
                  name={product.productName}
                  primary={`${formatNumber(product.quantityAvailable)} ${isVietnamese ? 'còn lại' : 'left'}`}
                  secondary={`${isVietnamese ? 'Đang giữ' : 'Reserved'} ${formatNumber(product.quantityReserved ?? 0)}`}
                  danger={toNumber(product.quantityAvailable) <= 3}
                />
              </div>
            ))}
            {!dashboard?.lowStockProductList?.length ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                {isVietnamese ? 'Không có sản phẩm sắp hết hàng.' : 'No low stock products.'}
              </p>
            ) : null}
          </div>
        </DataPanel>

        <DataPanel
          title={isVietnamese ? 'Sản phẩm nổi bật' : 'Featured Products'}
          subtitle={isVietnamese ? 'Fallback từ reports hoặc public products' : 'Fallback from reports or public products'}
          icon={Package}
        >
          <div className="space-y-3">
            {fallbackProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-on-surface/5 bg-white/60 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-on-surface">{product.name}</p>
                  <p className="text-xs font-semibold text-on-surface-variant">{product.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </DataPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <DataPanel
          title={isVietnamese ? 'Top khách hàng' : 'Top Customers'}
          subtitle={isVietnamese ? 'Theo doanh thu tích lũy' : 'By lifetime revenue'}
          icon={Users}
          className="xl:col-span-2"
        >
          <div className="space-y-3">
            {(dashboard?.topCustomers ?? []).slice(0, 7).map((customer, index) => (
              <div key={`${customer.userId}-${customer.phone}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border border-on-surface/5 bg-white/60 p-3">
                <div className="text-center text-sm font-black text-primary">#{index + 1}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{customer.fullName}</p>
                  <p className="text-xs font-semibold text-on-surface-variant">
                  <span>{formatNumber(customer.orders)} {isVietnamese ? 'đơn' : 'orders'}</span>
                  </p>
                </div>
                <div className="text-right text-sm font-black text-primary">{moneyCompact(customer.revenue)}</div>
              </div>
            ))}
            {!dashboard?.topCustomers?.length ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                {isVietnamese ? 'Chưa có khách hàng mua hàng.' : 'No customer purchases yet.'}
              </p>
            ) : null}
          </div>
        </DataPanel>

        <DataPanel
          title={isVietnamese ? 'Đơn hàng gần đây' : 'Recent Orders'}
          subtitle={isVietnamese ? 'Cập nhật realtime cùng dashboard' : 'Realtime updates with dashboard'}
          icon={ClipboardList}
          className="xl:col-span-3"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-on-surface/5 text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                  <th>{isVietnamese ? 'Mã đơn' : 'Order'}</th>
                  <th>{isVietnamese ? 'Khách hàng' : 'Customer'}</th>
                  <th>{isVietnamese ? 'Giá trị' : 'Value'}</th>
                  <th>{isVietnamese ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface/5">
                {orderRows.length > 0 ? (
                  orderRows.slice(0, 8).map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-primary/5">
                      <td className="py-4 text-sm font-black text-primary">{shortId(order.orderId ?? order.id)}</td>
                      <td className="py-4 text-sm font-semibold">{order.fullName}</td>
                      <td className="py-4 text-sm font-black">{money(order.totalPayment)}</td>
                      <td className="py-4">
                        <StatusPill status={order.status} label={translateOrderStatus(order.status, isVietnamese)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-on-surface-variant">
                      {isVietnamese ? 'Chưa có đơn hàng gần đây.' : 'No recent orders.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DataPanel>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  loading,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: 'green' | 'emerald' | 'blue' | 'amber' | 'orange';
  loading: boolean;
}) {
  const toneStyles: Record<typeof tone, string> = {
    green: 'bg-green-50 text-green-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-sky-50 text-sky-800',
    amber: 'bg-amber-50 text-amber-800',
    orange: 'bg-orange-50 text-orange-800',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border border-white/70 p-5 shadow-sm ${toneStyles[tone]}`}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70">{title}</p>
          <h3 className="mt-3 text-3xl font-black tracking-tight text-on-surface">
            {loading ? '...' : value}
          </h3>
          <p className="mt-2 text-xs font-bold text-on-surface-variant">{helper}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70">
          <Icon size={22} />
        </div>
      </div>
    </motion.div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-on-surface">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">{subtitle}</p>
        </div>
        <BarChart3 size={20} className="text-primary" />
      </div>
      {children}
    </section>
  );
}

function DataPanel({
  title,
  subtitle,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-on-surface">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
      </div>
      {children}
    </section>
  );
}

function DonutChart({
  data,
  valueFormatter,
  emptyLabel,
}: {
  data: Array<{ name: string; value: number }>;
  valueFormatter: (value: NumericValue) => string;
  emptyLabel: string;
}) {
  if (!data.length) {
    return <p className="flex h-[230px] items-center justify-center text-sm text-on-surface-variant">{emptyLabel}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={4}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => valueFormatter(value as NumericValue)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <p className="flex h-[230px] items-center justify-center text-sm text-on-surface-variant">{message}</p>;
}

function EmptyState({
  show,
  label,
  children,
}: {
  show: boolean;
  label: string;
  children: ReactNode;
}) {
  if (show) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-on-surface-variant">{label}</p>;
  }

  return <>{children}</>;
}

function MiniBarList({
  title,
  data,
  valueFormatter,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  valueFormatter: (value: NumericValue) => string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-on-surface/5 bg-white/60 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant">{title}</p>
      <div className="space-y-3">
        {data.length ? (
          data.slice(0, 5).map((item, index) => (
            <div key={`${title}-${item.name}`} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
              <span className="truncate text-xs font-bold text-on-surface">{item.name}</span>
              <div className="h-2 overflow-hidden rounded-full bg-on-surface/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, 6)}%`,
                    background: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
              </div>
              <span className="text-xs font-black text-primary">{valueFormatter(item.value)}</span>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-on-surface-variant">--</p>
        )}
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate font-semibold text-on-surface-variant">{label}</span>
      </div>
      <span className="font-black text-on-surface">{value}</span>
    </div>
  );
}

function RiskRow({
  name,
  primary,
  secondary,
  danger,
}: {
  name: string;
  primary: string;
  secondary: string;
  danger: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${danger ? 'border-red-100 bg-red-50' : 'border-on-surface/5 bg-white/60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-on-surface">{name}</p>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">{secondary}</p>
        </div>
        <span className={`shrink-0 rounded-xl px-3 py-1 text-xs font-black ${danger ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>
          {primary}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone = mapStatusTone(status);
  const styles: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${styles[tone]}`}>
      {label}
    </span>
  );
}

function toNumber(value: NumericValue) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: NumericValue) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

function formatPercent(value: NumericValue) {
  const numberValue = toNumber(value);
  return `${numberValue >= 0 ? '+' : ''}${numberValue.toFixed(1)}%`;
}

function formatDateLabel(value: string, language: string) {
  const time = Date.parse(value);

  if (!Number.isFinite(time)) {
    return value;
  }

  return new Date(time).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
  });
}

function shortLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function shortId(value: string) {
  return value.length > 10 ? `#${value.slice(0, 8)}` : `#${value}`;
}

function translateOrderStatus(status: string, isVietnamese: boolean) {
  const labels: Record<string, string> = isVietnamese
    ? {
    pending: isVietnamese ? 'Chờ xử lý' : 'Pending',
    confirmed: isVietnamese ? 'Đã xác nhận' : 'Confirmed',
    processing: isVietnamese ? 'Đang xử lý' : 'Processing',
    shipping: isVietnamese ? 'Đang giao' : 'Shipping',
    delivered: isVietnamese ? 'Đã giao' : 'Delivered',
    cancelled: isVietnamese ? 'Đã hủy' : 'Cancelled',
    returned: isVietnamese ? 'Đã hoàn' : 'Returned',
    partial_delivered: isVietnamese ? 'Giao một phần' : 'Partial delivered',
    partial_returned: isVietnamese ? 'Trả một phần' : 'Partial returned',
      }
    : {
        pending: 'Pending',
        backordered: 'Backordered',
        confirmed: 'Confirmed',
        processing: 'Processing',
        shipping: 'Shipping',
        delivered: 'Delivered',
        partial_delivered: 'Partial',
        cancelled: 'Cancelled',
        returned: 'Returned',
      };

  return labels[status] ?? status;
}

function translatePaymentMethod(method: string, isVietnamese: boolean) {
  const labels: Record<string, string> = isVietnamese
    ? {
        cod: 'COD',
    bank_transfer: isVietnamese ? 'Chuyển khoản' : 'Bank transfer',
        momo: 'MoMo',
        vnpay: 'VNPAY',
        zalopay: 'ZaloPay',
        paypal: 'PayPal',
      }
    : {
        cod: 'COD',
        bank_transfer: 'Bank transfer',
        momo: 'MoMo',
        vnpay: 'VNPAY',
        zalopay: 'ZaloPay',
        paypal: 'PayPal',
      };

  return labels[method] ?? method;
}

function translateStockLevel(level: string, isVietnamese: boolean) {
  const labels: Record<string, string> = isVietnamese
    ? {
    out: isVietnamese ? 'Hết hàng' : 'Out of stock',
    low: isVietnamese ? 'Tồn thấp' : 'Low stock',
    medium: isVietnamese ? 'Trung bình' : 'Medium',
    healthy: isVietnamese ? 'Tốt' : 'Healthy',
      }
    : {
        out: 'Out',
        low: 'Low',
        medium: 'Medium',
        healthy: 'Healthy',
      };

  return labels[level] ?? level;
}

function translateCustomerSegment(segment: string, isVietnamese: boolean) {
  const normalized = segment.toLowerCase();
  const labels: Record<string, string> = isVietnamese
    ? {
    no_purchase: isVietnamese ? 'Chưa mua' : 'No purchase',
    first_time: isVietnamese ? 'Mua 1 lần' : 'First-time',
    repeat: isVietnamese ? 'Mua lặp lại' : 'Repeat',
    loyal: isVietnamese ? 'Thân thiết' : 'Loyal',
      }
    : {
        'chua mua': 'No orders',
        'mua 1 lan': 'One-time',
        'lap lai': 'Repeat',
        'than thiet': 'Loyal',
      };

  return labels[normalized] ?? segment;
}

function mapStatusTone(status: string) {
  if (status === 'delivered') return 'green';
  if (status === 'processing' || status === 'shipping' || status === 'confirmed') return 'blue';
  if (status === 'pending' || status === 'backordered' || status === 'partial_delivered') return 'amber';
  if (status === 'cancelled' || status === 'returned') return 'red';
  return 'gray';
}
