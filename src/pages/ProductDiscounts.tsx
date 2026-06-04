import { useEffect, useState, useCallback } from 'react';
import {
  Award,
  BadgePercent,
  CalendarClock,
  ChevronDown,
  Edit2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tags,
  Trash2,
  ToggleLeft,
  ToggleRight,
  BarChart2,
  Users2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';
import Pagination from '../components/shared/Pagination';

type Discount = {
  discountId: string;
  discountCode: string;
  discountName: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  appliesTo: 'order' | 'category' | 'product';
  startAt: string;
  expireDate: string;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  minOrderValue: string;
  maxDiscountAmount: string | null;
  discountDescription: string | null;
  userId: string | null;
  categoryIds?: string[];
  productIds?: string[];
  stats?: { totalUsage: number; uniqueUsers: number };
  isExpired?: boolean;
  isStarted?: boolean;
  approvalStatus?: 'not_required' | 'pending_approval' | 'approved' | 'rejected';
};

type Category = { categoryId: string; categoryName: string };
type Product = { productId: string; productName: string };

type TierConfigItem = {
  tier: 'silver' | 'gold' | 'diamond';
  label: string;
  minSpent: number;
  discountPercent: number;
  couponValidDays: number;
};

type MemberRow = {
  userId: string; username: string; email: string;
  fullName: string | null; avatarUrl: string | null;
  tier: string; label: string; totalSpent: number; discountPercent: number;
};
type OverviewResponse = {
  data: MemberRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  tierStats: Record<string, number>;
};
const TIERS = [
  { value: 'all', label: 'Tất cả', dot: 'bg-gray-300' },
  { value: 'none', label: 'Thường', dot: 'bg-gray-400' },
  { value: 'silver', label: 'Bạc', dot: 'bg-slate-400' },
  { value: 'gold', label: 'Vàng', dot: 'bg-amber-400' },
  { value: 'diamond', label: 'Kim Cương', dot: 'bg-cyan-400' },
];
const TIER_BADGE: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500 border-gray-200',
  silver: 'bg-slate-100 text-slate-600 border-slate-300',
  gold: 'bg-amber-50 text-amber-700 border-amber-300',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-300',
};
const STAT_CARD: Record<string, { bg: string; text: string; border: string }> = {
  none:    { bg: 'bg-gray-50',  text: 'text-gray-600',  border: 'border-gray-200' },
  silver:  { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  gold:    { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  diamond: { bg: 'bg-cyan-50',  text: 'text-cyan-800',  border: 'border-cyan-200' },
};
function fmtVnd(n: number) { return n.toLocaleString('vi-VN'); }
function MemberAvatar({ row }: { row: MemberRow }) {
  const initials = (row.fullName ?? row.username ?? 'U').slice(0, 2).toUpperCase();
  if (row.avatarUrl) return <img src={row.avatarUrl} alt={initials} className="h-8 w-8 rounded-full object-cover" />;
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">{initials}</span>;
}

type DiscountFormState = {
  discountCode: string;
  discountName: string;
  discountType: 'percent' | 'fixed';
  appliesTo: 'order' | 'category' | 'product';
  discountValue: string;
  startAt: string;
  expireDate: string;
  isActive: boolean;
  usageLimit: string;
  minOrderValue: string;
  maxDiscountAmount: string;
  discountDescription: string;
  userId: string;
  categoryIds: string[];
  productIds: string[];
};

const defaultForm: DiscountFormState = {
  discountCode: '',
  discountName: '',
  discountType: 'percent',
  appliesTo: 'order',
  discountValue: '',
  startAt: '',
  expireDate: '',
  isActive: true,
  usageLimit: '',
  minOrderValue: '0',
  maxDiscountAmount: '',
  discountDescription: '',
  userId: '',
  categoryIds: [],
  productIds: [],
};

function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

export default function ProductDiscounts() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'discounts' | 'membership'>('discounts');

  // ── Discounts state ──
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountFormState>(defaultForm);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statsTarget, setStatsTarget] = useState<Discount | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // ── Membership state ──
  const tierFilter  = searchParams.get('tier') ?? 'all';
  const memberPage  = parseInt(searchParams.get('mpage') ?? '1', 10);
  const [memberSearch, setMemberSearch] = useState(searchParams.get('msearch') ?? '');
  const [memberSearchInput, setMemberSearchInput] = useState(memberSearch);
  const [memberData, setMemberData]     = useState<MemberRow[]>([]);
  const [memberMeta, setMemberMeta]     = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [tierStats, setTierStats]       = useState<Record<string, number>>({});
  const [memberLoading, setMemberLoading] = useState(false);
  const [settingTier, setSettingTier]     = useState<string | null>(null);
  const [tierDropdown, setTierDropdown]   = useState<string | null>(null);
  const [recalcingId, setRecalcingId]     = useState<string | null>(null);
  const [recalcingAll, setRecalcingAll]   = useState(false);
  const [showTierSettings, setShowTierSettings] = useState(false);
  const [tierConfigDraft, setTierConfigDraft]   = useState<TierConfigItem[]>([]);
  const [tierConfigLoading, setTierConfigLoading] = useState(false);
  const [tierConfigSaving, setTierConfigSaving]   = useState(false);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Discount[]>('/discounts/admin');
      setDiscounts(data);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi tải danh sách' : 'Failed to load discounts',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [isVietnamese, showToast]);

  const loadMembers = useCallback(async () => {
    setMemberLoading(true);
    try {
      const params = new URLSearchParams();
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (memberSearch) params.set('search', memberSearch);
      params.set('page', String(memberPage));
      params.set('limit', '20');
      const res = await apiClient.get<OverviewResponse>(`/membership/admin/overview?${params}`);
      setMemberData(res.data);
      setMemberMeta(res.meta);
      setTierStats(res.tierStats);
    } catch {
      showToast({ tone: 'error', title: 'Không tải được dữ liệu thành viên' });
    } finally {
      setMemberLoading(false);
    }
  }, [tierFilter, memberSearch, memberPage, showToast]);

  const handleRecalcOne = async (userId: string) => {
    setRecalcingId(userId);
    try {
      await apiClient.patch(`/membership/admin/${userId}/recalculate`, {});
      showToast({ tone: 'success', title: 'Đã tính lại hạng theo chi tiêu thực tế' });
      void loadMembers();
    } catch {
      showToast({ tone: 'error', title: 'Tính lại thất bại' });
    } finally {
      setRecalcingId(null);
    }
  };

  const handleRecalcAll = async () => {
    setRecalcingAll(true);
    try {
      const res = await apiClient.patch<{ updated: number }>('/membership/admin/recalculate-all', {});
      showToast({ tone: 'success', title: `Đã tính lại hạng cho ${res.updated} thành viên` });
      void loadMembers();
    } catch {
      showToast({ tone: 'error', title: 'Tính lại thất bại' });
    } finally {
      setRecalcingAll(false);
    }
  };

  const loadTierConfig = useCallback(async () => {
    setTierConfigLoading(true);
    try {
      const data = await apiClient.get<TierConfigItem[]>('/membership/admin/tier-config');
      setTierConfigDraft(data);
    } catch {
      showToast({ tone: 'error', title: 'Không tải được cấu hình hạng' });
    } finally {
      setTierConfigLoading(false);
    }
  }, [showToast]);

  const handleSaveTierConfig = async () => {
    setTierConfigSaving(true);
    try {
      const saved = await apiClient.patch<TierConfigItem[]>('/membership/admin/tier-config', tierConfigDraft);
      setTierConfigDraft(saved);
      showToast({ tone: 'success', title: 'Đã lưu cấu hình ngưỡng hạng thành viên' });
    } catch {
      showToast({ tone: 'error', title: 'Lưu thất bại' });
    } finally {
      setTierConfigSaving(false);
    }
  };

  const handleSetTier = async (userId: string, tier: string) => {
    setSettingTier(userId);
    setTierDropdown(null);
    try {
      await apiClient.patch(`/membership/admin/${userId}/set-tier/${tier}`, {});
      showToast({ tone: 'success', title: 'Đã cập nhật hạng thành viên' });
      void loadMembers();
    } catch {
      showToast({ tone: 'error', title: 'Cập nhật thất bại' });
    } finally {
      setSettingTier(null);
    }
  };

  useEffect(() => {
    void loadDiscounts();

    async function loadRefs() {
      try {
        const [catData, proData] = await Promise.all([
          apiClient.get<Category[]>('/categories'),
          apiClient.get<{ items: Product[] }>('/products?includeHidden=true&limit=500'),
        ]);
        setCategories(catData ?? []);
        setProducts(proData.items ?? []);
      } catch {
        // silently fail
      }
    }
    void loadRefs();
  }, [loadDiscounts]);

  useEffect(() => {
    if (activeTab === 'membership') {
      void loadMembers();
      void loadTierConfig();
    }
  }, [activeTab, loadMembers, loadTierConfig]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const data = await apiClient.get<Discount>(`/discounts/admin/${id}`);
      setEditTarget(data);
      setForm({
        discountCode: data.discountCode,
        discountName: data.discountName,
        discountType: data.discountType,
        appliesTo: data.appliesTo,
        discountValue: data.discountValue,
        startAt: toDatetimeLocal(data.startAt),
        expireDate: toDatetimeLocal(data.expireDate),
        isActive: data.isActive,
        usageLimit: data.usageLimit != null ? String(data.usageLimit) : '',
        minOrderValue: data.minOrderValue ?? '0',
        maxDiscountAmount: data.maxDiscountAmount ?? '',
        discountDescription: data.discountDescription ?? '',
        userId: data.userId ?? '',
        categoryIds: data.categoryIds ?? [],
        productIds: data.productIds ?? [],
      });
      setFormOpen(true);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Không tải được chi tiết' : 'Failed to load detail',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleSave() {
    if (!form.discountCode.trim() || !form.discountName.trim() || !form.discountValue || !form.startAt || !form.expireDate) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thiếu thông tin bắt buộc' : 'Required fields missing',
        description: isVietnamese ? 'Mã, tên, giá trị và thời gian là bắt buộc.' : 'Code, name, value and dates are required.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        discountCode: form.discountCode.toUpperCase().trim(),
        discountName: form.discountName.trim(),
        discountType: form.discountType,
        appliesTo: form.appliesTo,
        discountValue: form.discountValue,
        startAt: new Date(form.startAt).toISOString(),
        expireDate: new Date(form.expireDate).toISOString(),
        isActive: form.isActive,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        minOrderValue: form.minOrderValue || '0',
        maxDiscountAmount: form.maxDiscountAmount || undefined,
        discountDescription: form.discountDescription || undefined,
        userId: form.userId || undefined,
        categoryIds: form.appliesTo === 'category' ? form.categoryIds : undefined,
        productIds: form.appliesTo === 'product' ? form.productIds : undefined,
      };

      if (editTarget) {
        await apiClient.patch(`/discounts/${editTarget.discountId}`, payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật giảm giá' : 'Discount updated' });
      } else {
        await apiClient.post('/discounts', payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo giảm giá mới' : 'Discount created' });
      }

      setFormOpen(false);
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lưu thất bại' : 'Save failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await apiClient.delete(`/discounts/${confirmDeleteId}`);
      showToast({ tone: 'success', title: isVietnamese ? 'Đã xoá giảm giá' : 'Discount deleted' });
      setConfirmDeleteId(null);
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Xoá thất bại' : 'Delete failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(discount: Discount) {
    try {
      await apiClient.patch(`/discounts/${discount.discountId}/toggle-active`);
      showToast({
        tone: 'success',
        title: discount.isActive
          ? isVietnamese ? 'Đã tắt giảm giá' : 'Discount deactivated'
          : isVietnamese ? 'Đã bật giảm giá' : 'Discount activated',
      });
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thao tác thất bại' : 'Action failed',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleApproval(discount: Discount, action: 'approve' | 'reject') {
    const note = action === 'reject'
      ? window.prompt(isVietnamese ? 'Lý do từ chối (tùy chọn):' : 'Reject reason (optional):') ?? undefined
      : undefined;
    try {
      await apiClient.patch(`/discounts/admin/${discount.discountId}/${action}`, { note });
      showToast({
        tone: 'success',
        title: action === 'approve'
          ? (isVietnamese ? 'Đã duyệt mã giảm giá' : 'Discount approved')
          : (isVietnamese ? 'Đã từ chối mã giảm giá' : 'Discount rejected'),
      });
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thao tác thất bại' : 'Action failed',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function openStats(discount: Discount) {
    try {
      const stats = await apiClient.get<{ totalUsage: number; uniqueUsers: number }>(
        `/discounts/admin/${discount.discountId}/stats`,
      );
      setStatsTarget({ ...discount, stats });
    } catch {
      setStatsTarget(discount);
    }
  }

  function toggleCategoryId(id: string) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  function toggleProductId(id: string) {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((p) => p !== id)
        : [...prev.productIds, id],
    }));
  }

  const statusBadge = (d: Discount) => {
    const now = new Date();
    const expired = new Date(d.expireDate) < now;
    const notStarted = new Date(d.startAt) > now;
    if (!d.isActive) return { label: isVietnamese ? 'Tắt' : 'Inactive', cls: 'bg-slate-100 text-slate-500' };
    if (expired) return { label: isVietnamese ? 'Hết hạn' : 'Expired', cls: 'bg-red-50 text-red-600' };
    if (notStarted) return { label: isVietnamese ? 'Chưa bắt đầu' : 'Pending', cls: 'bg-yellow-50 text-yellow-700' };
    return { label: isVietnamese ? 'Đang chạy' : 'Active', cls: 'bg-emerald-50 text-emerald-700' };
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Chương Trình Giảm Giá' : 'Discount Programs'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Quản lý mã giảm giá và chương trình khách hàng thân thiết.'
              : 'Manage discount codes and loyalty programs.'}
          </p>
        </div>
        {activeTab === 'discounts' && (
          <button
            type="button"
            onClick={openCreate}
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm hover:opacity-90"
          >
            <Plus size={18} />
            {isVietnamese ? 'Thêm giảm giá' : 'Add discount'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-on-surface-variant/5 p-1.5 w-fit">
        <button
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition ${
            activeTab === 'discounts' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <BadgePercent size={15} />
          {isVietnamese ? 'Mã giảm giá' : 'Discount codes'}
        </button>
        <button
          onClick={() => setActiveTab('membership')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition ${
            activeTab === 'membership' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Award size={15} />
          {isVietnamese ? 'Thành viên thân thiết' : 'Loyalty members'}
        </button>
      </div>

      {/* ── TAB: Discounts ── */}
      {activeTab === 'discounts' && (
      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                <th className="px-4 py-4">{isVietnamese ? 'Mã' : 'Code'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Tên' : 'Name'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Giá trị' : 'Value'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Phạm vi' : 'Scope'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Thời gian' : 'Period'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Đã dùng' : 'Used'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Trạng thái' : 'Status'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      {isVietnamese ? 'Đang tải...' : 'Loading...'}
                    </span>
                  </td>
                </tr>
              ) : discounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Tags size={30} className="mx-auto text-primary/60" />
                    <p className="mt-3 text-sm font-bold text-on-surface">
                      {isVietnamese ? 'Chưa có mã giảm giá nào' : 'No discounts yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                discounts.map((d) => {
                  const badge = statusBadge(d);
                  return (
                    <tr key={d.discountId} className="hover:bg-on-surface-variant/[0.02]">
                      <td className="px-4 py-4">
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black tracking-wider text-primary">
                          {d.discountCode}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-on-surface">{d.discountName}</p>
                        {d.discountDescription && (
                          <p className="mt-0.5 text-xs text-on-surface-variant/60 line-clamp-1">{d.discountDescription}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-on-surface">
                        {d.discountType === 'percent' ? `${d.discountValue}%` : `${Number(d.discountValue).toLocaleString()}₫`}
                        {d.maxDiscountAmount && (
                          <p className="text-xs font-normal text-on-surface-variant/60">
                            max {Number(d.maxDiscountAmount).toLocaleString()}₫
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant capitalize">{d.appliesTo}</td>
                      <td className="px-4 py-4 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-1">
                          <CalendarClock size={13} className="shrink-0" />
                          {new Date(d.startAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <CalendarClock size={13} className="shrink-0 text-red-400" />
                          {new Date(d.expireDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant">
                        {d.usedCount}/{d.usageLimit ?? '∞'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {d.approvalStatus === 'pending_approval' && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                              {isVietnamese ? '⏳ Chờ duyệt' : '⏳ Pending'}
                            </span>
                          )}
                          {d.approvalStatus === 'rejected' && (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                              {isVietnamese ? '✕ Bị từ chối' : '✕ Rejected'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {d.approvalStatus === 'pending_approval' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleApproval(d, 'approve')}
                                title={isVietnamese ? 'Duyệt' : 'Approve'}
                                className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleApproval(d, 'reject')}
                                title={isVietnamese ? 'Từ chối' : 'Reject'}
                                className="rounded-xl p-2 text-red-500 hover:bg-red-50"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => void openStats(d)}
                            title={isVietnamese ? 'Thống kê' : 'Stats'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            <BarChart2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(d)}
                            title={d.isActive ? (isVietnamese ? 'Tắt' : 'Deactivate') : (isVietnamese ? 'Bật' : 'Activate')}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            {d.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openEdit(d.discountId)}
                            title={isVietnamese ? 'Sửa' : 'Edit'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(d.discountId)}
                            title={isVietnamese ? 'Xoá' : 'Delete'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      )}

      {/* ── TAB: Membership ── */}
      {activeTab === 'membership' && (
        <div className="space-y-5">
          {/* Membership header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">
              Hạng được tính tự động theo tổng đơn hàng đã giao. Nhấn <strong>Tính lại</strong> để cập nhật thủ công.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { setShowTierSettings((v) => !v); }}
                className="flex items-center gap-2 rounded-2xl border border-on-surface-variant/10 px-4 py-2 text-sm font-bold text-on-surface hover:bg-on-surface-variant/5 transition"
              >
                <Settings size={14} />
                Cài đặt ngưỡng
              </button>
              <button
                onClick={() => void handleRecalcAll()}
                disabled={recalcingAll}
                className="flex items-center gap-2 rounded-2xl border border-on-surface-variant/10 px-4 py-2 text-sm font-bold text-on-surface hover:bg-on-surface-variant/5 transition disabled:opacity-50"
              >
                {recalcingAll ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Tính lại tất cả
              </button>
            </div>
          </div>

          {/* Tier Settings Panel */}
          {showTierSettings && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-amber-900">Cài đặt ngưỡng hạng thành viên</h3>
                {tierConfigLoading && <LoaderCircle size={14} className="animate-spin text-amber-600" />}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/60">
                      <th className="pb-3 pr-4 text-left">Hạng</th>
                      <th className="pb-3 pr-4 text-left">Chi tiêu tối thiểu (₫)</th>
                      <th className="pb-3 pr-4 text-left">Giảm giá thưởng (%)</th>
                      <th className="pb-3 text-left">Hiệu lực coupon (ngày)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {tierConfigDraft.map((cfg, idx) => {
                      const dot = cfg.tier === 'silver' ? 'bg-slate-400' : cfg.tier === 'gold' ? 'bg-amber-400' : 'bg-cyan-400';
                      const lbl = cfg.tier === 'silver' ? 'Bạc' : cfg.tier === 'gold' ? 'Vàng' : 'Kim Cương';
                      return (
                        <tr key={cfg.tier}>
                          <td className="py-3 pr-4">
                            <span className="flex items-center gap-2 font-bold text-on-surface">
                              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{lbl}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <input
                              type="number"
                              min={0}
                              step={100000}
                              value={cfg.minSpent}
                              onChange={(e) => setTierConfigDraft((prev) => prev.map((c, i) => i === idx ? { ...c, minSpent: Number(e.target.value) } : c))}
                              className="input-base w-40 text-right"
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={cfg.discountPercent}
                              onChange={(e) => setTierConfigDraft((prev) => prev.map((c, i) => i === idx ? { ...c, discountPercent: Number(e.target.value) } : c))}
                              className="input-base w-24 text-right"
                            />
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              min={1}
                              value={cfg.couponValidDays}
                              onChange={(e) => setTierConfigDraft((prev) => prev.map((c, i) => i === idx ? { ...c, couponValidDays: Number(e.target.value) } : c))}
                              className="input-base w-24 text-right"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => void handleSaveTierConfig()}
                  disabled={tierConfigSaving || tierConfigLoading}
                  className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50 transition"
                >
                  {tierConfigSaving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu cài đặt
                </button>
              </div>
            </section>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.filter((t) => t.value !== 'all').map((t) => {
              const s = STAT_CARD[t.value];
              const count = tierStats[t.value] ?? 0;
              return (
                <button
                  key={t.value}
                  onClick={() => setSearchParams((p) => { p.set('tier', t.value); p.set('mpage', '1'); return p; })}
                  className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${s.bg} ${s.border} ${tierFilter === t.value ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}
                >
                  <div className={`mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${s.text}`}>
                    <span className={`h-2 w-2 rounded-full ${t.dot}`} />{t.label}
                  </div>
                  <p className={`text-2xl font-black ${s.text}`}>{fmtVnd(count)}</p>
                  <p className="mt-0.5 text-xs text-gray-400">khách hàng</p>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-xl bg-on-surface-variant/5 p-1">
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSearchParams((p) => { p.set('tier', t.value); p.set('mpage', '1'); return p; })}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tierFilter === t.value ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2 min-w-[220px]">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setMemberSearch(memberSearchInput);
                      setSearchParams((p) => { p.set('msearch', memberSearchInput); p.set('mpage', '1'); return p; });
                    }
                  }}
                  placeholder="Tìm theo tên, email..."
                  className="input-base w-full pl-8"
                />
              </div>
              <button
                onClick={() => { setMemberSearch(memberSearchInput); setSearchParams((p) => { p.set('msearch', memberSearchInput); p.set('mpage', '1'); return p; }); }}
                className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-white hover:opacity-90"
              >Tìm</button>
            </div>
          </div>

          {/* Table */}
          <section className="rounded-xl border border-on-surface-variant/5 bg-white shadow-sm overflow-hidden">
            {memberLoading ? (
              <div className="flex h-48 items-center justify-center">
                <LoaderCircle size={24} className="animate-spin text-primary" />
              </div>
            ) : memberData.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-on-surface-variant">
                <Users2 size={32} className="opacity-30" />
                <p className="text-sm">Không có dữ liệu</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    <th className="px-4 py-4">Khách hàng</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Hạng</th>
                    <th className="px-4 py-4 text-right">Tổng chi tiêu</th>
                    <th className="px-4 py-4 text-center">Giảm giá</th>
                    <th className="px-4 py-4 text-center">Tính lại</th>
                    <th className="px-4 py-4 text-center">Đặt tay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface-variant/5">
                  {memberData.map((row) => (
                    <tr key={row.userId} className="hover:bg-on-surface-variant/[0.02]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar row={row} />
                          <div>
                            <p className="font-bold text-on-surface">{row.fullName ?? row.username}</p>
                            <p className="text-xs text-on-surface-variant">@{row.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant">{row.email}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TIER_BADGE[row.tier] ?? TIER_BADGE.none}`}>
                          <Award size={11} />{row.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-on-surface">{fmtVnd(row.totalSpent)}₫</td>
                      <td className="px-4 py-4 text-center text-sm">
                        {row.discountPercent > 0
                          ? <span className="font-bold text-emerald-600">-{row.discountPercent}%</span>
                          : <span className="text-on-surface-variant/40">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          disabled={recalcingId === row.userId}
                          onClick={() => void handleRecalcOne(row.userId)}
                          title="Tính lại theo chi tiêu thực tế"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-on-surface-variant/10 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-on-surface-variant/5 transition disabled:opacity-50"
                        >
                          {recalcingId === row.userId
                            ? <LoaderCircle size={12} className="animate-spin" />
                            : <RefreshCw size={12} />}
                          Tự động
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="relative inline-block">
                          <button
                            disabled={settingTier === row.userId}
                            onClick={() => setTierDropdown(tierDropdown === row.userId ? null : row.userId)}
                            className="flex items-center gap-1.5 rounded-xl border border-on-surface-variant/10 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-on-surface-variant/5 transition disabled:opacity-50"
                          >
                            {settingTier === row.userId
                              ? <LoaderCircle size={12} className="animate-spin" />
                              : <><span>Đặt hạng</span><ChevronDown size={12} /></>}
                          </button>
                          {tierDropdown === row.userId && (
                            <div className="absolute right-0 z-20 mt-1 w-36 rounded-2xl border border-on-surface-variant/10 bg-white shadow-lg">
                              {TIERS.filter((t) => t.value !== 'all').map((t) => (
                                <button
                                  key={t.value}
                                  onClick={() => void handleSetTier(row.userId, t.value)}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition hover:bg-on-surface-variant/5 first:rounded-t-2xl last:rounded-b-2xl ${row.tier === t.value ? 'text-primary' : 'text-on-surface'}`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${t.dot}`} />{t.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {memberMeta.totalPages > 1 && (
            <Pagination
              currentPage={memberMeta.page}
              totalPages={memberMeta.totalPages}
              onPageChange={(p) => setSearchParams((sp) => { sp.set('mpage', String(p)); return sp; })}
            />
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        title={editTarget ? (isVietnamese ? 'Sửa giảm giá' : 'Edit discount') : (isVietnamese ? 'Thêm giảm giá' : 'Add discount')}
        onClose={() => setFormOpen(false)}
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">
              {isVietnamese ? 'Huỷ' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isVietnamese ? 'Lưu' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label={isVietnamese ? 'Mã giảm giá *' : 'Discount code *'}>
              <input
                value={form.discountCode}
                onChange={(e) => setForm((p) => ({ ...p, discountCode: e.target.value.toUpperCase() }))}
                className="input-base"
                placeholder="SUMMER20"
              />
            </Field>
            <Field label={isVietnamese ? 'Tên chương trình *' : 'Program name *'}>
              <input
                value={form.discountName}
                onChange={(e) => setForm((p) => ({ ...p, discountName: e.target.value }))}
                className="input-base"
                placeholder={isVietnamese ? 'Giảm hè 2025' : 'Summer Sale 2025'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label={isVietnamese ? 'Loại giảm giá' : 'Discount type'}>
              <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as 'percent' | 'fixed' }))} className="input-base">
                <option value="percent">{isVietnamese ? 'Phần trăm (%)' : 'Percent (%)'}</option>
                <option value="fixed">{isVietnamese ? 'Số tiền cố định' : 'Fixed amount'}</option>
              </select>
            </Field>
            <Field label={isVietnamese ? 'Giá trị *' : 'Value *'}>
              <input
                type="number"
                min="0"
                max={form.discountType === 'percent' ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                className="input-base"
                placeholder={form.discountType === 'percent' ? '20' : '50000'}
              />
            </Field>
            <Field label={isVietnamese ? 'Giảm tối đa' : 'Max discount'}>
              <input
                type="number"
                min="0"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm((p) => ({ ...p, maxDiscountAmount: e.target.value }))}
                className="input-base"
                placeholder={isVietnamese ? 'Không giới hạn' : 'Unlimited'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={isVietnamese ? 'Ngày bắt đầu *' : 'Start date *'}>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))} className="input-base" />
            </Field>
            <Field label={isVietnamese ? 'Ngày hết hạn *' : 'Expire date *'}>
              <input type="datetime-local" value={form.expireDate} onChange={(e) => setForm((p) => ({ ...p, expireDate: e.target.value }))} className="input-base" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label={isVietnamese ? 'Đơn hàng tối thiểu' : 'Min order value'}>
              <input type="number" min="0" value={form.minOrderValue} onChange={(e) => setForm((p) => ({ ...p, minOrderValue: e.target.value }))} className="input-base" placeholder="0" />
            </Field>
            <Field label={isVietnamese ? 'Giới hạn lượt dùng' : 'Usage limit'}>
              <input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))} className="input-base" placeholder={isVietnamese ? 'Không giới hạn' : 'Unlimited'} />
            </Field>
            <Field label={isVietnamese ? 'Áp dụng cho' : 'Applies to'}>
              <select value={form.appliesTo} onChange={(e) => setForm((p) => ({ ...p, appliesTo: e.target.value as 'order' | 'category' | 'product' }))} className="input-base">
                <option value="order">{isVietnamese ? 'Toàn bộ đơn hàng' : 'Entire order'}</option>
                <option value="category">{isVietnamese ? 'Theo danh mục' : 'By category'}</option>
                <option value="product">{isVietnamese ? 'Theo sản phẩm' : 'By product'}</option>
              </select>
            </Field>
          </div>

          {form.appliesTo === 'category' && (
            <Field label={isVietnamese ? 'Chọn danh mục áp dụng' : 'Select categories'}>
              <div className="max-h-40 overflow-y-auto rounded-2xl border border-on-surface/10 bg-surface p-3 grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <label key={cat.categoryId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.categoryIds.includes(cat.categoryId)} onChange={() => toggleCategoryId(cat.categoryId)} className="accent-primary" />
                    {cat.categoryName}
                  </label>
                ))}
              </div>
            </Field>
          )}

          {form.appliesTo === 'product' && (
            <Field label={isVietnamese ? 'Chọn sản phẩm áp dụng' : 'Select products'}>
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-on-surface/10 bg-surface p-3 grid grid-cols-1 gap-2">
                {products.map((prod) => (
                  <label key={prod.productId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.productIds.includes(prod.productId)} onChange={() => toggleProductId(prod.productId)} className="accent-primary" />
                    {prod.productName}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label={isVietnamese ? 'Mô tả' : 'Description'}>
            <textarea
              value={form.discountDescription}
              onChange={(e) => setForm((p) => ({ ...p, discountDescription: e.target.value }))}
              rows={2}
              className="input-base resize-none"
              placeholder={isVietnamese ? 'Mô tả ngắn về chương trình...' : 'Short description...'}
            />
          </Field>

          <div className="flex items-center gap-3">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-primary h-4 w-4" />
            <label htmlFor="isActive" className="text-sm font-bold text-on-surface cursor-pointer">
              {isVietnamese ? 'Kích hoạt ngay sau khi tạo' : 'Active immediately after creation'}
            </label>
          </div>
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        open={!!confirmDeleteId}
        title={isVietnamese ? 'Xác nhận xoá' : 'Confirm delete'}
        onClose={() => setConfirmDeleteId(null)}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">
              {isVietnamese ? 'Huỷ' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={!!deletingId}
              className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {deletingId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xoá' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">
          {isVietnamese
            ? 'Bạn có chắc muốn xoá mã giảm giá này? Thao tác không thể hoàn tác.'
            : 'Are you sure you want to delete this discount? This action cannot be undone.'}
        </p>
      </Modal>

      {/* Stats modal */}
      <Modal
        open={!!statsTarget}
        title={isVietnamese ? 'Thống kê sử dụng' : 'Usage Statistics'}
        onClose={() => setStatsTarget(null)}
        size="md"
      >
        {statsTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-primary/5 px-5 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{isVietnamese ? 'Mã giảm giá' : 'Discount code'}</p>
              <p className="mt-1 text-2xl font-black text-primary">{statsTarget.discountCode}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-on-surface-variant/5 bg-surface px-5 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Tổng lượt dùng' : 'Total uses'}</p>
                <p className="mt-2 text-3xl font-black text-on-surface">{statsTarget.stats?.totalUsage ?? statsTarget.usedCount}</p>
                <p className="mt-1 text-xs text-on-surface-variant/60">/ {statsTarget.usageLimit ?? '∞'}</p>
              </div>
              <div className="rounded-2xl border border-on-surface-variant/5 bg-surface px-5 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Người dùng' : 'Unique users'}</p>
                <p className="mt-2 text-3xl font-black text-on-surface">{statsTarget.stats?.uniqueUsers ?? '—'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{label}</span>
      {children}
    </label>
  );
}
import { type ReactNode } from 'react';
