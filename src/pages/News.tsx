import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  LoaderCircle,
  Newspaper,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';
import RichTextEditor from '../components/shared/RichTextEditor';

type NewsArticle = {
  newsId: string;
  title: string;
  subTitle: string | null;
  slug: string;
  titleImageUrl: string | null;
  content: string | null;
  isDraft: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
};

type NewsResponse = {
  items: NewsArticle[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type StatusFilter = 'all' | 'published' | 'draft';

type FormState = {
  title: string;
  subTitle: string;
  slug: string;
  titleImageUrl: string;
  content: string;
};

const defaultForm: FormState = {
  title: '',
  subTitle: '',
  slug: '',
  titleImageUrl: '',
  content: '',
};

type SavedArticle = { newsId: string } & Record<string, unknown>;

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function News() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NewsArticle | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<NewsArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [isVietnamese],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const data = await apiClient.get<NewsResponse>(`/news?${params.toString()}`);
      setArticles(data.items);
      setMeta(data.meta);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Không tải được danh sách bài viết' : 'Failed to load articles',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, isVietnamese, showToast]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setCoverFile(null);
    setCoverPreview(null);
    setFormOpen(true);
  }

  function openEdit(article: NewsArticle) {
    setEditTarget(article);
    setForm({
      title: article.title,
      subTitle: article.subTitle ?? '',
      slug: article.slug,
      titleImageUrl: article.titleImageUrl ?? '',
      content: article.content ?? '',
    });
    setCoverFile(null);
    setCoverPreview(article.titleImageUrl ?? null);
    setFormOpen(true);
  }

  function handleCoverFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const preview = URL.createObjectURL(file);
    setCoverPreview(preview);
  }

  function clearCover() {
    setCoverFile(null);
    setCoverPreview(null);
    setForm((f) => ({ ...f, titleImageUrl: '' }));
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'title' && !editTarget) {
        next.slug = normalizeSlug(value as string);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.title.trim()) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Tiêu đề không được để trống' : 'Title is required',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subTitle: form.subTitle.trim() || undefined,
        slug: form.slug.trim() || undefined,
        titleImageUrl: form.titleImageUrl.trim() || undefined,
        content: form.content || undefined,
      };

      let savedId: string;

      if (editTarget) {
        await apiClient.patch(`/news/${editTarget.newsId}`, payload);
        savedId = editTarget.newsId;
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật bài viết' : 'Article updated' });
      } else {
        const created = await apiClient.post<SavedArticle>('/news', payload);
        savedId = created.newsId;
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo bài viết nháp' : 'Draft created' });
      }

      // Upload cover image if a new file was selected
      if (coverFile && savedId) {
        setUploadingCover(true);
        try {
          const fd = new FormData();
          fd.append('file', coverFile);
          await apiClient.postForm(`/news/${savedId}/cover-image`, fd);
        } catch {
          showToast({ tone: 'error', title: isVietnamese ? 'Ảnh bìa tải lên thất bại' : 'Cover image upload failed' });
        } finally {
          setUploadingCover(false);
        }
      }

      setFormOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lưu thất bại' : 'Save failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(article: NewsArticle) {
    setTogglingId(article.newsId);
    try {
      if (article.isPublished) {
        await apiClient.patch(`/news/${article.newsId}/unpublish`, {});
        showToast({ tone: 'success', title: isVietnamese ? 'Đã gỡ xuất bản' : 'Unpublished' });
      } else {
        await apiClient.patch(`/news/${article.newsId}/publish`, {});
        showToast({ tone: 'success', title: isVietnamese ? 'Đã xuất bản bài viết' : 'Published' });
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thao tác thất bại' : 'Action failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/news/${deleteTarget.newsId}`);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã xóa bài viết' : 'Article deleted',
        description: deleteTarget.title,
      });
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Xóa thất bại' : 'Delete failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setDeleting(false);
    }
  }

  const stats = useMemo(() => {
    const total = meta.total;
    const published = articles.filter((a) => a.isPublished).length;
    const drafts = articles.filter((a) => a.isDraft && !a.isPublished).length;
    return { total, published, drafts };
  }, [articles, meta.total]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: isVietnamese ? 'Tất cả' : 'All' },
    { key: 'published', label: isVietnamese ? 'Đã xuất bản' : 'Published' },
    { key: 'draft', label: isVietnamese ? 'Nháp' : 'Draft' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVietnamese ? 'Quản lý bài viết' : 'Article Management'}
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {isVietnamese
              ? 'Viết, chỉnh sửa và xuất bản bài viết / tin tức cho hệ thống.'
              : 'Write, edit and publish articles and news for the system.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5"
        >
          <Plus size={18} />
          {isVietnamese ? 'Viết bài mới' : 'Write article'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Newspaper} label={isVietnamese ? 'Tổng bài viết' : 'Total articles'} value={String(meta.total)} />
        <StatCard icon={Eye} label={isVietnamese ? 'Đã xuất bản' : 'Published'} value={String(articles.filter((a) => a.isPublished).length)} color="emerald" />
        <StatCard icon={FileText} label={isVietnamese ? 'Nháp' : 'Drafts'} value={String(articles.filter((a) => a.isDraft && !a.isPublished).length)} color="amber" />
      </div>

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3">
            <Search size={16} className="shrink-0 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isVietnamese ? 'Tìm kiếm tiêu đề, slug...' : 'Search by title, slug...'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant/40"
            />
          </div>

          <div className="flex rounded-2xl border border-on-surface/10 bg-surface p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  statusFilter === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-on-surface-variant">
            <LoaderCircle size={18} className="animate-spin" />
            <span>{isVietnamese ? 'Đang tải...' : 'Loading...'}</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Newspaper size={28} />
            </div>
            <p className="font-bold text-on-surface">
              {isVietnamese ? 'Chưa có bài viết nào' : 'No articles yet'}
            </p>
            <p className="text-sm text-on-surface-variant">
              {isVietnamese ? 'Bắt đầu viết bài đầu tiên của bạn.' : 'Start writing your first article.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <div
                key={article.newsId}
                className="group flex flex-col overflow-hidden rounded-2xl border border-on-surface-variant/8 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-[#f7f5ef]">
                  {article.titleImageUrl ? (
                    <img
                      src={article.titleImageUrl}
                      alt={article.title}
                      className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-on-surface-variant/40">
                      <Newspaper size={42} />
                    </div>
                  )}
                  <span
                    className={`absolute right-3 top-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur ${
                      article.isPublished
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-amber-500/90 text-white'
                    }`}
                  >
                    {article.isPublished
                      ? isVietnamese ? 'Đã xuất bản' : 'Published'
                      : isVietnamese ? 'Bản nháp' : 'Draft'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h3 className="line-clamp-2 text-base font-black text-on-surface">
                    {article.title}
                  </h3>
                  {article.subTitle && (
                    <p className="line-clamp-2 text-xs text-on-surface-variant">
                      {article.subTitle}
                    </p>
                  )}
                  <p className="text-[11px] font-mono text-on-surface-variant/40">
                    /{article.slug}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-on-surface-variant/8 pt-3">
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} />
                        {article.views.toLocaleString()}
                      </span>
                      <span>
                        {article.publishedAt
                          ? dateFormatter.format(new Date(article.publishedAt))
                          : isVietnamese ? 'Chưa đăng' : 'Unpublished'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleTogglePublish(article)}
                        disabled={togglingId === article.newsId}
                        title={article.isPublished
                          ? (isVietnamese ? 'Gỡ xuất bản' : 'Unpublish')
                          : (isVietnamese ? 'Xuất bản' : 'Publish')}
                        className={`rounded-lg p-1.5 transition ${
                          article.isPublished
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        } disabled:opacity-40`}
                      >
                        {togglingId === article.newsId
                          ? <LoaderCircle size={14} className="animate-spin" />
                          : article.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(article)}
                        className="rounded-lg bg-primary/8 p-1.5 text-primary transition hover:bg-primary/15"
                        title={isVietnamese ? 'Chỉnh sửa' : 'Edit'}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(article)}
                        className="rounded-lg bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100"
                        title={isVietnamese ? 'Xóa' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`h-9 w-9 rounded-xl text-sm font-bold transition ${
                  page === p
                    ? 'bg-primary text-white'
                    : 'bg-surface text-on-surface-variant hover:bg-primary/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="xl"
        title={editTarget
          ? isVietnamese ? 'Chỉnh sửa bài viết' : 'Edit article'
          : isVietnamese ? 'Viết bài mới' : 'New article'}
        description={
          isVietnamese
            ? 'Điền thông tin bài viết. Bài mới sẽ được lưu dưới dạng nháp, bạn có thể xuất bản sau.'
            : 'Fill in article details. New articles are saved as drafts; publish when ready.'
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
            >
              {isVietnamese ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
              {editTarget
                ? isVietnamese ? 'Lưu thay đổi' : 'Save changes'
                : isVietnamese ? 'Tạo nháp' : 'Create draft'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FieldLabel label={isVietnamese ? 'Tiêu đề *' : 'Title *'}>
              <input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/30"
                placeholder={isVietnamese ? 'Tiêu đề bài viết...' : 'Article title...'}
                autoFocus
              />
            </FieldLabel>

            <FieldLabel label={isVietnamese ? 'Tiêu đề phụ' : 'Subtitle'}>
              <input
                value={form.subTitle}
                onChange={(e) => setField('subTitle', e.target.value)}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/30"
                placeholder={isVietnamese ? 'Mô tả ngắn...' : 'Short description...'}
              />
            </FieldLabel>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldLabel label="Slug">
              <input
                value={form.slug}
                onChange={(e) => setField('slug', e.target.value)}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/30"
                placeholder="tieu-de-bai-viet"
              />
            </FieldLabel>

            <FieldLabel label={isVietnamese ? 'Ảnh bìa' : 'Cover image'}>
              <div className="space-y-2">
                {coverPreview ? (
                  <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#f7f5ef]">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="h-full w-full object-contain p-2"
                    />
                    <button
                      type="button"
                      onClick={clearCover}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-on-surface/15 bg-surface/50 text-on-surface-variant transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <ImagePlus size={22} className="text-on-surface-variant/50" />
                    <span className="text-xs font-medium">
                      {isVietnamese ? 'Chọn ảnh bìa' : 'Choose cover image'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/40">JPG, PNG, WebP</span>
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverFileChange}
                />
                {coverPreview && !coverFile && (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {isVietnamese ? 'Đổi ảnh khác' : 'Change image'}
                  </button>
                )}
                {uploadingCover && (
                  <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <LoaderCircle size={12} className="animate-spin" />
                    {isVietnamese ? 'Đang tải ảnh lên...' : 'Uploading image...'}
                  </p>
                )}
              </div>
            </FieldLabel>
          </div>

          <RichTextEditor
            label={isVietnamese ? 'Nội dung bài viết' : 'Article content'}
            value={form.content}
            onChange={(v) => setField('content', v)}
            isVietnamese={isVietnamese}
          />
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="md"
        title={isVietnamese ? 'Xác nhận xóa bài viết' : 'Confirm delete'}
        description={
          deleteTarget
            ? isVietnamese
              ? `Bài viết "${deleteTarget.title}" sẽ bị xóa vĩnh viễn.`
              : `Article "${deleteTarget.title}" will be permanently deleted.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
            >
              {isVietnamese ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xóa bài viết' : 'Delete article'}
            </button>
          </>
        }
      >
        <p className="text-sm text-on-surface-variant">
          {isVietnamese
            ? 'Thao tác này không thể hoàn tác. Bài viết đã xuất bản sẽ biến mất khỏi hệ thống.'
            : 'This action cannot be undone. Published articles will disappear from the system.'}
        </p>
      </Modal>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'primary',
}: {
  icon: typeof Newspaper;
  label: string;
  value: string;
  color?: 'primary' | 'emerald' | 'amber';
}) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {label}
      </p>
      <h3 className="mt-3 text-4xl font-black tracking-tight text-primary">{value}</h3>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {label}
      </span>
      {children}
    </label>
  );
}
