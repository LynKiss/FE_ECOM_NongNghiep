import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Leaf, LoaderCircle, AlertCircle, CheckCircle2, Sprout, TreeDeciduous, Wheat } from 'lucide-react';
import { registerClient, loginClient } from '../../lib/client-api';
import { refreshGlobalCart } from '../../hooks/useCart';

const heroImage =
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=85';

const inputCls =
  'h-11 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 text-sm outline-none transition placeholder:text-black/30 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10';

const labelCls = 'block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]';

export default function ClientRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const setField = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await registerClient({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
      });
      await loginClient(form.username.trim(), form.password);
      await refreshGlobalCart();
      setSuccess(true);
      setTimeout(() => void navigate('/client'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f0eb] px-4">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#1E3932]">
            <CheckCircle2 size={40} className="text-[#6fcfa3]" />
          </div>
          <h2 className="text-2xl font-black text-[#1E3932]">Đăng ký thành công!</h2>
          <p className="mt-2 text-sm text-[#4a6155]">Chào mừng bạn đến với Cultivated Ledger. Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f0eb]">
      <div className="mx-auto min-h-screen max-w-[1280px] p-3 sm:p-4">
        <div className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] lg:grid-cols-[1fr_520px]">

          {/* Hero */}
          <section className="relative hidden overflow-hidden bg-[#1E3932] lg:block">
            <img
              src={heroImage}
              alt="Nông nghiệp"
              className="absolute inset-0 h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1E3932]/30 via-[#1E3932]/55 to-[#0f2019]/90" />

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
                  Tham gia cộng đồng
                </div>
                <h1 className="text-[2.4rem] font-black leading-[1.06] tracking-tight xl:text-[2.8rem]">
                  Kết nối trực tiếp với nhà nông Việt Nam.
                </h1>
                <p className="mt-4 text-[13px] leading-7 text-white/70">
                  Tạo tài khoản để mua nông sản tươi sạch từ nguồn, theo dõi đơn hàng và nhận ưu đãi độc quyền.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    { icon: Sprout, title: 'Nguồn gốc rõ ràng', desc: 'Nông sản có truy xuất nguồn gốc đầy đủ.' },
                    { icon: Wheat, title: 'Sản phẩm theo mùa', desc: 'Cập nhật sản phẩm theo từng vụ thu hoạch.' },
                    { icon: TreeDeciduous, title: 'Nông nghiệp bền vững', desc: 'Hỗ trợ canh tác xanh và hữu cơ.' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <item.icon size={15} className="text-[#6fcfa3]" />
                      </div>
                      <div>
                        <p className="text-sm font-black">{item.title}</p>
                        <p className="text-[12px] text-white/55">{item.desc}</p>
                      </div>
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
            <div className="w-full max-w-[420px]">

              {/* Mobile logo */}
              <div className="mb-7 flex items-center gap-3 lg:hidden">
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

              <h2 className="text-[1.75rem] font-black leading-none tracking-tight text-[#1E3932]">
                Tạo tài khoản
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-[#4a6155]">
                Điền thông tin bên dưới để bắt đầu mua sắm.
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-3.5">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-medium text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Họ và tên</label>
                    <input
                      value={form.fullName}
                      onChange={setField('fullName')}
                      placeholder="Nguyễn Văn A"
                      autoComplete="name"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Tên đăng nhập *</label>
                    <input
                      value={form.username}
                      onChange={setField('username')}
                      placeholder="user123"
                      required
                      autoComplete="username"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={setField('email')}
                      placeholder="email@example.com"
                      required
                      autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Số điện thoại</label>
                    <input
                      type="tel"
                      value={form.phoneNumber}
                      onChange={setField('phoneNumber')}
                      placeholder="0901 234 567"
                      autoComplete="tel"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Mật khẩu * <span className="normal-case font-medium text-black/35">(tối thiểu 6 ký tự)</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={setField('password')}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className={inputCls + ' pr-11'}
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

                <div className="space-y-1.5">
                  <label className={labelCls}>Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={setField('confirmPassword')}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className={inputCls + ' pr-11'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-black/35 transition hover:bg-black/5 hover:text-black/60"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3932] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(30,57,50,0.55)] transition hover:bg-[#163028] active:scale-[0.98] disabled:opacity-60"
                >
                  {loading && <LoaderCircle size={16} className="animate-spin" />}
                  {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </button>
              </form>

              <p className="mt-4 text-center text-[11.5px] text-black/35">
                Bằng cách đăng ký, bạn đồng ý với{' '}
                <a href="#" className="text-[#006241] hover:underline">Điều khoản</a>
                {' '}và{' '}
                <a href="#" className="text-[#006241] hover:underline">Chính sách bảo mật</a>.
              </p>

              <div className="mt-5 text-center text-sm text-[#4a6155]">
                Đã có tài khoản?{' '}
                <Link
                  to="/client/login"
                  className="font-black text-[#006241] transition hover:text-[#00754A] hover:underline"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
