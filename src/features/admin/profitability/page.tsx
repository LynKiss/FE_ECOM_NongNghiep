import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, Download } from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { showToast } from '../../../lib/toast-store';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000/api/v1';

function downloadCsv(path: string, filename: string) {
  const token = (() => {
    try {
      const raw = localStorage.getItem('admin_session');
      if (!raw) return '';
      return JSON.parse(raw)?.accessToken ?? '';
    } catch { return ''; }
  })();
  fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((r) => r.blob())
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })
    .catch(() =>
      showToast({
        tone: 'error',
        title: 'Không tải được file',
        description: 'Vui lòng thử lại.',
      }),
    );
}

interface ProductProfit {
  productId: string;
  productName: string;
  soldQty: number;
  revenue: number;
  cogs: number;
  cogsSource?: 'transaction' | 'fallback_avg_cost' | 'mixed';
  grossProfit: number;
  marginPct: number;
}

interface PeriodProfit {
  period: string;
  revenue: number;
  soldQty: number;
}

interface ProfitabilityMeta {
  total?: number;
  revenuePolicy?: string;
  refundPolicy?: string;
  cogsPolicy?: string;
  unallocatedRefund?: number;
}

export default function ProfitabilityPage() {
  const [groupBy, setGroupBy] = useState<'product' | 'day' | 'month'>('product');
  const [productRows, setProductRows] = useState<ProductProfit[]>([]);
  const [periodRows, setPeriodRows] = useState<PeriodProfit[]>([]);
  const [reportMeta, setReportMeta] = useState<ProfitabilityMeta | null>(null);
  const [loadError, setLoadError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const limit = 30;
  const totalPages = Math.ceil(total / limit);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ groupBy, page: String(p), limit: String(limit) });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo + 'T23:59:59');
      const data = await apiClient.get<{
        items?: ProductProfit[];
        meta?: ProfitabilityMeta;
      }>(`/reports/profitability?${params.toString()}`);

      setReportMeta(data.meta ?? null);
      setLoadError('');
      if (groupBy === 'product') {
        setProductRows(data.items ?? []);
        setTotal(data.meta?.total ?? 0);
      } else {
        setPeriodRows((data as any).items ?? []);
        setTotal(0);
      }
    } catch (error) {
      setProductRows([]);
      setPeriodRows([]);
      setReportMeta(null);
      setLoadError(error instanceof Error ? error.message : 'Không thể tải báo cáo lợi nhuận');
    } finally {
      setLoading(false);
    }
  }, [groupBy, filterFrom, filterTo]);

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const fmt = (n: number) =>
    n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  const totalRevenue = productRows.reduce((s, r) => s + r.revenue, 0);
  const totalCOGS = productRows.reduce((s, r) => s + r.cogs, 0);
  const totalProfit = productRows.reduce((s, r) => s + r.grossProfit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-on-surface">Lợi Nhuận Thật</h1>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Nhóm theo</label>
            <select
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'product' | 'day' | 'month')}
            >
              <option value="product">Sản phẩm</option>
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Từ ngày</label>
            <input type="date" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Đến ngày</label>
            <input type="date" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
          <button onClick={() => void load(page)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams({ groupBy });
              if (filterFrom) params.set('from', filterFrom);
              if (filterTo) params.set('to', filterTo + 'T23:59:59');
              downloadCsv(`/reports/profitability/export?${params.toString()}`, `profitability-${new Date().toISOString().slice(0,10)}.csv`);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-white px-3 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {groupBy === 'product' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Doanh thu', value: fmt(totalRevenue), color: 'text-blue-600' },
            { label: 'Giá vốn (COGS)', value: fmt(totalCOGS), color: 'text-red-500' },
            { label: 'Lãi gộp', value: fmt(totalProfit), color: 'text-green-600' },
            { label: 'Tỷ suất lãi', value: `${avgMargin.toFixed(1)}%`, color: avgMargin > 20 ? 'text-green-600' : 'text-yellow-600' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-outline-variant bg-surface p-4">
              <p className="text-xs text-on-surface-variant">{c.label}</p>
              <p className={`mt-1 text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        <p className="font-bold">Chính sách báo cáo</p>
        <p className="mt-1">
          Doanh thu chỉ tính phần đơn đã hoàn tất giao/nhận và chỉ trừ refund đã hoàn thành.
        </p>
        <p className="mt-1">
          Giá vốn ưu tiên transaction xuất/nhập trả theo đơn; dữ liệu cũ thiếu giá vốn sẽ dùng giá vốn bình quân.
        </p>
        {Number(reportMeta?.unallocatedRefund ?? 0) > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Có refund đã hoàn thành chưa gắn được vào dòng trả hàng/sản phẩm:{' '}
              <b>{fmt(Number(reportMeta?.unallocatedRefund ?? 0))}</b>.
            </span>
          </div>
        )}
        {loadError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {loadError}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              {groupBy === 'product' ? (
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 text-right font-medium">SL bán</th>
                  <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                  <th className="px-4 py-3 text-right font-medium">Nguồn vốn</th>
                  <th className="px-4 py-3 text-right font-medium">Giá vốn</th>
                  <th className="px-4 py-3 text-right font-medium">Lãi gộp</th>
                  <th className="px-4 py-3 text-right font-medium">Tỷ suất</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{groupBy === 'month' ? 'Tháng' : 'Ngày'}</th>
                  <th className="px-4 py-3 text-right font-medium">SL bán</th>
                  <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-on-surface-variant">Đang tải...</td></tr>
              ) : groupBy === 'product' ? (
                productRows.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-on-surface-variant">Không có dữ liệu</td></tr>
                ) : productRows.map((r) => (
                  <tr key={r.productId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 font-medium max-w-[220px] truncate">{r.productName}</td>
                    <td className="px-4 py-2.5 text-right">{r.soldQty.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="rounded-full bg-surface-variant px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                        {r.cogsSource === 'transaction'
                          ? 'Sổ kho'
                          : r.cogsSource === 'mixed'
                            ? 'Hỗn hợp'
                            : 'Giá TB'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-500">{fmt(r.cogs)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${r.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(r.grossProfit)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs font-medium ${r.marginPct >= 20 ? 'text-green-600' : r.marginPct >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {r.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                periodRows.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-on-surface-variant">Không có dữ liệu</td></tr>
                ) : periodRows.map((r) => (
                  <tr key={r.period} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 font-medium">{r.period}</td>
                    <td className="px-4 py-2.5 text-right">{Number(r.soldQty).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{fmt(Number(r.revenue))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {groupBy === 'product' && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <span className="text-sm text-on-surface-variant">Trang {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p); }} className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p); }} className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
