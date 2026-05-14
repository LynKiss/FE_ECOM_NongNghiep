import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  requestClientPasswordResetOtp,
  resetClientPassword,
} from '../../lib/client-api';

const heroImage =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85';

export default function ClientForgotPassword() {
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleRequestOtp = async (event: FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return;

    setLoading(true);
    setError('');
    setNotice('');
    try {
      await requestClientPasswordResetOtp(nextEmail);
      setEmail(nextEmail);
      setStep('otp');
      setNotice('Nếu email hợp lệ, mã OTP đã được gửi. Vui lòng kiểm tra hộp thư.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không gửi được mã OTP. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Mã OTP phải gồm 6 chữ số.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu chưa khớp.');
      return;
    }

    setLoading(true);
    try {
      await resetClientPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setStep('done');
      setNotice('Mật khẩu đã được cập nhật.');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'Không đặt lại được mật khẩu. Vui lòng kiểm tra OTP.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await requestClientPasswordResetOtp(email.trim());
      setNotice('Mã OTP mới đã được gửi nếu email hợp lệ.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không gửi lại được OTP. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f0eb]">
      <div className="mx-auto min-h-screen max-w-[1280px] p-3 sm:p-4">
        <div className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] lg:grid-cols-[1fr_480px]">
          <section className="relative hidden overflow-hidden bg-[#1E3932] lg:block">
            <img
              src={heroImage}
              alt="Cánh đồng nông nghiệp"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1E3932]/35 via-[#1E3932]/55 to-[#0f2019]/90" />

            <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-12">
              <Link to="/client" className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00754A]">
                  <Leaf size={20} />
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
                  Bảo mật tài khoản
                </div>
                <h1 className="text-[2.55rem] font-black leading-[1.05] tracking-tight xl:text-[3rem]">
                  Lấy lại quyền truy cập bằng email đã đăng ký.
                </h1>
                <p className="mt-4 text-[13.5px] leading-7 text-white/70">
                  OTP chỉ có hiệu lực trong thời gian ngắn và mật khẩu mới sẽ đăng xuất các phiên cũ.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[
                    { icon: Mail, label: 'Email', desc: 'Nhận mã xác thực' },
                    { icon: ShieldCheck, label: 'OTP', desc: 'Xác minh 6 chữ số' },
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
                © {new Date().getFullYear()} Cultivated Ledger.
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
            <div className="w-full max-w-[380px]">
              <Link
                to="/client/login"
                className="mb-7 inline-flex items-center gap-2 text-sm font-black text-[#006241] hover:underline"
              >
                <ArrowLeft size={16} />
                Đăng nhập
              </Link>

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
                Quên mật khẩu
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-[#4a6155]">
                {step === 'email'
                  ? 'Nhập email tài khoản để nhận mã OTP.'
                  : step === 'otp'
                    ? 'Nhập OTP và mật khẩu mới.'
                    : 'Bạn có thể đăng nhập bằng mật khẩu mới.'}
              </p>

              {error ? (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-medium text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              ) : null}

              {notice ? (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  {notice}
                </div>
              ) : null}

              {step === 'email' ? (
                <form onSubmit={(event) => void handleRequestOtp(event)} className="mt-7 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]">
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        className="h-11 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 pl-10 text-sm outline-none transition placeholder:text-black/30 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3932] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(30,57,50,0.55)] transition hover:bg-[#163028] active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
                    {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                  </button>
                </form>
              ) : null}

              {step === 'otp' ? (
                <form onSubmit={(event) => void handleResetPassword(event)} className="mt-7 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]">
                      OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      required
                      className="h-12 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 text-center text-xl font-black tracking-[0.4em] text-[#1E3932] outline-none transition placeholder:text-black/20 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10"
                    />
                  </div>

                  <PasswordField
                    label="Mật khẩu mới"
                    value={newPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                  />

                  <PasswordField
                    label="Xác nhận mật khẩu"
                    value={confirmPassword}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3932] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(30,57,50,0.55)] transition hover:bg-[#163028] active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <LockKeyhole size={16} />
                    )}
                    {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void resendOtp()}
                    disabled={loading}
                    className="h-10 w-full rounded-xl border border-black/10 text-sm font-black text-[#006241] transition hover:bg-[#f2f0eb] disabled:opacity-60"
                  >
                    Gửi lại OTP
                  </button>
                </form>
              ) : null}

              {step === 'done' ? (
                <div className="mt-7 space-y-4">
                  <Link
                    to="/client/login"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3932] text-sm font-black text-white shadow-[0_12px_28px_-10px_rgba(30,57,50,0.55)] transition hover:bg-[#163028]"
                  >
                    <ShieldCheck size={16} />
                    Về trang đăng nhập
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PasswordField(props: {
  label: string;
  value: string;
  show: boolean;
  autoComplete: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#4a6155]">
        {props.label}
      </label>
      <div className="relative">
        <input
          type={props.show ? 'text' : 'password'}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="••••••••"
          required
          autoComplete={props.autoComplete}
          className="h-11 w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 pr-11 text-sm outline-none transition placeholder:text-black/30 focus:border-[#00754A]/50 focus:bg-white focus:ring-2 focus:ring-[#00754A]/10"
        />
        <button
          type="button"
          onClick={props.onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-black/35 transition hover:bg-black/5 hover:text-black/60"
          aria-label={props.show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {props.show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}
