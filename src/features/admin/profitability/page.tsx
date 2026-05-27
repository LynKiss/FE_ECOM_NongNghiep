import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { showToast } from '../../../lib/toast-store';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
  'http://localhost:8000/api/v1';

function downloadCsv(path: string, filename: string) {
  const token = (() => {
    try {
      const raw = localStorage.getItem('admin_session');
      if (!raw) return '';
      return JSON.parse(raw)?.accessToken ?? '';
    } catch {
      return '';
    }
  })();

  fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) throw new Error('Download failed');
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })
    .catch(() =>
      showToast({
        tone: 'error',
        title: 'Không tải được file',
        description: 'Vui lòng thử lại sau.',
      }),
    );
}

type CogsSource = 'transaction' | 'fallback_avg_cost' | 'mixed' | 'missing';

interface ProductProfit {
  productId: string;
  productName: string;
  soldQty: number;
  returnedQty: number;
  netSoldQty: number;
  grossRevenue: number;
  discountAllocated: number;
  revenueBeforeRefund: number;
  refundAllocated: number;
  revenue: number;
  cogs: number;
  transactionCogs: number;
  fallbackCostUsed: number;
  fallbackUnitCost: number;
  missingCostQty: number;
  fallbackCostQty: number;
  transactionCoveredQty: number;
  cogsCoveragePct: number;
  cogsSource: CogsSource;
  warnings: string[];
  grossProfit: number;
  marginPct: number;
}

interface PeriodProfit {
  period: string;
  soldQty: number;
  returnedQty: number;
  netSoldQty: number;
  grossRevenue: number;
  discountAllocated: number;
  refundAllocated: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  missingCostQty: number;
  warnings: string[];
}

interface ProfitabilityMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  revenuePolicy?: string;
  refundPolicy?: string;
  cogsPolicy?: string;
  unallocatedRefund?: number;
  totalGrossRevenue?: number;
  totalDiscountAllocated?: number;
  totalRevenueBeforeRefund?: number;
  totalRefund?: number;
  totalLineRefund?: number;
  totalRevenue?: number;
  totalCOGS?: number;
  grossProfit?: number;
  grossMargin?: number;
  totalSoldQty?: number;
  totalReturnedQty?: number;
  totalNetSoldQty?: number;
  cogsCoveragePct?: number;
  transactionCoveredQty?: number;
  fallbackCostQty?: number;
  missingCostQty?: number;
  zeroCostRows?: number;
  fallbackRows?: number;
  missingCostRows?: number;
  unreliableCogs?: boolean;
  dataQualityWarnings?: string[];
}

const fmt = (value: number | undefined | null) =>
  Number(value ?? 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const fmtQty = (value: number | undefined | null) =>
  Number(value ?? 0).toLocaleString('vi-VN');

function sourceLabel(source?: CogsSource) {
  if (source === 'transaction') return 'Sổ kho';
  if (source === 'mixed') return 'Hỗn hợp';
  if (source === 'fallback_avg_cost') return 'Giá vốn TB';
  if (source === 'missing') return 'Thiếu giá vốn';
  return 'Chưa rõ';
}

function sourceClass(source?: CogsSource) {
  if (source === 'transaction') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (source === 'mixed') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (source === 'fallback_avg_cost') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function warningText(code: string) {
  const labels: Record<string, string> = {
    MISSING_COST_SOURCE: 'Thiếu nguồn giá vốn',
    USED_FALLBACK_AVG_COST: 'Đang dùng giá vốn TB fallback',
    ZERO_COST_INVENTORY_TRANSACTION: 'Có giao dịch kho giá vốn bằng 0',
    COGS_QTY_EXCEEDS_NET_SOLD: 'SL giá vốn lớn hơn SL giữ lại',
  };
  return labels[code] ?? code;
}

export default function ProfitabilityPage() {
  const [groupBy, setGroupBy] = useState<'product' | 'day' | 'month'>('product');
  const [productRows, setProductRows] = useState<ProductProfit[]>([]);
  const [periodRows, setPeriodRows] = useState<PeriodProfit[]>([]);
  const [reportMeta, setReportMeta] = useState<ProfitabilityMeta | null>(null);
  const [selectedRow, setSelectedRow] = useState<ProductProfit | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const limit = 30;
  const total = reportMeta?.total ?? 0;
  const totalPages = reportMeta?.totalPages ?? Math.ceil(total / limit);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          groupBy,
          page: String(nextPage),
          limit: String(limit),
        });
        if (filterFrom) params.set('from', filterFrom);
        if (filterTo) params.set('to', `${filterTo}T23:59:59`);

        const data = await apiClient.get<{
          items?: ProductProfit[] | PeriodProfit[];
          meta?: ProfitabilityMeta;
        }>(`/reports/profitability?${params.toString()}`);

        setReportMeta(data.meta ?? null);
        setLoadError('');
        if (groupBy === 'product') {
          setProductRows((data.items as ProductProfit[]) ?? []);
          setPeriodRows([]);
        } else {
          setPeriodRows((data.items as PeriodProfit[]) ?? []);
          setProductRows([]);
        }
      } catch (error) {
        setProductRows([]);
        setPeriodRows([]);
        setReportMeta(null);
        setLoadError(
          error instanceof Error ? error.message : 'Không thể tải báo cáo lợi nhuận',
        );
      } finally {
        setLoading(false);
      }
    },
    [filterFrom, filterTo, groupBy],
  );

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const summary = useMemo(() => {
    const fallbackRevenue = productRows.reduce((sum, item) => sum + item.revenue, 0);
    const fallbackCOGS = productRows.reduce((sum, item) => sum + item.cogs, 0);
    const fallbackProfit = fallbackRevenue - fallbackCOGS;
    return {
      totalRevenue: reportMeta?.totalRevenue ?? fallbackRevenue,
      totalRefund: reportMeta?.totalRefund ?? 0,
      totalCOGS: reportMeta?.totalCOGS ?? fallbackCOGS,
      grossProfit: reportMeta?.grossProfit ?? fallbackProfit,
      grossMargin:
        reportMeta?.grossMargin ??
        (fallbackRevenue > 0 ? (fallbackProfit / fallbackRevenue) * 100 : 0),
      cogsCoveragePct: reportMeta?.cogsCoveragePct ?? 100,
      missingCostQty: reportMeta?.missingCostQty ?? 0,
      unreliableCogs: Boolean(reportMeta?.unreliableCogs),
    };
  }, [productRows, reportMeta]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-on-surface">Lợi Nhuận Thật</h1>
          <p className="text-sm text-on-surface-variant">
            Lãi gộp sau refund và giá vốn xuất kho thực tế.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Nhóm theo</label>
            <select
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as 'product' | 'day' | 'month')}
            >
              <option value="product">Sản phẩm</option>
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Từ ngày</label>
            <input
              type="date"
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterFrom}
              onChange={(event) => setFilterFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Đến ngày</label>
            <input
              type="date"
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterTo}
              onChange={(event) => setFilterTo(event.target.value)}
            />
          </div>
          <button
            onClick={() => void load(page)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams({ groupBy });
              if (filterFrom) params.set('from', filterFrom);
              if (filterTo) params.set('to', `${filterTo}T23:59:59`);
              downloadCsv(
                `/reports/profitability/export?${params.toString()}`,
                `profitability-${new Date().toISOString().slice(0, 10)}.csv`,
              );
            }}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-white px-3 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { label: 'Doanh thu thuần', value: fmt(summary.totalRevenue), color: 'text-blue-600' },
          { label: 'Refund đã trừ', value: fmt(summary.totalRefund), color: 'text-amber-600' },
          { label: 'Giá vốn (COGS)', value: fmt(summary.totalCOGS), color: 'text-red-500' },
          { label: 'Lãi gộp', value: fmt(summary.grossProfit), color: summary.grossProfit >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Tỷ suất lãi', value: `${summary.grossMargin.toFixed(1)}%`, color: summary.grossMargin >= 20 ? 'text-green-600' : 'text-yellow-600' },
          { label: 'Đủ giá vốn', value: `${summary.cogsCoveragePct.toFixed(1)}%`, color: summary.unreliableCogs ? 'text-amber-600' : 'text-green-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-outline-variant bg-surface p-4">
            <p className="text-xs text-on-surface-variant">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl border p-4 text-sm ${
          summary.unreliableCogs
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        <div className="flex items-start gap-2">
          {summary.unreliableCogs ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-bold">Chính sách báo cáo</p>
            <p className="mt-1">
              Doanh thu chỉ tính phần đơn đã hoàn tất giao/nhận và trừ refund đã hoàn thành.
              Giá vốn ưu tiên giao dịch xuất/nhập trả theo đơn; dữ liệu cũ thiếu giá vốn sẽ
              dùng giá vốn bình quân và được đánh dấu.
            </p>
            {summary.unreliableCogs && (
              <div className="mt-2 space-y-1">
                {(reportMeta?.dataQualityWarnings ?? [
                  'Có sản phẩm thiếu giá vốn, lợi nhuận có thể đang cao hơn thực tế.',
                ]).map((warning) => (
                  <p key={warning}>- {warning}</p>
                ))}
                {summary.missingCostQty > 0 && (
                  <p>- Số lượng đang thiếu nguồn giá vốn: {fmtQty(summary.missingCostQty)}.</p>
                )}
              </div>
            )}
            {loadError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                {loadError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              {groupBy === 'product' ? (
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 text-right font-medium">SL giữ lại</th>
                  <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                  <th className="px-4 py-3 text-right font-medium">Refund</th>
                  <th className="px-4 py-3 text-right font-medium">Giá vốn</th>
                  <th className="px-4 py-3 text-right font-medium">Nguồn</th>
                  <th className="px-4 py-3 text-right font-medium">Thiếu vốn</th>
                  <th className="px-4 py-3 text-right font-medium">Lãi gộp</th>
                  <th className="px-4 py-3 text-right font-medium">Tỷ suất</th>
                  <th className="px-4 py-3 text-right font-medium">Chi tiết</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{groupBy === 'month' ? 'Tháng' : 'Ngày'}</th>
                  <th className="px-4 py-3 text-right font-medium">SL giữ lại</th>
                  <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                  <th className="px-4 py-3 text-right font-medium">Refund</th>
                  <th className="px-4 py-3 text-right font-medium">Giá vốn</th>
                  <th className="px-4 py-3 text-right font-medium">Lãi gộp</th>
                  <th className="px-4 py-3 text-right font-medium">Tỷ suất</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-on-surface-variant">
                    Đang tải...
                  </td>
                </tr>
              ) : groupBy === 'product' ? (
                productRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-on-surface-variant">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  productRows.map((row) => (
                    <tr key={row.productId} className="hover:bg-surface-variant/40">
                      <td className="max-w-[240px] truncate px-4 py-2.5 font-medium">
                        {row.productName}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmtQty(row.netSoldQty)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(row.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-600">
                        {fmt(row.refundAllocated)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-500">{fmt(row.cogs)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${sourceClass(row.cogsSource)}`}>
                          {sourceLabel(row.cogsSource)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.missingCostQty > 0 ? (
                          <span className="font-semibold text-red-600">{fmtQty(row.missingCostQty)}</span>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(row.grossProfit)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-medium ${row.marginPct >= 20 ? 'text-green-600' : row.marginPct >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {row.marginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setSelectedRow(row)}
                          className="inline-flex rounded-lg border border-outline-variant p-2 text-primary hover:bg-primary/5"
                          title="Xem chi tiết tính toán"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : periodRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                periodRows.map((row) => (
                  <tr key={row.period} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 font-medium">{row.period}</td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(row.netSoldQty)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                      {fmt(row.revenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">
                      {fmt(row.refundAllocated)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-500">{fmt(row.cogs)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(row.grossProfit)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.marginPct.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {groupBy === 'product' && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <span className="text-sm text-on-surface-variant">
              Trang {page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const nextPage = page - 1;
                  setPage(nextPage);
                  void load(nextPage);
                }}
                className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  void load(nextPage);
                }}
                className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Chi tiết tính lợi nhuận
                </p>
                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  {selectedRow.productName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-full border border-outline-variant p-2 hover:bg-surface-variant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ['SL bán', fmtQty(selectedRow.soldQty)],
                ['SL trả/refund', fmtQty(selectedRow.returnedQty)],
                ['SL giữ lại', fmtQty(selectedRow.netSoldQty)],
                ['Doanh thu trước refund', fmt(selectedRow.revenueBeforeRefund)],
                ['Refund dòng hàng', fmt(selectedRow.refundAllocated)],
                ['Doanh thu thuần', fmt(selectedRow.revenue)],
                ['COGS transaction', fmt(selectedRow.transactionCogs)],
                ['COGS fallback', fmt(selectedRow.fallbackCostUsed)],
                ['Giá vốn đơn vị fallback', fmt(selectedRow.fallbackUnitCost)],
                ['SL thiếu giá vốn', fmtQty(selectedRow.missingCostQty)],
                ['Tỷ lệ đủ giá vốn', `${selectedRow.cogsCoveragePct.toFixed(1)}%`],
                ['Lãi gộp', fmt(selectedRow.grossProfit)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-outline-variant bg-surface-variant/30 p-3">
                  <p className="text-xs text-on-surface-variant">{label}</p>
                  <p className="mt-1 font-bold text-on-surface">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-outline-variant p-4">
              <p className="font-bold text-on-surface">Nguồn giá vốn</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Hệ thống ưu tiên giá vốn từ giao dịch kho liên quan đơn hàng. Nếu giao dịch
                cũ thiếu đơn giá, hệ thống dùng giá vốn bình quân hoặc giá nhập cuối cùng của
                sản phẩm và đánh dấu để kế toán/kho đối soát.
              </p>
              <div className="mt-3">
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${sourceClass(selectedRow.cogsSource)}`}>
                  {sourceLabel(selectedRow.cogsSource)}
                </span>
              </div>
            </div>

            {selectedRow.warnings.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-bold">Cảnh báo cần đối soát</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {selectedRow.warnings.map((warning) => (
                    <li key={warning}>{warningText(warning)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
