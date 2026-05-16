import { useEffect, useState } from 'react';
import { Package, RefreshCw, X, Check, AlertTriangle, Truck } from 'lucide-react';
import { apiClient } from '../../../lib/api';

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'inspected' | 'refunded';
type InspectionStatus = 'pending' | 'usable' | 'damaged' | 'return_to_supplier';

interface ReturnRequest {
  returnId: string;
  orderId: string;
  orderItemId: string;
  userId: string;
  reason: string;
  description: string | null;
  returnStatus: ReturnStatus;
  inspectionStatus: InspectionStatus;
  inspectionNote: string | null;
  inspectedBy: string | null;
  inspectedAt: string | null;
  refundAmount: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Yêu cầu',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  received: 'Đã nhận hàng',
  inspected: 'Đã kiểm tra',
  refunded: 'Đã hoàn tiền',
};

const INSPECTION_LABELS: Record<InspectionStatus, string> = {
  pending: 'Chờ kiểm tra',
  usable: 'Dùng được',
  damaged: 'Hỏng',
  return_to_supplier: 'Trả NCC',
};

export default function ReturnsAdminPage() {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspectModal, setInspectModal] = useState<ReturnRequest | null>(null);
  const [inspectDecision, setInspectDecision] =
    useState<InspectionStatus>('usable');
  const [inspectNote, setInspectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<ReturnRequest[]>('/returns/admin');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openInspect = (r: ReturnRequest) => {
    setInspectModal(r);
    setInspectDecision('usable');
    setInspectNote('');
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  // Chuyển status return: REQUESTED→APPROVED/REJECTED, APPROVED→RECEIVED, RECEIVED→REFUNDED...
  const transitionStatus = async (returnId: string, nextStatus: ReturnStatus, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(returnId);
    try {
      await apiClient.patch(`/returns/${returnId}/status`, { status: nextStatus });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không cập nhật được trạng thái');
    } finally {
      setBusyId(null);
    }
  };

  const handleInspect = async () => {
    if (!inspectModal) return;
    if (inspectDecision === 'pending') return;
    setSubmitting(true);
    try {
      await apiClient.patch(`/returns/${inspectModal.returnId}/inspect`, {
        decision: inspectDecision,
        note: inspectNote || undefined,
      });
      setInspectModal(null);
      await load();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Không thể inspect return — kiểm tra log',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inspectionToneCls = (s: InspectionStatus) => {
    if (s === 'usable') return 'bg-emerald-100 text-emerald-700';
    if (s === 'damaged') return 'bg-red-100 text-red-700';
    if (s === 'return_to_supplier') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-on-surface">Quản Lý Trả Hàng</h1>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Làm mới
        </button>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Return ID</th>
                <th className="px-4 py-3 text-left font-medium">Order ID</th>
                <th className="px-4 py-3 text-left font-medium">Lý do</th>
                <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-left font-medium">Inspect</th>
                <th className="px-4 py-3 text-left font-medium">Ngày</th>
                <th className="px-4 py-3 text-right font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    Chưa có yêu cầu trả hàng
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.returnId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.returnId}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {r.orderId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate">{r.reason}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STATUS_LABELS[r.returnStatus] ?? r.returnStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${inspectionToneCls(
                          r.inspectionStatus,
                        )}`}
                      >
                        {INSPECTION_LABELS[r.inspectionStatus] ?? r.inspectionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-on-surface-variant">
                      {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {r.returnStatus === 'requested' && (
                          <>
                            <button
                              onClick={() => void transitionStatus(r.returnId, 'approved', `Duyệt yêu cầu trả ${r.returnId}?`)}
                              disabled={busyId === r.returnId}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => void transitionStatus(r.returnId, 'rejected', `Từ chối yêu cầu trả ${r.returnId}?`)}
                              disabled={busyId === r.returnId}
                              className="rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                        {r.returnStatus === 'approved' && (
                          <button
                            onClick={() => void transitionStatus(r.returnId, 'received', `Xác nhận đã nhận hàng trả ${r.returnId} về kho?`)}
                            disabled={busyId === r.returnId}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Đã nhận hàng trả
                          </button>
                        )}
                        {r.returnStatus === 'received' && r.inspectionStatus === 'pending' && (
                          <button
                            onClick={() => openInspect(r)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                          >
                            Kiểm tra
                          </button>
                        )}
                        {r.returnStatus === 'inspected' && (
                          <button
                            onClick={() => void transitionStatus(r.returnId, 'refunded', `Đánh dấu đã hoàn tiền cho ${r.returnId}?`)}
                            disabled={busyId === r.returnId}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Hoàn tiền
                          </button>
                        )}
                        {(r.returnStatus === 'rejected' || r.returnStatus === 'refunded' ||
                          (r.returnStatus === 'received' && r.inspectionStatus !== 'pending')) && (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Kiểm tra hàng trả về</h2>
              <button
                onClick={() => setInspectModal(null)}
                className="rounded-lg p-1.5 hover:bg-surface-variant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-surface-variant p-3 text-xs">
              <div>Return ID: <span className="font-mono">{inspectModal.returnId}</span></div>
              <div>Order ID: <span className="font-mono">{inspectModal.orderId}</span></div>
              <div className="mt-1">Lý do: {inspectModal.reason}</div>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-sm font-semibold">Quyết định:</p>
              {(
                [
                  {
                    val: 'usable' as InspectionStatus,
                    label: 'Dùng được — Nhập lại kho chính',
                    icon: Check,
                    color: 'emerald',
                  },
                  {
                    val: 'damaged' as InspectionStatus,
                    label: 'Hỏng — Ghi nhận loss, KHÔNG nhập kho',
                    icon: AlertTriangle,
                    color: 'red',
                  },
                  {
                    val: 'return_to_supplier' as InspectionStatus,
                    label: 'Trả NCC — Cần tạo Supplier Return riêng',
                    icon: Truck,
                    color: 'amber',
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.val}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
                    inspectDecision === opt.val
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-surface-variant hover:border-primary/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={opt.val}
                    checked={inspectDecision === opt.val}
                    onChange={() => setInspectDecision(opt.val)}
                    className="h-4 w-4 accent-primary"
                  />
                  <opt.icon
                    className={`h-4 w-4 ${
                      opt.color === 'emerald'
                        ? 'text-emerald-600'
                        : opt.color === 'red'
                          ? 'text-red-600'
                          : 'text-amber-600'
                    }`}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-on-surface-variant">
                Ghi chú (tùy chọn):
              </label>
              <textarea
                rows={2}
                value={inspectNote}
                onChange={(e) => setInspectNote(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                placeholder="VD: Bao bì rách, sản phẩm còn nguyên..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setInspectModal(null)}
                className="flex-1 rounded-lg border border-outline-variant py-2 text-sm font-semibold text-on-surface hover:bg-surface-variant"
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                onClick={() => void handleInspect()}
                disabled={submitting}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
