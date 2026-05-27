import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../components/shared/Pagination';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../i18n/language-context';
import { apiClient } from '../lib/api';

type CommentStatus = 'visible' | 'hidden' | 'deleted';

type CommentItem = {
  id: string;
  content: string;
  imageUrls?: string[];
  status: CommentStatus;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  author: { username: string };
  article: { newsId: string; title: string };
};

type CommentsResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: CommentItem[];
};

type CommentStats = {
  total: number;
  totalVisible: number;
  totalHidden: number;
  totalDeleted: number;
  totalReactions: number;
  commentsToday: number;
};

type FilterStatus = 'all' | CommentStatus;

function StatusBadge({ status }: { status: CommentStatus }) {
  const cfg: Record<CommentStatus, { label: string; cls: string }> = {
    visible: { label: 'Hiển thị', cls: 'bg-emerald-100 text-emerald-700' },
    hidden: { label: 'Đang ẩn', cls: 'bg-amber-100 text-amber-700' },
    deleted: { label: 'Đã xóa', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = cfg[status];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function getImages(comment: CommentItem) {
  return Array.isArray(comment.imageUrls) ? comment.imageUrls.filter(Boolean) : [];
}

export default function NewsComments() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<CommentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (searchParams.get('status') as FilterStatus) ?? 'all',
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const LIMIT = 12;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [isVietnamese],
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (filterStatus !== 'all') next.set('status', filterStatus);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [filterStatus, page, search, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, search]);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);

    void apiClient
      .get<CommentStats>('/news/admin/comments/stats')
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
    });
    if (filterStatus !== 'all') query.set('status', filterStatus);
    if (search.trim()) query.set('search', search.trim());

    void apiClient
      .get<CommentsResponse>(`/news/admin/comments?${query.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setComments(data.items);
          setMeta(data.meta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không tải được danh sách bình luận bài viết',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterStatus, page, reloadKey, search]);

  async function handleToggleVisibility(id: string) {
    try {
      await apiClient.patch(`/news/admin/comments/${id}/hide`);
      showToast({ tone: 'success', title: 'Đã cập nhật trạng thái bình luận' });
      setReloadKey((current) => current + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Cập nhật thất bại',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xóa bình luận này?')) return;

    try {
      await apiClient.delete(`/news/admin/comments/${id}`);
      showToast({ tone: 'success', title: 'Đã xóa bình luận' });
      setReloadKey((current) => current + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Xóa thất bại',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  function openImagePreview(images: string[], index: number) {
    setPreviewImages(images);
    setPreviewIndex(index);
  }

  function closeImagePreview() {
    setPreviewImages(null);
    setPreviewIndex(0);
  }

  function movePreview(step: number) {
    setPreviewIndex((current) => {
      if (!previewImages?.length) return current;
      return (current + step + previewImages.length) % previewImages.length;
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          Quản lý bình luận bài viết
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Kiểm duyệt bình luận từ độc giả, xem ảnh đính kèm, ẩn hoặc xóa nội dung không phù hợp.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statsLoading || !stats ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm"
            >
              <div className="mx-auto h-7 w-12 animate-pulse rounded-lg bg-surface" />
              <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-surface" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Tổng bình luận" value={stats.total} />
            <StatCard label="Hiển thị" value={stats.totalVisible} accent="emerald" />
            <StatCard label="Đang ẩn" value={stats.totalHidden} accent="amber" />
            <StatCard label="Đã xóa" value={stats.totalDeleted} accent="red" />
            <StatCard label="Tương tác" value={stats.totalReactions} />
            <StatCard label="Hôm nay" value={stats.commentsToday} />
          </>
        )}
      </div>

      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm trong nội dung, tác giả, bài viết..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="visible">Hiển thị</option>
            <option value="hidden">Đang ẩn</option>
            <option value="deleted">Đã xóa</option>
          </select>

          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-4 py-4">Bài viết</th>
                <th className="px-4 py-4">Tác giả</th>
                <th className="px-4 py-4">Nội dung</th>
                <th className="px-4 py-4">Ảnh</th>
                <th className="px-4 py-4 text-center">Tương tác</th>
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
                      Đang tải bình luận...
                    </span>
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <MessageSquare size={28} className="mx-auto mb-3 text-primary/30" />
                    Không có bình luận phù hợp
                  </td>
                </tr>
              ) : (
                comments.map((comment) => {
                  const images = getImages(comment);

                  return (
                    <tr key={comment.id} className="hover:bg-surface/40">
                      <td className="max-w-[220px] px-4 py-4">
                        <p className="line-clamp-2 font-semibold text-on-surface">
                          {comment.article.title || '—'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-on-surface-variant">
                        {comment.author.username || '—'}
                      </td>
                      <td className="max-w-[280px] px-4 py-4">
                        <p className="line-clamp-3 text-on-surface">{comment.content}</p>
                      </td>
                      <td className="min-w-[150px] px-4 py-4">
                        {images.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {images.slice(0, 3).map((url, index) => (
                              <button
                                key={`${comment.id}-${url}-${index}`}
                                type="button"
                                onClick={() => openImagePreview(images, index)}
                                className="group relative h-14 w-14 overflow-hidden rounded-xl border border-on-surface/10 bg-surface p-1 transition hover:border-primary/40"
                                title="Xem ảnh bình luận"
                              >
                                <img
                                  src={url}
                                  alt={`Ảnh bình luận ${index + 1}`}
                                  className="h-full w-full rounded-lg object-contain"
                                />
                                <span className="absolute inset-0 hidden items-center justify-center bg-black/30 text-white group-hover:flex">
                                  <Eye size={15} />
                                </span>
                              </button>
                            ))}
                            {images.length > 3 ? (
                              <button
                                type="button"
                                onClick={() => openImagePreview(images, 3)}
                                className="h-14 w-14 rounded-xl border border-on-surface/10 bg-surface text-xs font-bold text-primary"
                              >
                                +{images.length - 3}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-on-surface-variant">
                            <ImageIcon size={13} />
                            Không có ảnh
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-on-surface-variant">
                        <span className="text-emerald-600">{comment.likeCount}</span>
                        {' / '}
                        <span className="text-red-500">{comment.dislikeCount}</span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={comment.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-on-surface-variant">
                        {dateFormatter.format(new Date(comment.createdAt))}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {comment.status === 'visible' ? (
                            <button
                              type="button"
                              title="Ẩn bình luận"
                              onClick={() => void handleToggleVisibility(comment.id)}
                              className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50"
                            >
                              <EyeOff size={16} />
                            </button>
                          ) : comment.status === 'hidden' ? (
                            <button
                              type="button"
                              title="Hiển thị bình luận"
                              onClick={() => void handleToggleVisibility(comment.id)}
                              className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50"
                            >
                              <Eye size={16} />
                            </button>
                          ) : null}

                          {comment.status !== 'deleted' && (
                            <button
                              type="button"
                              title="Xóa bình luận"
                              onClick={() => void handleDelete(comment.id)}
                              className="rounded-xl p-2 text-red-500 transition hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            onLimitChange={(next) => {
              setPage(1);
              void next;
            }}
            pageSizeOptions={[12]}
          />
        </div>
      </section>

      {previewImages ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
          onClick={closeImagePreview}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-on-surface">Ảnh bình luận</p>
                <p className="text-xs text-on-surface-variant">
                  {previewIndex + 1}/{previewImages.length}
                </p>
              </div>
              <button
                type="button"
                onClick={closeImagePreview}
                className="rounded-full border border-on-surface/10 p-2 text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
                aria-label="Đóng xem ảnh"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex min-h-[360px] items-center justify-center rounded-xl bg-surface">
              {previewImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => movePreview(-1)}
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-on-surface shadow transition hover:bg-white"
                    aria-label="Ảnh trước"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePreview(1)}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-on-surface shadow transition hover:bg-white"
                    aria-label="Ảnh sau"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              ) : null}
              <img
                src={previewImages[previewIndex]}
                alt="Ảnh bình luận"
                className="max-h-[72vh] max-w-full object-contain"
              />
            </div>

            {previewImages.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {previewImages.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className={`h-16 w-16 flex-none overflow-hidden rounded-xl border bg-surface p-1 ${
                      index === previewIndex ? 'border-primary' : 'border-on-surface/10'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Ảnh bình luận ${index + 1}`}
                      className="h-full w-full rounded-lg object-contain"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
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
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'amber'
        ? 'text-amber-600'
        : accent === 'red'
          ? 'text-red-600'
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
