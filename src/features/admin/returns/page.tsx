import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { showToast } from '../../../lib/toast-store';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'inspected' | 'refunded';
type InspectionStatus = 'pending' | 'usable' | 'damaged' | 'return_to_supplier';

interface ReturnRequest {
  returnId: string;
  orderId: string;
  orderCode?: string | null;
  orderItemId: string;
  productId?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  orderedQuantity?: number | null;
  deliveredQuantity?: number | null;
  returnQuantity: number;
  userId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reason: string;
  reasonLabel?: string | null;
  description: string | null;
  returnStatus: ReturnStatus;
  statusLabel?: string | null;
  inspectionStatus: InspectionStatus;
  inspectionStatusLabel?: string | null;
  inspectionNote: string | null;
  inspectedBy: string | null;
  inspectedAt: string | null;
  refundAmount: string | null;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Đã gửi yêu cầu',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  received: 'Đã nhận hàng trả',
  inspected: 'Đã kiểm tra hàng',
  refunded: 'Đã hoàn tiền',
};

const INSPECTION_LABELS: Record<InspectionStatus, string> = {
  pending: 'Chờ kiểm tra',
  usable: 'Dùng được',
  damaged: 'Hỏng',
  return_to_supplier: 'Trả nhà cung cấp',
};

const REASON_LABELS: Record<string, string> = {
  wrong_item: 'Sai hàng',
  damaged: 'Hàng lỗi/hỏng',
  defective: 'Hàng lỗi/hỏng',
  not_as_described: 'Không đúng mô tả',
  change_mind: 'Đổi ý',
  other: 'Lý do khác',
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function statusTone(status: ReturnStatus) {
  if (status === 'refunded') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'approved' || status === 'received') return 'bg-blue-100 text-blue-700';
  if (status === 'inspected') return 'bg-violet-100 text-violet-700';
  return 'bg-amber-100 text-amber-700';
}

function inspectionTone(status: InspectionStatus) {
  if (status === 'usable') return 'bg-emerald-100 text-emerald-700';
  if (status === 'damaged') return 'bg-red-100 text-red-700';
  if (status === 'return_to_supplier') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : '-';
}

function getReasonLabel(item: ReturnRequest) {
  return item.reasonLabel || REASON_LABELS[item.reason] || item.reason || 'Lý do khác';
}

function getStatusLabel(item: ReturnRequest) {
  return item.statusLabel || STATUS_LABELS[item.returnStatus] || item.returnStatus;
}

function getInspectionLabel(item: ReturnRequest) {
  return item.inspectionStatusLabel || INSPECTION_LABELS[item.inspectionStatus] || item.inspectionStatus;
}

export default function ReturnsAdminPage() {
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReturnStatus>('all');
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [inspectModal, setInspectModal] = useState<ReturnRequest | null>(null);
  const [inspectDecision, setInspectDecision] = useState<InspectionStatus>('usable');
  const [inspectNote, setInspectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<ReturnRequest[] | { items: ReturnRequest[] }>('/returns/admin');
      setItems(Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      showToast({
        tone: 'error',
        title: 'Không tải được yêu cầu trả hàng',
        description: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.returnStatus !== statusFilter) return false;
      if (!normalized) return true;
      return [
        String(item.returnId),
        item.orderId,
        item.orderCode,
        item.productName,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        getReasonLabel(item),
        item.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [items, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      waiting: items.filter((item) => item.returnStatus === 'requested' || item.returnStatus === 'approved').length,
      inspecting: items.filter((item) => item.returnStatus === 'received' || item.returnStatus === 'inspected').length,
      refunded: items.filter((item) => item.returnStatus === 'refunded').length,
    };
  }, [items]);

  const transitionStatus = async (returnId: string, nextStatus: ReturnStatus, confirmMsg?: string) => {
    if (confirmMsg) {
      const ok = await askConfirm({
        title: 'Xác nhận cập nhật trả hàng',
        description: confirmMsg,
        tone: nextStatus === 'rejected' ? 'danger' : 'warning',
        confirmLabel: nextStatus === 'rejected' ? 'Từ chối' : 'Xác nhận',
      });
      if (!ok) return;
    }
    setBusyId(returnId);
    try {
      await apiClient.patch(`/returns/${returnId}/status`, { status: nextStatus });
      showToast({ tone: 'success', title: 'Đã cập nhật yêu cầu trả hàng' });
      await load();
      setSelected((current) => (current?.returnId === returnId ? null : current));
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Không cập nhật được trạng thái',
        description: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openInspect = (item: ReturnRequest) => {
    setInspectModal(item);
    setInspectDecision('usable');
    setInspectNote(item.inspectionNote ?? '');
  };

  const handleInspect = async () => {
    if (!inspectModal || inspectDecision === 'pending') return;
    setSubmitting(true);
    try {
      await apiClient.patch(`/returns/${inspectModal.returnId}/inspect`, {
        decision: inspectDecision,
        note: inspectNote || undefined,
      });
      showToast({ tone: 'success', title: 'Đã ghi nhận kết quả kiểm tra hàng' });
      setInspectModal(null);
      setSelected(null);
      await load();
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Không thể kiểm tra hàng trả',
        description: err instanceof Error ? err.message : 'Vui lòng kiểm tra lại.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderActions = (item: ReturnRequest) => (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        onClick={() => setSelected(item)}
        className="inline-flex items-center gap-1 rounded-full border border-primary/25 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
      >
        <Eye size={13} /> Chi tiết
      </button>
      {item.returnStatus === 'requested' && (
        <>
          <button
            onClick={() => void transitionStatus(item.returnId, 'approved', `Duyệt yêu cầu #${item.returnId}?`)}
            disabled={busyId === item.returnId}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Duyệt
          </button>
          <button
            onClick={() => void transitionStatus(item.returnId, 'rejected', `Từ chối yêu cầu #${item.returnId}?`)}
            disabled={busyId === item.returnId}
            className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Từ chối
          </button>
        </>
      )}
      {item.returnStatus === 'approved' && (
        <button
          onClick={() => void transitionStatus(item.returnId, 'received', `Xác nhận đã nhận hàng trả #${item.returnId}?`)}
          disabled={busyId === item.returnId}
          className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Đã nhận hàng trả
        </button>
      )}
      {item.returnStatus === 'received' && item.inspectionStatus === 'pending' && (
        <button
          onClick={() => openInspect(item)}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
        >
          Kiểm tra
        </button>
      )}
      {item.returnStatus === 'inspected' && (
        <button
          onClick={() => void transitionStatus(item.returnId, 'refunded', `Đánh dấu đã hoàn tiền cho #${item.returnId}?`)}
          disabled={busyId === item.returnId}
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Hoàn tiền
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-black text-on-surface">Quản lý trả hàng</h1>
            <p className="text-sm text-on-surface-variant">Duyệt, nhận hàng, kiểm tra và hoàn tiền yêu cầu trả hàng.</p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" /> Làm mới
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['Tổng yêu cầu', stats.total],
          ['Chờ xử lý', stats.waiting],
          ['Đang kiểm tra', stats.inspecting],
          ['Đã hoàn tiền', stats.refunded],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-outline-variant bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
            <p className="mt-2 text-2xl font-black text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã yêu cầu, mã đơn, khách hàng, sản phẩm..."
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface pl-11 pr-4 text-sm outline-none focus:border-primary"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReturnStatus)}
            className="h-12 rounded-xl border border-outline-variant bg-surface px-4 text-sm outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-b border-outline-variant bg-surface-variant/50 text-left text-[11px] uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-5 py-4">Yêu cầu</th>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4">Khách hàng</th>
                <th className="px-5 py-4">SL trả</th>
                <th className="px-5 py-4">Lý do</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Kiểm tra</th>
                <th className="px-5 py-4">Hoàn tiền</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-on-surface-variant">
                    <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Đang tải yêu cầu trả hàng...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-on-surface-variant">
                    Không có yêu cầu trả hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.returnId} className="align-top hover:bg-surface-variant/35">
                    <td className="px-5 py-4">
                      <div className="font-black text-on-surface">#{item.returnId}</div>
                      <div className="mt-1 text-xs text-on-surface-variant">Đơn #{item.orderCode || shortId(item.orderId)}</div>
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-on-surface-variant">
                        <CalendarClock size={13} />
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-64 gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-[#f7f5ef] p-1">
                          {item.productImageUrl ? (
                            <img src={item.productImageUrl} alt={item.productName || 'Sản phẩm'} className="h-full w-full object-contain" />
                          ) : (
                            <Package size={22} className="text-primary/45" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface">{item.productName || 'Sản phẩm đã xóa'}</div>
                          <div className="mt-1 text-xs text-on-surface-variant">
                            Đã mua: {item.orderedQuantity ?? '-'} · Đã giao: {item.deliveredQuantity ?? item.orderedQuantity ?? '-'}
                          </div>
                          {item.description ? (
                            <div className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{item.description}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-on-surface">{item.customerName || '-'}</div>
                      <div className="text-xs text-on-surface-variant">{item.customerPhone || item.customerEmail || '-'}</div>
                    </td>
                    <td className="px-5 py-4 font-black">{item.returnQuantity}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-surface-variant px-3 py-1 text-xs font-bold text-on-surface">{getReasonLabel(item)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(item.returnStatus)}`}>
                        {getStatusLabel(item)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${inspectionTone(item.inspectionStatus)}`}>
                        {getInspectionLabel(item)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-primary">
                      {item.refundAmount ? currency.format(Number(item.refundAmount)) : 'Chưa hoàn'}
                    </td>
                    <td className="px-5 py-4 text-right">{renderActions(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Chi tiết trả hàng</p>
                <h2 className="mt-1 text-2xl font-black text-on-surface">Yêu cầu #{selected.returnId}</h2>
                <p className="text-sm text-on-surface-variant">Đơn #{selected.orderCode || shortId(selected.orderId)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full border border-outline-variant p-2 hover:bg-surface-variant">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4">
              <section className="rounded-2xl border border-outline-variant p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant">Sản phẩm trả hàng</p>
                <div className="flex gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-[#f7f5ef] p-2">
                    {selected.productImageUrl ? (
                      <img src={selected.productImageUrl} alt={selected.productName || 'Sản phẩm'} className="h-full w-full object-contain" />
                    ) : (
                      <Package size={28} className="text-primary/45" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-on-surface">{selected.productName || 'Sản phẩm đã xóa'}</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">Số lượng trả: <b>{selected.returnQuantity}</b></p>
                    <p className="text-sm text-on-surface-variant">Số lượng mua/giao: {selected.orderedQuantity ?? '-'} / {selected.deliveredQuantity ?? selected.orderedQuantity ?? '-'}</p>
                    <p className="mt-2 text-sm"><b>Lý do:</b> {getReasonLabel(selected)}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{selected.description || 'Không có mô tả thêm.'}</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Khách hàng</p>
                  <p className="mt-2 font-bold">{selected.customerName || '-'}</p>
                  <p className="text-sm text-on-surface-variant">{selected.customerPhone || '-'}</p>
                  <p className="text-sm text-on-surface-variant">{selected.customerEmail || '-'}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Trạng thái xử lý</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(selected.returnStatus)}`}>{getStatusLabel(selected)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${inspectionTone(selected.inspectionStatus)}`}>{getInspectionLabel(selected)}</span>
                  </div>
                  <p className="mt-3 text-sm text-on-surface-variant">Tiền hoàn: <b>{selected.refundAmount ? currency.format(Number(selected.refundAmount)) : 'Chưa hoàn'}</b></p>
                  {selected.inspectionNote ? <p className="mt-1 text-sm text-on-surface-variant">Ghi chú kiểm tra: {selected.inspectionNote}</p> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-outline-variant p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant">Thao tác nghiệp vụ</p>
                {renderActions(selected)}
              </section>
            </div>
          </aside>
        </div>
      )}

      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Kiểm tra hàng trả về</h2>
              <button onClick={() => setInspectModal(null)} className="rounded-full p-2 hover:bg-surface-variant">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-surface-variant p-3 text-sm">
              <div className="font-bold">{inspectModal.productName || 'Sản phẩm đã xóa'}</div>
              <div className="mt-1 text-on-surface-variant">Yêu cầu #{inspectModal.returnId} · Đơn #{inspectModal.orderCode || shortId(inspectModal.orderId)}</div>
              <div className="mt-1 text-on-surface-variant">Lý do: {getReasonLabel(inspectModal)}</div>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-sm font-bold">Quyết định kiểm tra:</p>
              {[
                { val: 'usable' as InspectionStatus, label: 'Dùng được - nhập lại kho bán', icon: Check, tone: 'text-emerald-600' },
                { val: 'damaged' as InspectionStatus, label: 'Hỏng - ghi nhận tổn thất, không nhập kho', icon: AlertTriangle, tone: 'text-red-600' },
                { val: 'return_to_supplier' as InspectionStatus, label: 'Trả nhà cung cấp - không nhập kho bán', icon: Truck, tone: 'text-amber-600' },
              ].map((option) => (
                <label
                  key={option.val}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${
                    inspectDecision === option.val ? 'border-primary bg-primary/5' : 'border-transparent bg-surface-variant hover:border-primary/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option.val}
                    checked={inspectDecision === option.val}
                    onChange={() => setInspectDecision(option.val)}
                    className="h-4 w-4 accent-primary"
                  />
                  <option.icon className={`h-4 w-4 ${option.tone}`} />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Ghi chú kiểm tra</span>
              <textarea
                rows={3}
                value={inspectNote}
                onChange={(event) => setInspectNote(event.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Ví dụ: bao bì còn nguyên, sản phẩm hỏng do vận chuyển..."
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setInspectModal(null)}
                className="flex-1 rounded-xl border border-outline-variant py-2 text-sm font-bold hover:bg-surface-variant"
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                onClick={() => void handleInspect()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
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
