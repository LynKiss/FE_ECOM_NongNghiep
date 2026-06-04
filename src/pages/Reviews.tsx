import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Eye,
  ImageIcon,
  Trash2,
  LoaderCircle,
  Search,
  Star,
  RefreshCw,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

type ReviewStatus = 'visible' | 'hidden' | 'deleted';

type ReviewItem = {
  commentId: string;
  content: string;
  rating: number | null;
  status: ReviewStatus;
  imageUrls: string[];
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  user: { username: string | null };
  product: { productName: string | null };
};

type ReviewsResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: ReviewItem[];
};

type ReviewStats = {
  total: number;
  totalVisible: number;
  totalHidden: number;
  totalDeleted: number;
  averageRating: number;
  reviewsToday: number;
};

type FilterStatus = 'all' | ReviewStatus;

// ── Sub-components ──────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-on-surface-variant/50">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          className={s <= rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-on-surface/20'}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg: Record<ReviewStatus, { label: string; cls: string }> = {
    visible: { label: 'Hiển thị', cls: 'bg-emerald-100 text-emerald-700' },
    hidden: { label: 'Ẩn', cls: 'bg-amber-100 text-amber-700' },
    deleted: { label: 'Đã xóa', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function ImageThumbnails({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {urls.map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => onOpen(i)}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-on-surface/10 transition hover:scale-105 hover:border-primary/40 hover:shadow"
          title="Xem ảnh"
        >
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
      {urls.length > 1 && (
        <span className="flex h-10 items-center px-1 text-[10px] font-bold text-on-surface-variant/60">
          {urls.length} ảnh
        </span>
      )}
    </div>
  );
}

type LightboxState = { images: string[]; index: number };

function Lightbox({
  state,
  onClose,
  onPrev,
  onNext,
}: {
  state: LightboxState;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { images, index } = state;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Nav prev */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div
        className="relative mx-16 flex max-h-[88vh] max-w-[88vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[index]}
          alt={`Ảnh ${index + 1}`}
          className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl"
        />
      </div>

      {/* Nav next */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          {index + 1} / {images.length}
        </div>
      )}

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
      >
        <X size={18} />
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Reviews() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (searchParams.get('status') as FilterStatus) ?? 'all',
  );
  const [filterRating, setFilterRating] = useState<string>(searchParams.get('rating') ?? '');
  const [filterHasImages, setFilterHasImages] = useState(searchParams.get('hasImages') === 'true');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const LIMIT = 12;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [isVietnamese],
  );

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (filterStatus !== 'all') next.set('status', filterStatus);
    if (filterRating) next.set('rating', filterRating);
    if (filterHasImages) next.set('hasImages', 'true');
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [search, filterStatus, filterRating, filterHasImages, page, setSearchParams]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterRating, filterHasImages]);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    void apiClient
      .get<ReviewStats>('/reviews/admin/stats')
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Load reviews
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filterStatus !== 'all') q.set('status', filterStatus);
    if (filterRating) q.set('rating', filterRating);
    if (search.trim()) q.set('search', search.trim());
    if (filterHasImages) q.set('hasImages', 'true');

    void apiClient
      .get<ReviewsResponse>(`/reviews/admin?${q.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setReviews(data.items);
          setMeta(data.meta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Không tải được danh sách đánh giá');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [search, filterStatus, filterRating, filterHasImages, page, reloadKey]);

  async function handleHide(commentId: string) {
    try {
      await apiClient.patch(`/reviews/admin/${commentId}/hide`);
      showToast({ tone: 'success', title: 'Đã ẩn đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Ẩn thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleShow(commentId: string) {
    try {
      await apiClient.patch(`/reviews/admin/${commentId}/show`);
      showToast({ tone: 'success', title: 'Đã hiển thị đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thao tác thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleDelete(commentId: string) {
    const ok = await askConfirm({
      title: 'Xóa đánh giá?',
      description: 'Đánh giá sẽ bị xóa khỏi trang sản phẩm và nhật ký đánh giá.',
      tone: 'danger',
      confirmLabel: 'Xóa',
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/reviews/admin/${commentId}`);
      showToast({ tone: 'success', title: 'Đã xóa đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Xóa thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  function openLightbox(images: string[], index: number) {
    setLightbox({ images, index });
  }

  function closeLightbox() {
    setLightbox(null);
  }

  function lightboxPrev() {
    setLightbox((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null);
  }

  function lightboxNext() {
    setLightbox((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null);
  }

  return (
    <div className="space-y-6 pb-12">
      {ConfirmDialog}
      {lightbox && (
        <Lightbox state={lightbox} onClose={closeLightbox} onPrev={lightboxPrev} onNext={lightboxNext} />
      )}

      {/* Header */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">Quản lý đánh giá</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Kiểm duyệt đánh giá sản phẩm từ khách hàng, ẩn hoặc xóa nội dung không phù hợp.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statsLoading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
              <div className="mx-auto h-7 w-12 animate-pulse rounded-lg bg-surface" />
              <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-surface" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Tổng đánh giá" value={stats.total} />
            <StatCard label="Hiển thị" value={stats.totalVisible} accent="emerald" />
            <StatCard label="Đang ẩn" value={stats.totalHidden} accent="amber" />
            <StatCard label="Đã xóa" value={stats.totalDeleted} accent="red" />
            <StatCard label="Điểm TB" value={stats.averageRating.toFixed(1)} icon={<Star size={13} className="fill-amber-400 text-amber-400" />} />
            <StatCard label="Hôm nay" value={stats.reviewsToday} />
          </>
        )}
      </div>

      {/* Filter bar */}
      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_140px_auto_auto]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm trong nội dung đánh giá..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="visible">Hiển thị</option>
            <option value="hidden">Ẩn</option>
            <option value="deleted">Đã xóa</option>
          </select>

          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="">Tất cả sao</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={String(r)}>{r} sao</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFilterHasImages((v) => !v)}
            title="Chỉ hiện đánh giá có ảnh"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              filterHasImages
                ? 'border-primary bg-primary text-white'
                : 'border-on-surface/10 bg-surface text-on-surface-variant hover:border-primary/30 hover:text-primary'
            }`}
          >
            <ImageIcon size={15} />
            Có ảnh
          </button>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-4 py-4">Sản phẩm</th>
                <th className="px-4 py-4">Người dùng</th>
                <th className="px-4 py-4">Nội dung & Ảnh</th>
                <th className="px-4 py-4 text-center">Rating</th>
                <th className="px-4 py-4 text-center">Lượt thích</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Ngày</th>
                <th className="px-4 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      Đang tải đánh giá...
                    </span>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <Star size={28} className="mx-auto mb-3 text-primary/30" />
                    Không có đánh giá phù hợp
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.commentId} className="hover:bg-surface/40">
                    <td className="px-4 py-4 max-w-[160px]">
                      <p className="truncate font-semibold text-on-surface">
                        {review.product.productName ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-on-surface-variant">
                      {review.user.username ?? '—'}
                    </td>
                    <td className="px-4 py-4 max-w-[280px]">
                      <p className="line-clamp-2 text-on-surface">{review.content}</p>
                      <ImageThumbnails
                        urls={review.imageUrls}
                        onOpen={(i) => openLightbox(review.imageUrls, i)}
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="px-4 py-4 text-center text-on-surface-variant">
                      <span className="text-emerald-600">{review.likeCount}</span>
                      {' / '}
                      <span className="text-red-500">{review.dislikeCount}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={review.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-on-surface-variant">
                      {dateFormatter.format(new Date(review.createdAt))}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {review.status === 'visible' ? (
                          <button
                            type="button"
                            title="Ẩn đánh giá"
                            onClick={() => void handleHide(review.commentId)}
                            className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50"
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : review.status === 'hidden' ? (
                          <button
                            type="button"
                            title="Hiển thị đánh giá"
                            onClick={() => void handleShow(review.commentId)}
                            className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <Eye size={16} />
                          </button>
                        ) : null}
                        {review.status !== 'deleted' && (
                          <button
                            type="button"
                            title="Xóa đánh giá"
                            onClick={() => void handleDelete(review.commentId)}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 pb-5">
          <Pagination
            page={meta.page}
            limit={meta.limit}
            total={meta.total}
            totalPages={meta.totalPages}
            isVietnamese={isVietnamese}
            onPageChange={setPage}
            onLimitChange={(next) => { setPage(1); void next; }}
            pageSizeOptions={[12]}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'amber' | 'red';
  icon?: ReactNode;
}) {
  const colorCls =
    accent === 'emerald' ? 'text-emerald-600'
    : accent === 'amber' ? 'text-amber-600'
    : accent === 'red' ? 'text-red-600'
    : 'text-primary';

  return (
    <div className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
      <p className={`flex items-center justify-center gap-1 text-2xl font-black ${colorCls}`}>
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}
