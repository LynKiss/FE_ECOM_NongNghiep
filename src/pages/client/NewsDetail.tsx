import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Share2,
  ArrowRight,
  Copy,
  Check,
  Facebook,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Send,
  LoaderCircle,
  ImagePlus,
  X,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import CollapsibleHtml from '../../components/shared/CollapsibleHtml';

type NewsDetail = {
  _id: string;
  title: string;
  subTitle?: string;
  slug: string;
  titleImageUrl?: string;
  content?: string;
  isPublished: boolean;
  createdAt: string;
  views: number;
  likeCount: number;
  author?: { username: string };
};

type RelatedNews = {
  _id: string;
  title: string;
  slug: string;
  titleImageUrl?: string;
  createdAt: string;
};

type NewsComment = {
  id: string;
  userId: string | null;
  parentId: string | null;
  content: string;
  imageUrls: string[];
  likeCount: number;
  dislikeCount: number;
  isDeleted: boolean;
  createdAt: string;
  author: { username: string } | null;
  replies: NewsComment[];
};

const LIKED_NEWS_KEY = 'liked_news';
const COMMENT_VOTES_PREFIX = 'news_comment_votes_';

function getLikedNews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LIKED_NEWS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function setLikedNews(ids: string[]) {
  localStorage.setItem(LIKED_NEWS_KEY, JSON.stringify(ids));
}
function loadVotes(newsId: string): Record<string, 'like' | 'dislike' | null> {
  try {
    const raw = localStorage.getItem(COMMENT_VOTES_PREFIX + newsId);
    return raw ? (JSON.parse(raw) as Record<string, 'like' | 'dislike' | null>) : {};
  } catch {
    return {};
  }
}
function saveVotes(newsId: string, votes: Record<string, 'like' | 'dislike' | null>) {
  localStorage.setItem(COMMENT_VOTES_PREFIX + newsId, JSON.stringify(votes));
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number;
  onClose: () => void;
}) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCur((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCur((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <X size={28} />
      </button>
      {images.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={cur === 0}
            onClick={(e) => { e.stopPropagation(); setCur((i) => i - 1); }}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={cur === images.length - 1}
            onClick={(e) => { e.stopPropagation(); setCur((i) => i + 1); }}
          >
            <ArrowRight size={20} />
          </button>
        </>
      )}
      <img
        src={images[cur]}
        alt=""
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 text-sm text-white/60">
          {cur + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

// ─── CommentImages ─────────────────────────────────────────────────────────
function CommentImages({ urls }: { urls: string[] }) {
  const [lb, setLb] = useState<number | null>(null);
  if (urls.length === 0) return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setLb(i)}
            className="h-16 w-16 overflow-hidden rounded-lg border border-black/10 transition hover:scale-105"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {lb !== null && <Lightbox images={urls} index={lb} onClose={() => setLb(null)} />}
    </>
  );
}

// ─── CommentForm ─────────────────────────────────────────────────────────────
function CommentForm({
  newsId,
  parentId,
  username,
  placeholder,
  onSubmitted,
  onCancel,
}: {
  newsId: string;
  parentId?: string;
  username: string;
  placeholder: string;
  onSubmitted: (comment: NewsComment) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      alert('Tối đa 5 ảnh mỗi bình luận');
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file as unknown as Blob);
        const res = await clientApi.postForm<{ url: string }>('/news/public/comments/upload-image', fd);
        setImages((prev) => [...prev, res.url]);
      }
    } catch {
      alert('Upload ảnh thất bại, vui lòng thử lại');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const result = await clientApi.post<NewsComment>(`/news/public/${newsId}/comments`, {
        content: text.trim(),
        imageUrls: images,
        ...(parentId ? { parentId } : {}),
      });
      onSubmitted(result);
      setText('');
      setImages([]);
    } catch {
      alert('Gửi bình luận thất bại');
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }}>
      <div className="flex gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ background: '#1E3932' }}
        >
          {username[0]?.toUpperCase() ?? 'U'}
        </div>
        <div className="flex-1 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={parentId ? 2 : 3}
            className="client-input w-full resize-none px-4 py-3 text-sm"
          />

          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {images.map((url, i) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="h-14 w-14 rounded-lg border border-black/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading || images.length >= 5}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:border-[#006241] hover:text-[#006241] disabled:opacity-40"
            >
              {uploading ? <LoaderCircle size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              Thêm ảnh {images.length > 0 ? `(${images.length}/5)` : ''}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { void handleImagePick(e); }}
            />
            <div className="flex-1" />
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:bg-black/5"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="client-pill-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              {submitting ? <LoaderCircle size={12} className="animate-spin" /> : <Send size={12} />}
              Gửi
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─── CommentItem ──────────────────────────────────────────────────────────────
function CommentItem({
  comment,
  newsId,
  sessionUsername,
  currentUserId,
  votes,
  counts,
  onVote,
  onReplySubmitted,
  onDeleteComment,
  depth,
}: {
  comment: NewsComment;
  newsId: string;
  sessionUsername?: string;
  currentUserId?: string;
  votes: Record<string, 'like' | 'dislike' | null>;
  counts: Record<string, { likeCount: number; dislikeCount: number }>;
  onVote: (id: string, type: 'like' | 'dislike') => Promise<void>;
  onReplySubmitted: (parentId: string, reply: NewsComment) => void;
  onDeleteComment: (commentId: string) => Promise<void>;
  depth: number;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const curCounts = counts[comment.id] ?? {
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
  };
  const vote = votes[comment.id] ?? null;
  const isOwn = !comment.isDeleted && !!currentUserId && comment.userId === currentUserId;

  const handleDelete = async () => {
    setDeleting(true);
    await onDeleteComment(comment.id);
    setDeleting(false);
    setConfirmDelete(false);
  };

  // ── Stub rendering for deleted comments ──────────────────────────────────
  if (comment.isDeleted) {
    return (
      <div className={depth > 0 ? 'ml-10 mt-3 border-l-2 border-black/5 pl-4' : ''}>
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
            ✕
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm italic text-gray-400">[Bình luận đã bị xóa]</p>
            {comment.replies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#006241]"
              >
                {showReplies ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {comment.replies.length} phản hồi
              </button>
            )}
          </div>
        </div>
        {showReplies && comment.replies.length > 0 && (
          <div className="mt-1 space-y-1">
            {comment.replies.map((reply) => (
              <Fragment key={reply.id}>
                <CommentItem
                  comment={reply}
                  newsId={newsId}
                  sessionUsername={sessionUsername}
                  currentUserId={currentUserId}
                  votes={votes}
                  counts={counts}
                  onVote={onVote}
                  onReplySubmitted={onReplySubmitted}
                  onDeleteComment={onDeleteComment}
                  depth={depth + 1}
                />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Normal rendering ──────────────────────────────────────────────────────
  return (
    <div className={depth > 0 ? 'ml-10 mt-3 border-l-2 border-[#006241]/15 pl-4' : ''}>
      <div className="flex gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ background: depth === 0 ? '#1E3932' : '#006241' }}
        >
          {comment.author?.username[0]?.toUpperCase() ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold text-[#1E3932]">{comment.author?.username}</p>
              <p className="text-[11px] text-gray-400">
                {new Date(comment.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            {isOwn && !confirmDelete && (
              <button
                type="button"
                title="Xóa bình luận của bạn"
                onClick={() => setConfirmDelete(true)}
                className="rounded-full p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Inline delete confirm */}
          {confirmDelete && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle size={13} className="shrink-0 text-red-400" />
              <p className="flex-1 text-[11px] text-red-600">
                {comment.replies.length > 0
                  ? 'Bình luận sẽ được ẩn nội dung nhưng giữ lại thread phản hồi.'
                  : 'Xóa bình luận này? Thao tác không thể hoàn tác.'}
              </p>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] text-gray-500 hover:bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { void handleDelete(); }}
                className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting
                  ? <LoaderCircle size={10} className="animate-spin" />
                  : <Trash2 size={10} />}
                Xóa
              </button>
            </div>
          )}

          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {comment.content}
          </p>
          <CommentImages urls={comment.imageUrls} />

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { void onVote(comment.id, 'like'); }}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                vote === 'like'
                  ? 'border-[#006241] bg-[#006241]/10 text-[#006241]'
                  : 'border-black/10 text-gray-400 hover:text-[#006241]'
              }`}
            >
              <ThumbsUp size={11} />
              {curCounts.likeCount > 0 ? curCounts.likeCount : ''}
            </button>
            <button
              type="button"
              onClick={() => { void onVote(comment.id, 'dislike'); }}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                vote === 'dislike'
                  ? 'border-red-400 bg-red-50 text-red-500'
                  : 'border-black/10 text-gray-400 hover:text-red-400'
              }`}
            >
              <ThumbsDown size={11} />
              {curCounts.dislikeCount > 0 ? curCounts.dislikeCount : ''}
            </button>
            {sessionUsername && depth === 0 && (
              <button
                type="button"
                onClick={() => setShowReplyForm((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-gray-400 transition hover:border-[#006241] hover:text-[#006241]"
              >
                <CornerDownRight size={11} />
                Trả lời
              </button>
            )}
            {comment.replies.length > 0 && depth === 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#006241]"
              >
                {showReplies ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {comment.replies.length} phản hồi
              </button>
            )}
          </div>

          {showReplyForm && sessionUsername && (
            <div className="mt-3">
              <CommentForm
                newsId={newsId}
                parentId={comment.id}
                username={sessionUsername}
                placeholder={`Trả lời ${comment.author?.username ?? ''}...`}
                onSubmitted={(reply) => {
                  onReplySubmitted(comment.id, reply);
                  setShowReplyForm(false);
                }}
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {showReplies && comment.replies.length > 0 && (
        <div className="mt-1 space-y-1">
          {comment.replies.map((reply) => (
            <Fragment key={reply.id}>
              <CommentItem
                comment={reply}
                newsId={newsId}
                sessionUsername={sessionUsername}
                currentUserId={currentUserId}
                votes={votes}
                counts={counts}
                onVote={onVote}
                onReplySubmitted={onReplySubmitted}
                onDeleteComment={onDeleteComment}
                depth={depth + 1}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewsDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session } = useClientSession();

  const [article, setArticle] = useState<NewsDetail | null>(null);
  const [related, setRelated] = useState<RelatedNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewTracked = useRef(false);

  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentVotes, setCommentVotes] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, { likeCount: number; dislikeCount: number }>>({});

  // Load article
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    viewTracked.current = false;

    void clientApi
      .get<NewsDetail>(`/news/public/by-slug/${slug}`)
      .then(async (item) => {
        setArticle(item);
        setLikeCount(item.likeCount ?? 0);
        setLiked(getLikedNews().includes(item._id));
        setCommentVotes(loadVotes(item._id));

        const rel = await clientApi
          .get<{ items?: RelatedNews[] } | RelatedNews[]>('/news/public/list?limit=4')
          .catch(() => [] as RelatedNews[]);
        const relItems = Array.isArray(rel) ? rel : ((rel as { items?: RelatedNews[] }).items ?? []);
        setRelated(relItems.filter((r) => r._id !== item._id).slice(0, 3));
      })
      .catch(() => { void navigate('/client/news'); })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  // Track view once
  useEffect(() => {
    if (!article?._id || viewTracked.current) return;
    viewTracked.current = true;
    void clientApi
      .patch<{ views: number }>(`/news/public/${article._id}/view`)
      .then((res) => setArticle((prev) => (prev ? { ...prev, views: res.views } : prev)))
      .catch(() => {});
  }, [article?._id]);

  // Load comments
  useEffect(() => {
    if (!article?._id) return;
    setCommentsLoading(true);
    void clientApi
      .get<NewsComment[]>(`/news/public/${article._id}/comments`)
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [article?._id]);

  const handleLike = async () => {
    if (!article) return;
    try {
      if (!liked) {
        const res = await clientApi.post<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(true);
        setLikedNews([...getLikedNews(), article._id]);
      } else {
        const res = await clientApi.delete<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(false);
        setLikedNews(getLikedNews().filter((id) => id !== article._id));
      }
    } catch {}
  };

  const handleCommentVote = async (commentId: string, voteType: 'like' | 'dislike') => {
    if (!article) return;
    const current = commentVotes[commentId] ?? null;
    let newVotes = { ...commentVotes };

    if (current === voteType) {
      try {
        const res = await clientApi.delete<{ likeCount: number; dislikeCount: number }>(
          `/news/public/comments/${commentId}/${voteType}`,
        );
        newVotes = { ...newVotes, [commentId]: null };
        setCommentCounts((c) => ({ ...c, [commentId]: res }));
      } catch { return; }
    } else {
      if (current) {
        await clientApi.delete(`/news/public/comments/${commentId}/${current}`).catch(() => {});
      }
      try {
        const res = await clientApi.post<{ likeCount: number; dislikeCount: number }>(
          `/news/public/comments/${commentId}/${voteType}`,
        );
        newVotes = { ...newVotes, [commentId]: voteType };
        setCommentCounts((c) => ({ ...c, [commentId]: res }));
      } catch { return; }
    }

    setCommentVotes(newVotes);
    saveVotes(article._id, newVotes);
  };

  const handleTopLevelSubmitted = (comment: NewsComment) => {
    setComments((prev) => [comment, ...prev]);
  };

  const handleReplySubmitted = (parentId: string, reply: NewsComment) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c,
      ),
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await clientApi.delete<{ id: string; deleted: boolean; hasStub: boolean }>(
        `/news/public/comments/${commentId}`,
      );
      if (res.hasStub) {
        // Mark as deleted stub — keep row, clear content/images
        const markDeleted = (list: NewsComment[]): NewsComment[] =>
          list.map((c) => {
            if (c.id === commentId) {
              return { ...c, isDeleted: true, content: '[Bình luận đã bị xóa]', imageUrls: [], userId: null, author: null };
            }
            return { ...c, replies: markDeleted(c.replies) };
          });
        setComments((prev) => markDeleted(prev));
      } else {
        // Remove entirely
        const removeComment = (list: NewsComment[]): NewsComment[] =>
          list
            .filter((c) => c.id !== commentId)
            .map((c) => ({ ...c, replies: removeComment(c.replies) }));
        setComments((prev) => removeComment(prev));
      }
    } catch {
      // error handled inside CommentItem
    }
  };

  const totalCommentCount =
    comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  if (!article) return null;

  const authorName = article.author?.username ?? 'Ban biên tập';

  return (
    <div className="client-surface min-h-[80vh]">
      {article.titleImageUrl && (
        <div className="relative h-72 overflow-hidden md:h-[420px]" style={{ background: '#1E3932' }}>
          <img
            src={article.titleImageUrl}
            alt={article.title}
            className="h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Link
          to="/client/news"
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#006241] hover:underline"
        >
          <ArrowLeft size={15} /> Quay lại tin tức
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main article */}
          <div className="space-y-6">
            <article className="client-card p-8 md:p-10">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} />
                  {new Date(article.createdAt).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span>·</span>
                <span>{authorName}</span>
              </div>

              <h1 className="text-3xl font-black leading-tight text-[#1E3932] md:text-4xl">
                {article.title}
              </h1>
              {article.subTitle && (
                <p className="mt-4 text-base leading-relaxed text-gray-500">{article.subTitle}</p>
              )}

              <div className="mt-5 flex items-center gap-5 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">👁 {article.views ?? 0} lượt đọc</span>
                <span className="flex items-center gap-1.5">❤️ {likeCount} lượt thích</span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle size={14} /> {totalCommentCount} bình luận
                </span>
              </div>

              <div className="my-7 h-px bg-black/5" />

              {article.content ? (
                <CollapsibleHtml
                  html={article.content}
                  contentClassName="prose prose-green max-w-none text-sm leading-relaxed text-gray-700 md:text-base"
                />
              ) : (
                <p className="italic text-gray-400">Nội dung đang được cập nhật...</p>
              )}

              {/* Action bar */}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/5 pt-6">
                <button
                  onClick={() => { void handleLike(); }}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    liked
                      ? 'border-red-400 bg-red-50 text-red-500'
                      : 'border-black/10 text-gray-500 hover:border-red-300 hover:text-red-400'
                  }`}
                >
                  <span className="text-base leading-none">{liked ? '❤️' : '🤍'}</span>
                  <span>{liked ? `Đã thích (${likeCount})` : 'Thích'}</span>
                </button>

                <button
                  onClick={() =>
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
                      '_blank',
                    )
                  }
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
                >
                  <Facebook size={14} /> Facebook
                </button>

                <button
                  onClick={() =>
                    window.open(
                      `https://zalo.me/share/url?url=${encodeURIComponent(window.location.href)}`,
                      '_blank',
                    )
                  }
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-300 hover:text-blue-500"
                >
                  <Share2 size={14} /> Zalo
                </button>

                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-[#006241] hover:text-[#006241]"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép!' : 'Sao chép link'}
                </button>
              </div>
            </article>

            {/* Comments section */}
            <section className="client-card p-8 md:p-10">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <MessageCircle size={20} /> Bình luận ({totalCommentCount})
              </h2>

              {/* Top-level comment form */}
              {session ? (
                <div className="mb-7">
                  <CommentForm
                    newsId={article._id}
                    username={session.user.username ?? 'U'}
                    placeholder="Viết bình luận của bạn..."
                    onSubmitted={handleTopLevelSubmitted}
                  />
                </div>
              ) : (
                <div className="mb-6 rounded-2xl border border-[#006241]/15 bg-[#006241]/5 px-5 py-4 text-sm text-[#006241]">
                  <Link to="/client/login" className="font-bold hover:underline">
                    Đăng nhập
                  </Link>{' '}
                  để bình luận.
                </div>
              )}

              {/* Comment list */}
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <LoaderCircle size={20} className="animate-spin text-[#006241]/40" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  Chưa có bình luận nào. Hãy là người đầu tiên!
                </p>
              ) : (
                <div className="space-y-5">
                  {comments.map((c) => (
                    <Fragment key={c.id}>
                    <CommentItem
                      comment={c}
                      newsId={article._id}
                      sessionUsername={session?.user.username}
                      currentUserId={session?.user._id}
                      votes={commentVotes}
                      counts={commentCounts}
                      onVote={handleCommentVote}
                      onReplySubmitted={handleReplySubmitted}
                      onDeleteComment={handleDeleteComment}
                      depth={0}
                    />
                    </Fragment>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {related.length > 0 && (
              <div className="client-card p-5">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                  Bài viết liên quan
                </h3>
                <div className="space-y-4">
                  {related.map((r) => (
                    <Link
                      key={r._id}
                      to={`/client/news/${r.slug}`}
                      className="group flex items-start gap-3"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#d4e9e2]">
                        {r.titleImageUrl ? (
                          <img
                            src={r.titleImageUrl}
                            alt={r.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xl">🌿</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1E3932] group-hover:text-[#006241]">
                          {r.title}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/client/news"
                  className="mt-4 flex items-center gap-1 text-xs font-bold text-[#006241] hover:underline"
                >
                  Xem tất cả tin tức <ArrowRight size={12} />
                </Link>
              </div>
            )}

            <div className="client-feature-band p-5 text-center">
              <span className="text-3xl">📬</span>
              <h3 className="mt-3 font-black text-white">Nhận tin mới nhất</h3>
              <p className="mt-1 text-xs text-white/60">Cập nhật kiến thức nông nghiệp mỗi tuần.</p>
              <input
                type="email"
                placeholder="Email của bạn..."
                className="mt-3 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:bg-white/20"
              />
              <button className="client-pill-primary mt-2 w-full py-2.5 text-sm font-bold">
                Đăng ký
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
