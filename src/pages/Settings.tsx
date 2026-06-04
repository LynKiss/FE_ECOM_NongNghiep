import { useState, useEffect, type ReactNode } from 'react';
import {
  Building2,
  Truck,
  Share2,
  Save,
  Plus,
  Trash2,
  Edit2,
  Facebook,
  Youtube,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Globe,
  MapPin,
  PanelLeft,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import { useAdminSession } from '../hooks/useAdminSession';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export const VIETNAM_PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước',
  'Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên',
  'Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An',
  'Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng',
  'Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh',
  'Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

export function getSocialLinks(): SocialLinks {
  try {
    const raw = localStorage.getItem('social_links');
    if (raw) return JSON.parse(raw) as SocialLinks;
  } catch {
    // ignore
  }
  return { facebook: '', youtube: '', zalo: '', instagram: '' };
}

type Section = 'general' | 'shipping' | 'social' | 'language' | 'sidebar';

type AdminSidebarSettings = {
  hiddenItemIds: string[];
};

const ADMIN_SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'analytics', label: 'Phân tích AI' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'products-all', label: 'Tất cả sản phẩm' },
  { id: 'products-new', label: 'Thêm sản phẩm' },
  { id: 'products-import', label: 'Nhập kho thủ công' },
  { id: 'products-damage', label: 'Hàng hỏng / trả hàng' },
  { id: 'products-lowstock', label: 'Tổng quan tồn kho' },
  { id: 'categories', label: 'Danh mục' },
  { id: 'subcategories', label: 'Danh mục phụ' },
  { id: 'origins', label: 'Xuất xứ' },
  { id: 'tags', label: 'Nhãn sản phẩm' },
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'returns', label: 'Trả hàng' },
  { id: 'discounts', label: 'Chương trình giảm giá' },
  { id: 'customers', label: 'Tài khoản' },
  { id: 'news', label: 'Bài viết' },
  { id: 'news-comments', label: 'Bình luận' },
  { id: 'reviews', label: 'Đánh giá sản phẩm' },
  { id: 'payments', label: 'Thanh toán' },
  { id: 'support-chats', label: 'Chat hỗ trợ' },
  { id: 'rice-diagnosis', label: 'AI bệnh lúa' },
  { id: 'suppliers', label: 'Nhà cung cấp' },
  { id: 'procurement', label: 'Mua hàng' },
  { id: 'pricing', label: 'Định giá bán' },
  { id: 'warehouses', label: 'Kho hàng' },
  { id: 'inventory-ledger', label: 'Sổ kho chi tiết' },
  { id: 'inventory-valuation', label: 'Giá trị tồn kho' },
  { id: 'profitability', label: 'Lợi nhuận thật' },
  { id: 'aging-debt', label: 'Tuổi nợ NCC' },
  { id: 'credit-limits', label: 'Hạn mức công nợ' },
  { id: 'audit-logs', label: 'Nhật ký thao tác' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'reports', label: 'Báo cáo' },
  { id: 'permissions', label: 'Phân quyền' },
  { id: 'interface', label: 'Giao diện' },
  { id: 'security', label: 'Bảo mật' },
  { id: 'settings', label: 'Cấu hình' },
];

// Mirrors the permissions defined in Sidebar.tsx navItems.
// undefined = public (everyone can see); array = at least one perm required.
const SIDEBAR_ITEM_PERMISSIONS: Record<string, string[] | undefined> = {
  'dashboard': undefined,
  'analytics': ['manage_inventory'],
  'products': ['manage_products'],
  'products-all': ['manage_products'],
  'products-new': ['manage_products'],
  'products-import': ['manage_inventory'],
  'products-damage': ['manage_inventory'],
  'products-lowstock': ['manage_inventory'],
  'categories': ['manage_products'],
  'subcategories': ['manage_products'],
  'origins': ['manage_products'],
  'tags': ['manage_products'],
  'orders': ['manage_orders'],
  'returns': ['manage_orders'],
  'discounts': ['manage_discounts'],
  'customers': ['manage_users'],
  'news': ['manage_news'],
  'news-comments': ['manage_news'],
  'reviews': ['manage_reviews'],
  'payments': ['manage_orders'],
  'support-chats': ['manage_support'],
  'rice-diagnosis': ['manage_ai_diagnosis'],
  'suppliers': ['manage_products'],
  'procurement': ['manage_products'],
  'pricing': ['manage_products'],
  'warehouses': ['manage_inventory'],
  'inventory-ledger': ['manage_inventory'],
  'inventory-valuation': ['manage_reports'],
  'profitability': ['manage_reports'],
  'aging-debt': ['manage_reports'],
  'credit-limits': ['manage_users'],
  'audit-logs': ['manage_permissions'],
  'newsletter': ['manage_news'],
  'reports': ['manage_reports'],
  'permissions': ['manage_permissions'],
  'interface': ['manage_interface'],
  'security': ['manage_settings'],
  'settings': ['manage_settings'],
};

type StoreConfig = {
  name: string;
  email: string;
  address: string;
  province: string;
  phone: string;
};

type SocialLinks = {
  facebook: string;
  youtube: string;
  zalo: string;
  instagram: string;
};

type DeliveryMethod = {
  id: string;
  name: string;
  type: 'delivery' | 'pickup';
  description: string | null;
  basePrice: number;
  minOrderAmount: number;
  freeShippingThreshold: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  region: string | null;
  areas: Array<{ id: string; province: string; district: string | null }>;
  isDefault: boolean;
  isActive: boolean;
};

type DeliveryMethodForm = {
  name: string;
  type: 'delivery' | 'pickup';
  description: string;
  basePrice: string;
  minOrderAmount: string;
  freeShippingThreshold: string;
  etaMinDays: string;
  etaMaxDays: string;
  region: string;
  areasText: string;
  isDefault: boolean;
  isActive: boolean;
};

const defaultDeliveryForm: DeliveryMethodForm = {
  name: '',
  type: 'delivery',
  description: '',
  basePrice: '0',
  minOrderAmount: '0',
  freeShippingThreshold: '',
  etaMinDays: '',
  etaMaxDays: '',
  region: '',
  areasText: '',
  isDefault: false,
  isActive: true,
};

function formatPrice(v: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
}

function deliveryAreasLabel(method: DeliveryMethod) {
  if (method.type === 'pickup') return 'Tại cửa hàng';
  if (!method.areas.length) return 'Toàn quốc';
  return method.areas
    .map((area) => area.district ? `${area.district}, ${area.province}` : area.province)
    .join('; ');
}

function deliveryAreasText(method: DeliveryMethod) {
  return method.areas
    .map((area) => area.district ? `${area.province} | ${area.district}` : area.province)
    .join('\n');
}

function parseDeliveryAreas(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [province, district] = line.split('|').map((value) => value.trim());
      return { province, district: district || undefined };
    })
    .filter((area) => area.province);
}

// ── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<StoreConfig>(() => {
    try {
      const raw = localStorage.getItem('store_config');
      if (raw) return JSON.parse(raw) as StoreConfig;
    } catch {
      // ignore
    }
    return { name: 'Agri E-Commerce', email: 'admin@agri.vn', address: '', province: 'Hà Nội', phone: '' };
  });

  const handleSave = () => {
    localStorage.setItem('store_config', JSON.stringify(config));
    showToast({ tone: 'success', title: 'Đã lưu thông tin website' });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-on-surface">Thông tin website</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Cấu hình thông tin cơ bản cho cửa hàng.</p>
      </div>

      <div className="rounded-xl border border-on-surface-variant/10 bg-white p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Tên website
          </label>
          <input
            value={config.name}
            onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
            className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Email liên hệ
          </label>
          <input
            type="email"
            value={config.email}
            onChange={(e) => setConfig((c) => ({ ...c, email: e.target.value }))}
            className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Số điện thoại
          </label>
          <input
            value={config.phone}
            onChange={(e) => setConfig((c) => ({ ...c, phone: e.target.value }))}
            className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Địa chỉ
          </label>
          <input
            value={config.address}
            onChange={(e) => setConfig((c) => ({ ...c, address: e.target.value }))}
            className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Tỉnh / Thành phố
          </label>
          <select
            value={config.province}
            onChange={(e) => setConfig((c) => ({ ...c, province: e.target.value }))}
            className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            {VIETNAM_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
      >
        <Save size={16} /> Lưu thay đổi
      </button>
    </div>
  );
}

// ── Shipping Tab ──────────────────────────────────────────────────────────────

function ShippingTab() {
  const { showToast } = useToast();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeliveryMethodForm>(defaultDeliveryForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMethods = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<DeliveryMethod[]>('/delivery-methods/admin/all');
      setMethods(Array.isArray(data) ? data : []);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMethods();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultDeliveryForm);
    setModalOpen(true);
  };

  const openEdit = (m: DeliveryMethod) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      type: m.type,
      description: m.description ?? '',
      basePrice: String(m.basePrice),
      minOrderAmount: String(m.minOrderAmount),
      freeShippingThreshold: m.freeShippingThreshold == null ? '' : String(m.freeShippingThreshold),
      etaMinDays: m.etaMinDays == null ? '' : String(m.etaMinDays),
      etaMaxDays: m.etaMaxDays == null ? '' : String(m.etaMaxDays),
      region: m.region ?? '',
      areasText: deliveryAreasText(m),
      isDefault: m.isDefault,
      isActive: m.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast({ tone: 'error', title: 'Tên phương thức không được để trống' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        isPickup: form.type === 'pickup',
        basePrice: form.type === 'pickup' ? 0 : Number(form.basePrice),
        minOrderAmount: Number(form.minOrderAmount),
        freeShippingThreshold:
          form.type === 'pickup' || !form.freeShippingThreshold
            ? null
            : Number(form.freeShippingThreshold),
        etaMinDays:
          form.type === 'pickup' || !form.etaMinDays
            ? null
            : Number(form.etaMinDays),
        etaMaxDays:
          form.type === 'pickup' || !form.etaMaxDays
            ? null
            : Number(form.etaMaxDays),
        region: form.region.trim() || null,
        areas: form.type === 'pickup' ? [] : parseDeliveryAreas(form.areasText),
        isDefault: form.type === 'pickup' ? false : form.isDefault,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiClient.patch(`/delivery-methods/${editingId}`, body);
        showToast({ tone: 'success', title: 'Đã cập nhật phương thức nhận hàng' });
      } else {
        await apiClient.post('/delivery-methods', body);
        showToast({ tone: 'success', title: 'Đã thêm phương thức nhận hàng' });
      }
      setModalOpen(false);
      void loadMethods();
    } catch (err) {
      showToast({ tone: 'error', title: err instanceof Error ? err.message : 'Lưu thất bại' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await askConfirm({
      title: 'Xóa phương thức nhận hàng?',
      description: 'Nếu phương thức đã phát sinh đơn, hệ thống sẽ chỉ ngừng hoạt động để giữ lịch sử đơn hàng.',
      tone: 'danger',
      confirmLabel: 'Xóa / ngừng hoạt động',
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const result = await apiClient.delete<{ deleted?: boolean; deactivated?: boolean }>(`/delivery-methods/${id}`);
      showToast({
        tone: 'success',
        title: result.deactivated
          ? 'Phương thức đã phát sinh đơn, hệ thống đã ngừng hoạt động'
          : 'Đã xóa phương thức nhận hàng',
      });
      void loadMethods();
    } catch (err) {
      showToast({ tone: 'error', title: err instanceof Error ? err.message : 'Xoá thất bại' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-on-surface">Phương thức nhận hàng</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Quản lý giao hàng, nhận tại cửa hàng, khu vực áp dụng và cước phí.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-on-surface-variant/20 p-12 text-center">
          <Truck size={36} className="mx-auto mb-3 text-on-surface-variant/30" />
          <p className="text-sm text-on-surface-variant">Chưa có phương thức nhận hàng nào.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-on-surface-variant/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-on-surface-variant/8 bg-on-surface-variant/3">
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tên</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">Loại</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">Khu vực</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">Cước phí</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">Điều kiện</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant">ETA</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mặc định</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-on-surface-variant">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {methods.map((m) => (
                <tr key={m.id} className="hover:bg-on-surface-variant/2 transition">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-on-surface">{m.name}</p>
                    {m.description && <p className="text-xs text-on-surface-variant mt-0.5">{m.description}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.type === 'pickup' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      {m.type === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao hàng'}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-5 py-4 text-xs text-on-surface-variant">
                    {deliveryAreasLabel(m)}
                  </td>
                  <td className="px-5 py-4 text-on-surface">{formatPrice(m.basePrice)}</td>
                  <td className="px-5 py-4 text-xs text-on-surface">
                    <p>Tối thiểu {formatPrice(m.minOrderAmount)}</p>
                    <p className="mt-1 text-on-surface-variant">
                      {m.freeShippingThreshold == null ? 'Không ngưỡng miễn phí' : `Miễn phí từ ${formatPrice(m.freeShippingThreshold)}`}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant">
                    {m.type === 'pickup'
                      ? 'Theo giờ cửa hàng'
                      : m.etaMinDays == null || m.etaMaxDays == null
                        ? 'Chưa cấu hình'
                        : `${m.etaMinDays}-${m.etaMaxDays} ngày`}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {m.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        <CheckCircle2 size={11} /> Mặc định
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${m.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {m.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(m)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-on-surface-variant/10 text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => void handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-on-surface-variant/10 text-on-surface-variant transition hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="px-6 py-5 border-b border-on-surface-variant/8">
              <h3 className="text-base font-black text-on-surface">
                {editingId ? 'Chỉnh sửa phương thức nhận hàng' : 'Thêm phương thức nhận hàng'}
              </h3>
            </div>
            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Loại phương thức
                </label>
                <div className="grid grid-cols-2 rounded-2xl border border-on-surface-variant/15 bg-on-surface-variant/5 p-1">
                  {([
                    { value: 'delivery', label: 'Giao hàng' },
                    { value: 'pickup', label: 'Nhận tại cửa hàng' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((current) => ({
                        ...current,
                        type: option.value,
                        isDefault: option.value === 'pickup' ? false : current.isDefault,
                      }))}
                      className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                        form.type === option.value
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Tên *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  placeholder={form.type === 'pickup' ? 'Ví dụ: Nhận tại cửa hàng' : 'Ví dụ: Giao hàng tiêu chuẩn'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {form.type === 'pickup' ? 'Hướng dẫn nhận hàng' : 'Mô tả'}
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  placeholder={form.type === 'pickup' ? 'Khách mang mã đơn và số điện thoại khi đến nhận.' : 'Giao trong 3-5 ngày làm việc.'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {form.type === 'delivery' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Phí cơ bản (VND)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.basePrice}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                      className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Đơn tối thiểu (VND)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrderAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                    className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>
              {form.type === 'delivery' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Miễn phí từ</label>
                      <input
                        type="number"
                        min={0}
                        value={form.freeShippingThreshold}
                        onChange={(e) => setForm((f) => ({ ...f, freeShippingThreshold: e.target.value }))}
                        className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                        placeholder="Không áp dụng"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">ETA tối thiểu</label>
                      <input
                        type="number"
                        min={0}
                        value={form.etaMinDays}
                        onChange={(e) => setForm((f) => ({ ...f, etaMinDays: e.target.value }))}
                        className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                        placeholder="Ngày"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">ETA tối đa</label>
                      <input
                        type="number"
                        min={0}
                        value={form.etaMaxDays}
                        onChange={(e) => setForm((f) => ({ ...f, etaMaxDays: e.target.value }))}
                        className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                        placeholder="Ngày"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Khu vực áp dụng</label>
                    <textarea
                      value={form.areasText}
                      onChange={(e) => setForm((f) => ({ ...f, areasText: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      placeholder={'Để trống = toàn quốc\nHà Nội\nTP. Hồ Chí Minh | Quận 7'}
                    />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Mỗi dòng là một tỉnh; thêm quận/huyện bằng dấu <span className="font-bold">|</span> để giới hạn chi tiết.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Nhận tại cửa hàng luôn có phí 0 đồng và không kiểm tra khu vực giao hàng. Checkout chỉ yêu cầu tên người nhận và số điện thoại.
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Ghi chú khu vực hiển thị</label>
                <input
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  placeholder={form.type === 'pickup' ? 'Ví dụ: Cửa hàng Hưng Yên' : 'Ví dụ: Nội thành, liên tỉnh...'}
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    disabled={form.type === 'pickup'}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-sm font-semibold text-on-surface">Đặt làm mặc định</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-sm font-semibold text-on-surface">Kích hoạt</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-on-surface-variant/8">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-2xl border border-on-surface-variant/15 px-5 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-on-surface-variant/5"
              >
                Huỷ
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save size={15} />
                )}
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Social Tab ────────────────────────────────────────────────────────────────

function SocialTab() {
  const { showToast } = useToast();
  const [links, setLinks] = useState<SocialLinks>(getSocialLinks);

  const handleSave = () => {
    localStorage.setItem('social_links', JSON.stringify(links));
    showToast({ tone: 'success', title: 'Đã lưu liên kết mạng xã hội' });
  };

  const fields: { key: keyof SocialLinks; label: string; placeholder: string; icon: ReactNode; color: string }[] = [
    {
      key: 'facebook',
      label: 'Facebook',
      placeholder: 'https://facebook.com/yourpage',
      icon: <Facebook size={16} />,
      color: 'text-[#1877F2]',
    },
    {
      key: 'youtube',
      label: 'YouTube',
      placeholder: 'https://youtube.com/@yourchannel',
      icon: <Youtube size={16} />,
      color: 'text-[#FF0000]',
    },
    {
      key: 'zalo',
      label: 'Zalo',
      placeholder: 'https://zalo.me/yourpage',
      icon: <span className="text-xs font-black">Z</span>,
      color: 'text-[#0068FF]',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      placeholder: 'https://instagram.com/yourprofile',
      icon: <Share2 size={16} />,
      color: 'text-[#E1306C]',
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-on-surface">Mạng xã hội</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Liên kết tới các trang mạng xã hội của cửa hàng.</p>
      </div>

      <div className="rounded-xl border border-on-surface-variant/10 bg-white p-6 space-y-5">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <span className={f.color}>{f.icon}</span>
              {f.label}
            </label>
            <input
              type="url"
              value={links[f.key]}
              onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
      >
        <Save size={16} /> Lưu liên kết
      </button>
    </div>
  );
}

// ── Language Tab ──────────────────────────────────────────────────────────────

type CustomLanguage = { code: string; name: string; flag: string };

const BUILTIN_LANGUAGES: CustomLanguage[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

const CUSTOM_LANG_KEY = 'custom_languages';
const ACTIVE_LANG_KEY = 'active_language_code';

function loadCustomLanguages(): CustomLanguage[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LANG_KEY);
    if (raw) return JSON.parse(raw) as CustomLanguage[];
  } catch {}
  return [];
}

function LanguageTab() {
  const { language, setLanguage } = useLanguage();
  const { showToast } = useToast();

  const [customLanguages, setCustomLanguages] = useState<CustomLanguage[]>(loadCustomLanguages);
  const [activeLangCode, setActiveLangCode] = useState<string>(
    () => localStorage.getItem(ACTIVE_LANG_KEY) ?? language,
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLang, setNewLang] = useState<CustomLanguage>({ code: '', name: '', flag: '' });

  const allLanguages = [...BUILTIN_LANGUAGES, ...customLanguages];
  const isBuiltin = (code: string) => BUILTIN_LANGUAGES.some((l) => l.code === code);

  const activate = (code: string) => {
    setActiveLangCode(code);
    localStorage.setItem(ACTIVE_LANG_KEY, code);
    if (code === 'vi' || code === 'en') {
      setLanguage(code);
    }
    showToast({ tone: 'success', title: `Đã đặt ngôn ngữ: ${allLanguages.find((l) => l.code === code)?.name ?? code}` });
  };

  const handleAddLanguage = () => {
    const code = newLang.code.trim().toLowerCase();
    const name = newLang.name.trim();
    const flag = newLang.flag.trim();
    if (!code || !name) {
      showToast({ tone: 'error', title: 'Vui lòng nhập mã và tên ngôn ngữ' });
      return;
    }
    if (allLanguages.some((l) => l.code === code)) {
      showToast({ tone: 'error', title: `Mã ngôn ngữ "${code}" đã tồn tại` });
      return;
    }
    const updated = [...customLanguages, { code, name, flag: flag || '🌐' }];
    setCustomLanguages(updated);
    localStorage.setItem(CUSTOM_LANG_KEY, JSON.stringify(updated));
    setNewLang({ code: '', name: '', flag: '' });
    setShowAddForm(false);
    showToast({ tone: 'success', title: `Đã thêm ngôn ngữ: ${name}` });
  };

  const handleDeleteLanguage = (code: string) => {
    const updated = customLanguages.filter((l) => l.code !== code);
    setCustomLanguages(updated);
    localStorage.setItem(CUSTOM_LANG_KEY, JSON.stringify(updated));
    if (activeLangCode === code) activate('vi');
    showToast({ tone: 'success', title: 'Đã xoá ngôn ngữ' });
  };

  const inputCls = 'w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-on-surface">Ngôn ngữ giao diện</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Chọn ngôn ngữ hiển thị cho trang quản trị.</p>
      </div>

      {/* Language list */}
      <div className="overflow-hidden rounded-xl border border-on-surface-variant/10 bg-white">
        {allLanguages.map((lang, i) => {
          const isActive = activeLangCode === lang.code;
          return (
            <div
              key={lang.code}
              className={`flex items-center gap-4 px-5 py-4 transition hover:bg-primary/[0.02] ${i > 0 ? 'border-t border-on-surface-variant/5' : ''}`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex-1">
                <p className={`text-sm font-black ${isActive ? 'text-primary' : 'text-on-surface'}`}>{lang.name}</p>
                <p className="text-xs text-on-surface-variant/60">
                  {lang.code.toUpperCase()}
                  {!isBuiltin(lang.code) && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">Tùy chỉnh</span>}
                </p>
              </div>
              {isActive && <CheckCircle2 size={18} className="shrink-0 text-primary" />}
              <button
                onClick={() => activate(lang.code)}
                disabled={isActive}
                className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition ${isActive ? 'bg-primary/10 text-primary cursor-default' : 'border border-on-surface-variant/15 text-on-surface-variant hover:border-primary/30 hover:text-primary'}`}
              >
                {isActive ? 'Đang dùng' : 'Kích hoạt'}
              </button>
              {!isBuiltin(lang.code) && (
                <button
                  onClick={() => handleDeleteLanguage(lang.code)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-on-surface-variant/10 text-on-surface-variant/40 transition hover:border-red-200 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add language form */}
      {showAddForm ? (
        <div className="rounded-xl border border-on-surface-variant/10 bg-white p-6 space-y-4">
          <h3 className="text-sm font-black text-on-surface">Thêm ngôn ngữ mới</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Mã *</label>
              <input
                className={inputCls}
                placeholder="fr"
                value={newLang.code}
                onChange={(e) => setNewLang((l) => ({ ...l, code: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Tên *</label>
              <input
                className={inputCls}
                placeholder="Français"
                value={newLang.name}
                onChange={(e) => setNewLang((l) => ({ ...l, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Cờ (emoji)</label>
              <input
                className={inputCls}
                placeholder="🇫🇷"
                value={newLang.flag}
                onChange={(e) => setNewLang((l) => ({ ...l, flag: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAddLanguage}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              <Plus size={15} /> Thêm
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewLang({ code: '', name: '', flag: '' }); }}
              className="rounded-2xl border border-on-surface-variant/15 px-5 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-on-surface-variant/5"
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-on-surface-variant/20 px-5 py-3 text-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
        >
          <Plus size={16} /> Thêm ngôn ngữ
        </button>
      )}

      {/* Note */}
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Ngôn ngữ tùy chỉnh hiện chỉ thay đổi code, chưa có bản dịch đầy đủ. Chỉ Tiếng Việt và English có giao diện dịch hoàn chỉnh.
      </p>
    </div>
  );
}

function SidebarTab() {
  const { showToast } = useToast();
  const { session } = useAdminSession();
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AdminSidebarSettings>('/settings/admin/sidebar')
      .then((data) => {
        if (!cancelled) setHiddenItemIds(data.hiddenItemIds ?? []);
      })
      .catch(() => {
        if (!cancelled) setHiddenItemIds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userPermSet = new Set((session?.user.permissions ?? []).map((p) => p.key));

  const itemHasAccess = (perms?: string[]): boolean => {
    if (!perms || perms.length === 0) return true;
    return perms.some((key) => userPermSet.has(key));
  };

  const accessibleItems = ADMIN_SIDEBAR_ITEMS.filter((item) =>
    itemHasAccess(SIDEBAR_ITEM_PERMISSIONS[item.id]),
  );

  const toggle = (id: string) => {
    setHiddenItemIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await apiClient.put<AdminSidebarSettings>('/settings/admin/sidebar', {
        hiddenItemIds,
      });
      setHiddenItemIds(data.hiddenItemIds ?? []);
      showToast({ tone: 'success', title: 'Đã lưu cấu hình sidebar' });
    } catch (err) {
      showToast({ tone: 'error', title: err instanceof Error ? err.message : 'Lưu cấu hình thất bại' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-on-surface">Sidebar quản trị</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Tắt các mục không cần hiển thị trong menu admin.</p>
      </div>

      <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Đang tải cấu hình...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accessibleItems.map((item) => {
              const visible = !hiddenItemIds.includes(item.id);
              return (
                <label key={item.id} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-on-surface-variant/10 bg-surface px-4 py-3">
                  <span className="text-sm font-bold text-on-surface">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => void save()}
        disabled={saving || loading}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình sidebar'}
      </button>
    </div>
  );
}

// ── Settings Hub Sections ─────────────────────────────────────────────────────

type SectionConfig = {
  key: Section;
  label: string;
  description: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
};

const SECTIONS: SectionConfig[] = [
  {
    key: 'general',
    label: 'Thông tin cửa hàng',
    description: 'Tên, địa chỉ, liên hệ và tỉnh thành',
    icon: <Building2 size={22} />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    key: 'shipping',
    label: 'Vận chuyển',
    description: 'Đơn vị giao hàng, cước phí và phương thức',
    icon: <Truck size={22} />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    key: 'social',
    label: 'Mạng xã hội',
    description: 'Facebook, YouTube, Zalo — liên kết footer',
    icon: <Share2 size={22} />,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },
  {
    key: 'language',
    label: 'Ngôn ngữ',
    description: 'Ngôn ngữ hiển thị cho admin và client',
    icon: <Globe size={22} />,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    key: 'sidebar',
    label: 'Sidebar',
    description: 'An hien cac muc quan tri khong can dung',
    icon: <PanelLeft size={22} />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

// ── Hub (landing view) ────────────────────────────────────────────────────────

function SettingsHub({ onSelect }: { onSelect: (s: Section) => void }) {
  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="font-headline mb-2 text-4xl font-black leading-none tracking-tight text-primary">
          Cài đặt hệ thống
        </h1>
        <p className="text-base font-medium text-on-surface-variant">
          Chọn mục cấu hình bên dưới để chỉnh sửa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className="group flex flex-col gap-4 rounded-xl border border-on-surface-variant/10 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.iconBg} ${s.iconColor}`}>
              {s.icon}
            </div>
            <div className="flex-1">
              <p className="text-base font-black text-on-surface group-hover:text-primary transition-colors">
                {s.label}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                {s.description}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-on-surface-variant/5 text-on-surface-variant transition group-hover:bg-primary/10 group-hover:text-primary">
                <ChevronRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tỉnh thành</p>
              <p className="text-sm font-black text-on-surface">63 tỉnh/thành</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">
            Dropdown 63 tỉnh thành đã được tích hợp vào trang địa chỉ và thanh toán.
          </p>
        </div>
        <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Truck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Vận chuyển</p>
              <p className="text-sm font-black text-on-surface">CRUD đầy đủ</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">
            Thêm/sửa/xoá đơn vị vận chuyển. Phí được hiển thị trước khi thanh toán.
          </p>
        </div>
        <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
              <Share2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Social Links</p>
              <p className="text-sm font-black text-on-surface">4 nền tảng</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">
            Links mạng xã hội tự động cập nhật ở footer trang client.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Settings() {
  const [active, setActive] = useState<Section | null>(null);

  const activeSectionConfig = SECTIONS.find((s) => s.key === active);

  return (
    <div className="pb-20">
      {active === null ? (
        <SettingsHub onSelect={setActive} />
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActive(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface-variant/15 text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <button onClick={() => setActive(null)} className="hover:text-primary transition-colors font-semibold">
                Cài đặt
              </button>
              <ChevronRight size={14} className="opacity-40" />
              <span className="font-black text-on-surface">
                {activeSectionConfig?.label}
              </span>
            </div>
          </div>

          {/* Sub-page content */}
          <div>
            {active === 'general' && <GeneralTab />}
            {active === 'shipping' && <ShippingTab />}
            {active === 'social' && <SocialTab />}
            {active === 'language' && <LanguageTab />}
            {active === 'sidebar' && <SidebarTab />}
          </div>
        </div>
      )}
    </div>
  );
}
