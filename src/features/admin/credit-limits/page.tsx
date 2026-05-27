import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { hasAdminPermission } from '../../../lib/admin-session';

type DebtStatus = 'all' | 'outstanding' | 'near_limit' | 'over_limit';

interface CreditLimitItem {
  limitId: string;
  userId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  usagePct: number;
  debtStatus: string;
  paymentTerms: number;
  notes: string | null;
  updatedAt: string;
}

interface UserOption {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
}

interface CreditOrder {
  orderId: string;
  code: string;
  orderStatus: string;
  paymentStatus: string;
  totalPayment: number;
  paidByCredit: number;
  outstanding: number;
  createdAt: string;
  dueDate: string;
  isOverdue: boolean;
}

interface CreditTransaction {
  transactionId: string;
  orderId: string | null;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceNo: string | null;
  note: string | null;
  createdAt: string;
}

interface CreditDetail {
  creditLimit: CreditLimitItem;
  summary: {
    creditLimit: number;
    currentDebt: number;
    availableCredit: number;
    usagePct: number;
    paymentTerms: number;
    overdueOrders: number;
  };
  orders: { items: CreditOrder[] };
  transactions: { items: CreditTransaction[] };
}

const EMPTY_FORM = { userId: '', creditLimit: '', notes: '' };
const EMPTY_PAYMENT = { userId: '', userName: '', amount: '', referenceNo: '', notes: '' };

const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const dateText = (value?: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '-');

function debtTone(item: Pick<CreditLimitItem, 'debtStatus' | 'currentDebt'>) {
  if (item.debtStatus === 'over_limit') return 'bg-red-100 text-red-700';
  if (item.debtStatus === 'near_limit') return 'bg-yellow-100 text-yellow-700';
  if (item.currentDebt > 0) return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700';
}

function debtLabel(item: Pick<CreditLimitItem, 'debtStatus' | 'currentDebt'>) {
  if (item.debtStatus === 'over_limit') return 'Vượt hạn mức';
  if (item.debtStatus === 'near_limit') return 'Gần hết hạn mức';
  if (item.currentDebt > 0) return 'Đang nợ';
  return 'Không nợ';
}

function txTypeLabel(type: string) {
  if (type === 'payment_received') return 'Thu tiền';
  if (type === 'order_payment_allocated') return 'Phân bổ vào đơn';
  if (type === 'sync_adjustment') return 'Đối soát';
  return type;
}

export default function CreditLimitsPage() {
  const [items, setItems] = useState<CreditLimitItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debtStatus, setDebtStatus] = useState<DebtStatus>('all');

  const [users, setUsers] = useState<UserOption[]>([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitForm, setLimitForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CreditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManagePayments = hasAdminPermission('manage_payments');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(meta.page),
        limit: String(meta.limit),
        debtStatus,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await apiClient.get<{ items: CreditLimitItem[]; meta: typeof meta }>(`/credit-limits?${params.toString()}`);
      setItems(data.items ?? []);
      setMeta((prev) => ({ ...prev, ...(data.meta ?? {}) }));
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Không tải được danh sách hạn mức công nợ.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, debtStatus, meta.limit, meta.page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiClient.get<UserOption[]>('/credit-limits/customers').then((data) => setUsers(Array.isArray(data) ? data : []));
  }, []);

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.totalLimit += Number(item.creditLimit);
        acc.totalDebt += Number(item.currentDebt);
        acc.totalAvailable += Number(item.availableCredit);
        return acc;
      },
      { totalLimit: 0, totalDebt: 0, totalAvailable: 0 },
    );
  }, [items]);

  const openAddModal = () => {
    setLimitForm(EMPTY_FORM);
    setShowLimitModal(true);
  };

  const openEditModal = (item: CreditLimitItem) => {
    setLimitForm({ userId: item.userId, creditLimit: String(item.creditLimit), notes: item.notes ?? '' });
    setShowLimitModal(true);
  };

  const openPaymentModal = (item: CreditLimitItem) => {
    if (!canManagePayments || item.currentDebt <= 0) return;
    setPaymentForm({
      userId: item.userId,
      userName: item.fullName ?? item.username ?? item.email ?? '',
      amount: String(item.currentDebt),
      referenceNo: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const openDetail = async (userId: string) => {
    setDetailUserId(userId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await apiClient.get<CreditDetail>(`/credit-limits/user/${userId}/detail`);
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveLimit = async () => {
    if (!limitForm.userId || Number(limitForm.creditLimit) < 0) return;
    setSaving(true);
    try {
      await apiClient.post('/credit-limits', {
        userId: limitForm.userId,
        creditLimit: Number(limitForm.creditLimit),
        notes: limitForm.notes || undefined,
      });
      setShowLimitModal(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!paymentForm.userId || Number(paymentForm.amount) <= 0) return;
    setPaymentSaving(true);
    try {
      const result = await apiClient.post<CreditDetail>('/credit-limits/record-payment', {
        userId: paymentForm.userId,
        amount: Number(paymentForm.amount),
        referenceNo: paymentForm.referenceNo || undefined,
        notes: paymentForm.notes || undefined,
        allocationMode: 'oldest_first',
      });
      setShowPaymentModal(false);
      if (detailUserId === paymentForm.userId) setDetail(result);
      void load();
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSync = async (userId: string) => {
    setSyncingId(userId);
    try {
      await apiClient.post(`/credit-limits/sync-debt/${userId}`, {});
      if (detailUserId === userId) void openDetail(userId);
      void load();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Vô hiệu hạn mức công nợ của khách hàng này?')) return;
    await apiClient.delete(`/credit-limits/user/${userId}`);
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-on-surface">Hạn Mức Công Nợ Khách Sỉ</h1>
            <p className="text-sm text-on-surface-variant">Quản lý hạn mức, công nợ, thu tiền và đối soát khách mua công nợ.</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-variant">
            <RefreshCw className="h-4 w-4" /> Làm mới
          </button>
          <button onClick={openAddModal} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Thêm hạn mức
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Công nợ tăng khi khách sỉ đặt đơn thanh toán công nợ, giảm khi thu tiền, hủy đơn hoặc hoàn tiền. Mọi thao tác thu tiền/đối soát được ghi vào ledger để kiểm tra lại.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Khách có hạn mức" value={meta.total.toLocaleString('vi-VN')} />
        <Stat icon={<CreditCard className="h-4 w-4" />} label="Tổng hạn mức" value={fmt(stats.totalLimit)} tone="text-primary" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Đang nợ" value={fmt(stats.totalDebt)} tone="text-red-600" />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Còn khả dụng" value={fmt(stats.totalAvailable)} tone="text-green-600" />
      </div>

      <div className="grid gap-3 rounded-xl border border-outline-variant bg-surface p-3 lg:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="Tìm khách hàng theo tên, email, username..."
            className="w-full rounded-lg border border-outline-variant bg-surface pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={debtStatus}
          onChange={(e) => {
            setDebtStatus(e.target.value as DebtStatus);
            setMeta((prev) => ({ ...prev, page: 1 }));
          }}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="outstanding">Đang nợ</option>
          <option value="near_limit">Gần hết hạn mức</option>
          <option value="over_limit">Vượt hạn mức</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Khách hàng</th>
                <th className="px-4 py-3 text-right font-semibold">Hạn mức</th>
                <th className="px-4 py-3 text-right font-semibold">Đang nợ</th>
                <th className="px-4 py-3 text-right font-semibold">Còn lại</th>
                <th className="px-4 py-3 text-center font-semibold">Sử dụng</th>
                <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-on-surface-variant">Đang tải dữ liệu...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="py-12 text-center text-red-600">{error}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-on-surface-variant">Không có khách hàng phù hợp.</td></tr>
              ) : items.map((item) => (
                <tr key={item.limitId} className="hover:bg-surface-variant/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-on-surface">{item.fullName ?? item.username ?? item.email}</p>
                    <p className="text-xs text-on-surface-variant">{item.email}</p>
                    {item.notes ? <p className="mt-1 line-clamp-1 text-xs italic text-on-surface-variant">{item.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(item.creditLimit)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(item.currentDebt)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${item.availableCredit <= 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(item.availableCredit)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-variant">
                        <div
                          className={`h-full rounded-full ${item.usagePct >= 100 ? 'bg-red-500' : item.usagePct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, item.usagePct)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-bold">{item.usagePct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${debtTone(item)}`}>{debtLabel(item)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => void openDetail(item.userId)} className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-bold hover:bg-surface-variant">
                        <Eye className="mr-1 inline h-3.5 w-3.5" /> Chi tiết
                      </button>
                      {canManagePayments && item.currentDebt > 0 ? (
                        <button onClick={() => openPaymentModal(item)} className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700 hover:bg-green-100">
                          Thu tiền
                        </button>
                      ) : null}
                      <button onClick={() => openEditModal(item)} className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20">Sửa</button>
                      <button onClick={() => void handleSync(item.userId)} disabled={syncingId === item.userId} className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-bold hover:bg-surface-variant disabled:opacity-50">
                        {syncingId === item.userId ? '...' : 'Sync'}
                      </button>
                      <button onClick={() => void handleDelete(item.userId)} className="rounded-lg p-1 text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-outline-variant p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-on-surface-variant">Tổng {meta.total} khách hàng</span>
          <div className="flex items-center gap-2">
            <select value={meta.limit} onChange={(e) => setMeta((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))} className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5">
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/trang</option>)}
            </select>
            <button disabled={meta.page <= 1} onClick={() => setMeta((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} className="rounded-lg border border-outline-variant p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-bold">Trang {meta.page}/{Math.max(1, meta.totalPages)}</span>
            <button disabled={meta.page >= meta.totalPages} onClick={() => setMeta((prev) => ({ ...prev, page: prev.page + 1 }))} className="rounded-lg border border-outline-variant p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {showLimitModal && (
        <Modal title={limitForm.userId && items.some((item) => item.userId === limitForm.userId) ? 'Chỉnh hạn mức công nợ' : 'Thêm hạn mức công nợ'} onClose={() => setShowLimitModal(false)}>
          <div className="space-y-3">
            <Field label="Khách hàng">
              <select
                value={limitForm.userId}
                disabled={items.some((item) => item.userId === limitForm.userId)}
                onChange={(e) => setLimitForm((prev) => ({ ...prev, userId: e.target.value }))}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="">Chọn khách hàng</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>{user.fullName ?? user.username} ({user.email})</option>
                ))}
              </select>
            </Field>
            <Field label="Hạn mức công nợ">
              <input type="number" min="0" value={limitForm.creditLimit} onChange={(e) => setLimitForm((prev) => ({ ...prev, creditLimit: e.target.value }))} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
            </Field>
            <Field label="Ghi chú">
              <input value={limitForm.notes} onChange={(e) => setLimitForm((prev) => ({ ...prev, notes: e.target.value }))} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowLimitModal(false)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm">Hủy</button>
              <button onClick={() => void handleSaveLimit()} disabled={saving || !limitForm.userId || !limitForm.creditLimit} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title="Thu tiền công nợ" onClose={() => setShowPaymentModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">Khách hàng: <strong className="text-on-surface">{paymentForm.userName}</strong></p>
            <Field label="Số tiền thu">
              <input type="number" min="1" value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" autoFocus />
            </Field>
            <Field label="Mã chứng từ / tham chiếu">
              <input value={paymentForm.referenceNo} onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNo: e.target.value }))} placeholder="VD: CK-2705-001, PC001..." className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
            </Field>
            <Field label="Ghi chú">
              <input value={paymentForm.notes} onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Nội dung thu tiền, ngân hàng, người nhận..." className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
            </Field>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Hệ thống phân bổ tiền thu vào các đơn công nợ cũ trước và ghi ledger đối soát.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm">Hủy</button>
              <button onClick={() => void handleSavePayment()} disabled={paymentSaving || Number(paymentForm.amount) <= 0} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {paymentSaving ? 'Đang lưu...' : 'Xác nhận thu tiền'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {(detailUserId || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <aside className="h-full w-full max-w-4xl overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-on-surface">Chi tiết công nợ khách sỉ</h2>
                <p className="text-sm text-on-surface-variant">{detail?.creditLimit.fullName ?? detail?.creditLimit.username ?? detail?.creditLimit.email ?? 'Đang tải...'}</p>
              </div>
              <button onClick={() => { setDetailUserId(null); setDetail(null); }} className="rounded-lg p-2 hover:bg-surface-variant"><X className="h-5 w-5" /></button>
            </div>
            {detailLoading ? (
              <div className="py-16 text-center text-on-surface-variant">Đang tải chi tiết...</div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Stat label="Hạn mức" value={fmt(detail.summary.creditLimit)} />
                  <Stat label="Đang nợ" value={fmt(detail.summary.currentDebt)} tone="text-red-600" />
                  <Stat label="Còn lại" value={fmt(detail.summary.availableCredit)} tone="text-green-600" />
                  <Stat label="Đơn quá hạn" value={String(detail.summary.overdueOrders)} tone={detail.summary.overdueOrders ? 'text-red-600' : 'text-green-600'} />
                </div>
                <section className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="mb-3 font-black text-on-surface">Đơn mua công nợ</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="text-on-surface-variant">
                        <tr>
                          <th className="pb-2 text-left">Đơn hàng</th>
                          <th className="pb-2 text-right">Tổng tiền</th>
                          <th className="pb-2 text-right">Đã thu</th>
                          <th className="pb-2 text-right">Còn nợ</th>
                          <th className="pb-2 text-center">Hạn thanh toán</th>
                          <th className="pb-2 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {detail.orders.items.length === 0 ? (
                          <tr><td colSpan={6} className="py-6 text-center text-on-surface-variant">Chưa có đơn công nợ.</td></tr>
                        ) : detail.orders.items.map((order) => (
                          <tr key={order.orderId}>
                            <td className="py-2 font-mono text-xs font-bold text-primary">{order.code}</td>
                            <td className="py-2 text-right">{fmt(order.totalPayment)}</td>
                            <td className="py-2 text-right text-green-600">{fmt(order.paidByCredit)}</td>
                            <td className="py-2 text-right font-bold text-red-600">{fmt(order.outstanding)}</td>
                            <td className={`py-2 text-center text-xs ${order.isOverdue ? 'font-bold text-red-600' : 'text-on-surface-variant'}`}>{dateText(order.dueDate)}</td>
                            <td className="py-2 text-center"><span className="rounded-full bg-surface-variant px-2 py-1 text-xs font-bold">{order.paymentStatus}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="mb-3 font-black text-on-surface">Lịch sử công nợ</h3>
                  <div className="space-y-2">
                    {detail.transactions.items.length === 0 ? (
                      <p className="py-6 text-center text-sm text-on-surface-variant">Chưa có giao dịch công nợ.</p>
                    ) : detail.transactions.items.map((tx) => (
                      <div key={tx.transactionId} className="grid gap-2 rounded-xl bg-surface-variant/50 p-3 text-sm md:grid-cols-[1fr_140px_160px]">
                        <div>
                          <p className="font-bold text-on-surface">{txTypeLabel(tx.type)} {tx.referenceNo ? `- ${tx.referenceNo}` : ''}</p>
                          <p className="text-xs text-on-surface-variant">{tx.orderId ? `Đơn: ${tx.orderId.slice(0, 8).toUpperCase()}` : 'Không gắn đơn cụ thể'} · {tx.note || 'Không có ghi chú'}</p>
                        </div>
                        <p className={`font-black ${Number(tx.amount) < 0 ? 'text-red-600' : 'text-primary'}`}>{fmt(tx.amount)}</p>
                        <p className="text-xs text-on-surface-variant">{dateText(tx.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone = 'text-on-surface' }: { icon?: ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-on-surface-variant">{icon}{label}</div>
      <p className={`truncate text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-on-surface">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-on-surface">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-variant"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
