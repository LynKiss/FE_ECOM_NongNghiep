import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';

type Review = {
  reviewId?: string;
  id?: string;
  productId?: string | null;
  productName?: string | null;
  rating?: number;
  content?: string | null;
  imageUrls?: string[];
  status?: string;
  createdAt?: string;
};

type NewsComment = {
  commentId?: string;
  id?: string;
  articleTitle?: string | null;
  articleSlug?: string | null;
  content?: string | null;
  imageUrls?: string[];
  status?: string;
  createdAt?: string;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };
type Paginated<T> = { items: T[]; meta?: Meta };

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'visible', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đã ẩn' },
  { value: 'deleted', label: 'Đã xóa' },
];

const statusLabels: Record<string, string> = {
  visible: 'Đang hiển thị',
  published: 'Đang hiển thị',
  approved: 'Đang hiển thị',
  pending: 'Chờ duyệt',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
};

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizePayload<T>(payload: T[] | Paginated<T>, page: number, limit: number) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: { page, limit, total: payload.length, totalPages: Math.max(1, Math.ceil(payload.length / limit)) },
    };
  }
  return {
    items: payload.items ?? [],
    meta: payload.meta ?? { page, limit, total: payload.items?.length ?? 0, totalPages: 1 },
  };
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = status ?? 'visible';
  const isBad = normalized === 'deleted';
  const isPending = normalized === 'pending' || normalized === 'hidden';
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        isBad
          ? 'bg-red-50 text-red-700'
          : isPending
            ? 'bg-amber-50 text-amber-700'
            : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {statusLabels[normalized] ?? normalized}
    </span>
  );
}

function ImageStrip({ imageUrls }: { imageUrls?: string[] }) {
  if (!imageUrls?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {imageUrls.slice(0, 5).map((url, index) => (
        <a
          key={`${url}-${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="h-16 w-16 overflow-hidden rounded-xl border border-black/10 bg-[#f2f0eb]"
          title="Mở ảnh"
        >
          <img src={url} alt={`Ảnh đính kèm ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
      {imageUrls.length > 5 ? (
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f2f0eb] text-xs font-black text-gray-500">
          +{imageUrls.length - 5}
        </span>
      ) : null}
    </div>
  );
}

export default function MyActivity() {
  const [activeTab, setActiveTab] = useState<'reviews' | 'comments'>('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [reviewMeta, setReviewMeta] = useState<Meta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [commentMeta, setCommentMeta] = useState<Meta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [reviewPage, setReviewPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const reviewParams = new URLSearchParams({ page: String(reviewPage), limit: String(limit) });
    const commentParams = new URLSearchParams({ page: String(commentPage), limit: String(limit) });
    if (search.trim()) {
      reviewParams.set('search', search.trim());
      commentParams.set('search', search.trim());
    }
    if (status !== 'all') {
      reviewParams.set('status', status);
      commentParams.set('status', status);
    }
    Promise.all([
      clientApi.get<Review[] | Paginated<Review>>(`/reviews/me?${reviewParams.toString()}`),
      clientApi.get<NewsComment[] | Paginated<NewsComment>>(`/news/public/comments/me?${commentParams.toString()}`),
    ])
      .then(([reviewPayload, commentPayload]) => {
        const normalizedReviews = normalizePayload(reviewPayload, reviewPage, limit);
        const normalizedComments = normalizePayload(commentPayload, commentPage, limit);
        setReviews(normalizedReviews.items);
        setReviewMeta(normalizedReviews.meta);
        setComments(normalizedComments.items);
        setCommentMeta(normalizedComments.meta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được hoạt động cá nhân.'))
      .finally(() => setLoading(false));
  }, [commentPage, limit, reviewPage, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = () => {
    setReviewPage(1);
    setCommentPage(1);
    setSearch(searchInput.trim());
  };

  const meta = activeTab === 'reviews' ? reviewMeta : commentMeta;
  const setPage = activeTab === 'reviews' ? setReviewPage : setCommentPage;
  const visibleItems = activeTab === 'reviews' ? reviews : comments;

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <Link to="/client/account" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#006241] hover:underline">
          <ArrowLeft size={15} /> Tài khoản của tôi
        </Link>

        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]">Hoạt động cá nhân</p>
            <h1 className="mt-1 text-3xl font-black text-[#1E3932]">Đánh giá & bình luận</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Xem lại đánh giá sản phẩm và bình luận bài viết của bạn.
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#006241]/20 px-4 py-2 text-sm font-black text-[#006241] hover:bg-[#006241]/10">
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="mb-3 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
                placeholder="Tìm sản phẩm, bài viết hoặc nội dung..."
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f6f1] pl-10 pr-3 text-sm outline-none focus:border-[#006241]"
              />
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setReviewPage(1);
                setCommentPage(1);
              }}
              className="h-11 rounded-xl border border-black/10 bg-[#f8f6f1] px-3 text-sm outline-none focus:border-[#006241]"
            >
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button onClick={applySearch} className="h-11 rounded-xl bg-[#006241] px-5 text-sm font-black text-white hover:bg-[#005234]">
              Tìm kiếm
            </button>
          </div>
          <div className="grid rounded-xl bg-[#f8f6f1] p-1 sm:grid-cols-2">
            <button type="button" onClick={() => setActiveTab('reviews')} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${activeTab === 'reviews' ? 'bg-[#006241] text-white shadow-sm' : 'text-[#1E3932] hover:bg-white'}`}>
              Đánh giá sản phẩm ({reviewMeta.total})
            </button>
            <button type="button" onClick={() => setActiveTab('comments')} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${activeTab === 'comments' ? 'bg-[#006241] text-white shadow-sm' : 'text-[#1E3932] hover:bg-white'}`}>
              Bình luận bài viết ({commentMeta.total})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-white">
            <LoaderCircle className="animate-spin text-[#006241]" size={26} />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            {activeTab === 'reviews' ? <Star className="mx-auto mb-3 text-[#006241]" size={34} /> : <MessageSquareText className="mx-auto mb-3 text-[#006241]" size={34} />}
            <h2 className="text-xl font-black text-[#1E3932]">Chưa có dữ liệu</h2>
            <p className="mt-2 text-sm text-gray-500">
              {activeTab === 'reviews'
                ? 'Các đánh giá sản phẩm của bạn sẽ hiển thị tại đây.'
                : 'Các bình luận bài viết của bạn sẽ hiển thị tại đây.'}
            </p>
          </div>
        ) : activeTab === 'reviews' ? (
          <div className="space-y-3">
            {reviews.map((item) => (
              <article key={item.reviewId ?? item.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400">{formatDate(item.createdAt)}</p>
                    <h2 className="mt-1 line-clamp-2 text-lg font-black text-[#1E3932]">{item.productName ?? 'Sản phẩm'}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star key={idx} size={15} fill={idx < Number(item.rating ?? 0) ? 'currentColor' : 'none'} />
                      ))}
                      <StatusBadge status={item.status} />
                    </div>
                    {item.content ? <p className="mt-3 text-sm text-gray-600">{item.content}</p> : null}
                    <ImageStrip imageUrls={item.imageUrls} />
                  </div>
                  {item.productId ? (
                    <Link to={`/client/products/${item.productId}#reviews`} className="shrink-0 rounded-full border border-[#006241]/20 p-2 text-[#006241] hover:bg-[#006241]/10">
                      <ExternalLink size={16} />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((item) => (
              <article key={item.commentId ?? item.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400">{formatDate(item.createdAt)}</p>
                    <h2 className="mt-1 line-clamp-2 text-lg font-black text-[#1E3932]">{item.articleTitle ?? 'Bài viết'}</h2>
                    {item.content ? <p className="mt-3 text-sm text-gray-600">{item.content}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.imageUrls?.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f0eb] px-3 py-1 text-xs font-bold text-gray-500">
                          <ImageIcon size={13} /> {item.imageUrls.length} ảnh
                        </span>
                      ) : null}
                    </div>
                    <ImageStrip imageUrls={item.imageUrls} />
                  </div>
                  {item.articleSlug ? (
                    <Link to={`/client/news/${item.articleSlug}`} className="shrink-0 rounded-full border border-[#006241]/20 p-2 text-[#006241] hover:bg-[#006241]/10">
                      <ExternalLink size={16} />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-gray-500">Tổng {meta.total} mục</span>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setReviewPage(1);
                setCommentPage(1);
              }}
              className="rounded-lg border border-black/10 px-2 py-1.5"
            >
              {[10, 20, 50].map((value) => <option key={value} value={value}>{value}/trang</option>)}
            </select>
            <button disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-black/10 p-2 disabled:opacity-40">
              <ChevronLeft size={15} />
            </button>
            <span className="font-bold">Trang {meta.page}/{Math.max(1, meta.totalPages)}</span>
            <button disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-black/10 p-2 disabled:opacity-40">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
