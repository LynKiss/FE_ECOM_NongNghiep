import { useEffect, useState } from 'react';
import { Coins, RefreshCw, Search, Package, Download } from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { showToast } from '../../../lib/toast-store';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000/api/v1';

function downloadFromUrl(path: string, filename: string) {
  const token = (() => {
    try {
      const raw = localStorage.getItem('admin_session');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.accessToken ?? '';
    } catch {
      return '';
    }
  })();
  fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
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

interface ValuationItem {
  productId: string;
  productName: string;
  qtyAvailable: number;
  qtyReserved: number;
  totalQty: number;
  avgCost: number;
  lastCost: number;
  retailPrice: number;
  totalValue: number;
  potentialRevenue: number;
  potentialProfit: number;
}

interface ValuationResponse {
  asOf: string;
  summary: {
    totalProducts: number;
    totalQty: number;
    totalValue: number;
    potentialRevenue: number;
    potentialProfit: number;
  };
  items: ValuationItem[];
}

interface ReconciliationItem {
  productId: string;
  productName: string;
  quantityAvailable: number;
  quantityReserved: number;
  batchRemainingQty: number;
  defaultWarehouseQty: number;
  deltaBatch: number;
  deltaWarehouse: number;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
  warnings: string[];
}

interface ReconciliationResponse {
  summary: {
    totalProducts: number;
    totalMismatches: number;
    missingBatch: number;
    warehouseMismatches: number;
    critical: number;
    warning: number;
    ok: number;
  };
  items: ReconciliationItem[];
  meta: { asOf: string; policy: string };
}

export default function InventoryValuationPage() {
  const [data, setData] = useState<ValuationResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMismatch, setOnlyMismatch] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [res, recon] = await Promise.all([
        apiClient.get<ValuationResponse>('/reports/inventory-valuation'),
        apiClient.get<ReconciliationResponse>(
          `/reports/inventory-reconciliation?onlyMismatch=${onlyMismatch ? 'true' : 'false'}&limit=200`,
        ),
      ]);
      setData(res);
      setReconciliation(recon);
      setLoadError('');
    } catch (error) {
      setData(null);
      setReconciliation(null);
      setLoadError(error instanceof Error ? error.message : 'Không thể tải báo cáo tồn kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [onlyMismatch]);

  const fmt = (n: number) =>
    n.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    });

  const filtered =
    data?.items.filter((it) =>
      search.trim()
        ? it.productName.toLowerCase().includes(search.trim().toLowerCase())
        : true,
    ) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-on-surface">
            Giá Trị Tồn Kho
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadFromUrl(
                '/reports/inventory-valuation/export',
                `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-white px-3 py-1.5 text-sm text-primary transition hover:bg-primary/5"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
        </div>
      </div>

      {data && (
        <p className="text-xs text-on-surface-variant">
          Tính tại thời điểm:{' '}
          <span className="font-semibold">
            {new Date(data.asOf).toLocaleString('vi-VN')}
          </span>{' '}
          • Phương pháp: <span className="font-semibold">Bình quân gia quyền (Moving Average Cost)</span>
        </p>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {loadError}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            {
              label: 'Số sản phẩm',
              value: data.summary.totalProducts.toLocaleString('vi-VN'),
              color: 'text-blue-600',
              icon: Package,
            },
            {
              label: 'Tổng số lượng',
              value: data.summary.totalQty.toLocaleString('vi-VN'),
              color: 'text-slate-700',
              icon: Package,
            },
            {
              label: 'Giá trị tồn kho',
              value: fmt(data.summary.totalValue),
              color: 'text-amber-600',
              icon: Coins,
            },
            {
              label: 'Doanh thu tiềm năng',
              value: fmt(data.summary.potentialRevenue),
              color: 'text-emerald-600',
              icon: Coins,
            },
            {
              label: 'Lãi tiềm năng',
              value: fmt(data.summary.potentialProfit),
              color:
                data.summary.potentialProfit >= 0
                  ? 'text-green-600'
                  : 'text-red-600',
              icon: Coins,
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-outline-variant bg-surface p-4"
            >
              <p className="text-xs text-on-surface-variant">{c.label}</p>
              <p className={`mt-1 text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên sản phẩm..."
            className="w-full rounded-lg border border-outline-variant bg-surface pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {reconciliation && (
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-on-surface">Đối soát tồn kho</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                So sánh tồn sản phẩm, tồn batch FIFO/FEFO và tồn kho mặc định.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOnlyMismatch((value) => !value)}
                className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
              >
                {onlyMismatch ? 'Đang xem lệch' : 'Đang xem tất cả'}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFromUrl(
                    `/reports/inventory-reconciliation/export?onlyMismatch=${onlyMismatch ? 'true' : 'false'}`,
                    `inventory-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
              >
                <Download className="h-3.5 w-3.5" /> Xuất đối soát
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Tổng SP', reconciliation.summary.totalProducts],
              ['Lệch', reconciliation.summary.totalMismatches],
              ['Thiếu batch', reconciliation.summary.missingBatch],
              ['Lệch kho', reconciliation.summary.warehouseMismatches],
              ['Critical', reconciliation.summary.critical],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-outline-variant bg-surface-variant/40 p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant">{label}</p>
                <p className="mt-1 text-lg font-black text-on-surface">{Number(value).toLocaleString('vi-VN')}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-variant text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Sản phẩm</th>
                  <th className="px-3 py-2 text-right font-medium">Available</th>
                  <th className="px-3 py-2 text-right font-medium">Batch</th>
                  <th className="px-3 py-2 text-right font-medium">Kho mặc định</th>
                  <th className="px-3 py-2 text-right font-medium">Lệch batch</th>
                  <th className="px-3 py-2 text-right font-medium">Lệch kho</th>
                  <th className="px-3 py-2 text-right font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {reconciliation.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-on-surface-variant">
                      Không có lệch tồn kho trong bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  reconciliation.items.slice(0, 25).map((item) => (
                    <tr key={item.productId}>
                      <td className="max-w-[240px] truncate px-3 py-2 font-semibold">{item.productName}</td>
                      <td className="px-3 py-2 text-right">{item.quantityAvailable.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-right">{item.batchRemainingQty.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-right">{item.defaultWarehouseQty.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-right">{item.deltaBatch.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-right">{item.deltaWarehouse.toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                          item.severity === 'OK'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.severity === 'WARNING'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}>
                          {item.severity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Sản phẩm</th>
                <th className="px-4 py-3 text-right font-medium">Tồn khả dụng</th>
                <th className="px-4 py-3 text-right font-medium">Đang giữ</th>
                <th className="px-4 py-3 text-right font-medium">Tổng SL</th>
                <th className="px-4 py-3 text-right font-medium">Giá vốn TB</th>
                <th className="px-4 py-3 text-right font-medium">Giá bán</th>
                <th className="px-4 py-3 text-right font-medium">
                  Giá trị tồn
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Lãi tiềm năng
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-on-surface-variant"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-on-surface-variant"
                  >
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr
                    key={it.productId}
                    className="hover:bg-surface-variant/40"
                  >
                    <td className="px-4 py-2.5 font-medium max-w-[260px] truncate">
                      {it.productName}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {it.qtyAvailable.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">
                      {it.qtyReserved.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {it.totalQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmt(it.avgCost)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">
                      {fmt(it.retailPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700">
                      {fmt(it.totalValue)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${
                        it.potentialProfit >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {fmt(it.potentialProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
