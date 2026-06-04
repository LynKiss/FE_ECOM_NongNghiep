import { type Key, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpToLine,
  Boxes,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Edit2,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  Shapes,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';
import RichTextEditor from '../components/shared/RichTextEditor';

type CategoryNode = {
  categoryId: string;
  categoryName: string;
  categoryDescription: string | null;
  categorySlug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  directProductCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
  children: CategoryNode[];
};

type FlatCategoryNode = CategoryNode & { level: number };

type CategoryFormState = {
  categoryName: string;
  categorySlug: string;
  categoryDescription: string;
  parentId: string;
  isActive: boolean;
};

type CategoryFormErrors = Partial<Record<keyof CategoryFormState, string>>;

type DragState = {
  categoryId: string;
  parentId: string | null;
};

const defaultFormState: CategoryFormState = {
  categoryName: '',
  categorySlug: '',
  categoryDescription: '',
  parentId: '',
  isActive: true,
};

function getCategoryDescriptionPreview(value: string | null | undefined) {
  if (!value) return '';

  if (typeof window === 'undefined') {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export default function Categories() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

  const [formState, setFormState] = useState<CategoryFormState>(defaultFormState);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  const hoverExpandTimerRef = useRef<number | null>(null);
  const readySyncExpandedRef = useRef(false);
  const initialExpandedRef = useRef<string[] | null>(
    searchParams.has('expanded')
      ? searchParams
          .get('expanded')
          ?.split(',')
          .map((value) => value.trim())
          .filter(Boolean) ?? []
      : null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<CategoryNode[]>('/categories/admin/tree');
        if (cancelled) {
          return;
        }

        const nextExpanded = collectExpandableIds(response);
        const initialExpanded = initialExpandedRef.current;

        setCategories(response);
        setExpandedIds(
          initialExpanded === null
            ? nextExpanded
            : nextExpanded.filter((id) => initialExpanded.includes(id)),
        );
        readySyncExpandedRef.current = true;
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
                ? 'Không thể tải cây danh mục.'
                : 'Unable to load the category tree.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
      clearHoverExpandTimer();
    };
  }, [reloadKey, isVietnamese]);

  useEffect(() => {
    if (!readySyncExpandedRef.current) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (expandedIds.length > 0) {
      nextParams.set('expanded', expandedIds.join(','));
    } else {
      nextParams.delete('expanded');
    }

    setSearchParams(nextParams, { replace: true });
  }, [expandedIds, searchParams, setSearchParams]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const categoryMap = useMemo(
    () => new Map(flatCategories.map((category) => [category.categoryId, category])),
    [flatCategories],
  );
  const siblingIdsMap = useMemo(() => buildSiblingMap(categories), [categories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    return filterTree(categories, searchQuery);
  }, [categories, searchQuery]);

  const displayExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return expandedIds;
    return collectExpandableIds(filteredCategories);
  }, [searchQuery, filteredCategories, expandedIds]);

  const stats = useMemo(() => {
    const total = flatCategories.length;
    const rootCount = flatCategories.filter((item) => !item.parentId).length;
    const childCount = total - rootCount;
    const activeCount = flatCategories.filter((item) => item.isActive).length;
    const productCount = flatCategories.reduce((sum, item) => sum + item.directProductCount, 0);

    return { total, rootCount, childCount, activeCount, productCount };
  }, [flatCategories]);

  const parentOptions = useMemo(() => {
    if (!editingId) {
      return flatCategories;
    }

    const blockedIds = getDescendantIds(editingId, categoryMap);
    blockedIds.add(editingId);

    return flatCategories.filter((category) => !blockedIds.has(category.categoryId));
  }, [categoryMap, editingId, flatCategories]);

  function clearHoverExpandTimer() {
    if (hoverExpandTimerRef.current !== null) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
  }

  function setField<K extends keyof CategoryFormState>(field: K, value: CategoryFormState[K]) {
    setFormState((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openCreateModal() {
    setEditingId(null);
    setFormState(defaultFormState);
    setFormErrors({});
    setPreviewOpen(false);
    setFormOpen(true);
  }

  function openEditModal(category: CategoryNode) {
    setEditingId(category.categoryId);
    setFormState({
      categoryName: category.categoryName,
      categorySlug: category.categorySlug,
      categoryDescription: category.categoryDescription ?? '',
      parentId: category.parentId ?? '',
      isActive: category.isActive,
    });
    setFormErrors({});
    setPreviewOpen(false);
    setFormOpen(true);
  }

  function closeFormModal() {
    setFormOpen(false);
    setPreviewOpen(false);
    setEditingId(null);
    setFormState(defaultFormState);
    setFormErrors({});
  }

  function toggleExpand(categoryId: string) {
    setExpandedIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function scheduleHoverExpand(categoryId: string) {
    clearHoverExpandTimer();
    hoverExpandTimerRef.current = window.setTimeout(() => {
      setExpandedIds((current) =>
        current.includes(categoryId) ? current : [...current, categoryId],
      );
      hoverExpandTimerRef.current = null;
    }, 450);
  }

  function validateForm() {
    const nextErrors: CategoryFormErrors = {};

    if (!formState.categoryName.trim()) {
      nextErrors.categoryName = isVietnamese
        ? 'Tên danh mục là bắt buộc.'
        : 'Category name is required.';
    }

    if (formState.categorySlug.trim().length > 180) {
      nextErrors.categorySlug = isVietnamese
        ? 'Slug tối đa 180 ký tự.'
        : 'Slug must be at most 180 characters.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function requestPreview() {
    if (!validateForm()) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Biểu mẫu chưa hợp lệ' : 'Invalid form',
        description: isVietnamese
          ? 'Hãy kiểm tra lại thông tin danh mục trước khi lưu.'
          : 'Please review the category form before saving.',
      });
      return;
    }

    setPreviewOpen(true);
  }

  async function saveCategory() {
    setSubmitting(true);
    setError(null);

    const payload = {
      categoryName: formState.categoryName.trim(),
      categorySlug: formState.categorySlug.trim() || undefined,
      categoryDescription: formState.categoryDescription.trim() || null,
      parentId: formState.parentId || null,
      isActive: formState.isActive,
    };

    try {
      if (editingId) {
        await apiClient.patch(`/categories/${editingId}`, payload);
      } else {
        await apiClient.post('/categories', payload);
      }

      showToast({
        tone: 'success',
        title: editingId
          ? isVietnamese
            ? 'Cập nhật danh mục thành công'
            : 'Category updated'
          : isVietnamese
            ? 'Tạo danh mục thành công'
            : 'Category created',
        description: payload.categoryName,
      });
      closeFormModal();
      setReloadKey((value) => value + 1);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : isVietnamese
            ? 'Không thể lưu danh mục.'
            : 'Unable to save category.';
      setError(message);
      showToast({
        tone: 'error',
        title: editingId
          ? isVietnamese
            ? 'Cập nhật danh mục thất bại'
            : 'Update failed'
          : isVietnamese
            ? 'Tạo danh mục thất bại'
            : 'Create failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await apiClient.delete(`/categories/${deleteTarget.categoryId}`);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã xóa danh mục' : 'Category deleted',
        description: deleteTarget.categoryName,
      });
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : isVietnamese
            ? 'Không thể xóa danh mục.'
            : 'Unable to delete category.';
      setError(message);
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Xóa danh mục thất bại' : 'Delete failed',
        description: message,
      });
    } finally {
      setDeleting(false);
    }
  }

  function resetDragState() {
    clearHoverExpandTimer();
    setDragState(null);
    setDropTarget(null);
    setReorderingId(null);
  }

  async function toggleCategoryActive(category: CategoryNode) {
    setTogglingActiveId(category.categoryId);
    try {
      await apiClient.patch(`/categories/${category.categoryId}`, {
        isActive: !category.isActive,
      });
      showToast({
        tone: 'success',
        title: category.isActive
          ? isVietnamese ? 'Đã ẩn danh mục' : 'Category hidden'
          : isVietnamese ? 'Đã hiển thị danh mục' : 'Category shown',
        description: category.categoryName,
      });
      setReloadKey((value) => value + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật thất bại' : 'Update failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setTogglingActiveId(null);
    }
  }

  async function moveCategory(
    nextParentId: string | null,
    targetIndex: number,
    title: string,
    description: string,
  ) {
    if (!dragState) {
      return;
    }

    setReorderingId(dragState.categoryId);
    setError(null);

    try {
      const nextTree = await apiClient.patch<CategoryNode[]>(
        `/categories/${dragState.categoryId}/reorder`,
        { parentId: nextParentId, targetIndex },
      );

      setCategories(nextTree);
      setExpandedIds((current) => {
        const nextSet = new Set([...current, ...collectExpandableIds(nextTree)]);
        if (nextParentId) {
          nextSet.add(nextParentId);
        }
        return [...nextSet];
      });
      showToast({ tone: 'success', title, description });
    } catch (moveError) {
      const message =
        moveError instanceof Error
          ? moveError.message
          : isVietnamese
            ? 'Không thể cập nhật vị trí danh mục.'
            : 'Unable to reorder categories.';
      setError(message);
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Kéo thả thất bại' : 'Move failed',
        description: message,
      });
    } finally {
      resetDragState();
    }
  }

  async function handleDropBefore(targetCategory: CategoryNode) {
    if (!dragState || dragState.categoryId === targetCategory.categoryId) {
      return;
    }

    const siblingIds = siblingIdsMap.get(targetCategory.parentId ?? '__root__') ?? [];
    const targetIndex = siblingIds.findIndex((id) => id === targetCategory.categoryId);
    if (targetIndex < 0) {
      return;
    }

    await moveCategory(
      targetCategory.parentId,
      targetIndex,
      isVietnamese ? 'Đã cập nhật thứ tự danh mục' : 'Category order updated',
      isVietnamese ? 'Thứ tự mới đã được lưu.' : 'The new order has been saved.',
    );
  }

  async function handleDropAsChild(targetCategory: CategoryNode) {
    if (!dragState || dragState.categoryId === targetCategory.categoryId) {
      return;
    }

    await moveCategory(
      targetCategory.categoryId,
      targetCategory.children.length,
      isVietnamese ? 'Đã chuyển danh mục' : 'Category moved',
      isVietnamese
        ? `Danh mục đã được chuyển vào "${targetCategory.categoryName}".`
        : `The category was moved into "${targetCategory.categoryName}".`,
    );
  }

  async function handleDropToRoot() {
    if (!dragState || dragState.parentId === null) {
      return;
    }

    await moveCategory(
      null,
      categories.length,
      isVietnamese ? 'Đã đưa danh mục lên cấp gốc' : 'Moved to root level',
      isVietnamese
        ? 'Danh mục hiện không còn danh mục cha.'
        : 'The category no longer has a parent.',
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-primary">
            {isVietnamese ? 'Quản lý danh mục' : 'Category Management'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            {isVietnamese
              ? 'Cây danh mục hỗ trợ kéo thả đổi thứ tự, chuyển danh mục sang nhánh khác, xem trước mô tả và lưu trạng thái mở nhánh trên URL.'
              : 'The category tree supports drag-and-drop ordering, moving categories across branches, description preview, and URL-synced expanded nodes.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5"
        >
          <Plus size={18} />
          {isVietnamese ? 'Thêm danh mục' : 'Add category'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <StatCard
          icon={FolderTree}
          title={isVietnamese ? 'Tổng danh mục' : 'Total categories'}
          value={String(stats.total)}
        />
        <StatCard
          icon={Layers3}
          title={isVietnamese ? 'Danh mục cha' : 'Root categories'}
          value={String(stats.rootCount)}
        />
        <StatCard
          icon={Shapes}
          title={isVietnamese ? 'Danh mục con' : 'Child categories'}
          value={String(stats.childCount)}
        />
        <StatCard
          icon={ChevronRight}
          title={isVietnamese ? 'Đang hiển thị' : 'Active'}
          value={String(stats.activeCount)}
        />
        <StatCard
          icon={Boxes}
          title={isVietnamese ? 'Sản phẩm trực tiếp' : 'Direct products'}
          value={String(stats.productCount)}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3">
          <Search size={16} className="shrink-0 text-on-surface-variant/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={isVietnamese ? 'Tìm kiếm danh mục theo tên hoặc slug...' : 'Search categories by name or slug...'}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant/40"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="shrink-0 text-xs font-semibold text-on-surface-variant/60 hover:text-primary"
            >
              {isVietnamese ? 'Xóa' : 'Clear'}
            </button>
          ) : null}
        </div>

        {dragState ? (
          <div
            className={`mb-6 rounded-xl border-2 border-dashed px-5 py-4 transition ${
              dropTarget === 'root'
                ? 'border-primary bg-primary/5'
                : 'border-on-surface-variant/15 bg-surface'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              clearHoverExpandTimer();
              setDropTarget('root');
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleDropToRoot();
            }}
          >
            <div className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <ArrowUpToLine size={18} className="text-primary" />
              <span>
                {isVietnamese
                  ? 'Thả vào đây để đưa danh mục lên cấp gốc'
                  : 'Drop here to move the category to the root level'}
              </span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm font-semibold text-on-surface-variant">
            <LoaderCircle size={18} className="animate-spin" />
            <span>{isVietnamese ? 'Đang tải cây danh mục...' : 'Loading category tree...'}</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <FolderTree size={28} />
            </div>
            <div>
              <p className="text-lg font-black text-primary">
                {isVietnamese ? 'Chưa có danh mục nào' : 'No categories yet'}
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                {isVietnamese
                  ? 'Hãy tạo danh mục đầu tiên để tổ chức sản phẩm.'
                  : 'Create your first category to organize products.'}
              </p>
            </div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-on-surface-variant">
            {isVietnamese ? `Không tìm thấy kết quả cho "${searchQuery}".` : `No results for "${searchQuery}".`}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-on-surface-variant/6">
            <div className="hidden grid-cols-[52px_minmax(0,1.8fr)_minmax(0,1fr)_150px_160px_112px] gap-4 bg-surface px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-on-surface-variant/55 md:grid">
              <div />
              <div>{isVietnamese ? 'Danh mục' : 'Category'}</div>
              <div>Slug</div>
              <div>{isVietnamese ? 'Số sản phẩm' : 'Products'}</div>
              <div>{isVietnamese ? 'Trạng thái' : 'Status'}</div>
              <div className="text-right">{isVietnamese ? 'Tác vụ' : 'Actions'}</div>
            </div>

            <div className="divide-y divide-on-surface-variant/6">
              {filteredCategories.map((category) => (
                <CategoryTreeRow
                  key={category.categoryId}
                  category={category}
                  level={0}
                  expandedIds={displayExpandedIds}
                  dragState={dragState}
                  dropTarget={dropTarget}
                  isVietnamese={isVietnamese}
                  reorderingId={reorderingId}
                  togglingActiveId={togglingActiveId}
                  onEdit={openEditModal}
                  onDelete={setDeleteTarget}
                  onToggleActive={(cat) => void toggleCategoryActive(cat)}
                  onToggleExpand={toggleExpand}
                  onDragStart={(nextDragState) => setDragState(nextDragState)}
                  onDragEnd={resetDragState}
                  onScheduleHoverExpand={scheduleHoverExpand}
                  onClearHoverExpand={clearHoverExpandTimer}
                  onDropTargetChange={setDropTarget}
                  onDropBefore={(targetCategory) => void handleDropBefore(targetCategory)}
                  onDropAsChild={(targetCategory) => void handleDropAsChild(targetCategory)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        size="xl"
        title={editingId ? (isVietnamese ? 'Cập nhật danh mục' : 'Update category') : isVietnamese ? 'Tạo danh mục mới' : 'Create category'}
        description={
          isVietnamese
            ? 'Bạn có thể đặt danh mục cha, chỉnh slug và xem trước nội dung mô tả trước khi lưu.'
            : 'Set a parent category, adjust the slug, and preview the description before saving.'
        }
        footer={
          previewOpen ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
              >
                {isVietnamese ? 'Quay lại chỉnh sửa' : 'Back to editing'}
              </button>
              <button
                type="button"
                onClick={() => void saveCategory()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingId
                  ? isVietnamese
                    ? 'Xác nhận cập nhật'
                    : 'Confirm update'
                  : isVietnamese
                    ? 'Xác nhận tạo mới'
                    : 'Confirm create'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
              >
                {isVietnamese ? 'Đóng' : 'Close'}
              </button>
              <button
                type="button"
                onClick={requestPreview}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
              >
                <Plus size={16} />
                {isVietnamese ? 'Xem trước nội dung' : 'Preview content'}
              </button>
            </>
          )
        }
      >
        {previewOpen ? (
          <PreviewPanel
            title={formState.categoryName || (isVietnamese ? 'Danh mục chưa đặt tên' : 'Untitled category')}
            subtitle={
              formState.categorySlug ||
              (isVietnamese
                ? 'Slug sẽ được tạo tự động nếu để trống.'
                : 'The slug will be generated automatically if left blank.')
            }
            html={formState.categoryDescription}
            emptyLabel={
              isVietnamese
                ? 'Chưa có mô tả để xem trước.'
                : 'No description to preview yet.'
            }
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldInput
                  label={isVietnamese ? 'Tên danh mục' : 'Category name'}
                  value={formState.categoryName}
                  onChange={(value) => setField('categoryName', value)}
                />
                <FieldError message={formErrors.categoryName} />
              </div>

              <div className="space-y-2">
                <FieldInput
                  label="Slug"
                  value={formState.categorySlug}
                  onChange={(value) => setField('categorySlug', value)}
                />
                <FieldError message={formErrors.categorySlug} />
              </div>
            </div>

            <FieldSelect
              label={isVietnamese ? 'Danh mục cha' : 'Parent category'}
              value={formState.parentId}
              onChange={(value) => setField('parentId', value)}
              emptyLabel={isVietnamese ? 'Không có danh mục cha' : 'No parent category'}
              options={parentOptions.map((category) => ({
                value: category.categoryId,
                label: `${'— '.repeat(category.level)}${category.categoryName}`,
              }))}
            />

            <RichTextEditor
              label={isVietnamese ? 'Mô tả danh mục' : 'Category description'}
              value={formState.categoryDescription}
              onChange={(value) => setField('categoryDescription', value)}
              isVietnamese={isVietnamese}
            />

            <label className="flex items-center gap-3 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setField('isActive', event.target.checked)}
                className="h-4 w-4 rounded border-on-surface/20 text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-on-surface">
                {isVietnamese ? 'Hiển thị danh mục này trên hệ thống' : 'Show this category in the system'}
              </span>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="md"
        title={isVietnamese ? 'Xác nhận xóa danh mục' : 'Confirm category deletion'}
        description={
          deleteTarget
            ? isVietnamese
              ? `Danh mục "${deleteTarget.categoryName}" sẽ bị xóa khỏi hệ thống.`
              : `The category "${deleteTarget.categoryName}" will be removed from the system.`
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
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xóa danh mục' : 'Delete category'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-6 text-on-surface-variant">
          {isVietnamese
            ? 'Nếu danh mục vẫn còn danh mục con, backend sẽ chặn thao tác này.'
            : 'If the category still has child categories, the backend will block this action.'}
        </p>
      </Modal>
    </div>
  );
}

function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const q = query.toLowerCase();
  return nodes.flatMap((node) => {
    const filteredChildren = filterTree(node.children, query);
    const matches =
      node.categoryName.toLowerCase().includes(q) ||
      node.categorySlug.toLowerCase().includes(q);
    if (matches || filteredChildren.length > 0) {
      return [{ ...node, children: filteredChildren }];
    }
    return [];
  });
}

function flattenCategories(nodes: CategoryNode[], level = 0): FlatCategoryNode[] {
  return nodes.flatMap((node) => [
    { ...node, level },
    ...flattenCategories(node.children, level + 1),
  ]);
}

function collectExpandableIds(nodes: CategoryNode[]) {
  const ids: string[] = [];

  function walk(items: CategoryNode[]) {
    for (const item of items) {
      if (item.children.length > 0) {
        ids.push(item.categoryId);
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return ids;
}

function buildSiblingMap(nodes: CategoryNode[]) {
  const map = new Map<string, string[]>();

  function walk(items: CategoryNode[], parentId: string | null) {
    map.set(parentId ?? '__root__', items.map((item) => item.categoryId));
    for (const item of items) {
      walk(item.children, item.categoryId);
    }
  }

  walk(nodes, null);
  return map;
}

function getDescendantIds(categoryId: string, categoryMap: Map<string, FlatCategoryNode>) {
  const result = new Set<string>();

  function walk(parentId: string) {
    for (const category of categoryMap.values()) {
      if (category.parentId === parentId && !result.has(category.categoryId)) {
        result.add(category.categoryId);
        walk(category.categoryId);
      }
    }
  }

  walk(categoryId);
  return result;
}

function StatCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof FolderTree;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={22} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {title}
      </p>
      <h3 className="mt-3 text-4xl font-black tracking-tight text-primary">{value}</h3>
    </div>
  );
}

type CategoryTreeRowProps = {
  key?: Key;
  category: CategoryNode;
  level: number;
  expandedIds: string[];
  dragState: DragState | null;
  dropTarget: string | null;
  isVietnamese: boolean;
  reorderingId: string | null;
  togglingActiveId: string | null;
  onEdit: (category: CategoryNode) => void;
  onDelete: (category: CategoryNode) => void;
  onToggleActive: (category: CategoryNode) => void;
  onToggleExpand: (categoryId: string) => void;
  onDragStart: (dragState: DragState) => void;
  onDragEnd: () => void;
  onScheduleHoverExpand: (categoryId: string) => void;
  onClearHoverExpand: () => void;
  onDropTargetChange: (value: string | null) => void;
  onDropBefore: (category: CategoryNode) => void;
  onDropAsChild: (category: CategoryNode) => void;
};

function CategoryTreeRow({
  category,
  level,
  expandedIds,
  dragState,
  dropTarget,
  isVietnamese,
  reorderingId,
  togglingActiveId,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleExpand,
  onDragStart,
  onDragEnd,
  onScheduleHoverExpand,
  onClearHoverExpand,
  onDropTargetChange,
  onDropBefore,
  onDropAsChild,
}: CategoryTreeRowProps) {
  const hasChildren = category.children.length > 0;
  const expanded = expandedIds.includes(category.categoryId);
  const isDragging = dragState?.categoryId === category.categoryId;
  const isSameCategory = isDragging;
  const beforeKey = `before:${category.categoryId}`;
  const childKey = `child:${category.categoryId}`;

  return (
    <>
      {dropTarget === beforeKey ? (
        <div className="px-4 py-2 md:px-5">
          <div
            className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary"
            style={{ marginLeft: `${level * 18 + 52}px` }}
          >
            <ArrowUpToLine size={14} />
            <span>{isVietnamese ? 'Thả tại vị trí này' : 'Drop at this position'}</span>
          </div>
        </div>
      ) : null}

      <div
        className={`group grid gap-4 bg-white px-4 py-4 transition md:grid-cols-[52px_minmax(0,1.8fr)_minmax(0,1fr)_150px_160px_112px] md:px-5 ${
          dropTarget === beforeKey ? 'bg-primary/[0.03] ring-2 ring-primary/20' : 'hover:bg-surface'
        } ${isDragging ? 'opacity-50' : ''}`}
        draggable={reorderingId === null}
        onDragStart={(event) => {
          onDragStart({ categoryId: category.categoryId, parentId: category.parentId });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', category.categoryId);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!dragState || isSameCategory) {
            return;
          }

          event.preventDefault();
          onClearHoverExpand();
          onDropTargetChange(beforeKey);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDropBefore(category);
        }}
      >
        <div className="flex items-start md:justify-center">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-on-surface/10 bg-surface text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
            title={isVietnamese ? 'Kéo để di chuyển danh mục' : 'Drag to move category'}
          >
            {reorderingId === category.categoryId ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <GripVertical size={16} />
            )}
          </button>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-3" style={{ paddingLeft: `${level * 18}px` }}>
            <button
              type="button"
              onClick={() => hasChildren && onToggleExpand(category.categoryId)}
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                hasChildren
                  ? 'border-primary/10 bg-primary/5 text-primary hover:border-primary/20 hover:bg-primary/10'
                  : 'border-transparent bg-transparent text-on-surface-variant/30'
              }`}
            >
              {hasChildren ? (
                expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-on-surface-variant/30" />
              )}
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                  {level === 0 ? (isVietnamese ? 'Cha' : 'Root') : isVietnamese ? 'Con' : 'Child'}
                </span>
                <h3 className="truncate text-base font-black text-on-surface">{category.categoryName}</h3>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant/70">
                {getCategoryDescriptionPreview(category.categoryDescription) || (isVietnamese ? 'Chưa có mô tả.' : 'No description yet.')}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 md:pl-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40 md:hidden">
            Slug
          </p>
          <p className="truncate rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant">
            {category.categorySlug}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40 md:hidden">
            {isVietnamese ? 'Số sản phẩm' : 'Products'}
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              {category.productCount}
            </span>
            <span className="text-xs text-on-surface-variant/60">
              {isVietnamese ? `Trực tiếp: ${category.directProductCount}` : `Direct: ${category.directProductCount}`}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40 md:hidden">
              {isVietnamese ? 'Trạng thái' : 'Status'}
            </p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                category.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {category.isActive ? (isVietnamese ? 'Đang hiển thị' : 'Active') : isVietnamese ? 'Tạm ẩn' : 'Inactive'}
            </span>
          </div>

          <div
            className={`rounded-xl border border-dashed px-3 py-2 text-xs font-semibold transition ${
              dropTarget === childKey
                ? 'border-primary bg-primary/8 text-primary shadow-sm'
                : 'border-on-surface-variant/15 text-on-surface-variant'
            } ${isSameCategory ? 'opacity-40' : ''}`}
            onDragOver={(event) => {
              if (!dragState || isSameCategory) {
                return;
              }

              event.preventDefault();
              if (hasChildren && !expanded) {
                onScheduleHoverExpand(category.categoryId);
              } else {
                onClearHoverExpand();
              }
              onDropTargetChange(childKey);
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDropAsChild(category);
            }}
          >
            <div className="flex items-center gap-2">
              <CornerDownRight size={14} />
              <span>{isVietnamese ? 'Chuyển vào danh mục này' : 'Move inside this category'}</span>
            </div>
            {dropTarget === childKey ? (
              <p className="mt-2 text-[11px] font-medium">
                {isVietnamese ? 'Thả để chuyển thành danh mục con' : 'Drop to move as a child category'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onToggleActive(category)}
            disabled={togglingActiveId === category.categoryId}
            title={category.isActive ? (isVietnamese ? 'Ẩn danh mục' : 'Hide category') : (isVietnamese ? 'Hiện danh mục' : 'Show category')}
            className={`rounded-xl p-2 transition ${
              category.isActive
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-on-surface-variant/50 hover:bg-surface hover:text-on-surface-variant'
            } disabled:opacity-40`}
          >
            {togglingActiveId === category.categoryId
              ? <LoaderCircle size={16} className="animate-spin" />
              : category.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-primary/5 hover:text-primary"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {hasChildren && expanded
        ? category.children.map((child) => (
            <CategoryTreeRow
              key={child.categoryId}
              category={child}
              level={level + 1}
              expandedIds={expandedIds}
              dragState={dragState}
              dropTarget={dropTarget}
              isVietnamese={isVietnamese}
              reorderingId={reorderingId}
              togglingActiveId={togglingActiveId}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onScheduleHoverExpand={onScheduleHoverExpand}
              onClearHoverExpand={onClearHoverExpand}
              onDropTargetChange={onDropTargetChange}
              onDropBefore={onDropBefore}
              onDropAsChild={onDropAsChild}
            />
          ))
        : null}
    </>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/30"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/30"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="-mt-1 text-xs font-semibold text-red-600">{message}</p>;
}

function PreviewPanel({
  title,
  subtitle,
  html,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  html: string;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-on-surface/10 bg-surface px-5 py-4">
        <h4 className="text-lg font-black text-primary">{title}</h4>
        <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-on-surface/10 bg-white px-5 py-4">
        {html.trim() ? (
          <iframe
            title="Xem trước mô tả danh mục"
            sandbox=""
            className="h-64 w-full rounded-lg border border-on-surface/10 bg-white"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#1f2933;line-height:1.6;padding:12px;margin:0}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d8ded8;padding:6px}</style></head><body>${html}</body></html>`}
          />
        ) : (
          <p className="text-sm text-on-surface-variant">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
