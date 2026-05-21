import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, DollarSign, X } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface AgingDebtItem {
  poId: string;
  poCode: string;
  supplierId: string;
  orderDate: string | null;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  status: string;
  diffDays?: number;
  outstanding?: number;
  createdAt: string;
}

interface AgingSummary {
  asOf: string;
  totalPos: number;
  totalOutstanding: number;
  buckets: Record<string, { count: number; total: number }>;
}

interface AgingResponse {
  summary: AgingSummary;
  items: AgingDebtItem[];
}

interface Supplier {
  supplierId: string;
  name: string;
  code?: string | null;
}

const BUCKET_LABELS: Record<string, { label: string; color: string; bar: string }> = {
  current:   { label: 'Hiện tại',   color: 'text-green-600', bar: 'bg-green-500' },
  days1_7:   { label: '1–7 ngày',   color: 'text-blue-600',  bar: 'bg-blue-500' },
  days8_30:  { label: '8–30 ngày',  color: 'text-yellow-600', bar: 'bg-yellow-500' },
  days31_60: { label: '31–60 ngày', color: 'text-orange-600', bar: 'bg-orange-500' },
  days61_90: { label: '61–90 ngày', color: 'text-red-500',   bar: 'bg-red-500' },
  over90:    { label: '>90 ngày',   color: 'text-red-700',   bar: 'bg-red-700' },
};

export default function AgingDebtPage() {
  const [data, setData] = useState<AgingResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [asOf, setAsOf] = useState('');
  const [payingPo, setPayingPo] = useState<AgingDebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (asOf) params.set('asOf', asOf);
      if (filterSupplierId) params.set('supplierId', filterSupplierId);
      const d = await apiClient.get<AgingResponse>(`/reports/aging-debt?${params.toString()}`);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf, filterSupplierId]);

  useEffect(() => {
    void apiClient.get<{ items: Supplier[] }>('/suppliers?limit=500&status=active').then((d) => setSuppliers(d.items ?? []));
    void load();
  }, [load]);

  const fmt = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  const handleRecordPayment = async () => {
    if (!payingPo || !payAmount) return;
    setPaying(true);
    try {
      await apiClient.post('/reports/record-po-payment', {
        poId: payingPo.poId,
        amount: payAmount,
        notes: payNotes || undefined,
      });
      setPayingPo(null);
      setPayAmount('');
      setPayNotes('');
      void load();
    } catch {
      // ignore
    } finally {
      setPaying(false);
    }
  };

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-500" />
        <h1 className="text-xl font-bold text-on-surface">Báo Cáo Tuổi Nợ NCC</h1>
        {summary && (
          <span className="ml-auto text-sm text-on-surface-variant">
            Tính đến: <strong>{summary.asOf}</strong>
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Nhà cung cấp</label>
            <select className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary" value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)}>
              <option value="">Tất cả NCC</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}{s.code ? ` (${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Tính đến ngày</label>
            <input type="date" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
            <RefreshCw className="h-3.5 w-3.5" /> Tải lại
          </button>
        </div>
      </div>

      {/* Aging buckets */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(BUCKET_LABELS).map(([key, cfg]) => {
            const bucket = summary.buckets[key];
            return (
              <div key={key} className="rounded-xl border border-outline-variant bg-surface p-3 text-center">
                <div className={`h-1.5 w-full rounded-full mb-2 ${cfg.bar}`} />
                <p className="text-xs text-on-surface-variant">{cfg.label}</p>
                <p className={`text-base font-bold ${cfg.color}`}>{fmt(bucket?.total ?? 0)}</p>
                <p className="text-xs text-on-surface-variant">{bucket?.count ?? 0} PO</p>
              </div>
            );
          })}
        </div>
      )}

      {summary && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-4">
          <DollarSign className="h-8 w-8 text-orange-500 shrink-0" />
          <div>
            <p className="text-sm text-orange-700">Tổng công nợ chưa thanh toán</p>
            <p className="text-2xl font-bold text-orange-800">{fmt(summary.totalOutstanding)}</p>
          </div>
          <span className="ml-auto text-sm text-orange-600">{summary.totalPos} đơn đặt hàng</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Mã PO</th>
                <th className="px-4 py-3 text-left font-medium">NCC</th>
                <th className="px-4 py-3 text-left font-medium">Ngày đặt</th>
                <th className="px-4 py-3 text-right font-medium">Tổng tiền</th>
                <th className="px-4 py-3 text-right font-medium">Đã trả</th>
                <th className="px-4 py-3 text-right font-medium">Còn nợ</th>
                <th className="px-4 py-3 text-center font-medium">Tuổi nợ</th>
                <th className="px-4 py-3 text-center font-medium">TT thanh toán</th>
                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-on-surface-variant">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-on-surface-variant">Không có công nợ</td></tr>
              ) : items.map((po) => {
                const outstanding = po.outstanding ?? (Number(po.totalAmount) - Number(po.paidAmount));
                const diffDays = po.diffDays ?? 0;
                const ageColor = diffDays > 90 ? 'text-red-700 font-bold' : diffDays > 60 ? 'text-red-500' : diffDays > 30 ? 'text-orange-500' : 'text-on-surface-variant';
                const supplier = suppliers.find((s) => s.supplierId === po.supplierId);
                return (
                  <tr key={po.poId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{po.poCode}</td>
                    <td className="px-4 py-2.5 text-on-surface">{supplier?.name ?? po.supplierId}</td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant">
                      {po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmt(Number(po.totalAmount))}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{fmt(Number(po.paidAmount))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">{fmt(outstanding)}</td>
                    <td className={`px-4 py-2.5 text-center text-xs ${ageColor}`}>{diffDays} ngày</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        po.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                        po.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {po.paymentStatus === 'paid' ? 'Đã trả' : po.paymentStatus === 'partial' ? 'Một phần' : 'Chưa trả'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {po.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => { setPayingPo(po); setPayAmount(String(outstanding)); }}
                          className="rounded-lg bg-primary px-2.5 py-1 text-xs text-white hover:bg-primary/90"
                        >
                          Ghi thanh toán
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record payment modal */}
      {payingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-on-surface">Ghi thanh toán — {payingPo.poCode}</h3>
              <button onClick={() => setPayingPo(null)} className="rounded-lg p-1.5 hover:bg-surface-variant"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-on-surface-variant">Còn nợ: <strong className="text-red-600">
                  {(payingPo.outstanding ?? (Number(payingPo.totalAmount) - Number(payingPo.paidAmount))).toLocaleString('vi-VN')}₫
                </strong></p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Số tiền thanh toán (₫)</label>
                <input type="number" min="0" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Ghi chú</label>
                <input type="text" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Tùy chọn" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setPayingPo(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-variant">Hủy</button>
                <button onClick={() => void handleRecordPayment()} disabled={paying || !payAmount} className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-60">
                  {paying ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
