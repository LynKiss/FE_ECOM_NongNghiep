import { type FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
import { loginAdmin } from '../lib/api';
import { useLanguage } from '../i18n/language-context';

const heroImage =
  'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80';

export default function LoginPage() {
  const { session } = useAdminSession();
  const { showToast } = useToast();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('admin@gmail.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isVietnamese = language === 'vi';
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  useEffect(() => {
    setError(null);
  }, [username, password, language]);

  if (session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginAdmin(username, password);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đăng nhập thành công' : 'Sign in successful',
        description: isVietnamese
          ? 'Bảng điều khiển đã sẵn sàng.'
          : 'The admin console is ready.',
      });
      navigate(from, { replace: true });
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : isVietnamese
            ? 'Đăng nhập thất bại'
            : 'Sign in failed';
      setError(message);
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Đăng nhập thất bại' : 'Sign in failed',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#eef1ec] p-2 text-[#163126] md:p-3">
      <div className="mx-auto flex h-[calc(100vh-1rem)] max-w-[1220px] flex-col overflow-hidden rounded-[1.5rem] border border-[#d8dfd7] bg-white shadow-[0_30px_90px_-45px_rgba(20,50,34,0.35)] md:h-[calc(100vh-1.5rem)]">
        <div className="grid flex-1 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative min-h-[220px] overflow-hidden bg-[#10281e]">
            <img src={heroImage} alt="Greenhouse" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,35,26,0.18)_0%,rgba(11,35,26,0.4)_34%,rgba(8,24,17,0.76)_100%)]" />
            <div className="absolute right-5 top-5 z-10">
              <button
                type="button"
                onClick={() => setLanguage(isVietnamese ? 'en' : 'vi')}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur transition hover:bg-white/20"
              >
                {isVietnamese ? 'VI' : 'EN'}
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-7">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/80 backdrop-blur">
                {isVietnamese ? 'Phân tích chính xác' : 'Precision analytics'}
              </div>
              <h1 className="mt-4 max-w-[460px] text-[2.5rem] font-black leading-[0.94] tracking-tight md:text-[3rem] xl:text-[3.2rem]">
                {isVietnamese
                  ? 'Kiểm soát hệ thống nông nghiệp trên một bảng điều khiển.'
                  : 'Run the agricultural platform from one unified control room.'}
              </h1>
              <p className="mt-3 max-w-[520px] text-[13px] leading-6 text-white/72">
                {isVietnamese
                  ? 'Theo dõi vận hành, dữ liệu và chuỗi cung ứng trong một giao diện quản trị rõ ràng, hiệu quả.'
                  : 'Monitor operations, data, and supply chains from a clear and efficient management interface.'}
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center overflow-y-auto bg-[#f8f8f5] px-5 py-8 md:px-8 lg:px-10">
            <div className="w-full max-w-[380px]">
              <div className="mb-7 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0a7b59]">
                  <ShieldCheck size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0b7a58]">
                    Editorial Agronomy
                  </p>
                  <p className="text-[10px] text-[#7a8f84]">
                    {isVietnamese ? 'Cổng quản trị' : 'Admin portal'}
                  </p>
                </div>
              </div>

              <h2 className="text-[1.85rem] font-black leading-none tracking-tight text-[#142f24]">
                {isVietnamese ? 'Đăng nhập' : 'Sign in'}
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-[#66756d]">
                {isVietnamese
                  ? 'Nhập thông tin tài khoản để truy cập bảng điều khiển.'
                  : 'Enter your credentials to access the admin console.'}
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <FieldLabel label={isVietnamese ? 'Địa chỉ email' : 'Email address'} />
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7c8c84]"
                      size={15}
                    />
                    <input
                      type="email"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="admin@agronomy.vn"
                      autoComplete="username"
                      className="h-11 w-full rounded-xl border border-[#dfe5de] bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-[#b0bdb8] focus:border-[#0b7a58]/50 focus:ring-2 focus:ring-[#0b7a58]/10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <FieldLabel label={isVietnamese ? 'Mật khẩu' : 'Password'} />
                  </div>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7c8c84]"
                      size={15}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 w-full rounded-xl border border-[#dfe5de] bg-white pl-11 pr-11 text-sm outline-none transition placeholder:text-[#b0bdb8] focus:border-[#0b7a58]/50 focus:ring-2 focus:ring-[#0b7a58]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#708078] transition hover:bg-[#edf2ec] hover:text-[#173628]"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex cursor-pointer items-center gap-2.5 text-[12.5px] text-[#627168]">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-[#cfd6cf] accent-[#0b7a58]"
                    />
                    {isVietnamese ? 'Duy trì đăng nhập' : 'Keep me signed in'}
                  </label>
                </div>

                {error && (
                  <div className="rounded-xl border border-[#f5c6c3] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#c0483f]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#0a7b59] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(10,123,89,0.55)] transition hover:bg-[#086447] active:scale-[0.98] disabled:opacity-60"
                >
                  {loading
                    ? isVietnamese
                      ? 'Đang xác thực...'
                      : 'Signing in...'
                    : isVietnamese
                      ? 'Truy cập bảng điều khiển'
                      : 'Access admin console'}
                </button>
              </form>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-[#e3e7e2] bg-[#f7f8f4] px-5 py-3 text-[10px] text-[#77837d] md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <p className="font-black uppercase tracking-[0.22em] text-[#0f5d46]">
              Editorial Agronomy
            </p>
            <p className="mt-2">
              {isVietnamese
                ? '© 2024 Editorial Agronomy. Kiến tạo tương lai của trái đất.'
                : '© 2024 Editorial Agronomy. Building the future of the planet.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <span>{isVietnamese ? 'Phát triển bền vững' : 'Sustainability'}</span>
            <span>{isVietnamese ? 'Thông số kỹ thuật' : 'Technical specs'}</span>
            <span>{isVietnamese ? 'Chính sách quyền riêng tư' : 'Privacy policy'}</span>
            <span>{isVietnamese ? 'Điều khoản' : 'Terms'}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#65746c]">{label}</p>;
}

