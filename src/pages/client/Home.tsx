import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  Truck,
  HeadphonesIcon,
  Star,
  ChevronLeft,
  ChevronRight,
  Sprout,
  FlaskConical,
  TreePine,
  Droplets,
  Award,
  RefreshCw,
  ShoppingCart,
  Tag,
  Flame,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import { triggerCartFlyAnimation } from '../../hooks/useCartAnimation';

type Product = {
  productId: string;
  productName: string;
  productSlug: string;
  basePrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
  quantityAvailable?: number;
  ratingAverage?: string;
  ratingCount?: number;
  unit?: string | null;
  category?: { categoryId: string; categoryName: string };
  appliedDiscount?: { id: string; type: string; value: number; name?: string } | null;
};

type NewsItem = {
  newsId: string;
  title: string;
  subTitle?: string;
  slug: string;
  titleImageUrl?: string | null;
  createdAt: string;
};

type Category = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
};

const CATEGORY_ICONS: Record<string, typeof Leaf> = {
  default: Leaf,
  phan: FlaskConical,
  thuoc: ShieldCheck,
  hat: Sprout,
  cay: TreePine,
  tuoi: Droplets,
};

function getCategoryIcon(slug: string) {
  const key = Object.keys(CATEGORY_ICONS).find((k) => slug.includes(k));
  return CATEGORY_ICONS[key ?? 'default'];
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const TESTIMONIALS = [
  { name: 'Nguyễn Văn Minh', role: 'Nông dân tỉnh Đồng Tháp', text: 'Sản phẩm chất lượng cao, giao hàng nhanh. Phân bón hữu cơ giúp lúa tôi tốt hơn hẳn mùa trước.', stars: 5 },
  { name: 'Trần Thị Hoa', role: 'Chủ vườn trái cây Tiền Giang', text: 'Đặt hàng online rất tiện lợi. Thuốc bảo vệ thực vật chính hãng, không lo hàng giả như ngoài thị trường.', stars: 5 },
  { name: 'Lê Văn Hùng', role: 'HTX nông nghiệp Cần Thơ', text: 'Giá cả cạnh tranh, tư vấn kỹ thuật nhiệt tình. Sẽ tiếp tục mua hàng ở đây lâu dài.', stars: 5 },
];

const DEFAULT_STATS = [
  { value: '15.000+', label: 'Nông dân tin tưởng' },
  { value: '500+', label: 'Sản phẩm chính hãng' },
  { value: '63', label: 'Tỉnh thành giao hàng' },
  { value: '98%', label: 'Tỷ lệ hài lòng' },
];

const DEFAULT_WHY_US = [
  { emoji: '✅', title: 'Hàng chính hãng 100%', desc: 'Toàn bộ sản phẩm có giấy chứng nhận và nguồn gốc rõ ràng. Cam kết không hàng giả, hàng nhái.', icon: ShieldCheck },
  { emoji: '🚚', title: 'Nhận hàng linh hoạt', desc: 'Chọn giao đến địa chỉ hoặc nhận tại cửa hàng. Phí và thời gian dự kiến được báo rõ ở checkout.', icon: Truck },
  { emoji: '🎧', title: 'Hỗ trợ kỹ thuật', desc: 'Đội ngũ kỹ sư nông nghiệp tư vấn trực tiếp. Hotline miễn phí 1800 6863, hỗ trợ 7 ngày/tuần.', icon: HeadphonesIcon },
  { emoji: '♻️', title: 'Đổi trả dễ dàng', desc: 'Chính sách đổi trả trong 7 ngày nếu sản phẩm lỗi hoặc không đúng mô tả. Hoàn tiền 100%.', icon: RefreshCw },
];

type HomepageContentConfig = {
  hero?: { title?: string; subtitle?: string; buttonText?: string; bgColor?: string };
  stats?: Array<{ value: string; label: string }>;
  sale_banner?: { title?: string; subtitle?: string; buttonText?: string };
  why_us?: Array<{ title: string; description: string }>;
};

function loadHomepageContent(): HomepageContentConfig {
  try {
    const raw = localStorage.getItem('homepage_content_config');
    if (raw) return JSON.parse(raw) as HomepageContentConfig;
  } catch {}
  return {};
}

// ── Product Card (compact for carousel) ──────────────────────────────────────
function ProductCard({ product, onAddToCart, adding }: {
  product: Product;
  onAddToCart: (e: MouseEvent<HTMLButtonElement>) => void;
  adding: boolean;
  key?: string;
}) {
  const base = Number(product.basePrice);
  const effective = Number(product.effectivePrice);
  const hasDiscount = effective < base - 0.01;
  const discountPct = hasDiscount ? Math.round(((base - effective) / base) * 100) : 0;
  const outOfStock = product.quantityAvailable === 0;

  return (
    <div className="client-card-soft group flex w-56 shrink-0 flex-col overflow-hidden transition-all duration-300 sm:w-64">
      <div className="relative overflow-hidden bg-[#f2f0eb]">
        <Link to={`/client/products/${product.productId}`}>
          {product.primaryImageUrl ? (
            <img src={product.primaryImageUrl} alt={product.productName}
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-44 items-center justify-center">
              <Leaf size={40} className="text-[#006241]/20" />
            </div>
          )}
        </Link>
        {hasDiscount && discountPct > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white">
            -{discountPct}%
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-700">Hết hàng</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.category && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#006241' }}>
            {product.category.categoryName}
          </p>
        )}
        <Link to={`/client/products/${product.productId}`}
          className="line-clamp-2 text-sm font-bold text-[#1E3932] hover:text-[#006241]">
          {product.productName}
        </Link>

        {product.ratingCount && product.ratingCount > 0 ? (
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={9} fill={s <= Math.round(Number(product.ratingAverage ?? 0)) ? '#f59e0b' : 'none'}
                className={s <= Math.round(Number(product.ratingAverage ?? 0)) ? 'text-amber-400' : 'text-gray-200'} />
            ))}
            <span className="text-[10px] text-gray-400">({product.ratingCount})</span>
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-base font-black" style={{ color: '#006241' }}>{formatPrice(effective)}</span>
            {hasDiscount && <span className="text-xs text-gray-400 line-through">{formatPrice(base)}</span>}
          </div>
          {product.appliedDiscount && hasDiscount && (
            <p className="flex items-center gap-1 text-[10px] font-semibold text-orange-500">
              <Tag size={9} />
              {product.appliedDiscount.type === 'PERCENTAGE'
                ? `Giảm ${product.appliedDiscount.value}%`
                : `Giảm ${formatPrice(product.appliedDiscount.value)}`}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Link to={`/client/products/${product.productId}`}
              className="client-pill-outline flex-1 py-2 text-center text-xs font-bold">
              Chi tiết
            </Link>
            <button onClick={(e) => onAddToCart(e)} disabled={adding || outOfStock}
              className="client-pill-primary flex flex-1 items-center justify-center gap-1 py-2 text-xs font-bold disabled:opacity-50">
              {adding
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <><ShoppingCart size={11} />Thêm</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Carousel ─────────────────────────────────────────────────────────────────
function ProductCarousel({ products, addingId, onAddToCart, loading }: {
  products: Product[];
  addingId: string | null;
  onAddToCart: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="client-card h-80 w-56 shrink-0 animate-pulse sm:w-64" />
        ))}
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="relative">
      {/* Prev button */}
      <button onClick={() => scroll('left')}
        className="absolute -left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white transition hover:bg-[#006241] hover:text-white">
        <ChevronLeft size={18} />
      </button>

      {/* Scroll container */}
      <div ref={ref}
        className="flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {products.map((p) => (
          <ProductCard
            key={p.productId}
            product={p}
            adding={addingId === p.productId}
            onAddToCart={(e) => onAddToCart(p.productId, e)}
          />
        ))}
      </div>

      {/* Next button */}
      <button onClick={() => scroll('right')}
        className="absolute -right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white transition hover:bg-[#006241] hover:text-white">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const { session } = useClientSession();
  const { addItem } = useCart();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [bestSellerProducts, setBestSellerProducts] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingBest, setLoadingBest] = useState(true);
  const [loadingSale, setLoadingSale] = useState(true);

  const [sectionConfig] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('homepage_sections_config');
      if (saved) {
        const arr = JSON.parse(saved) as { id: string; enabled: boolean }[];
        return Object.fromEntries(arr.map(s => [s.id, s.enabled]));
      }
    } catch {}
    return {};
  });

  const [contentCfg] = useState<HomepageContentConfig>(loadHomepageContent);

  // Derived content values with fallbacks
  const heroBgColor = contentCfg.hero?.bgColor ?? '#1E3932';
  const heroTitle = contentCfg.hero?.title ?? 'Mọi mùa vụ đều bắt đầu từ đây.';
  const heroSubtitle = contentCfg.hero?.subtitle ?? 'Cung cấp đầy đủ vật tư nông nghiệp — phân bón, thuốc BVTV, hạt giống, dụng cụ — chính hãng, giá tốt, giao nhanh toàn quốc.';
  const heroButtonText = contentCfg.hero?.buttonText ?? 'Khám phá ngay';
  const statsData = contentCfg.stats ?? DEFAULT_STATS;
  const saleBannerTitle = contentCfg.sale_banner?.title ?? 'Giảm giá lên đến 30% cho nhiều sản phẩm 🔥';
  const saleBannerSubtitle = contentCfg.sale_banner?.subtitle ?? 'Đừng bỏ lỡ! Số lượng có hạn.';
  const saleBannerButton = contentCfg.sale_banner?.buttonText ?? 'Xem ưu đãi →';
  const whyUsData = DEFAULT_WHY_US.map((def, i) => {
    const override = contentCfg.why_us?.[i];
    return { emoji: def.emoji, icon: def.icon, title: override?.title ?? def.title, desc: override?.description ?? def.desc };
  });

  function isSectionEnabled(id: string): boolean {
    return sectionConfig[id] ?? true; // default true if not set
  }

  useEffect(() => {
    // Featured products (marked isFeatured = true)
    void clientApi
      .get<{ items: Product[] }>('/products?isFeatured=true&limit=12&page=1')
      .then((d) => { setFeaturedProducts(d.items ?? []); setLoadingFeatured(false); })
      .catch(() => setLoadingFeatured(false));

    // Best sellers (highest rating)
    void clientApi
      .get<{ items: Product[] }>('/products?sortBy=rating_average&sortOrder=DESC&limit=12&page=1')
      .then((d) => { setBestSellerProducts(d.items ?? []); setLoadingBest(false); })
      .catch(() => setLoadingBest(false));

    // Sale products (with sale price)
    void clientApi
      .get<{ items: Product[] }>('/products?hasSalePrice=true&limit=12&page=1')
      .then((d) => { setSaleProducts(d.items ?? []); setLoadingSale(false); })
      .catch(() => setLoadingSale(false));

    // News
    void clientApi
      .get<{ items: NewsItem[] }>('/news?limit=3&status=published')
      .then((d) => setNews(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => {});

    // Categories
    void clientApi
      .get<Category[]>('/categories')
      .then((d) => setCategories(Array.isArray(d) ? d.slice(0, 8) : []))
      .catch(() => {});
  }, []);

  const handleAddToCart = async (productId: string, e: MouseEvent<HTMLButtonElement>) => {
    triggerCartFlyAnimation(e.currentTarget);
    if (!session) { window.location.href = '/client/login'; return; }
    setAddingId(productId);
    try { await addItem(productId, 1); } finally { setAddingId(null); }
  };

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('loading');
    try {
      await clientApi.post('/newsletter/subscribe', { email: newsletterEmail });
      setNewsletterStatus('success');
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
    }
  };

  return (
    <div>
      <style>{`
        @keyframes floatUp { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-18px) rotate(3deg)} }
        @keyframes leafDrift { 0%{transform:translateY(0) translateX(0) rotate(0) scale(1);opacity:.8} 100%{transform:translateY(-120px) translateX(30px) rotate(40deg) scale(.6);opacity:0} }
        .float-box{animation:floatUp 5s ease-in-out infinite}
        .leaf-1{animation:leafDrift 4s ease-in-out infinite}
        .leaf-2{animation:leafDrift 5s ease-in-out 1s infinite}
        .leaf-3{animation:leafDrift 3.5s ease-in-out 2s infinite}
        .leaf-4{animation:leafDrift 4.5s ease-in-out .5s infinite}
        ::-webkit-scrollbar{display:none}
      `}</style>

      {/* ===== HERO ===== */}
      {isSectionEnabled('hero') && (<section style={{ background: heroBgColor }} className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold"
                style={{ background: 'rgba(0,117,74,0.3)', color: '#d4e9e2' }}>
                <Leaf size={12} /> Nông nghiệp bền vững · Chất lượng được chứng nhận
              </div>
              <h1 className="text-4xl font-black leading-tight text-white lg:text-6xl">
                {heroTitle}
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/client/products"
                  className="client-pill-primary flex items-center gap-2 px-7 py-3.5 text-sm font-bold">
                  {heroButtonText} <ArrowRight size={16} />
                </Link>
                <Link to="/client/news"
                  className="flex items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-bold transition-all active:scale-95"
                  style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)' }}>
                  Đọc tin tức
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6">
                {[{ icon: '🌿', text: '100% chính hãng' }, { icon: '🚚', text: 'Giao hàng 2–4 ngày' }, { icon: '⭐', text: '15.000+ khách hàng' }].map((b) => (
                  <div key={b.text} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="text-base">{b.icon}</span>{b.text}
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Scene */}
            <div className="flex items-center justify-center">
              <div style={{ perspective: '1200px' }} className="relative h-80 w-80">
                <div className="leaf-1 absolute left-4 top-10 select-none text-2xl">🌿</div>
                <div className="leaf-2 absolute right-8 top-6 select-none text-xl">🍃</div>
                <div className="leaf-3 absolute bottom-16 left-12 select-none text-lg">🌱</div>
                <div className="leaf-4 absolute bottom-20 right-4 select-none text-2xl">🌾</div>
                <div className="float-box absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%) rotateX(10deg) rotateY(-15deg)', transformStyle: 'preserve-3d' }}>
                  <div className="relative flex h-52 w-44 flex-col items-center justify-center overflow-hidden rounded-xl"
                    style={{ background: '#1E3932', boxShadow: 'var(--client-card-shadow)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl" style={{ background: 'rgba(0,117,74,0.4)', border: '1px solid rgba(0,117,74,0.5)' }}>
                      <span className="text-4xl">🌾</span>
                    </div>
                    <p className="text-center text-xs font-black uppercase tracking-widest text-white/80">Phân bón</p>
                    <p className="text-center text-[11px] text-white/40">Hữu cơ · Sinh học</p>
                    <div className="mt-3 flex gap-1">
                      {[1,2,3,4,5].map((s) => <Star key={s} size={8} fill="#d4e9e2" className="text-[#d4e9e2]" />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <svg viewBox="0 0 1440 80" className="block w-full" style={{ marginBottom: '-2px' }}>
          <path fill="#f2f0eb" d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>)}

      {/* ===== STATS ===== */}
      {isSectionEnabled('stats') && (<section style={{ background: '#f2f0eb' }} className="py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {statsData.map((s) => (
              <div key={s.label} className="client-card p-5 text-center">
                <p className="text-3xl font-black" style={{ color: '#006241' }}>{s.value}</p>
                <p className="mt-1 text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>)}

      {/* ===== CATEGORIES ===== */}
      {isSectionEnabled('categories') && categories.length > 0 && (
        <section style={{ background: '#f2f0eb' }} className="py-14">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Danh mục</p>
                <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Tìm theo nhóm sản phẩm</h2>
              </div>
              <Link to="/client/products" className="hidden items-center gap-1 text-sm font-bold transition hover:gap-2 sm:flex" style={{ color: '#006241' }}>
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.categorySlug);
                return (
                  <Link key={cat.categoryId} to={`/client/products?categoryId=${cat.categoryId}`}
                    className="client-card group flex flex-col items-center gap-3 p-4 text-center transition-all duration-200">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110" style={{ background: '#d4e9e2' }}>
                      <Icon size={22} style={{ color: '#006241' }} />
                    </div>
                    <p className="text-xs font-bold leading-tight" style={{ color: '#1E3932' }}>{cat.categoryName}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== FEATURED PRODUCTS (carousel) ===== */}
      {isSectionEnabled('featured') && (loadingFeatured || featuredProducts.length > 0) && (
        <section className="py-16" style={{ background: '#fff' }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Nổi bật</p>
                <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Sản phẩm được chọn lọc</h2>
              </div>
              <Link to="/client/products" className="hidden items-center gap-1 text-sm font-bold transition hover:gap-2 sm:flex" style={{ color: '#006241' }}>
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            <ProductCarousel
              products={featuredProducts}
              addingId={addingId}
              onAddToCart={(id, e) => void handleAddToCart(id, e)}
              loading={loadingFeatured}
            />
          </div>
        </section>
      )}

      {/* ===== BEST SELLERS (carousel) ===== */}
      {isSectionEnabled('best_sellers') && (loadingBest || bestSellerProducts.length > 0) && (
        <section className="py-16" style={{ background: '#f2f0eb' }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Bán chạy nhất</p>
                <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Sản phẩm được đánh giá cao</h2>
              </div>
              <Link to="/client/products?sort=rating" className="hidden items-center gap-1 text-sm font-bold transition hover:gap-2 sm:flex" style={{ color: '#006241' }}>
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            <ProductCarousel
              products={bestSellerProducts}
              addingId={addingId}
              onAddToCart={(id, e) => void handleAddToCart(id, e)}
              loading={loadingBest}
            />
          </div>
        </section>
      )}

      {/* ===== SALE BANNER ===== */}
      {isSectionEnabled('sale_banner') && (<section style={{ background: '#c82014' }}>
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Flame size={20} className="text-yellow-300" />
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">Siêu ưu đãi</p>
              </div>
              <h2 className="text-2xl font-black text-white">{saleBannerTitle}</h2>
              <p className="mt-2 text-sm text-white/70">{saleBannerSubtitle}</p>
            </div>
            <Link to="/client/products"
              className="shrink-0 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-red-600 transition-all active:scale-95">
              {saleBannerButton}
            </Link>
          </div>
        </div>
      </section>)}

      {/* ===== SALE PRODUCTS (carousel) ===== */}
      {isSectionEnabled('sale_products') && (loadingSale || saleProducts.length > 0) && (
        <section className="py-16" style={{ background: '#fff' }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#c82014' }}>
                  <Flame size={14} /> Siêu ưu đãi
                </p>
                <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Đang giảm giá mạnh</h2>
              </div>
              <Link to="/client/products" className="hidden items-center gap-1 text-sm font-bold transition hover:gap-2 sm:flex" style={{ color: '#006241' }}>
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            <ProductCarousel
              products={saleProducts}
              addingId={addingId}
              onAddToCart={(id, e) => void handleAddToCart(id, e)}
              loading={loadingSale}
            />
          </div>
        </section>
      )}

      {/* ===== WHY CHOOSE US ===== */}
      {isSectionEnabled('why_us') && (<section style={{ background: '#1E3932' }} className="relative overflow-hidden py-16">
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#d4e9e2' }}>Tại sao chọn chúng tôi</p>
            <h2 className="text-3xl font-black text-white">Cam kết từ chúng tôi</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {whyUsData.map((item) => (
              <div key={item.title} className="rounded-xl p-6 text-center"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: 'rgba(0,117,74,0.3)' }}>{item.emoji}</div>
                <h3 className="mb-2 font-black text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>)}

      {/* ===== TESTIMONIALS ===== */}
      {isSectionEnabled('testimonials') && (<section style={{ background: '#fff' }} className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Khách hàng nói gì</p>
            <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Đánh giá từ nông dân</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-xl bg-[#f2f0eb] p-6">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: t.stars }).map((_, i) => <Star key={i} size={14} fill="#006241" className="text-[#006241]" />)}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">"{t.text}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: '#1E3932' }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1E3932]">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>)}

      {/* ===== NEWS ===== */}
      {isSectionEnabled('news') && news.length > 0 && (
        <section style={{ background: '#f2f0eb' }} className="py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Tin tức & Kiến thức</p>
                <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>Nông nghiệp hôm nay</h2>
              </div>
              <Link to="/client/news" className="hidden items-center gap-1 text-sm font-bold transition hover:gap-2 sm:flex" style={{ color: '#006241' }}>
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {news.map((article, idx) => (
                <Link key={article.newsId} to={`/client/news/${article.slug}`}
                  className="client-card group overflow-hidden transition-all duration-300">
                  <div className="relative overflow-hidden" style={{ background: '#d4e9e2' }}>
                    {article.titleImageUrl ? (
                      <img src={article.titleImageUrl} alt={article.title}
                        className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-44 items-center justify-center">
                        <span className="text-5xl">{['🌾', '🌿', '🚜'][idx % 3]}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#006241' }}>
                      {new Date(article.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <h3 className="line-clamp-2 font-bold" style={{ color: '#1E3932' }}>{article.title}</h3>
                    {article.subTitle && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{article.subTitle}</p>}
                    <p className="mt-3 flex items-center gap-1 text-xs font-bold" style={{ color: '#006241' }}>Đọc tiếp <ArrowRight size={12} /></p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== BRAND/CERT ===== */}
      <section style={{ background: '#fff' }} className="border-t border-black/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-8 text-center text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Đối tác & Chứng nhận</p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {['🏛️ Bộ NN & PTNT', '✅ VietGAP', '🌿 Organic Certified', '🔬 ISO 9001:2015', '🚜 AgriTech Partner'].map((b) => (
              <div key={b} className="text-sm font-bold text-gray-400 transition hover:text-[#006241]">{b}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section style={{ background: '#f2f0eb' }} className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Mua sắm đơn giản</p>
            <h2 className="text-3xl font-black" style={{ color: '#1E3932' }}>3 bước đặt hàng</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '1', emoji: '🔍', title: 'Chọn sản phẩm', desc: 'Duyệt qua 500+ sản phẩm nông nghiệp chính hãng, lọc theo danh mục, giá cả và đánh giá.' },
              { step: '2', emoji: '🛒', title: 'Đặt hàng online', desc: 'Thêm vào giỏ hàng, nhập địa chỉ giao hàng và chọn phương thức thanh toán phù hợp.' },
              { step: '3', emoji: '🚚', title: 'Nhận hàng tận nơi', desc: 'Hàng được đóng gói cẩn thận và giao đến tận tay bạn trong 2–4 ngày làm việc.' },
            ].map((item) => (
              <div key={item.step} className="client-card relative p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: '#d4e9e2' }}>{item.emoji}</div>
                <div className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: '#006241' }}>{item.step}</div>
                <h3 className="mb-2 font-black text-[#1E3932]">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/client/products"
              className="client-pill-primary inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold">
              <ShoppingCart size={16} /> Bắt đầu mua sắm
            </Link>
          </div>
        </div>
      </section>

      {/* ===== NEWSLETTER ===== */}
      <section style={{ background: '#fff' }} className="py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: '#d4e9e2' }}>
            <Award size={28} style={{ color: '#006241' }} />
          </div>
          <h2 className="text-2xl font-black" style={{ color: '#1E3932' }}>Nhận thông tin khuyến mãi</h2>
          <p className="mt-2 text-sm text-gray-500">Đăng ký email để nhận ưu đãi độc quyền và kiến thức nông nghiệp mỗi tuần.</p>
          {newsletterStatus === 'success' ? (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#d4e9e2] px-6 py-3 text-sm font-bold text-[#006241]">
              ✓ Đăng ký thành công! Cảm ơn bạn.
            </div>
          ) : (
            <form className="mt-6 flex gap-2" onSubmit={(e) => void handleNewsletterSubmit(e)}>
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => { setNewsletterEmail(e.target.value); setNewsletterStatus('idle'); }}
                placeholder="Nhập email của bạn..."
                required
                className="client-input flex-1 px-5 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={newsletterStatus === 'loading'}
                className="client-pill-primary px-6 py-3 text-sm font-bold disabled:opacity-60"
              >
                {newsletterStatus === 'loading' ? '...' : 'Đăng ký'}
              </button>
            </form>
          )}
          {newsletterStatus === 'error' && (
            <p className="mt-2 text-xs text-red-500">Có lỗi xảy ra, vui lòng thử lại.</p>
          )}
          <p className="mt-3 text-xs text-gray-400">Không spam. Hủy đăng ký bất cứ lúc nào.</p>
        </div>
      </section>
    </div>
  );
}
