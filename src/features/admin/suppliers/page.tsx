import { Eye, LoaderCircle, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

type Supplier = {
  supplierId: string;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxCode: string | null;
  contactPerson: string | null;
  paymentTerms: number;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number | null;
  debtUsagePct: number;
  creditStatus: 'normal' | 'near_limit' | 'over_limit';
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

type SuppliersResponse = {
  items: Supplier[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const emptyForm = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  taxCode: '',
  contactPerson: '',
  paymentTerms: 30,
  creditLimit: 0,
  notes: '',
};

type SupplierCreditDetail = {
  supplier: Supplier;
  summary: {
    totalOrders: number;
    outstandingOrders: number;
    paidOrders: number;
    totalDebt: number;
    totalPaid: number;
  };
  purchaseOrders: Array<{
    poId: string;
    poCode: string;
    status: string;
    paymentStatus: string;
    orderDate: string | null;
    totalAmount: number;
    paidAmount: number;
    outstanding: number;
    paidDate: string | null;
  }>;
};

const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';

const creditStatusLabel: Record<Supplier['creditStatus'], string> = {
  normal: 'Bình thường',
  near_limit: 'Gần hạn mức',
  over_limit: 'Vượt hạn mức',
};

const creditStatusClass: Record<Supplier['creditStatus'], string> = {
  normal: 'bg-emerald-100 text-emerald-700',
  near_limit: 'bg-amber-100 text-amber-700',
  over_limit: 'bg-red-100 text-red-700',
};

export default function SuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'outstanding' | 'near_limit' | 'over_limit'>('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [creditDetail, setCreditDetail] = useState<SupplierCreditDetail | null>(null);
  const [creditDetailLoading, setCreditDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    if (debtFilter !== 'all') q.set('debtStatus', debtFilter);
    if (search.trim()) q.set('search', search.trim());

    void apiClient.get<SuppliersResponse>(`/suppliers?${q}`).then((data) => {
      if (!cancelled) { setSuppliers(data.items); setMeta(data.meta); }
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [search, statusFilter, debtFilter, page, reloadKey]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.supplierId);
    setForm({
      name: s.name,
      code: s.code ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      taxCode: s.taxCode ?? '',
      contactPerson: s.contactPerson ?? '',
      paymentTerms: s.paymentTerms,
      creditLimit: Number(s.creditLimit ?? 0),
      notes: s.notes ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast({ tone: 'error', title: 'Tên nhà cung cấp là bắt buộc' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        taxCode: form.taxCode.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        paymentTerms: form.paymentTerms,
        creditLimit: Number(form.creditLimit || 0),
        notes: form.notes.trim() || undefined,
      };
      if (editingId) {
        await apiClient.patch(`/suppliers/${editingId}`, payload);
        showToast({ tone: 'success', title: 'Đã cập nhật nhà cung cấp' });
      } else {
        await apiClient.post('/suppliers', payload);
        showToast({ tone: 'success', title: 'Đã tạo nhà cung cấp mới' });
      }
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await apiClient.patch(`/suppliers/${id}/toggle-active`, {});
      setReloadKey((k) => k + 1);
    } catch {
      showToast({ tone: 'error', title: 'Thao tác thất bại' });
    }
  }

  async function openCreditDetail(supplierId: string) {
    setCreditDetailLoading(true);
    try {
      const detail = await apiClient.get<SupplierCreditDetail>(`/suppliers/${supplierId}/credit-detail`);
      setCreditDetail(detail);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Không tải được chi tiết công nợ',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setCreditDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">Nhà cung cấp</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Quản lý danh sách nhà cung cấp và thông tin liên hệ.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
        >
          <Plus size={16} />
          Thêm nhà cung cấp
        </button>
      </div>

      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_200px_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên, mã, SĐT, email..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngừng</option>
          </select>
          <select
            value={debtFilter}
            onChange={(e) => { setDebtFilter(e.target.value as typeof debtFilter); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả công nợ</option>
            <option value="outstanding">Còn nợ</option>
            <option value="near_limit">Gần hạn mức</option>
            <option value="over_limit">Vượt hạn mức</option>
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Liên hệ</th>
                <th className="px-5 py-4">MST</th>
                <th className="px-5 py-4">Công nợ (ngày)</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant"><Truck size={28} className="mx-auto mb-3 text-primary/30" />Chưa có nhà cung cấp</td></tr>
              ) : suppliers.map((s) => (
                <tr key={s.supplierId} className="hover:bg-surface/40">
                  <td className="px-5 py-4">
                    <p className="font-bold text-on-surface">{s.name}</p>
                    {s.code && <p className="text-xs text-on-surface-variant/60">{s.code}</p>}
                    <div className="mt-2 grid gap-1 text-xs text-on-surface-variant">
                      <span>Hạn mức: <strong className="text-on-surface">{Number(s.creditLimit) > 0 ? money(s.creditLimit) : 'Chưa cài'}</strong></span>
                      <span>Đang nợ: <strong className="text-red-600">{money(s.currentDebt)}</strong></span>
                      <span>Còn khả dụng: <strong className="text-emerald-700">{s.availableCredit === null ? 'Không giới hạn' : money(s.availableCredit)}</strong></span>
                      <span className={`w-fit rounded-full px-2 py-0.5 font-bold ${creditStatusClass[s.creditStatus]}`}>
                        {creditStatusLabel[s.creditStatus]} {Number(s.creditLimit) > 0 ? `(${s.debtUsagePct}%)` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">
                    <p>{s.phone ?? '—'}</p>
                    <p className="text-xs">{s.email ?? ''}</p>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{s.taxCode ?? '—'}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{s.paymentTerms} ngày</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {s.isActive ? 'Hoạt động' : 'Tạm ngừng'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => void openCreditDetail(s.supplierId)}
                        className="inline-flex items-center gap-1 rounded-xl border border-on-surface/10 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-on-surface/5"
                      >
                        <Eye size={13} />
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/8"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggle(s.supplierId)}
                        className="rounded-xl border border-on-surface/10 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-on-surface/5"
                      >
                        {s.isActive ? 'Tạm ngừng' : 'Kích hoạt'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} nhà cung cấp</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-sm" style={{ maxHeight: '90vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black text-on-surface">
                {editingId ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp mới'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Tên nhà cung cấp *</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Mã NCC</span>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Số điện thoại</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Mã số thuế</span>
                  <input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Người liên hệ</span>
                  <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Địa chỉ</span>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Điều khoản thanh toán (ngày)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: Number(e.target.value) })}
                  className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Ghi chú</span>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Hạn mức công nợ NCC</span>
                <input
                  type="number"
                  min={0}
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                  className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                />
                <span className="text-xs text-on-surface-variant">Nhập 0 nếu chưa cấu hình hạn mức cho nhà cung cấp này.</span>
              </label>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)}
                className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-on-surface/5">
                Đóng
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {creditDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Công nợ nhà cung cấp</p>
                <h2 className="mt-1 text-2xl font-black text-on-surface">{creditDetail.supplier.name}</h2>
                <p className="text-sm text-on-surface-variant">{creditDetail.supplier.code ?? 'Không có mã NCC'}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreditDetail(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
              >
                <X size={18} />
              </button>
            </div>

            {creditDetailLoading ? (
              <div className="py-16 text-center"><LoaderCircle className="mx-auto animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-on-surface/10 bg-surface p-4">
                    <p className="text-xs font-bold text-on-surface-variant">Hạn mức</p>
                    <p className="mt-1 text-lg font-black text-on-surface">{Number(creditDetail.supplier.creditLimit) > 0 ? money(creditDetail.supplier.creditLimit) : 'Chưa cài'}</p>
                  </div>
                  <div className="rounded-xl border border-on-surface/10 bg-surface p-4">
                    <p className="text-xs font-bold text-on-surface-variant">Đang nợ</p>
                    <p className="mt-1 text-lg font-black text-red-600">{money(creditDetail.supplier.currentDebt)}</p>
                  </div>
                  <div className="rounded-xl border border-on-surface/10 bg-surface p-4">
                    <p className="text-xs font-bold text-on-surface-variant">Còn khả dụng</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{creditDetail.supplier.availableCredit === null ? 'Không giới hạn' : money(creditDetail.supplier.availableCredit)}</p>
                  </div>
                  <div className="rounded-xl border border-on-surface/10 bg-surface p-4">
                    <p className="text-xs font-bold text-on-surface-variant">PO còn nợ</p>
                    <p className="mt-1 text-lg font-black text-on-surface">{creditDetail.summary.outstandingOrders}</p>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-xl border border-on-surface/10">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface text-xs font-black uppercase tracking-wide text-on-surface-variant">
                      <tr>
                        <th className="px-4 py-3">Mã PO</th>
                        <th className="px-4 py-3">Ngày đặt</th>
                        <th className="px-4 py-3 text-right">Tổng tiền</th>
                        <th className="px-4 py-3 text-right">Đã trả</th>
                        <th className="px-4 py-3 text-right">Còn nợ</th>
                        <th className="px-4 py-3">Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-on-surface/8">
                      {creditDetail.purchaseOrders.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Chưa có PO công nợ.</td></tr>
                      ) : creditDetail.purchaseOrders.map((po) => (
                        <tr key={po.poId}>
                          <td className="px-4 py-3 font-bold text-primary">{po.poCode}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : '-'}</td>
                          <td className="px-4 py-3 text-right font-semibold">{money(po.totalAmount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">{money(po.paidAmount)}</td>
                          <td className="px-4 py-3 text-right font-black text-red-600">{money(po.outstanding)}</td>
                          <td className="px-4 py-3">{po.paymentStatus === 'paid' ? 'Đã thanh toán' : po.paymentStatus === 'partial' ? 'Một phần' : 'Chưa thanh toán'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
