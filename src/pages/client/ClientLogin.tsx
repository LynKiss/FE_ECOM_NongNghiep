import { useState, type FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Leaf, LoaderCircle, AlertCircle, ShoppingBag, RotateCcw, Tag } from 'lucide-react';
import { loginClient } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { refreshGlobalCart } from '../../hooks/useCart';

const heroImage =
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1400&q=85';

export default function ClientLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const from = (location.state as { from?: string } | null)?.from ?? '/client';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) void navigate(from, { replace: true });
  }, [session, navigate, from]);

  useEffect(() => {
    setError('');
  }, [username, password]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginClient(username.trim(), password);
      await refreshGlobalCart();
      void navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f0eb]">
      <div className="mx-auto min-h-screen max-w-[1280px] p-3 sm:p-4">
        <div className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] lg:grid-cols-[1fr_480px]">

          {/* Hero */}
          <section className="relative hidden overflow-hidden bg-[#1E3932] lg:block">
            <img
              src={heroImage}
              alt="Nông nghiệp"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1E3932]/40 via-[#1E3932]/50 to-[#0f2019]/85" />

            <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-12">
              <Link to="/client" className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00754A]">
                  <Leaf size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#a8d5c2]">
                    Cultivated Ledger
                  </p>
                  <p className="text-sm font-black">Nông sản sạch</p>
                </div>
              </Link>

              <div className="max-w-md">
                <div className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/80 backdrop-blur">
                  Mua sắm thông minh hơn
                </div>
                <h1 className="text-[2.6rem] font-black leading-[1.05] tracking-tight xl:text-[3rem]">
                  Đặt hàng nông sản sạch, giao tận nơi.
                </h1>
                <p className="mt-4 text-[13.5px] leading-7 text-white/70">
                  Đăng nhập để theo dõi đơn hàng, lưu sản phẩm yêu thích và nhận ưu đãi dành riêng cho tài khoản của bạn.
                </p>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[
                    { icon: ShoppingBag, label: 'Đơn hàng', desc: 'Theo dõi trạng thái giao hàng' },
                    { icon: RotateCcw, label: 'Đổi trả', desc: 'Chính sách 7 ngày dễ dàng' },
                    { icon: Tag, label: 'Ưu đãi', desc: 'Voucher riêng cho tài khoản' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur"
                    >
                      <item.icon size={18} className="text-[#6fcfa3]" />
                      <p className="mt-3 text-sm font-black">{item.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-white/55">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-white/35">
                © {new Date().getFullYear()} Cultivated Ledger. Nông nghiệp bền vững.
              </p>
            </div>
          </section>

          {/* Form */}
          <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
            <div className="w-full max-w-[380px]">

              {/* Mobile logo */}
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E3932]">
                  <Leaf size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#006241]">
                    Cultivated Ledger
                  </p>
                  <p className="text-sm font-black text-[#1E3932]">Nông sản sạch</p>
                </div>
              </div>

              <h2 className="text-[1.85rem] font-black leading-none tracking-tight text-[#1E3932]">
                Đăng nhập
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-[#4a6155]">
                Chào mừng trở lại! Nhập thông tin tài khoản để tiếp tục.
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-7 space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-medium text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]">
                    Tên đăng nhập hoặc Email
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập email hoặc tên đăng nhập"
                    required
                    autoComplete="username"
                    className="h-11 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 text-sm outline-none transition placeholder:text-black/30 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]">
                      Mật khẩu
                    </label>
                    <Link
                      to="/client/forgot-password"
                      className="text-xs font-black text-[#006241] hover:underline"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="h-11 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 pr-11 text-sm outline-none transition placeholder:text-black/30 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-black/35 transition hover:bg-black/5 hover:text-black/60"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3932] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(30,57,50,0.55)] transition hover:bg-[#163028] active:scale-[0.98] disabled:opacity-60"
                >
                  {loading && <LoaderCircle size={16} className="animate-spin" />}
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#4a6155]">
                Chưa có tài khoản?{' '}
                <Link
                  to="/client/register"
                  className="font-black text-[#006241] transition hover:text-[#00754A] hover:underline"
                >
                  Đăng ký ngay
                </Link>
              </div>

              <div className="mt-8 border-t border-black/[0.06] pt-5 text-center text-xs text-black/35">
                Là nhân viên hoặc quản trị viên?{' '}
                <Link to="/login" className="font-bold text-[#006241] hover:underline">
                  Đăng nhập trang quản trị
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
