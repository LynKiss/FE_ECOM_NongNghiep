import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  ShoppingCart,
  Search,
  User,
  LogOut,
  Package,
  ChevronDown,
  Menu,
  X,
  Leaf,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Youtube,
  Heart,
  Globe,
  Bell,
  ArrowRight,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { useLanguage } from '../i18n/language-context';
import { useClientSession } from '../hooks/useClientSession';
import { useCart } from '../hooks/useCart';
import { logoutClient, clientApi } from '../lib/client-api';
import { getSocialLinks } from '../pages/Settings';
import { lazy, Suspense } from 'react';

const Chatbox = lazy(() => import('../components/client/Chatbox'));
const VoucherWalletModal = lazy(() => import('../components/client/VoucherWalletModal'));

type SearchProduct = {
  productId: string;
  productName: string;
  productPrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
};

type Notification = {
  id: string | null;
  title: string;
  message: string;
  channel: string;
  metadata: { orderId?: string; type?: string } | null;
  createdAt: string | null;
};

type CategoryTab = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  parentId: string | null;
};

type CategoryTree = CategoryTab & { children: CategoryTab[] };

export default function ClientLayout() {
  const { session } = useClientSession();
  const { cart } = useCart();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const megaMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void clientApi
      .get<CategoryTab[]>('/categories')
      .then((all) => {
        if (!Array.isArray(all)) return;
        const parents = all.filter((c) => !c.parentId);
        const tree: CategoryTree[] = parents.map((p) => ({
          ...p,
          children: all.filter((c) => c.parentId === p.categoryId),
        }));
        setCategoryTree(tree);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Apply client theme from Interface settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('client_theme_config');
      if (!raw) return;
      const cfg = JSON.parse(raw) as { themeId?: string; primaryColor?: string; fontId?: string };
      const THEMES: Record<string, { primary: string; accent: string; bg: string }> = {
        botanical: { primary: '#1b5e20', accent: '#d9f7c9', bg: '#f4f7f1' },
        harvest: { primary: '#92400e', accent: '#fde68a', bg: '#fffbeb' },
        midnight: { primary: '#8bdc8b', accent: '#1d3a29', bg: '#0f1713' },
      };
      const theme = cfg.themeId ? THEMES[cfg.themeId] : null;
      if (theme) {
        document.documentElement.style.setProperty('--client-primary', theme.primary);
        document.documentElement.style.setProperty('--client-accent', theme.accent);
        document.documentElement.style.setProperty('--client-bg', theme.bg);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (!session) return;
    const fetchNotifs = () =>
      void clientApi.get<Notification[]>('/notifications/me')
        .then((data) => setNotifications(data.filter((n) => n.channel === 'SYSTEM')))
        .catch(() => { });
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Search autocomplete debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      void clientApi
        .get<{ meta: unknown; items: SearchProduct[] }>(`/products?search=${encodeURIComponent(searchQuery)}&limit=6`)
        .then((data) => {
          setSuggestions(data.items ?? []);
          setShowSuggestions(true);
        })
        .catch(() => { });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      setShowSuggestions(false);
      void navigate(`/client/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleSuggestionClick = (productId: string) => {
    setSearchOpen(false);
    setShowSuggestions(false);
    setSearchQuery('');
    void navigate(`/client/products/${productId}`);
  };

  const handleLogout = async () => {
    await logoutClient();
    setUserMenuOpen(false);
    void navigate('/client');
  };

  const handleMegaMenuEnter = () => {
    if (megaMenuCloseTimer.current) clearTimeout(megaMenuCloseTimer.current);
    setMegaMenuOpen(true);
  };

  const handleMegaMenuLeave = () => {
    megaMenuCloseTimer.current = setTimeout(() => setMegaMenuOpen(false), 200);
  };

  const cartCount = cart?.totalItems ?? 0;
  const displayName = session?.user.fullName || session?.user.username || '';
  const socialLinks = getSocialLinks();
  const isVi = language === 'vi';
  const aiDiagnosisLink = {
    to: '/client/rice-diagnosis',
    label: isVi ? 'AI Chẩn Đoán Bệnh Lúa' : 'Rice AI Diagnosis',
  };
  const supportLinks = [
    { to: '/client/support/buying-guide', label: isVi ? 'Hướng dẫn mua hàng' : 'Buying guide' },
    { to: '/client/support/returns', label: isVi ? 'Chính sách đổi trả' : 'Returns policy' },
    { to: '/client/support/warranty', label: isVi ? 'Chính sách bảo hành' : 'Warranty policy' },
    { to: '/client/support/news-knowledge', label: isVi ? 'Tin tức – Kiến thức' : 'News & knowledge' },
    { to: '/client/support/contact', label: isVi ? 'Liên hệ chúng tôi' : 'Contact us' },
  ];

  const colCount = Math.min(categoryTree.length + 1, 5);

  return (
    <div className="client-surface flex min-h-screen flex-col">
      {/* Top bar */}
      <div style={{ background: '#1E3932' }} className="hidden text-white/70 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Phone size={11} />
              1800 6863
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={11} />
              support@cultivatedledger.vn
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <MapPin size={11} />
            Giao hàng toàn quốc — miễn phí đơn từ 500.000đ
          </span>
        </div>
      </div>

      {/* Main navbar */}
      <header
        className={`sticky top-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-[0_1px_3px_rgba(0,0,0,0.1),0_2px_2px_rgba(0,0,0,0.06),0_0_2px_rgba(0,0,0,0.07)]' : ''
          }`}
        style={{ background: '#f2f0eb' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-6 lg:py-4">
          {/* Logo */}
          <Link to="/client" className="flex shrink-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: '#006241' }}
            >
              <Leaf size={18} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#006241' }}>
                Cultivated Ledger
              </p>
              <p className="text-xs font-black leading-none" style={{ color: '#1E3932' }}>
                Vật Tư Nông Nghiệp
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {/* Trang chủ */}
            <NavLink
              to="/client"
              end
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-[#006241] text-white' : 'text-[#1E3932] hover:bg-[#006241]/10'
                }`
              }
            >
              {isVi ? 'Trang chủ' : 'Home'}
            </NavLink>

            {/* Sản phẩm — Mega menu */}
            <div
              className="relative"
              onMouseEnter={handleMegaMenuEnter}
              onMouseLeave={handleMegaMenuLeave}
            >
              <NavLink
                to="/client/products"
                className={({ isActive }) =>
                  `flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive || megaMenuOpen
                    ? 'bg-[#006241] text-white'
                    : 'text-[#1E3932] hover:bg-[#006241]/10'
                  }`
                }
              >
                {isVi ? 'Danh mục' : 'Categories'}
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${megaMenuOpen ? 'rotate-180' : ''}`}
                />
              </NavLink>

              {/* Mega menu dropdown */}
              {megaMenuOpen && (
                <div
                  className="absolute left-1/2 top-full z-50 mt-3 -translate-x-1/2 overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_24px_60px_-12px_rgba(0,52,32,0.25),0_8px_20px_-6px_rgba(0,52,32,0.1)]"
                  style={{ width: `${colCount * 200 + 260}px`, minWidth: '720px', maxWidth: '1120px' }}
                  onMouseEnter={handleMegaMenuEnter}
                  onMouseLeave={handleMegaMenuLeave}
                >
                  {/* Top gradient accent */}
                  <div className="h-1 w-full bg-gradient-to-r from-[#006241] via-[#00a06a] to-[#006241]" />

                  {/* Arrow pointer */}
                  <div
                    className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-black/5 bg-white"
                    aria-hidden
                  />

                  <div className="flex">
                    {/* Categories grid */}
                    <div className="min-w-0 flex-1 p-8">
                      <div
                        className="grid gap-x-8 gap-y-5"
                        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
                      >
                        {/* Cột 0: Tất cả sản phẩm */}
                        <div className="min-w-0">
                          <Link
                            to="/client/products"
                            onClick={() => setMegaMenuOpen(false)}
                            className="group/header mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-[#006241] transition"
                          >
                            <Sparkles size={14} className="transition group-hover/header:rotate-12" />
                            <span>Tất cả</span>
                            <ArrowRight size={12} className="opacity-50 transition group-hover/header:translate-x-1 group-hover/header:opacity-100" />
                          </Link>
                          <div className="space-y-0.5 border-t border-black/5 pt-3">
                            {[
                              { to: '/client/products?sort=newest', label: 'Mới nhất', icon: '✨' },
                              { to: '/client/products?sort=bestseller', label: 'Bán chạy nhất', icon: '🔥' },
                              { to: '/client/products?sort=price_asc', label: 'Giá tốt nhất', icon: '💚' },
                            ].map((item) => (
                              <Link
                                key={item.label}
                                to={item.to}
                                onClick={() => setMegaMenuOpen(false)}
                                className="group/link flex items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] text-gray-600 transition hover:bg-[#006241]/7 hover:text-[#006241]"
                              >
                                <span className="text-sm leading-none">{item.icon}</span>
                                <span className="truncate font-medium transition-transform group-hover/link:translate-x-0.5">
                                  {item.label}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>

                        {/* Một cột cho mỗi danh mục cha */}
                        {categoryTree.slice(0, 4).map((cat) => (
                          <div key={cat.categoryId} className="min-w-0">
                            <Link
                              to={`/client/products?categoryId=${cat.categoryId}`}
                              onClick={() => setMegaMenuOpen(false)}
                              className="group/header mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-[#1E3932] transition hover:text-[#006241]"
                            >
                              <Sprout size={14} className="shrink-0 text-[#006241] transition group-hover/header:rotate-12" />
                              <span className="truncate">{cat.categoryName}</span>
                              <ArrowRight size={12} className="shrink-0 opacity-50 transition group-hover/header:translate-x-1 group-hover/header:opacity-100" />
                            </Link>
                            <div className="space-y-0.5 border-t border-black/5 pt-3">
                              {cat.children.slice(0, 7).map((child) => (
                                <Link
                                  key={child.categoryId}
                                  to={`/client/products?categoryId=${child.categoryId}`}
                                  onClick={() => setMegaMenuOpen(false)}
                                  className="group/link block rounded-xl px-3 py-2 text-[15px] font-medium text-gray-600 transition hover:bg-[#006241]/7 hover:text-[#006241]"
                                >
                                  <span className="truncate transition-transform group-hover/link:translate-x-0.5 inline-block">
                                    {child.categoryName}
                                  </span>
                                </Link>
                              ))}
                              {cat.children.length === 0 && (
                                <span className="block px-3 py-1 text-sm italic text-gray-300">
                                  Đang cập nhật
                                </span>
                              )}
                              {cat.children.length > 7 && (
                                <Link
                                  to={`/client/products?categoryId=${cat.categoryId}`}
                                  onClick={() => setMegaMenuOpen(false)}
                                  className="block px-3 pt-1.5 text-sm font-bold text-[#006241]/70 transition hover:text-[#006241]"
                                >
                                  +{cat.children.length - 7} mục khác →
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Inline footer: View all */}
                      {categoryTree.length > 4 && (
                        <div className="mt-6 border-t border-black/5 pt-4 text-center">
                          <Link
                            to="/client/products"
                            onClick={() => setMegaMenuOpen(false)}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#006241] transition hover:opacity-70"
                          >
                            Xem tất cả {categoryTree.length} danh mục
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Right agriculture info panel */}
                    <div
                      className="relative hidden w-[240px] shrink-0 overflow-hidden md:block"
                      style={{
                        background: 'linear-gradient(160deg, #0a3d1f 0%, #006241 45%, #00754A 100%)',
                      }}
                    >
                      {/* Decorative circles */}
                      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
                      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

                      {/* Decorative leaves */}
                      <Leaf className="absolute -right-2 top-6 text-white/10" size={100} strokeWidth={1} />
                      <Sprout className="absolute bottom-20 right-4 text-white/12" size={40} strokeWidth={1.2} />

                      {/* Content */}
                      <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white">
                        <div className="space-y-5">
                          {/* Badge */}
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur">
                            <Leaf size={10} />
                            Nông nghiệp sạch
                          </div>

                          {/* Headline */}
                          <div>
                            <h3 className="text-base font-black leading-snug text-white">
                              Vật tư<br />chất lượng cao
                            </h3>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">
                              Được kiểm định bởi Bộ Nông Nghiệp — đảm bảo an toàn cho cây trồng và người dùng.
                            </p>
                          </div>

                          {/* Stats */}
                          <div className="space-y-2">
                            {[
                              { num: '500+', label: 'Sản phẩm' },
                              { num: '24h', label: 'Giao hàng nhanh' },
                              { num: '100%', label: 'Chính hãng' },
                            ].map((s) => (
                              <div key={s.label} className="flex items-center gap-3">
                                <span className="min-w-[40px] text-sm font-black text-[#a8e6c3]">{s.num}</span>
                                <span className="text-[11px] text-white/60">{s.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Link
                          to="/client/products"
                          onClick={() => setMegaMenuOpen(false)}
                          className="group/cta inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#006241] shadow-lg transition hover:bg-[#dff1e4]"
                        >
                          Khám phá ngay
                          <ArrowRight size={12} className="transition group-hover/cta:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tin tức */}
            <NavLink
              to="/client/news"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-[#006241] text-white' : 'text-[#1E3932] hover:bg-[#006241]/10'
                }`
              }
            >
              {isVi ? 'Tin tức' : 'News'}
            </NavLink>

            {/* AI Diagnosis */}
            <NavLink
              to={aiDiagnosisLink.to}
              className={({ isActive }) =>
                `rounded-full border px-4 py-2 text-sm font-black transition-all motion-reduce:animate-none ${isActive
                  ? 'border-[#006241] bg-[#006241] text-white'
                  : 'animate-pulse border-[#006241]/25 bg-[#edf3ee] text-[#006241] hover:border-[#006241] hover:bg-[#dff1e4]'
                }`
              }
            >
              <span className="inline-flex items-center gap-2">
                <Leaf size={14} />
                {aiDiagnosisLink.label}
              </span>
            </NavLink>
          </nav>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 lg:gap-2">
            {/* Search with autocomplete */}
            {searchOpen ? (
              <div ref={searchContainerRef} className="relative">
                <form
                  onSubmit={handleSearch}
                  className="flex items-center rounded-full border border-[#006241]/30 bg-white px-4 py-2"
                >
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Tìm sản phẩm..."
                    className="w-48 bg-transparent text-sm outline-none"
                  />
                  <button type="submit" className="ml-2 text-[#006241]">
                    <Search size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setShowSuggestions(false); setSearchQuery(''); }}
                    className="ml-1 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                </form>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="client-menu-surface absolute left-0 top-full mt-2 w-72 overflow-hidden">
                    {suggestions.map((p) => (
                      <button
                        key={p.productId}
                        type="button"
                        onClick={() => handleSuggestionClick(p.productId)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#006241]/5"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#f2f0eb]">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Leaf size={14} className="text-[#006241]/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-semibold text-[#1E3932]">{p.productName}</p>
                          <p className="text-xs font-bold text-[#006241]">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                              Number(p.effectivePrice),
                            )}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        void navigate(`/client/products?search=${encodeURIComponent(searchQuery)}`);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-black/5 py-2.5 text-xs font-semibold text-[#006241] hover:bg-[#006241]/5"
                    >
                      <Search size={12} /> Xem tất cả kết quả
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
                style={{ color: '#1E3932' }}
              >
                <Search size={18} />
              </button>
            )}

            {/* Language switcher */}
            <button
              onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
              className="hidden"
              title={language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <Globe size={15} className="absolute opacity-0 w-0" aria-hidden="true" />
              {language === 'vi' ? '🇻🇳' : '🇬🇧'}
            </button>

            {/* Notification bell */}
            {session && (
              <div ref={notifRef} className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
                  style={{ color: '#1E3932' }}
                >
                  <Bell size={18} />
                  {notifications.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="client-menu-surface absolute right-0 top-full mt-2 w-80 overflow-hidden">
                    <div className="border-b border-black/5 px-4 py-3">
                      <p className="text-sm font-bold text-[#1E3932]">Thông báo</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Bell size={28} className="mb-2 text-gray-200" />
                          <p className="text-xs text-gray-400">Chưa có thông báo</p>
                        </div>
                      ) : (
                        notifications.slice(0, 20).map((n, idx) => {
                          const orderId = n.metadata?.orderId;
                          const inner = (
                            <>
                              <p className="text-xs font-semibold text-[#1E3932]">{n.title}</p>
                              <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.message}</p>
                              {n.createdAt && (
                                <p className="mt-1 text-[10px] text-gray-400">
                                  {new Date(n.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </>
                          );
                          const cls = 'block w-full border-b border-black/5 px-4 py-3 last:border-0 text-left';
                          return orderId ? (
                            <Link
                              key={n.id ?? idx}
                              to={`/client/orders/${orderId}`}
                              className={`${cls} transition hover:bg-[#006241]/5`}
                              onClick={() => setNotifOpen(false)}
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div key={n.id ?? idx} className={cls}>
                              {inner}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Wishlist */}
            {session && (
              <Link
                to="/client/wishlist"
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
                style={{ color: '#1E3932' }}
              >
                <Heart size={18} />
              </Link>
            )}

            {/* Cart */}
            <Link
              to="/client/cart"
              data-cart-icon="true"
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
              style={{ color: '#1E3932' }}
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c82014] px-1 text-[9px] font-black text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            {session ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-[#006241]/10"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                    style={{ background: '#006241' }}
                  >
                    {session.user.avatarUrl ? (
                      <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (displayName[0] ?? 'U').toUpperCase()
                    )}
                  </div>
                  <span className="hidden text-sm font-semibold text-[#1E3932] lg:block">
                    {displayName}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#1E3932] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="client-menu-surface absolute right-0 top-full mt-2 w-52 overflow-hidden">
                    <div className="border-b border-black/5 px-4 py-3">
                      <p className="text-sm font-bold text-[#1E3932]">{displayName}</p>
                      <p className="truncate text-xs text-gray-400">{session.user.email}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/client/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <User size={15} /> Tài khoản của tôi
                      </Link>
                      <Link
                        to="/client/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <Package size={15} /> Đơn hàng
                      </Link>
                      <Link
                        to="/client/wishlist"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <Heart size={15} /> Yêu thích
                      </Link>
                      <button
                        onClick={() => void handleLogout()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={15} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/client/login"
                className="client-pill-primary hidden px-5 py-2 text-sm font-bold lg:flex"
              >
                Đăng nhập
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10 lg:hidden"
              style={{ color: '#1E3932' }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-black/8 bg-white px-4 pb-4 pt-2 lg:hidden">
            <nav className="flex flex-col gap-1">
              <NavLink
                to="/client"
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#006241] text-white' : 'text-[#1E3932]'
                  }`
                }
              >
                {isVi ? 'Trang chủ' : 'Home'}
              </NavLink>

              {/* Sản phẩm collapsible in mobile */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileCatOpen(!mobileCatOpen)}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1E3932] transition active:bg-[#006241]/10"
                >
                  {isVi ? 'Danh mục' : 'Categories'}
                  <ChevronDown size={15} className={`transition-transform ${mobileCatOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileCatOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 rounded-xl border border-black/5 bg-gray-50/80 p-2">
                    <Link
                      to="/client/products"
                      onClick={() => { setMobileOpen(false); setMobileCatOpen(false); }}
                      className="block rounded-lg px-3 py-2 text-sm font-bold text-[#006241]"
                    >
                      Tất cả sản phẩm
                    </Link>
                    {categoryTree.map((cat) => (
                      <div key={cat.categoryId}>
                        <Link
                          to={`/client/products?categoryId=${cat.categoryId}`}
                          onClick={() => { setMobileOpen(false); setMobileCatOpen(false); }}
                          className="block rounded-lg px-3 py-1.5 text-sm font-semibold text-[#1E3932]"
                        >
                          {cat.categoryName}
                        </Link>
                        {cat.children.map((child) => (
                          <Link
                            key={child.categoryId}
                            to={`/client/products?categoryId=${child.categoryId}`}
                            onClick={() => { setMobileOpen(false); setMobileCatOpen(false); }}
                            className="block rounded-lg px-5 py-1 text-sm text-gray-500"
                          >
                            {child.categoryName}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <NavLink
                to="/client/news"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#006241] text-white' : 'text-[#1E3932]'
                  }`
                }
              >
                {isVi ? 'Tin tức' : 'News'}
              </NavLink>

              <NavLink
                to={aiDiagnosisLink.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2.5 text-sm font-black transition motion-reduce:animate-none ${isActive
                    ? 'bg-[#006241] text-white'
                    : 'animate-pulse border border-[#006241]/20 bg-[#edf3ee] text-[#006241]'
                  }`
                }
              >
                <span className="inline-flex items-center gap-2">
                  <Leaf size={14} />
                  {aiDiagnosisLink.label}
                </span>
              </NavLink>

              {!session ? (
                <div className="mt-2 flex gap-2 border-t border-black/5 pt-2">
                  <Link
                    to="/client/login"
                    onClick={() => setMobileOpen(false)}
                    className="client-pill-primary flex-1 py-2.5 text-center text-sm font-bold"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/client/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-full border border-[#006241] py-2.5 text-center text-sm font-bold text-[#006241]"
                  >
                    Đăng ký
                  </Link>
                </div>
              ) : null}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: '#1E3932' }} className="text-white">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#00754A' }}>
                  <Leaf size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
                    Cultivated Ledger
                  </p>
                  <p className="text-sm font-black text-white">Vật Tư Nông Nghiệp</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                Cung cấp vật tư nông nghiệp chất lượng cao cho nông dân Việt Nam. Cam kết uy tín
                — giá tốt — giao nhanh.
              </p>
              <div className="mt-5 flex gap-3">
                {(socialLinks.facebook || '#') && (
                  <a href={socialLinks.facebook || '#'} target={socialLinks.facebook ? '_blank' : undefined} rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white">
                    <Facebook size={16} />
                  </a>
                )}
                {(socialLinks.youtube || '#') && (
                  <a href={socialLinks.youtube || '#'} target={socialLinks.youtube ? '_blank' : undefined} rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white">
                    <Youtube size={16} />
                  </a>
                )}
                {socialLinks.zalo && (
                  <a href={socialLinks.zalo} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white text-xs font-black">
                    Zalo
                  </a>
                )}
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Sản phẩm
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                {['Phân bón hữu cơ', 'Thuốc bảo vệ thực vật', 'Hạt giống', 'Dụng cụ nông nghiệp', 'Nhà màng – Tưới tiêu'].map(
                  (item) => (
                    <li key={item}>
                      <Link to="/client/products" className="transition hover:text-white">
                        {item}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Hỗ trợ
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                {supportLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="transition hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Liên hệ
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                <li className="flex items-start gap-2.5">
                  <Phone size={14} className="mt-0.5 shrink-0" />
                  <span>1800 6863 (miễn phí)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail size={14} className="mt-0.5 shrink-0" />
                  <span>support@cultivatedledger.vn</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>123 Đường Nông Nghiệp, Quận 12, TP.HCM</span>
                </li>
              </ul>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-[11px] text-white/40">Mở cửa</p>
                <p className="text-sm font-bold text-white">7:00 – 21:00 mỗi ngày</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 text-xs text-white/30 sm:flex-row">
            <p>© 2025 Cultivated Ledger. Bảo lưu mọi quyền.</p>
            <div className="flex gap-6">
              <a href="#" className="transition hover:text-white/60">Chính sách bảo mật</a>
              <a href="#" className="transition hover:text-white/60">Điều khoản sử dụng</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Chatbox */}
      <Suspense fallback={null}>
        <VoucherWalletModal />
        <Chatbox />
      </Suspense>
    </div>
  );
}
