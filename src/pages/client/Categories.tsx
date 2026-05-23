import { useEffect, useMemo, useState, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Leaf,
  Sparkles,
  TrendingUp,
  ShoppingCart,
  Star,
  Truck,
  ShieldCheck,
  RotateCcw,
  Award,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';

type CategoryNode = {
  categoryId: string;
  categoryName: string;
  categoryDescription?: string | null;
  categorySlug: string;
  parentId?: string | null;
  children?: CategoryNode[];
};

type Product = {
  productId: string;
  productName: string;
  productSlug: string;
  basePrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
  quantityAvailable: number;
  ratingAverage: string;
  ratingCount: number;
  unit: string | null;
  isFeatured?: boolean;
  category?: { categoryId: string; categoryName: string };
};

const TRUST_BADGES = [
  { icon: Truck, title: 'Nhận hàng linh hoạt', desc: 'Báo phí ở checkout' },
  { icon: ShieldCheck, title: 'Hàng chính hãng', desc: '100% có chứng nhận' },
  { icon: RotateCcw, title: 'Đổi trả 7 ngày', desc: 'Lỗi NSX hoặc khác mô tả' },
  { icon: Award, title: 'CSKH 7-21h', desc: 'Hotline 1800 6863' },
];

function fmtPrice(n: number | string) {
  return Number(n).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });
}

export default function Categories() {
  const params = useParams<{ categoryId?: string }>();
  const activeCategoryId = params.categoryId ?? null;

  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categoryThumbs, setCategoryThumbs] = useState<Record<string, string>>({});
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  // Load category tree
  useEffect(() => {
    setLoading(true);
    clientApi
      .get<CategoryNode[]>('/categories/tree')
      .then((data) => setTree(Array.isArray(data) ? data : []))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  // Load featured products (sản phẩm nổi bật ở đầu trang)
  useEffect(() => {
    const url = activeCategoryId
      ? `/products?categoryId=${activeCategoryId}&isFeatured=true&limit=6`
      : '/products?isFeatured=true&limit=8';
    clientApi
      .get<{ items: Product[] }>(url)
      .then((d) => setFeaturedProducts(d.items ?? []))
      .catch(() => setFeaturedProducts([]));
  }, [activeCategoryId]);

  // Load thumbnails: lấy 1 product làm cover cho mỗi category
  // (chạy 1 query nhỏ cho từng cat — nếu BE có endpoint dedicated thì tốt hơn)
  useEffect(() => {
    if (tree.length === 0) return;
    const allCats = collectAllCategoryIds(tree);
    Promise.all(
      allCats.map((catId) =>
        clientApi
          .get<{ items: Product[]; meta?: { total: number } }>(
            `/products?categoryId=${catId}&limit=1&includeHidden=false`,
          )
          .then((d) => {
            const first = d.items?.[0];
            return [catId, first?.primaryImageUrl ?? '', d.meta?.total ?? 0] as const;
          })
          .catch(() => [catId, '', 0] as const),
      ),
    ).then((results) => {
      const thumbs: Record<string, string> = {};
      const counts: Record<string, number> = {};
      for (const [id, url, count] of results) {
        if (url) thumbs[id] = url;
        counts[id] = count;
      }
      setCategoryThumbs(thumbs);
      setProductCounts(counts);
    });
  }, [tree]);

  // Tìm category đang active
  const activeCategory = useMemo<CategoryNode | null>(() => {
    if (!activeCategoryId) return null;
    return findCategoryById(tree, activeCategoryId);
  }, [tree, activeCategoryId]);

  // Top-level parents (categories that have parentId=null)
  const parentCategories = useMemo(() => {
    return tree.filter((c) => !c.parentId);
  }, [tree]);

  // Sub-categories đang hiển thị
  const subCategories = useMemo(() => {
    if (activeCategory && activeCategory.children) {
      return activeCategory.children;
    }
    return [];
  }, [activeCategory]);

  if (loading) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '60vh' }}>
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== SUB-CATEGORY VIEW =====
  if (activeCategory) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
        {/* Banner */}
        <div className="border-b border-black/5 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-2 text-xs text-gray-500">
              <Link to="/client" className="hover:text-[#006241]">
                Trang chủ
              </Link>
              <ChevronRight size={11} />
              <Link to="/client/categories" className="hover:text-[#006241]">
                Danh mục
              </Link>
              <ChevronRight size={11} />
              <span className="font-bold text-[#1E3932]">
                {activeCategory.categoryName}
              </span>
            </nav>

            <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: '#1E3932' }}>
              {activeCategory.categoryName}
            </h1>
            {activeCategory.categoryDescription && (
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                {activeCategory.categoryDescription}
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          {/* Featured products */}
          {featuredProducts.length > 0 && (
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} style={{ color: '#006241' }} />
                <h2 className="text-lg font-black" style={{ color: '#1E3932' }}>
                  Gợi ý cho bạn
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {featuredProducts.slice(0, 6).map((p) => (
                  <ProductMiniCard key={p.productId} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Sub-category cards */}
          {subCategories.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: '#1E3932' }}>
                  Danh mục con
                </h2>
                <Link
                  to={`/client/products?categoryId=${activeCategory.categoryId}`}
                  className="text-xs font-bold text-[#006241] hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {subCategories.map((sub) => (
                  <CategoryCard
                    key={sub.categoryId}
                    category={sub}
                    image={categoryThumbs[sub.categoryId]}
                    count={productCounts[sub.categoryId] ?? 0}
                    linkTo={`/client/products?categoryId=${activeCategory.categoryId}&subcategoryId=${sub.categoryId}`}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border-2 border-dashed border-[#006241]/20 bg-white p-10 text-center">
              <Leaf size={36} className="mx-auto mb-3 opacity-30" style={{ color: '#006241' }} />
              <p className="text-base font-bold" style={{ color: '#1E3932' }}>
                Danh mục này chưa có phân loại con
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Bấm vào nút bên dưới để xem danh sách sản phẩm.
              </p>
              <Link
                to={`/client/products?categoryId=${activeCategory.categoryId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95"
                style={{ background: '#006241' }}
              >
                Xem sản phẩm
                <ChevronRight size={14} />
              </Link>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ===== TOP-LEVEL VIEW (all parent categories) =====
  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      {/* Hero banner */}
      <div className="border-b border-black/5 bg-gradient-to-br from-[#006241] to-[#1E3932] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">
            Cultivated Ledger
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">
            Khám phá sản phẩm theo danh mục
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/70">
            Vật tư nông nghiệp chính hãng — từ phân bón, hạt giống, thuốc BVTV đến dụng cụ canh tác. Chọn danh mục bên dưới để bắt đầu.
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRUST_BADGES.map((b) => (
              <div key={b.title} className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#006241]/8">
                  <b.icon size={16} style={{ color: '#006241' }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-[#1E3932] sm:text-sm">
                    {b.title}
                  </p>
                  <p className="truncate text-[10px] text-gray-500 sm:text-xs">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {/* Featured products */}
        {featuredProducts.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} style={{ color: '#006241' }} />
                <h2 className="text-lg font-black" style={{ color: '#1E3932' }}>
                  Sản phẩm nổi bật
                </h2>
              </div>
              <Link
                to="/client/products"
                className="text-xs font-bold text-[#006241] hover:underline"
              >
                Xem tất cả →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {featuredProducts.slice(0, 6).map((p) => (
                <ProductMiniCard key={p.productId} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Parent category cards */}
        <section>
          <h2 className="mb-4 text-lg font-black" style={{ color: '#1E3932' }}>
            Danh mục chính
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {parentCategories.map((cat) => (
              <CategoryCard
                key={cat.categoryId}
                category={cat}
                image={categoryThumbs[cat.categoryId]}
                count={productCounts[cat.categoryId] ?? 0}
                linkTo={
                  cat.children && cat.children.length > 0
                    ? `/client/categories/${cat.categoryId}`
                    : `/client/products?categoryId=${cat.categoryId}`
                }
                large
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectAllCategoryIds(tree: CategoryNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      ids.push(n.categoryId);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return ids;
}

function findCategoryById(tree: CategoryNode[], id: string): CategoryNode | null {
  for (const n of tree) {
    if (n.categoryId === id) return n;
    if (n.children?.length) {
      const found = findCategoryById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ─── Components ─────────────────────────────────────────────────────────────

const CategoryCard: FC<{
  category: CategoryNode;
  image?: string;
  count: number;
  linkTo: string;
  large?: boolean;
}> = ({ category, image, count, linkTo, large }) => {
  return (
    <Link
      to={linkTo}
      className={`group flex flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#006241]/30 hover:shadow-lg ${
        large ? '' : ''
      }`}
    >
      <div
        className={`relative overflow-hidden bg-[#f2f0eb] ${
          large ? 'aspect-[4/3]' : 'aspect-square'
        }`}
      >
        {image ? (
          <img
            src={image}
            alt={category.categoryName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Leaf size={large ? 56 : 36} className="opacity-20" style={{ color: '#006241' }} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
          <div className="min-w-0">
            <p className={`truncate font-black ${large ? 'text-base' : 'text-sm'}`}>
              {category.categoryName}
            </p>
            {count > 0 && (
              <p className="text-[10px] opacity-80">{count} sản phẩm</p>
            )}
          </div>
          <ChevronRight size={16} className="shrink-0 opacity-90 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

const ProductMiniCard: FC<{ product: Product }> = ({ product }) => {
  const base = Number(product.basePrice);
  const effective = Number(product.effectivePrice);
  const hasDiscount = effective < base - 0.01;
  const rating = Number(product.ratingAverage ?? 0);

  return (
    <Link
      to={`/client/products/${product.productId}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#006241]/20 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f2f0eb]">
        {product.primaryImageUrl ? (
          <img
            src={product.primaryImageUrl}
            alt={product.productName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Leaf size={28} className="opacity-20" style={{ color: '#006241' }} />
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-purple-500/90 px-2 py-0.5 text-[10px] font-black text-white shadow">
            ⭐ Nổi bật
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-[#1E3932] group-hover:text-[#006241]">
          {product.productName}
        </p>
        {rating > 0 && (
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={9}
                fill={s <= Math.round(rating) ? '#f59e0b' : 'none'}
                className={s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}
              />
            ))}
            {product.ratingCount > 0 && (
              <span className="text-[9px] text-gray-400">({product.ratingCount})</span>
            )}
          </div>
        )}
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-sm font-black" style={{ color: '#006241' }}>
            {fmtPrice(effective)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-gray-400 line-through">
              {fmtPrice(base)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-[#006241] opacity-80">
          <ShoppingCart size={10} /> Xem chi tiết
        </div>
      </div>
    </Link>
  );
};
