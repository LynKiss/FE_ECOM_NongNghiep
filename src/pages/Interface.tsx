import { type DragEvent, useEffect, useState } from 'react';
import {
  Palette,
  Layout,
  Plus,
  GripVertical,
  CheckCircle2,
  Monitor,
  Smartphone,
  Sun,
  Moon,
  Type,
  Grid3X3,
  Settings2,
  Eye,
  EyeOff,
  ChevronRight,
  Home,
  Star,
  StarOff,
  Search,
  Loader,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Pencil,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/language-context';
import { apiClient } from '../lib/api';
import { useToast } from '../hooks/useToast';

type ProductItem = {
  productId: string;
  productName: string;
  primaryImageUrl?: string | null;
  basePrice?: string;
  effectivePrice?: string;
  isFeatured?: boolean;
  category?: { categoryName: string };
};

type HomepageSection = {
  id: string;
  label: string;
  enabled: boolean;
};

const SECTIONS_STORAGE_KEY = 'homepage_sections_config';
const CONTENT_STORAGE_KEY = 'homepage_content_config';

type HomepageContentConfig = {
  hero?: { title?: string; subtitle?: string; buttonText?: string; bgColor?: string };
  stats?: Array<{ value: string; label: string }>;
  sale_banner?: { title?: string; subtitle?: string; buttonText?: string };
  why_us?: Array<{ title: string; description: string }>;
};

const DEFAULT_STATS: Array<{ value: string; label: string }> = [
  { value: '15.000+', label: 'Nông dân tin tưởng' },
  { value: '500+', label: 'Sản phẩm chính hãng' },
  { value: '63', label: 'Tỉnh thành giao hàng' },
  { value: '98%', label: 'Tỷ lệ hài lòng' },
];

const DEFAULT_WHY_US: Array<{ title: string; description: string }> = [
  { title: 'Hàng chính hãng 100%', description: 'Toàn bộ sản phẩm có giấy chứng nhận và nguồn gốc rõ ràng. Cam kết không hàng giả, hàng nhái.' },
  { title: 'Giao hàng toàn quốc', description: 'Đối tác vận chuyển uy tín, giao hàng 2–4 ngày. Miễn phí vận chuyển đơn hàng từ 500.000đ.' },
  { title: 'Hỗ trợ kỹ thuật', description: 'Đội ngũ kỹ sư nông nghiệp tư vấn trực tiếp. Hotline miễn phí 1800 6863, hỗ trợ 7 ngày/tuần.' },
  { title: 'Đổi trả dễ dàng', description: 'Chính sách đổi trả trong 7 ngày nếu sản phẩm lỗi hoặc không đúng mô tả. Hoàn tiền 100%.' },
];

function loadContentConfig(): HomepageContentConfig {
  try {
    const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HomepageContentConfig;
  } catch {}
  return {};
}

// ── Content Edit Modal ────────────────────────────────────────────────────────

function ContentEditModal({
  sectionId,
  config,
  onSave,
  onClose,
}: {
  sectionId: string;
  config: HomepageContentConfig;
  onSave: (next: HomepageContentConfig) => void;
  onClose: () => void;
}) {
  // Local draft state per section
  const [hero, setHero] = useState({
    title: config.hero?.title ?? 'Mọi mùa vụ đều bắt đầu từ đây.',
    subtitle: config.hero?.subtitle ?? 'Cung cấp đầy đủ vật tư nông nghiệp — phân bón, thuốc BVTV, hạt giống, dụng cụ — chính hãng, giá tốt, giao nhanh toàn quốc.',
    buttonText: config.hero?.buttonText ?? 'Khám phá ngay',
    bgColor: config.hero?.bgColor ?? '#1E3932',
  });

  const [stats, setStats] = useState<Array<{ value: string; label: string }>>(
    config.stats ?? DEFAULT_STATS.map((s) => ({ ...s })),
  );

  const [saleBanner, setSaleBanner] = useState({
    title: config.sale_banner?.title ?? 'Giảm giá lên đến 30% cho nhiều sản phẩm 🔥',
    subtitle: config.sale_banner?.subtitle ?? 'Đừng bỏ lỡ! Số lượng có hạn.',
    buttonText: config.sale_banner?.buttonText ?? 'Xem ưu đãi →',
  });

  const [whyUs, setWhyUs] = useState<Array<{ title: string; description: string }>>(
    config.why_us ?? DEFAULT_WHY_US.map((s) => ({ ...s })),
  );

  const handleSave = () => {
    const next: HomepageContentConfig = { ...config };
    if (sectionId === 'hero') next.hero = hero;
    if (sectionId === 'stats') next.stats = stats;
    if (sectionId === 'sale_banner') next.sale_banner = saleBanner;
    if (sectionId === 'why_us') next.why_us = whyUs;
    onSave(next);
  };

  const inputCls = 'w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';

  const sectionTitle: Record<string, string> = {
    hero: 'Banner Hero',
    stats: 'Thống kê',
    categories: 'Danh mục sản phẩm',
    featured: 'Sản phẩm nổi bật',
    sale_banner: 'Banner khuyến mãi',
    why_us: 'Tại sao chọn chúng tôi',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-on-surface-variant/8 shrink-0">
          <h3 className="text-base font-black text-on-surface">
            Chỉnh nội dung — {sectionTitle[sectionId] ?? sectionId}
          </h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-on-surface-variant/50 transition hover:text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* HERO */}
          {sectionId === 'hero' && (
            <>
              <div>
                <label className={labelCls}>Tiêu đề chính</label>
                <input className={inputCls} value={hero.title} onChange={(e) => setHero((h) => ({ ...h, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Mô tả phụ</label>
                <textarea rows={3} className={inputCls + ' resize-none'} value={hero.subtitle} onChange={(e) => setHero((h) => ({ ...h, subtitle: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Văn bản nút CTA</label>
                <input className={inputCls} value={hero.buttonText} onChange={(e) => setHero((h) => ({ ...h, buttonText: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Màu nền (hex)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={hero.bgColor} onChange={(e) => setHero((h) => ({ ...h, bgColor: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-on-surface-variant/20 bg-transparent p-1" />
                  <input className={inputCls + ' flex-1'} value={hero.bgColor} onChange={(e) => setHero((h) => ({ ...h, bgColor: e.target.value }))} placeholder="#1E3932" />
                </div>
              </div>
            </>
          )}

          {/* STATS */}
          {sectionId === 'stats' && (
            <div className="space-y-3">
              {stats.map((stat, i) => (
                <div key={i} className="rounded-2xl border border-on-surface-variant/10 p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant/50">Thống kê {i + 1}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Giá trị</label>
                      <input className={inputCls} value={stat.value}
                        onChange={(e) => setStats((arr) => arr.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} />
                    </div>
                    <div>
                      <label className={labelCls}>Nhãn</label>
                      <input className={inputCls} value={stat.label}
                        onChange={(e) => setStats((arr) => arr.map((s, j) => j === i ? { ...s, label: e.target.value } : s))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CATEGORIES */}
          {sectionId === 'categories' && (
            <div className="rounded-2xl bg-on-surface-variant/5 px-5 py-4 text-sm text-on-surface-variant">
              Danh mục được lấy từ DB tự động — không cần chỉnh sửa tại đây.
            </div>
          )}

          {/* FEATURED */}
          {sectionId === 'featured' && (
            <div className="rounded-2xl bg-on-surface-variant/5 px-5 py-4 text-sm text-on-surface-variant">
              Sản phẩm nổi bật được quản lý trong tab <strong>"Sản phẩm nổi bật"</strong> bên dưới.
            </div>
          )}

          {/* SALE BANNER */}
          {sectionId === 'sale_banner' && (
            <>
              <div>
                <label className={labelCls}>Tiêu đề banner</label>
                <input className={inputCls} value={saleBanner.title} onChange={(e) => setSaleBanner((b) => ({ ...b, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Mô tả phụ</label>
                <input className={inputCls} value={saleBanner.subtitle} onChange={(e) => setSaleBanner((b) => ({ ...b, subtitle: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Văn bản nút</label>
                <input className={inputCls} value={saleBanner.buttonText} onChange={(e) => setSaleBanner((b) => ({ ...b, buttonText: e.target.value }))} />
              </div>
            </>
          )}

          {/* WHY US */}
          {sectionId === 'why_us' && (
            <div className="space-y-3">
              {whyUs.map((item, i) => (
                <div key={i} className="rounded-2xl border border-on-surface-variant/10 p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant/50">Lý do {i + 1}</p>
                  <div>
                    <label className={labelCls}>Tiêu đề</label>
                    <input className={inputCls} value={item.title}
                      onChange={(e) => setWhyUs((arr) => arr.map((it, j) => j === i ? { ...it, title: e.target.value } : it))} />
                  </div>
                  <div>
                    <label className={labelCls}>Mô tả</label>
                    <textarea rows={2} className={inputCls + ' resize-none'} value={item.description}
                      onChange={(e) => setWhyUs((arr) => arr.map((it, j) => j === i ? { ...it, description: e.target.value } : it))} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DEFAULT */}
          {!['hero', 'stats', 'categories', 'featured', 'sale_banner', 'why_us'].includes(sectionId) && (
            <div className="rounded-2xl bg-on-surface-variant/5 px-5 py-4 text-sm text-on-surface-variant">
              Nội dung được tự động lấy từ hệ thống — không cần chỉnh sửa tại đây.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-on-surface-variant/8 shrink-0">
          <button onClick={onClose}
            className="rounded-2xl border border-on-surface-variant/15 px-5 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-on-surface-variant/5">
            Huỷ
          </button>
          <button onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
            Lưu nội dung
          </button>
        </div>
      </div>
    </div>
  );
}

const INITIAL_SECTIONS: HomepageSection[] = [
  { id: 'hero', label: 'Banner Hero (trang chủ)', enabled: true },
  { id: 'stats', label: 'Thống kê (15.000+ khách hàng...)', enabled: true },
  { id: 'categories', label: 'Danh mục sản phẩm', enabled: true },
  { id: 'featured', label: 'Sản phẩm nổi bật (carousel)', enabled: true },
  { id: 'best_sellers', label: 'Sản phẩm bán chạy (carousel)', enabled: true },
  { id: 'sale_banner', label: 'Banner khuyến mãi', enabled: true },
  { id: 'sale_products', label: 'Sản phẩm khuyến mãi', enabled: true },
  { id: 'why_us', label: 'Tại sao chọn chúng tôi', enabled: true },
  { id: 'testimonials', label: 'Đánh giá khách hàng', enabled: true },
  { id: 'news', label: 'Tin tức mới nhất', enabled: true },
];

const THEME_OPTIONS = [
  { id: 'botanical', name: 'Botanical Enterprise', version: '2.4.1', primary: '#1b5e20', accent: '#d9f7c9', bg: '#f4f7f1', houseColor: '#1E3932', starbucksColor: '#006241', greenAccent: '#00754A', neutralWarm: '#f2f0eb' },
  { id: 'harvest',   name: 'Harvest Gold',         version: '1.2.0', primary: '#92400e', accent: '#fde68a', bg: '#fffbeb', houseColor: '#451a03', starbucksColor: '#78350f', greenAccent: '#d97706', neutralWarm: '#fef9f0' },
  { id: 'midnight',  name: 'Midnight Field',        version: '1.0.0', primary: '#8bdc8b', accent: '#1d3a29', bg: '#0f1713', houseColor: '#0a0f0d', starbucksColor: '#1d3a29', greenAccent: '#8bdc8b', neutralWarm: '#0f1713' },
];

const TYPOGRAPHY_OPTIONS = [
  { id: 'inter', label: 'Inter', preview: 'Aa' },
  { id: 'manrope', label: 'Manrope', preview: 'Aa' },
  { id: 'nunito', label: 'Nunito Sans', preview: 'Aa' },
];

const BLOCKS_STORAGE_KEY = 'admin_blocks_config';
type Block = { id: string; title: string; desc: string; status: 'active' | 'hidden' };
const INITIAL_BLOCKS: Block[] = [
  { id: 'metric_cards',      title: 'Thẻ số liệu tổng quan',        desc: 'Doanh thu, đơn hàng, khách hàng, tồn kho, đánh giá...', status: 'active' },
  { id: 'revenue_chart',     title: 'Doanh thu & đơn hàng 30 ngày', desc: 'Biểu đồ doanh thu theo ngày kết hợp số đơn',            status: 'active' },
  { id: 'order_status_chart',title: 'Tỷ lệ trạng thái đơn',         desc: 'Donut chart phát hiện backlog xử lý đơn',               status: 'active' },
  { id: 'top_products_chart',title: 'Top sản phẩm bán chạy',         desc: 'Bar chart xếp hạng sản phẩm theo số lượng bán',         status: 'active' },
  { id: 'category_revenue',  title: 'Doanh thu theo danh mục',       desc: 'So sánh doanh thu từng danh mục sản phẩm',             status: 'active' },
  { id: 'shopping_hours',    title: 'Giờ vàng mua sắm',              desc: 'Heatmap doanh thu theo 24 giờ trong ngày',             status: 'active' },
  { id: 'payment_mix',       title: 'Cơ cấu thanh toán',             desc: 'Tỷ lệ COD, ví điện tử, chuyển khoản...',               status: 'active' },
  { id: 'stock_health',      title: 'Sức khỏe tồn kho',              desc: 'Phân tích hàng hết, thấp, trung bình, đủ hàng',        status: 'active' },
  { id: 'inventory_chart',   title: 'Giá trị tồn kho theo danh mục', desc: 'Vốn đang nằm trong kho so với tồn khả dụng',           status: 'active' },
  { id: 'customer_segments', title: 'Phân khúc khách hàng',          desc: 'Chưa mua, mua 1 lần, lặp lại, thân thiết',             status: 'active' },
  { id: 'voucher_chart',     title: 'Hiệu quả voucher',              desc: 'Lượt dùng và doanh thu kéo theo từng mã',              status: 'active' },
  { id: 'new_customers',     title: 'Khách mới 30 ngày',             desc: 'Biểu đồ tốc độ tăng trưởng khách hàng mới',           status: 'active' },
];

const TABS = [
  { id: 'homepage', label: 'Trang chủ client', icon: Home },
  { id: 'theme', label: 'Giao diện', icon: Palette },
  { id: 'blocks', label: 'Khối', icon: Layout },
];

function formatPrice(p: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
}

export default function Interface() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isVi = language === 'vi';

  const [activeTab, setActiveTab] = useState('homepage');

  // Homepage management state
  const [sections, setSections] = useState<HomepageSection[]>(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HomepageSection[];
        // Merge with INITIAL_SECTIONS to include any new sections added later
        return INITIAL_SECTIONS.map(s => ({
          ...s,
          enabled: parsed.find(p => p.id === s.id)?.enabled ?? s.enabled,
        }));
      }
    } catch {}
    return INITIAL_SECTIONS;
  });
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Content editing state
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [contentConfig, setContentConfig] = useState<HomepageContentConfig>(loadContentConfig);

  const handleSaveContent = (next: HomepageContentConfig) => {
    setContentConfig(next);
    try { localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setEditingSection(null);
    showToast({ tone: 'success', title: 'Đã lưu nội dung section' });
  };

  // Theme state
  const [activeTheme, setActiveTheme] = useState('botanical');
  const [activeTypo, setActiveTypo] = useState('inter');
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'spacious'>('comfortable');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(0);

  // Advanced custom theme
  const loadAdvancedTheme = () => {
    try {
      const raw = localStorage.getItem('client_theme_advanced');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      primaryColor: '#006241',
      accentColor: '#D4A537',
      bgColor: '#F5F1E8',
      borderRadius: 16,
      brandName: 'Nông Nghiệp Việt',
      logoUrl: '',
      footerText: '© 2025 Nông Nghiệp Việt. Mọi quyền được bảo lưu.',
      hotline: '1800 6863',
      sticky: true,
    };
  };
  const [advanced, setAdvanced] = useState<{
    primaryColor: string;
    accentColor: string;
    bgColor: string;
    borderRadius: number;
    brandName: string;
    logoUrl: string;
    footerText: string;
    hotline: string;
    sticky: boolean;
  }>(loadAdvancedTheme());

  // Block state — persisted to localStorage
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const saved = localStorage.getItem(BLOCKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Block[];
        return INITIAL_BLOCKS.map((b) => ({
          ...b,
          status: parsed.find((p) => p.id === b.id)?.status ?? b.status,
        }));
      }
    } catch {}
    return INITIAL_BLOCKS;
  });

  // Drag-and-drop state for sections
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load featured products on mount
  useEffect(() => {
    void apiClient
      .get<{ items: ProductItem[] }>('/products?isFeatured=true&limit=20&includeHidden=false')
      .then((d) => setFeaturedProducts(d.items ?? []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiClient.get<{ items: ProductItem[] }>(
        `/products?search=${encodeURIComponent(searchQuery.trim())}&limit=8&includeHidden=false`,
      );
      setSearchResults(data.items ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleFeatured = async (product: ProductItem) => {
    setTogglingId(product.productId);
    try {
      await apiClient.patch(`/products/${product.productId}/toggle-featured`, {});

      if (product.isFeatured) {
        setFeaturedProducts((prev) => prev.filter((p) => p.productId !== product.productId));
      } else {
        setFeaturedProducts((prev) => [...prev, { ...product, isFeatured: true }]);
      }

      setSearchResults((prev) =>
        prev.map((p) =>
          p.productId === product.productId ? { ...p, isFeatured: !p.isFeatured } : p,
        ),
      );

      showToast({
        tone: 'success',
        title: product.isFeatured ? 'Đã bỏ nổi bật' : 'Đã đánh dấu nổi bật',
        description: product.productName,
      });
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Thao tác thất bại',
        description: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const toggleSection = (id: string) => {
    setSections((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleBlock = (id: string) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, status: (b.status === 'active' ? 'hidden' : 'active') as Block['status'] } : b));
      try { localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    showToast({ tone: 'success', title: blocks.find((b) => b.id === id)?.status === 'active' ? 'Đã ẩn khối' : 'Đã bật khối' });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...sections];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setSections(reordered);
    try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(reordered)); } catch {}
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveTheme = () => {
    const themeConfig = { themeId: activeTheme, fontId: activeTypo, mode, density };
    try { localStorage.setItem('client_theme_config', JSON.stringify(themeConfig)); } catch {}
    try { localStorage.setItem('client_theme_advanced', JSON.stringify(advanced)); } catch {}

    // Ưu tiên advanced custom override theme preset
    const useAdvanced =
      advanced.primaryColor &&
      advanced.primaryColor !== (THEME_OPTIONS.find((t) => t.id === activeTheme)?.primary ?? '');

    const theme = THEME_OPTIONS.find((t) => t.id === activeTheme);
    // Structural layout colors (header/footer bg, logo) ALWAYS come from theme preset
    if (theme) {
      document.documentElement.style.setProperty('--client-house-green', theme.houseColor);
      document.documentElement.style.setProperty('--client-starbucks-green', theme.starbucksColor);
      document.documentElement.style.setProperty('--client-neutral-warm', theme.neutralWarm);
    }
    // Advanced custom override only applies to accent/button colors, not structural
    if (useAdvanced) {
      document.documentElement.style.setProperty('--client-primary', advanced.primaryColor);
      document.documentElement.style.setProperty('--client-green-accent', advanced.primaryColor);
      if (advanced.accentColor) document.documentElement.style.setProperty('--client-accent', advanced.accentColor);
      if (advanced.bgColor) document.documentElement.style.setProperty('--client-bg', advanced.bgColor);
    } else if (theme) {
      document.documentElement.style.setProperty('--client-primary', theme.primary);
      document.documentElement.style.setProperty('--client-accent', theme.accent);
      document.documentElement.style.setProperty('--client-bg', theme.bg);
      document.documentElement.style.setProperty('--client-green-accent', theme.greenAccent);
    }
    document.documentElement.style.setProperty('--client-radius', `${advanced.borderRadius}px`);
    setPreviewKey((k) => k + 1);
    showToast({ tone: 'success', title: 'Đã lưu cài đặt giao diện', description: 'Thay đổi được áp dụng cho cửa hàng client.' });
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="max-w-3xl">
        <h1 className="text-[2.5rem] font-black leading-none tracking-tight text-primary">
          {isVi ? 'Quản lý giao diện' : 'Interface Management'}
        </h1>
        <p className="mt-3 text-base text-on-surface-variant">
          {isVi ? 'Cấu hình trang chủ client, theme và các khối giao diện admin.' : 'Configure client homepage, admin theme, and UI blocks.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-on-surface-variant/10 bg-white p-1.5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? 'bg-primary text-white shadow' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: HOMEPAGE ===== */}
      {activeTab === 'homepage' && (
        <div className="space-y-8">

          {/* Section visibility */}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <Sliders className="text-accent" size={22} />
              <div>
                <h2 className="text-xl font-black text-primary">Bật / tắt sections trang chủ</h2>
                <p className="text-sm text-on-surface-variant">Thay đổi trực tiếp hiển thị các phần trên trang chủ client.</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-on-surface-variant/8 bg-white">
              {sections.map((sec, i) => (
                <div
                  key={sec.id}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  className={`flex items-center justify-between px-5 py-4 transition hover:bg-primary/[0.02] ${i > 0 ? 'border-t border-on-surface-variant/5' : ''} ${dragOverIndex === i && dragIndex !== i ? 'bg-primary/5 ring-2 ring-inset ring-primary/20' : ''} ${dragIndex === i ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical size={16} className="cursor-grab text-on-surface-variant/25 hover:text-primary/50 active:cursor-grabbing" />
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${sec.enabled ? 'bg-primary/10' : 'bg-on-surface-variant/8'}`}>
                      <Layout size={16} className={sec.enabled ? 'text-primary' : 'text-on-surface-variant/30'} />
                    </div>
                    <p className={`text-sm font-semibold ${sec.enabled ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>{sec.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSection(sec.id)}
                      title="Chỉnh nội dung"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-on-surface-variant/10 text-on-surface-variant/40 transition hover:border-primary/30 hover:text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleSection(sec.id)} className="transition hover:scale-110">
                      {sec.enabled
                        ? <ToggleRight size={28} className="text-primary" />
                        : <ToggleLeft size={28} className="text-on-surface-variant/30" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Featured products manager */}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <Star className="text-accent" size={22} />
              <div>
                <h2 className="text-xl font-black text-primary">Sản phẩm nổi bật (carousel trang chủ)</h2>
                <p className="text-sm text-on-surface-variant">
                  Chọn sản phẩm hiển thị trong section carousel "Nổi bật" trên trang chủ client.
                  Hiện có <strong>{featuredProducts.length}</strong> sản phẩm nổi bật.
                </p>
              </div>
            </div>

            {/* Current featured */}
            {featuredProducts.length > 0 && (
              <div className="mb-5 rounded-xl border border-on-surface-variant/8 bg-white p-5">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-on-surface-variant/50">Đang được đánh dấu nổi bật</p>
                <div className="space-y-2">
                  {featuredProducts.map((p) => (
                    <div key={p.productId} className="flex items-center gap-3 rounded-xl border border-on-surface-variant/8 p-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {p.primaryImageUrl
                          ? <img src={p.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-on-surface-variant/20">🌿</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{p.productName}</p>
                        {p.category && <p className="text-xs text-on-surface-variant/50">{p.category.categoryName}</p>}
                      </div>
                      <button
                        onClick={() => void handleToggleFeatured({ ...p, isFeatured: true })}
                        disabled={togglingId === p.productId}
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {togglingId === p.productId ? <Loader size={11} className="animate-spin" /> : <StarOff size={11} />}
                        Bỏ nổi bật
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search to add */}
            <div className="rounded-xl border border-on-surface-variant/8 bg-white p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-on-surface-variant/50">Tìm sản phẩm để thêm vào nổi bật</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                    placeholder="Nhập tên sản phẩm..."
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary/40"
                  />
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/30" />
                </div>
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {searching ? <Loader size={14} className="animate-spin" /> : null}
                  Tìm
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((p) => {
                    const alreadyFeatured = featuredProducts.some((fp) => fp.productId === p.productId) || p.isFeatured;
                    return (
                      <div key={p.productId} className="flex items-center gap-3 rounded-xl border border-on-surface-variant/8 p-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-surface">
                          {p.primaryImageUrl
                            ? <img src={p.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-on-surface-variant/20">🌿</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface">{p.productName}</p>
                          <p className="text-xs text-on-surface-variant/50">
                            {p.category?.categoryName} {p.effectivePrice && `· ${formatPrice(Number(p.effectivePrice))}`}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleToggleFeatured({ ...p, isFeatured: alreadyFeatured })}
                          disabled={togglingId === p.productId}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${alreadyFeatured ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        >
                          {togglingId === p.productId ? <Loader size={11} className="animate-spin" /> : alreadyFeatured ? <StarOff size={11} /> : <Star size={11} />}
                          {alreadyFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Content edit modal */}
      {editingSection !== null && (
        <ContentEditModal
          sectionId={editingSection}
          config={contentConfig}
          onSave={handleSaveContent}
          onClose={() => setEditingSection(null)}
        />
      )}

      {/* ===== TAB: THEME ===== */}
      {activeTab === 'theme' && (
        <div className="space-y-8">
          {/* Theme Gallery */}
          <section>
            <div className="mb-6 flex items-center gap-3">
              <Palette className="text-accent" size={24} />
              <h2 className="text-xl font-black text-primary">Bộ nhận diện (Theme)</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {THEME_OPTIONS.map((theme) => (
                <button key={theme.id} onClick={() => setActiveTheme(theme.id)}
                  className={`group relative overflow-hidden rounded-xl border-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${activeTheme === theme.id ? 'border-primary shadow-md' : 'border-on-surface-variant/10 bg-white hover:border-primary/30'}`}>
                  <div className="mb-4 flex h-28 items-center justify-center overflow-hidden rounded-2xl" style={{ background: theme.bg }}>
                    <div className="flex gap-2">
                      <div className="h-12 w-12 rounded-xl shadow-md" style={{ background: theme.primary }} />
                      <div className="h-12 w-12 rounded-xl shadow-md" style={{ background: theme.accent }} />
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-on-surface">{theme.name}</p>
                      <p className="mt-0.5 text-xs text-on-surface-variant/60">v{theme.version}</p>
                    </div>
                    {activeTheme === theme.id && <CheckCircle2 size={20} className="mt-0.5 text-primary" />}
                  </div>
                  {activeTheme === theme.id && (
                    <div className="mt-3 rounded-full bg-primary/10 px-3 py-1.5 text-center text-[11px] font-black uppercase tracking-wider text-primary">Đang sử dụng</div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Appearance settings */}
          <section>
            <div className="mb-6 flex items-center gap-3">
              <Settings2 className="text-accent" size={24} />
              <h2 className="text-xl font-black text-primary">Cài đặt hiển thị</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
                <p className="mb-3 font-bold text-on-surface flex items-center gap-2">
                  {mode === 'light' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-indigo-400" />}
                  Chế độ màu
                </p>
                <div className="flex gap-2">
                  {[{ id: 'light', icon: Sun, label: 'Sáng' }, { id: 'dark', icon: Moon, label: 'Tối' }].map((m) => (
                    <button key={m.id} onClick={() => setMode(m.id as 'light' | 'dark')}
                      className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold transition ${mode === m.id ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant hover:bg-primary/5'}`}>
                      <m.icon size={16} />{m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
                <p className="mb-3 font-bold text-on-surface flex items-center gap-2"><Type size={18} className="text-primary" />Kiểu chữ</p>
                <div className="space-y-2">
                  {TYPOGRAPHY_OPTIONS.map((t) => (
                    <button key={t.id} onClick={() => setActiveTypo(t.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${activeTypo === t.id ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface-variant hover:bg-surface'}`}>
                      <span>{t.label}</span><span className="text-base font-black">{t.preview}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5">
                <p className="mb-3 font-bold text-on-surface flex items-center gap-2"><Grid3X3 size={18} className="text-primary" />Mật độ layout</p>
                <div className="space-y-2">
                  {[{ id: 'compact', label: 'Gọn' }, { id: 'comfortable', label: 'Thoải mái' }, { id: 'spacious', label: 'Rộng rãi' }].map((d) => (
                    <button key={d.id} onClick={() => setDensity(d.id as typeof density)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${density === d.id ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface-variant hover:bg-surface'}`}>
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── ADVANCED CUSTOMIZATION ────────────────────────────────────── */}
          <section>
            <div className="mb-6 flex items-center gap-3">
              <Sliders className="text-accent" size={24} />
              <h2 className="text-xl font-black text-primary">Tùy chỉnh nâng cao</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                Pro
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Color customization */}
              <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5 space-y-4">
                <p className="font-bold text-on-surface flex items-center gap-2">
                  <Palette size={18} className="text-primary" />
                  Màu sắc tùy chỉnh
                </p>

                {[
                  { key: 'primaryColor', label: 'Màu chính (Primary)', help: 'Màu nút bấm, link, accent chính' },
                  { key: 'accentColor', label: 'Màu phụ (Accent)', help: 'Highlight, badge, icon' },
                  { key: 'bgColor', label: 'Màu nền (Background)', help: 'Nền của trang client' },
                ].map((c) => (
                  <div key={c.key}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      {c.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(advanced as any)[c.key]}
                        onChange={(e) => setAdvanced((a) => ({ ...a, [c.key]: e.target.value }))}
                        className="h-10 w-14 cursor-pointer rounded-xl border border-on-surface-variant/20 bg-transparent p-1"
                      />
                      <input
                        type="text"
                        value={(advanced as any)[c.key]}
                        onChange={(e) => setAdvanced((a) => ({ ...a, [c.key]: e.target.value }))}
                        className="flex-1 rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-3 py-2 text-sm font-mono outline-none focus:border-primary/40"
                        placeholder="#000000"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface-variant/50">{c.help}</p>
                  </div>
                ))}
              </div>

              {/* Layout & Brand */}
              <div className="rounded-xl border border-on-surface-variant/10 bg-white p-5 space-y-4">
                <p className="font-bold text-on-surface flex items-center gap-2">
                  <Settings2 size={18} className="text-primary" />
                  Layout & Thương hiệu
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Bo góc (Border radius): {advanced.borderRadius}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={advanced.borderRadius}
                    onChange={(e) =>
                      setAdvanced((a) => ({ ...a, borderRadius: Number(e.target.value) }))
                    }
                    className="w-full accent-primary"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-on-surface-variant/50">
                    <span>Vuông</span>
                    <span>Mềm mại</span>
                    <span>Rất tròn</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Tên thương hiệu
                  </label>
                  <input
                    type="text"
                    value={advanced.brandName}
                    onChange={(e) => setAdvanced((a) => ({ ...a, brandName: e.target.value }))}
                    className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    URL Logo (https)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={advanced.logoUrl}
                    onChange={(e) => setAdvanced((a) => ({ ...a, logoUrl: e.target.value }))}
                    className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                  />
                  {advanced.logoUrl && (
                    <div className="mt-2 flex h-14 items-center justify-center rounded-xl border border-on-surface-variant/10 bg-surface p-2">
                      <img
                        src={advanced.logoUrl}
                        alt="Logo preview"
                        className="max-h-full"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Hotline
                  </label>
                  <input
                    type="text"
                    value={advanced.hotline}
                    onChange={(e) => setAdvanced((a) => ({ ...a, hotline: e.target.value }))}
                    className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Văn bản footer
                  </label>
                  <textarea
                    rows={2}
                    value={advanced.footerText}
                    onChange={(e) => setAdvanced((a) => ({ ...a, footerText: e.target.value }))}
                    className="w-full rounded-xl border border-on-surface-variant/20 bg-on-surface-variant/5 px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Header dính (sticky)</p>
                    <p className="text-[11px] text-on-surface-variant/60">Header luôn hiện khi cuộn trang</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={advanced.sticky}
                    onChange={(e) => setAdvanced((a) => ({ ...a, sticky: e.target.checked }))}
                    className="h-5 w-5 rounded accent-primary"
                  />
                </label>
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-6 rounded-xl border border-on-surface-variant/10 bg-white p-5">
              <p className="mb-4 font-bold text-on-surface flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                Xem trước thay đổi
              </p>
              <div
                className="overflow-hidden rounded-xl p-6 transition-all"
                style={{
                  background: advanced.bgColor,
                  borderRadius: `${advanced.borderRadius}px`,
                }}
              >
                <div className="flex items-center justify-between rounded-2xl bg-white/80 px-5 py-3 backdrop-blur">
                  <div className="flex items-center gap-2">
                    {advanced.logoUrl ? (
                      <img src={advanced.logoUrl} alt="" className="h-8" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
                    ) : null}
                    <p className="text-base font-black" style={{ color: advanced.primaryColor }}>
                      {advanced.brandName}
                    </p>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: advanced.accentColor }}>
                    📞 {advanced.hotline}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    style={{
                      background: advanced.primaryColor,
                      borderRadius: `${advanced.borderRadius}px`,
                    }}
                    className="px-5 py-2.5 text-sm font-bold text-white shadow"
                  >
                    Mua ngay
                  </button>
                  <button
                    style={{
                      background: advanced.accentColor,
                      borderRadius: `${advanced.borderRadius}px`,
                    }}
                    className="px-5 py-2.5 text-sm font-bold text-white shadow"
                  >
                    Khám phá
                  </button>
                </div>
                <p className="mt-4 text-xs text-on-surface-variant/60">{advanced.footerText}</p>
              </div>
            </div>
          </section>

          {/* Save theme button */}
          <section className="flex justify-end">
            <button
              onClick={handleSaveTheme}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-md shadow-primary/20 transition hover:opacity-90 active:scale-95"
            >
              <CheckCircle2 size={16} />
              Lưu cài đặt giao diện
            </button>
          </section>

          {/* Preview */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="text-accent" size={24} />
                <h2 className="text-xl font-black text-primary">Xem trước</h2>
              </div>
              <div className="flex gap-2 rounded-xl border border-on-surface-variant/10 bg-white p-1">
                {[{ id: 'desktop', icon: Monitor }, { id: 'mobile', icon: Smartphone }].map((d) => (
                  <button key={d.id} onClick={() => setPreviewDevice(d.id as 'desktop' | 'mobile')}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${previewDevice === d.id ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface'}`}>
                    <d.icon size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-on-surface-variant/10 bg-white">
              <div className="flex items-center gap-2 border-b border-on-surface-variant/8 bg-surface px-5 py-3">
                <div className="flex gap-1.5">
                  {['#ef4444', '#f59e0b', '#22c55e'].map((c) => <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
                </div>
                <div className="ml-2 flex-1 rounded-full bg-on-surface-variant/8 px-3 py-1 text-xs text-on-surface-variant/50">localhost:5173/client</div>
              </div>
              <div className="mx-auto transition-all duration-300 overflow-hidden" style={{ maxWidth: previewDevice === 'mobile' ? '390px' : '100%' }}>
                <iframe
                  key={previewKey}
                  src="/client"
                  title="Client preview"
                  className="w-full border-0"
                  style={{ height: previewDevice === 'mobile' ? '700px' : '540px', pointerEvents: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ===== TAB: BLOCKS ===== */}
      {activeTab === 'blocks' && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <Layout className="text-accent" size={24} />
              <div>
                <h2 className="text-xl font-black text-primary">Khối giao diện</h2>
                <p className="text-sm text-on-surface-variant">Bật/tắt và sắp xếp các widget hiển thị trên bảng điều khiển.</p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-on-surface px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
              <Plus size={16} /> Thêm khối
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-on-surface-variant/8 bg-white">
            {blocks.map((block, index) => (
              <div key={block.id}
                className={`group flex items-center justify-between px-5 py-4 transition-colors hover:bg-primary/[0.02] ${index > 0 ? 'border-t border-on-surface-variant/5' : ''} ${block.status === 'hidden' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: block.status === 'active' ? 'rgba(27,94,32,0.08)' : 'rgba(0,0,0,0.04)' }}>
                    <Layout size={18} className={block.status === 'active' ? 'text-primary' : 'text-on-surface-variant/30'} />
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">{block.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant/50">{block.desc}</p>
                  </div>
                </div>
                <button onClick={() => toggleBlock(block.id)}
                  className="transition hover:scale-110 shrink-0 ml-4">
                  {block.status === 'active'
                    ? <ToggleRight size={28} className="text-primary" />
                    : <ToggleLeft size={28} className="text-on-surface-variant/30" />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
