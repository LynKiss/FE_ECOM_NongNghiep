import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, KeyRound, MapPin, Package, LogOut, Save, LoaderCircle, CheckCircle2, AlertCircle, Heart, ImagePlus, Award, RotateCcw, MessageSquareText } from 'lucide-react';
import { clientApi, logoutClient } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type Profile = {
  _id: string;
  username: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string | null;
};

type MembershipInfo = {
  tier: string;
  label: string;
  totalSpent: number;
  discountPercent: number;
  nextTier: { tier: string; label: string; minSpent: number; remaining: number } | null;
};

const TIER_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  none:    { bg: 'bg-gray-100',    text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-400' },
  silver:  { bg: 'bg-slate-100',   text: 'text-slate-600',  border: 'border-slate-300',  dot: 'bg-slate-400' },
  gold:    { bg: 'bg-amber-50',    text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-400' },
  diamond: { bg: 'bg-cyan-50',     text: 'text-cyan-700',   border: 'border-cyan-300',   dot: 'bg-cyan-400' },
};

export default function Account() {
  const navigate = useNavigate();
  const { session, setSession } = useClientSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const [form, setForm] = useState({ fullName: '', phoneNumber: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    void clientApi
      .get<Profile>('/users/me')
      .then((data) => {
        setProfile(data);
        setForm({ fullName: data.fullName ?? '', phoneNumber: data.phoneNumber ?? '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    void clientApi
      .get<MembershipInfo>('/membership/my-tier')
      .then((data) => setMembership(data))
      .catch(() => {});
  }, [session, navigate]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await clientApi.patch<Profile>('/users/me', form);
      setProfile(updated);
      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            fullName: updated.fullName ?? undefined,
            phoneNumber: updated.phoneNumber ?? undefined,
            avatarUrl: updated.avatarUrl ?? null,
          },
        });
      }
      showToast('success', 'Cập nhật hồ sơ thành công');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const updated = await clientApi.postForm<Profile>('/users/me/avatar', data);
      setProfile(updated);
      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            fullName: updated.fullName ?? session.user.fullName,
            phoneNumber: updated.phoneNumber ?? session.user.phoneNumber,
            avatarUrl: updated.avatarUrl ?? null,
          },
        });
      }
      showToast('success', 'Da cap nhat anh dai dien');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Tai anh that bai');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      showToast('error', 'Mật khẩu mới không khớp');
      return;
    }
    if (passwords.next.length < 6) {
      showToast('error', 'Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    setSaving(true);
    try {
      await clientApi.patch('/users/me/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: '', next: '', confirm: '' });
      showToast('success', 'Đổi mật khẩu thành công');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutClient();
    void navigate('/client');
  };

  if (loading) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  const initials = (profile?.fullName ?? profile?.username ?? 'U').slice(0, 2).toUpperCase();

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
            Cá nhân
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#1E3932]">Tài khoản của tôi</h1>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-sm ${
              toast.type === 'success'
                ? 'bg-[#d4e9e2] text-[#1E3932]'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <div className="space-y-3">
            {/* Avatar card */}
            <div className="client-card p-5 text-center">
              <label className="group relative mx-auto mb-3 block h-16 w-16 cursor-pointer overflow-hidden rounded-full">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile?.fullName ?? profile?.username ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-xl font-black text-white"
                    style={{ background: '#1E3932' }}
                  >
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                  {uploadingAvatar ? <LoaderCircle size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(event) => void handleAvatarUpload(event.target.files?.[0] ?? null)}
                />
              </label>
              <p className="font-bold text-[#1E3932]">
                {profile?.fullName ?? profile?.username}
              </p>
              <p className="text-xs text-gray-400">{profile?.email}</p>
            </div>

            {/* Membership tier card */}
            {membership && (() => {
              const style = TIER_STYLE[membership.tier] ?? TIER_STYLE.none;
              const progress = membership.nextTier
                ? Math.min(100, Math.round(((membership.nextTier.minSpent - membership.nextTier.remaining) / membership.nextTier.minSpent) * 100))
                : 100;
              return (
                <div className={`client-card p-4 ${style.bg} border ${style.border}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <Award size={15} className={style.text} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${style.text}`}>Thành viên</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <span className={`text-sm font-black ${style.text}`}>{membership.label}</span>
                    {membership.discountPercent > 0 && (
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${style.bg} border ${style.border} ${style.text}`}>
                        -{membership.discountPercent}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Đã chi: {membership.totalSpent.toLocaleString('vi-VN')}₫
                  </p>
                  {membership.nextTier && (
                    <>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                        <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Còn {membership.nextTier.remaining.toLocaleString('vi-VN')}₫ lên hạng <span className="font-semibold">{membership.nextTier.label}</span>
                      </p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Nav */}
            <div className="client-card overflow-hidden">
              {[
                { id: 'profile', label: 'Thông tin cá nhân', icon: User },
                { id: 'password', label: 'Đổi mật khẩu', icon: KeyRound },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as 'profile' | 'password')}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold transition ${
                    activeTab === item.id
                      ? 'bg-[#006241]/10 text-[#006241]'
                      : 'text-[#1E3932] hover:bg-black/3'
                  }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
              <Link
                to="/client/orders"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <Package size={15} /> Lịch sử đơn hàng
              </Link>
              <Link
                to="/client/returns"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <RotateCcw size={15} /> Trả hàng của tôi
              </Link>
              <Link
                to="/client/my-activity"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <MessageSquareText size={15} /> Đánh giá & bình luận
              </Link>
              <Link
                to="/client/wishlist"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <Heart size={15} /> Sản phẩm yêu thích
              </Link>
              <Link
                to="/client/account/addresses"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <MapPin size={15} /> Địa chỉ giao hàng
              </Link>
              <button
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50"
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </div>
          </div>

          {/* Main panel */}
          <div className="client-card p-6">
            {activeTab === 'profile' ? (
              <>
                <h2 className="mb-5 text-lg font-black text-[#1E3932]">Thông tin cá nhân</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Họ và tên
                    </label>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Nguyễn Văn A"
                      className="client-input w-full px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tên đăng nhập
                    </label>
                    <input
                      value={profile?.username ?? ''}
                      disabled
                      className="w-full rounded-xl border border-black/5 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">Email</label>
                    <input
                      value={profile?.email ?? ''}
                      disabled
                      className="w-full rounded-xl border border-black/5 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Số điện thoại
                    </label>
                    <input
                      value={form.phoneNumber}
                      onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="0901234567"
                      className="client-input w-full px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={saving}
                  className="client-pill-primary mt-6 flex items-center gap-2 px-6 py-3 text-sm font-bold disabled:opacity-60"
                >
                  {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            ) : (
              <>
                <h2 className="mb-5 text-lg font-black text-[#1E3932]">Đổi mật khẩu</h2>
                <form onSubmit={(e) => void handleChangePassword(e)} className="max-w-sm space-y-4">
                  {[
                    { key: 'current', label: 'Mật khẩu hiện tại' },
                    { key: 'next', label: 'Mật khẩu mới' },
                    { key: 'confirm', label: 'Xác nhận mật khẩu mới' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                        {field.label}
                      </label>
                      <input
                        type="password"
                        value={passwords[field.key as keyof typeof passwords]}
                        onChange={(e) =>
                          setPasswords((p) => ({ ...p, [field.key]: e.target.value }))
                        }
                        required
                        className="client-input w-full px-4 py-2.5 text-sm"
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={saving}
                    className="client-pill-primary flex items-center gap-2 px-6 py-3 text-sm font-bold disabled:opacity-60"
                  >
                    {saving ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    {saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
