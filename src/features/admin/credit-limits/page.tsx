import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Plus, RefreshCw, X, Trash2, AlertCircle, DollarSign, TrendingUp, Users, Search } from 'lucide-react';
import { apiClient } from '../../../lib/api';
import { hasAdminPermission } from '../../../lib/admin-session';

interface CreditLimitItem {
  limitId: string;
  userId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  creditLimit: string;
  currentDebt: string;
  availableCredit: number;
  notes: string | null;
  updatedAt: string;
}

interface User {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
}

const EMPTY_FORM = { userId: '', creditLimit: '', notes: '' };
const EMPTY_PAYMENT = { userId: '', userName: '', amount: '', notes: '' };

export default function CreditLimitsPage() {
  const [items, setItems] = useState<CreditLimitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal thêm/sửa hạn mức
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitForm, setLimitForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal ghi nhận thanh toán
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const canManagePayments = hasAdminPermission('manage_payments');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiClient.get<{ items: CreditLimitItem[]; meta: { total: number } }>('/credit-limits?limit=100');
      setItems(d.items ?? []);
      setTotal(d.meta?.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void apiClient.get<User[]>('/credit-limits/customers').then((d) => setUsers(Array.isArray(d) ? d : []));
  }, [load]);

  const fmt = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  // Stats
  const totalCreditIssued = items.reduce((s, i) => s + Number(i.creditLimit), 0);
  const totalDebt = items.reduce((s, i) => s + Number(i.currentDebt), 0);
  const totalAvailable = items.reduce((s, i) => s + i.availableCredit, 0);

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    return !q || (i.fullName ?? '').toLowerCase().includes(q) || (i.email ?? '').toLowerCase().includes(q) || (i.username ?? '').toLowerCase().includes(q);
  });

  // Hạn mức modal
  const openAddModal = () => { setLimitForm(EMPTY_FORM); setShowLimitModal(true); };
  const openEditModal = (item: CreditLimitItem) => {
    setLimitForm({ userId: item.userId, creditLimit: item.creditLimit, notes: item.notes ?? '' });
    setShowLimitModal(true);
  };
  const closeLimitModal = () => { setShowLimitModal(false); setLimitForm(EMPTY_FORM); };

  const handleSaveLimitForm = async () => {
    if (!limitForm.userId || !limitForm.creditLimit) return;
    setSaving(true);
    try {
      await apiClient.post('/credit-limits', {
        userId: limitForm.userId,
        creditLimit: Number(limitForm.creditLimit),
        notes: limitForm.notes || undefined,
      });
      closeLimitModal();
      void load();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Thanh toán modal
  const openPaymentModal = (item: CreditLimitItem) => {
    if (!canManagePayments) return;
    setPaymentForm({ userId: item.userId, userName: item.fullName ?? item.username ?? item.email ?? '', amount: '', notes: '' });
    setShowPaymentModal(true);
  };
  const closePaymentModal = () => { setShowPaymentModal(false); setPaymentForm(EMPTY_PAYMENT); };

  const handleSavePayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return;
    setPaymentSaving(true);
    try {
      await apiClient.post('/credit-limits/record-payment', {
        userId: paymentForm.userId,
        amount: Number(paymentForm.amount),
        notes: paymentForm.notes || undefined,
      });
      closePaymentModal();
      void load();
    } catch {
      // ignore
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSync = async (userId: string) => {
    setSyncingId(userId);
    try {
      await apiClient.post(`/credit-limits/sync-debt/${userId}`, {});
      void load();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Xóa hạn mức cho người dùng này?')) return;
    await apiClient.delete(`/credit-limits/user/${userId}`);
    void load();
  };

  const usagePct = (item: CreditLimitItem) => {
    const limit = Number(item.creditLimit);
    if (limit <= 0) return 0;
    return Math.min(100, (Number(item.currentDebt) / limit) * 100);
  };

  const barColor = (pct: number) => pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  const badgeColor = (pct: number) => pct >= 90 ? 'bg-red-100 text-red-700' : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-on-surface">Hạn Mức Công Nợ Khách Sỉ</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-variant">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
          <button onClick={openAddModal} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Thêm hạn mức
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start gap-2 text-sm text-blue-700">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Hạn mức tín dụng giới hạn tổng công nợ (đơn hàng chưa thanh toán) của khách sỉ.
          Nợ tự động tăng khi đặt đơn, tự giảm khi thanh toán hoặc hủy đơn.
          Dùng "Đồng bộ nợ" để hiệu chỉnh nếu có sai lệch.
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Khách sỉ</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">{total}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs">Tổng hạn mức</span>
          </div>
          <p className="text-lg font-bold text-primary truncate">{fmt(totalCreditIssued)}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Đang nợ</span>
          </div>
          <p className="text-lg font-bold text-red-600 truncate">{fmt(totalDebt)}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Còn khả dụng</span>
          </div>
          <p className="text-lg font-bold text-green-600 truncate">{fmt(totalAvailable)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
        <input
          type="text"
          placeholder="Tìm khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface py-16 text-center text-on-surface-variant">
          <CreditCard className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>{search ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có hạn mức nào. Nhấn "Thêm hạn mức" để bắt đầu.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-outline-variant overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Khách hàng</th>
                <th className="px-4 py-3 text-right font-medium">Hạn mức</th>
                <th className="px-4 py-3 text-right font-medium">Đang nợ</th>
                <th className="px-4 py-3 text-right font-medium">Còn lại</th>
                <th className="px-4 py-3 text-center font-medium w-40">Sử dụng</th>
                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant bg-surface">
              {filtered.map((item) => {
                const pct = usagePct(item);
                return (
                  <tr key={item.limitId} className="hover:bg-surface-variant/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface">{item.fullName ?? item.username ?? item.email}</p>
                      <p className="text-xs text-on-surface-variant">{item.email}</p>
                      {item.notes && <p className="text-xs text-on-surface-variant italic mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-on-surface">
                      {fmt(Number(item.creditLimit))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {fmt(Number(item.currentDebt))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${item.availableCredit <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(item.availableCredit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-surface-variant overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badgeColor(pct)}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canManagePayments && (
                        <button
                          onClick={() => openPaymentModal(item)}
                          title="Ghi nhận thanh toán"
                          className="rounded-lg bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 whitespace-nowrap"
                        >
                          Thu tiền
                        </button>
                        )}
                        <button
                          onClick={() => openEditModal(item)}
                          title="Chỉnh hạn mức"
                          className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 whitespace-nowrap"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => void handleSync(item.userId)}
                          disabled={syncingId === item.userId}
                          title="Đồng bộ nợ từ đơn hàng"
                          className="rounded-lg border border-outline-variant px-2 py-1 text-xs hover:bg-surface-variant disabled:opacity-60 whitespace-nowrap"
                        >
                          {syncingId === item.userId ? '...' : 'Sync'}
                        </button>
                        <button
                          onClick={() => void handleDelete(item.userId)}
                          title="Xóa hạn mức"
                          className="rounded p-1 text-red-400 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm/sửa hạn mức */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-on-surface">
                {limitForm.userId && items.some(i => i.userId === limitForm.userId) ? 'Chỉnh hạn mức tín dụng' : 'Thêm hạn mức tín dụng'}
              </h3>
              <button onClick={closeLimitModal} className="rounded-lg p-1.5 hover:bg-surface-variant">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Khách hàng</label>
                <select
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary disabled:opacity-60"
                  value={limitForm.userId}
                  onChange={(e) => setLimitForm((f) => ({ ...f, userId: e.target.value }))}
                  disabled={items.some(i => i.userId === limitForm.userId)}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.fullName ?? u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Hạn mức tín dụng (₫)</label>
                <input
                  type="number" min="0"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  placeholder="ví dụ: 10000000"
                  value={limitForm.creditLimit}
                  onChange={(e) => setLimitForm((f) => ({ ...f, creditLimit: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Ghi chú</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  placeholder="Tùy chọn"
                  value={limitForm.notes}
                  onChange={(e) => setLimitForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeLimitModal} className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-variant">Hủy</button>
                <button
                  onClick={() => void handleSaveLimitForm()}
                  disabled={saving || !limitForm.userId || !limitForm.creditLimit}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ghi nhận thanh toán */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-on-surface">Ghi nhận thanh toán</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">{paymentForm.userName}</p>
              </div>
              <button onClick={closePaymentModal} className="rounded-lg p-1.5 hover:bg-surface-variant">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Số tiền khách trả (₫)</label>
                <input
                  type="number" min="1"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  placeholder="ví dụ: 5000000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  autoFocus
                />
                <p className="mt-1 text-xs text-on-surface-variant">
                  Số tiền này sẽ được trừ vào công nợ hiện tại của khách.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Ghi chú</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  placeholder="ví dụ: Chuyển khoản ngày 11/05"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closePaymentModal} className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-variant">Hủy</button>
                <button
                  onClick={() => void handleSavePayment()}
                  disabled={paymentSaving || !paymentForm.amount || Number(paymentForm.amount) <= 0}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {paymentSaving ? 'Đang lưu...' : 'Xác nhận thu tiền'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
