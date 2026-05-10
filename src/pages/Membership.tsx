import { useEffect, useState, useCallback } from 'react';
import { Award, ChevronDown, LoaderCircle, Search, Users2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';

type MemberRow = {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  tier: string;
  label: string;
  totalSpent: number;
  discountPercent: number;
};

type OverviewResponse = {
  data: MemberRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  tierStats: Record<string, number>;
};

const TIERS = [
  { value: 'all',     label: 'Tất cả',    dot: 'bg-gray-300' },
  { value: 'none',    label: 'Thường',    dot: 'bg-gray-400' },
  { value: 'silver',  label: 'Bạc',       dot: 'bg-slate-400' },
  { value: 'gold',    label: 'Vàng',      dot: 'bg-amber-400' },
  { value: 'diamond', label: 'Kim Cương', dot: 'bg-cyan-400' },
];

const TIER_BADGE: Record<string, string> = {
  none:    'bg-gray-100 text-gray-500 border-gray-200',
  silver:  'bg-slate-100 text-slate-600 border-slate-300',
  gold:    'bg-amber-50 text-amber-700 border-amber-300',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-300',
};

const STAT_CARD: Record<string, { bg: string; text: string; border: string }> = {
  none:    { bg: 'bg-gray-50',    text: 'text-gray-600',  border: 'border-gray-200' },
  silver:  { bg: 'bg-slate-50',   text: 'text-slate-700', border: 'border-slate-200' },
  gold:    { bg: 'bg-amber-50',   text: 'text-amber-800', border: 'border-amber-200' },
  diamond: { bg: 'bg-cyan-50',    text: 'text-cyan-800',  border: 'border-cyan-200' },
};

function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

function Avatar({ row }: { row: MemberRow }) {
  const initials = (row.fullName ?? row.username ?? 'U').slice(0, 2).toUpperCase();
  if (row.avatarUrl) {
    return <img src={row.avatarUrl} alt={initials} className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

export default function Membership() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tierFilter = searchParams.get('tier') ?? 'all';
  const pageParam  = parseInt(searchParams.get('page') ?? '1', 10);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [searchInput, setSearchInput] = useState(search);

  const [data, setData]       = useState<MemberRow[]>([]);
  const [meta, setMeta]       = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [tierStats, setTierStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [settingTier, setSettingTier]   = useState<string | null>(null);
  const [tierDropdown, setTierDropdown] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (search) params.set('search', search);
      params.set('page', String(pageParam));
      params.set('limit', '20');
      const res = await apiClient.get<OverviewResponse>(`/membership/admin/overview?${params}`);
      setData(res.data);
      setMeta(res.meta);
      setTierStats(res.tierStats);
    } catch {
      toast('error', 'Không tải được dữ liệu thành viên');
    } finally {
      setLoading(false);
    }
  }, [tierFilter, search, pageParam, toast]);

  useEffect(() => { void load(); }, [load]);

  const handleSetTier = async (userId: string, tier: string) => {
    setSettingTier(userId);
    setTierDropdown(null);
    try {
      await apiClient.patch(`/membership/admin/${userId}/set-tier/${tier}`, {});
      toast('success', 'Đã cập nhật hạng thành viên');
      void load();
    } catch {
      toast('error', 'Cập nhật thất bại');
    } finally {
      setSettingTier(null);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setSearchParams((p) => { p.set('search', searchInput); p.set('page', '1'); return p; });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Award className="text-amber-500" size={22} />
          <div>
            <h1 className="text-xl font-black text-on-surface">Khách hàng thân thiết</h1>
            <p className="text-sm text-on-surface-variant">Quản lý hạng thành viên và phần thưởng</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TIERS.filter((t) => t.value !== 'all').map((t) => {
          const s = STAT_CARD[t.value];
          const count = tierStats[t.value] ?? 0;
          return (
            <button
              key={t.value}
              onClick={() => setSearchParams((p) => { p.set('tier', t.value); p.set('page', '1'); return p; })}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${s.bg} ${s.border} ${tierFilter === t.value ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}
            >
              <div className={`mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${s.text}`}>
                <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                {t.label}
              </div>
              <p className={`text-2xl font-black ${s.text}`}>{fmt(count)}</p>
              <p className="mt-0.5 text-xs text-gray-400">khách hàng</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-variant/30 p-1">
          {TIERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setSearchParams((p) => { p.set('tier', t.value); p.set('page', '1'); return p; })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tierFilter === t.value
                  ? 'bg-white text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 min-w-[220px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Tìm theo tên, email..."
              className="surface-input w-full pl-8 pr-3 py-2 text-sm"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary px-4 py-2 text-sm">Tìm</button>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <LoaderCircle size={24} className="animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-on-surface-variant">
            <Users2 size={32} className="opacity-30" />
            <p className="text-sm">Không có dữ liệu</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-variant/20 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-center">Hạng</th>
                <th className="px-4 py-3 text-right">Tổng chi tiêu</th>
                <th className="px-4 py-3 text-center">Giảm giá</th>
                <th className="px-4 py-3 text-center">Đặt hạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {data.map((row) => (
                <tr key={row.userId} className="hover:bg-surface-variant/10 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar row={row} />
                      <div>
                        <p className="font-semibold text-on-surface">{row.fullName ?? row.username}</p>
                        <p className="text-xs text-on-surface-variant">@{row.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{row.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TIER_BADGE[row.tier] ?? TIER_BADGE.none}`}>
                      <Award size={11} />
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-on-surface">
                    {fmt(row.totalSpent)}₫
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.discountPercent > 0 ? (
                      <span className="font-bold text-green-600">-{row.discountPercent}%</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="relative inline-block">
                      <button
                        disabled={settingTier === row.userId}
                        onClick={() => setTierDropdown(tierDropdown === row.userId ? null : row.userId)}
                        className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-variant/20 transition disabled:opacity-50"
                      >
                        {settingTier === row.userId ? (
                          <LoaderCircle size={12} className="animate-spin" />
                        ) : (
                          <>Đặt hạng <ChevronDown size={12} /></>
                        )}
                      </button>
                      {tierDropdown === row.userId && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-outline-variant bg-surface shadow-lg">
                          {TIERS.filter((t) => t.value !== 'all').map((t) => (
                            <button
                              key={t.value}
                              onClick={() => void handleSetTier(row.userId, t.value)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition hover:bg-surface-variant/30 first:rounded-t-xl last:rounded-b-xl ${row.tier === t.value ? 'text-primary' : 'text-on-surface'}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.totalPages}
          onPageChange={(p) => setSearchParams((sp) => { sp.set('page', String(p)); return sp; })}
        />
      )}
    </div>
  );
}
