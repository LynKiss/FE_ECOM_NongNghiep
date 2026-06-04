import {
  CheckCircle2,
  Leaf,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/api';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
import {
  getRiceSeverityLabel,
  getRiceSeverityTone,
  type AdminRiceDisease,
  type AdminRiceDiseaseListResponse,
  type RiceDiagnosisProduct,
} from '../lib/rice-diagnosis';

type ServiceStatus = {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  statusCode: number | null;
  payload: Record<string, unknown> | null;
  error?: string;
};

type RecommendedProductForm = {
  productId: string;
  note: string;
  rationale: string;
  isPrimary: boolean;
  sortOrder: number;
  product: RiceDiagnosisProduct | null;
};

type DiseaseForm = {
  diseaseKey: string;
  diseaseName: string;
  diseaseNameVi: string;
  diseaseSlug: string;
  summary: string;
  symptoms: string;
  causes: string;
  treatmentGuidance: string;
  preventionGuidance: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedIngredientsText: string;
  searchKeywordsText: string;
  confidenceThreshold: string;
  coverImageUrl: string;
  isActive: boolean;
  recommendedProducts: RecommendedProductForm[];
};

const emptyForm: DiseaseForm = {
  diseaseKey: '',
  diseaseName: '',
  diseaseNameVi: '',
  diseaseSlug: '',
  summary: '',
  symptoms: '',
  causes: '',
  treatmentGuidance: '',
  preventionGuidance: '',
  severity: 'medium',
  recommendedIngredientsText: '',
  searchKeywordsText: '',
  confidenceThreshold: '0.90',
  coverImageUrl: '',
  isActive: true,
  recommendedProducts: [],
};

function toLineText(values: string[]) {
  return values.join('\n');
}

function toStringArray(value: string) {
  return [...new Set(value.split(/\n|,/).map((item) => item.trim()).filter(Boolean))];
}

const RICE_DISEASE_VI_FALLBACK: Record<string, string> = {
  BACTERIAL_LEAF_BLIGHT: 'Bạc lá do vi khuẩn',
  BROWN_SPOT: 'Đốm nâu',
  LEAF_BLAST: 'Đạo ôn lá',
  LEAF_SCALD: 'Cháy lá',
  NARROW_BROWN_SPOT: 'Đốm nâu hẹp',
  SHEATH_BLIGHT: 'Khô vằn',
  RICE_HISPA: 'Bọ gai hại lúa',
  HEALTHY_RICE_LEAF: 'Lá lúa khỏe mạnh',
};

function normalizeDiseaseKey(value?: string | null) {
  return (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function getDiseaseVietnameseName(
  item: Pick<AdminRiceDisease, 'diseaseKey' | 'diseaseName' | 'diseaseNameVi'>,
) {
  return (
    item.diseaseNameVi?.trim() ||
    RICE_DISEASE_VI_FALLBACK[normalizeDiseaseKey(item.diseaseKey)] ||
    item.diseaseName
  );
}

export default function RiceDiagnosisAdmin() {
  const { session } = useAdminSession();
  const { showToast } = useToast();

  const canManage =
    session?.user.permissions?.some((permission) => permission.key === 'manage_ai_diagnosis') ?? false;

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [list, setList] = useState<AdminRiceDisease[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiseaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<RiceDiagnosisProduct[]>([]);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      if (activeOnly === 'active' && !item.isActive) return false;
      if (activeOnly === 'inactive' && item.isActive) return false;
      if (!search.trim()) return true;

      const keyword = search.trim().toLowerCase();
      const vietnameseName = getDiseaseVietnameseName(item).toLowerCase();
      return (
        vietnameseName.includes(keyword) ||
        item.diseaseName.toLowerCase().includes(keyword) ||
        item.diseaseKey.toLowerCase().includes(keyword) ||
        item.diseaseSlug.toLowerCase().includes(keyword)
      );
    });
  }, [activeOnly, list, search]);

  useEffect(() => {
    if (!canManage) return;
    void loadPage();
    void loadServiceStatus();
  }, [canManage]);

  async function loadPage() {
    setListLoading(true);
    try {
      const data = await apiClient.get<AdminRiceDiseaseListResponse>(
        '/rice-diagnosis/admin/diseases?page=1&limit=100',
      );
      setList(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không tải được danh mục bệnh',
        description: error instanceof Error ? error.message : '',
      });
      setList([]);
    } finally {
      setListLoading(false);
    }
  }

  async function loadServiceStatus() {
    setServiceLoading(true);
    try {
      const data = await apiClient.get<ServiceStatus>('/rice-diagnosis/admin/service-status');
      setServiceStatus(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không kiểm tra được AI service',
        description: error instanceof Error ? error.message : '',
      });
      setServiceStatus(null);
    } finally {
      setServiceLoading(false);
    }
  }

  async function searchProducts(value: string) {
    setProductSearch(value);
    if (!value.trim()) {
      setProductOptions([]);
      return;
    }

    setProductLoading(true);
    try {
      const items = await apiClient.get<RiceDiagnosisProduct[]>(
        `/rice-diagnosis/admin/products?search=${encodeURIComponent(value.trim())}&limit=12`,
      );
      setProductOptions(Array.isArray(items) ? items : []);
    } catch {
      setProductOptions([]);
    } finally {
      setProductLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setProductOptions([]);
    setProductSearch('');
    setModalOpen(true);
  }

  async function openEdit(diseaseId: string) {
    try {
      const detail = await apiClient.get<AdminRiceDisease>(
        `/rice-diagnosis/admin/diseases/${diseaseId}`,
      );

      setEditingId(diseaseId);
      setForm({
        diseaseKey: detail.diseaseKey,
        diseaseName: detail.diseaseName,
        diseaseNameVi: detail.diseaseNameVi ?? getDiseaseVietnameseName(detail),
        diseaseSlug: detail.diseaseSlug,
        summary: detail.summary ?? '',
        symptoms: detail.symptoms ?? '',
        causes: detail.causes ?? '',
        treatmentGuidance: detail.treatmentGuidance ?? '',
        preventionGuidance: detail.preventionGuidance ?? '',
        severity: detail.severity,
        recommendedIngredientsText: toLineText(detail.recommendedIngredients),
        searchKeywordsText: toLineText(detail.searchKeywords),
        confidenceThreshold: String(detail.confidenceThreshold),
        coverImageUrl: detail.coverImageUrl ?? '',
        isActive: detail.isActive,
        recommendedProducts: (detail.recommendedProducts ?? []).map((item, index) => ({
          productId: item.productId,
          note: item.note ?? '',
          rationale: item.rationale ?? '',
          isPrimary: item.isPrimary || index === 0,
          sortOrder: item.sortOrder ?? index,
          product: item.product ?? null,
        })),
      });
      setProductOptions([]);
      setProductSearch('');
      setModalOpen(true);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không tải được chi tiết bệnh',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  function addRecommendedProduct(product: RiceDiagnosisProduct) {
    setForm((current) => {
      if (current.recommendedProducts.some((item) => item.productId === product.productId)) {
        return current;
      }

      return {
        ...current,
        recommendedProducts: [
          ...current.recommendedProducts,
          {
            productId: product.productId,
            note: '',
            rationale: '',
            isPrimary: current.recommendedProducts.length === 0,
            sortOrder: current.recommendedProducts.length,
            product,
          },
        ],
      };
    });
  }

  function updateRecommendedProduct(
    productId: string,
    patch: Partial<RecommendedProductForm>,
  ) {
    setForm((current) => ({
      ...current,
      recommendedProducts: current.recommendedProducts.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeRecommendedProduct(productId: string) {
    setForm((current) => {
      const next = current.recommendedProducts.filter((item) => item.productId !== productId);
      return {
        ...current,
        recommendedProducts: next.map((item, index) => ({
          ...item,
          isPrimary: index === 0 ? true : item.isPrimary,
          sortOrder: index,
        })),
      };
    });
  }

  async function handleSave() {
    if (!form.diseaseName.trim() || !form.diseaseKey.trim()) {
      showToast({
        tone: 'error',
        title: 'Tên bệnh và disease key là bắt buộc',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        diseaseKey: form.diseaseKey.trim(),
        diseaseName: form.diseaseName.trim(),
        diseaseNameVi: form.diseaseNameVi.trim() || undefined,
        diseaseSlug: form.diseaseSlug.trim() || undefined,
        summary: form.summary.trim() || undefined,
        symptoms: form.symptoms.trim() || undefined,
        causes: form.causes.trim() || undefined,
        treatmentGuidance: form.treatmentGuidance.trim() || undefined,
        preventionGuidance: form.preventionGuidance.trim() || undefined,
        severity: form.severity,
        recommendedIngredients: toStringArray(form.recommendedIngredientsText),
        searchKeywords: toStringArray(form.searchKeywordsText),
        confidenceThreshold: Number(form.confidenceThreshold || '0.9'),
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        isActive: form.isActive,
        recommendedProducts: form.recommendedProducts.map((item, index) => ({
          productId: item.productId,
          note: item.note.trim() || undefined,
          rationale: item.rationale.trim() || undefined,
          isPrimary: item.isPrimary || index === 0,
          sortOrder: index,
        })),
      };

      if (editingId) {
        await apiClient.patch(`/rice-diagnosis/admin/diseases/${editingId}`, payload);
      } else {
        await apiClient.post('/rice-diagnosis/admin/diseases', payload);
      }

      showToast({
        tone: 'success',
        title: editingId ? 'Đã cập nhật danh mục bệnh' : 'Đã tạo bệnh mới',
      });
      setModalOpen(false);
      setForm(emptyForm);
      await loadPage();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Lưu danh mục bệnh thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(diseaseId: string) {
    try {
      await apiClient.patch(`/rice-diagnosis/admin/diseases/${diseaseId}/toggle-active`, {});
      await loadPage();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không đổi được trạng thái bệnh',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-amber-800">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <ShieldCheck size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-black">Không đủ quyền truy cập</h1>
        <p className="mt-2 text-sm">
          Tài khoản hiện tại cần quyền <code>manage_ai_diagnosis</code> để quản lý module chẩn đoán bệnh lúa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary/70">
            AI Diagnosis
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-primary">
            Quản lý chẩn đoán bệnh lúa
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Quản lý danh mục bệnh, ngưỡng confidence, keyword fallback và các sản phẩm map trực tiếp
            từ kết quả AI sang gian hàng.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadServiceStatus()}
            className="inline-flex items-center gap-2 rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-bold text-on-surface transition hover:border-primary/20"
          >
            {serviceLoading ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Kiểm tra AI service
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm shadow-primary/20 transition hover:-translate-y-0.5"
          >
            <Plus size={16} />
            Thêm bệnh mới
          </button>
        </div>
      </div>

      {/* Flask status — compact horizontal banner */}
      <div className="rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {serviceStatus?.reachable ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={16} />
              </span>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <RefreshCw size={16} />
              </span>
            )}
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-on-surface-variant/50">
                AI service · Flask
              </p>
              <p className="text-sm font-black text-on-surface">
                {serviceStatus?.reachable
                  ? `Online · HTTP ${serviceStatus.statusCode ?? '-'}`
                  : serviceStatus?.error ?? 'Chưa kết nối'}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-on-surface/8 hidden sm:block" />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-on-surface-variant/50">Endpoint</p>
            <p className="truncate text-sm font-semibold text-on-surface-variant">
              {serviceStatus?.baseUrl ?? '—'}
            </p>
          </div>

          {serviceStatus?.payload ? (
            <>
              <div className="h-8 w-px bg-on-surface/8 hidden lg:block" />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('flask-payload');
                  if (el) el.classList.toggle('hidden');
                }}
                className="shrink-0 rounded-xl border border-on-surface/10 px-3 py-1.5 text-xs font-bold text-on-surface-variant transition hover:bg-surface"
              >
                Xem payload
              </button>
            </>
          ) : null}
        </div>

        {serviceStatus?.payload ? (
          <div id="flask-payload" className="hidden border-t border-on-surface/8 px-6 pb-5 pt-4">
            <pre className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
              {JSON.stringify(serviceStatus.payload, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      {/* Search / filter + disease grid — full width */}
      <section className="rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-on-surface/8 px-6 py-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên bệnh, key, slug..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <select
            value={activeOnly}
            onChange={(event) => setActiveOnly(event.target.value as typeof activeOnly)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30"
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ẩn</option>
          </select>
          <span className="text-xs font-bold text-on-surface-variant/50">
            {filteredList.length} bệnh
          </span>
        </div>

        <div className="p-6">
          {listLoading ? (
            <div className="flex items-center justify-center py-16">
              <LoaderCircle size={22} className="animate-spin text-primary" />
            </div>
          ) : filteredList.length === 0 ? (
            <div className="rounded-2xl bg-surface px-4 py-12 text-center text-sm text-on-surface-variant">
              Chưa có bệnh nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredList.map((item) => {
                const displayName = getDiseaseVietnameseName(item);
                const hasVietnameseName = displayName !== item.diseaseName;

                return (
                  <div
                    key={item.diseaseId}
                    className="flex flex-col rounded-xl border border-on-surface/8 bg-surface/40 p-5"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Leaf size={15} className="shrink-0 text-primary" />
                        <p className="truncate text-base font-black text-on-surface">
                          {displayName}
                        </p>
                      </div>
                      {hasVietnameseName ? (
                        <p className="mt-1 truncate text-xs font-semibold text-on-surface-variant">
                          Tên tiếng Anh: {item.diseaseName}
                        </p>
                      ) : null}
                      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/50">
                        {item.diseaseKey}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black ${getRiceSeverityTone(
                        item.severity,
                      )}`}
                    >
                      {getRiceSeverityLabel(item.severity)}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-on-surface-variant">
                    {item.summary || 'Chưa có mô tả tóm tắt cho bệnh này.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-bold">
                    <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-on-surface">
                      Threshold {item.confidenceThreshold}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-on-surface">
                      {item.mappedProductCount} sản phẩm
                    </span>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 ${
                        item.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.isActive ? 'Hoạt động' : 'Tạm ẩn'}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void openEdit(item.diseaseId)}
                      className="flex-1 rounded-full border border-primary/20 py-2 text-sm font-bold text-primary transition hover:bg-primary/8"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(item.diseaseId)}
                      className="flex-1 rounded-full border border-on-surface/10 py-2 text-sm font-bold text-on-surface transition hover:bg-on-surface/5"
                    >
                      {item.isActive ? 'Tạm ẩn' : 'Kích hoạt'}
                    </button>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-sm">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {editingId ? 'Cập nhật' : 'Tạo mới'}
                </p>
                <h2 className="mt-1 text-2xl font-black text-on-surface">
                  {editingId ? 'Cập nhật danh mục bệnh' : 'Thêm bệnh lúa mới'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-on-surface/10 text-on-surface-variant transition hover:bg-on-surface/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Disease key
                    </span>
                    <input
                      value={form.diseaseKey}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseKey: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Disease slug
                    </span>
                    <input
                      value={form.diseaseSlug}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseSlug: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Tên tiếng Việt
                    </span>
                    <input
                      value={form.diseaseNameVi}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseNameVi: event.target.value }))}
                      placeholder="Ví dụ: Đạo ôn lá"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Tên tiếng Anh
                    </span>
                    <input
                      value={form.diseaseName}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseName: event.target.value }))}
                      placeholder="Ví dụ: Leaf Blast"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Mức độ
                    </span>
                    <select
                      value={form.severity}
                      onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as DiseaseForm['severity'] }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                      <option value="critical">Rất cao</option>
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Confidence threshold
                    </span>
                    <input
                      value={form.confidenceThreshold}
                      onChange={(event) => setForm((current) => ({ ...current, confidenceThreshold: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Trạng thái
                    </span>
                    <select
                      value={form.isActive ? 'active' : 'inactive'}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Tạm ẩn</option>
                    </select>
                  </label>
                </div>

                {[
                  ['summary', 'Tóm tắt'],
                  ['symptoms', 'Triệu chứng'],
                  ['causes', 'Nguyên nhân'],
                  ['treatmentGuidance', 'Hướng xử lý'],
                  ['preventionGuidance', 'Hướng phòng ngừa'],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      {label}
                    </span>
                    <textarea
                      rows={4}
                      value={form[key as keyof DiseaseForm] as string}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                ))}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Hoạt chất tham khảo
                    </span>
                    <textarea
                      rows={5}
                      value={form.recommendedIngredientsText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recommendedIngredientsText: event.target.value,
                        }))
                      }
                      placeholder="Mỗi dòng một hoạt chất"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Keyword fallback
                    </span>
                    <textarea
                      rows={5}
                      value={form.searchKeywordsText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          searchKeywordsText: event.target.value,
                        }))
                      }
                      placeholder="Mỗi dòng một keyword tìm sản phẩm"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-on-surface/8 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                    Tìm sản phẩm để map
                  </p>
                  <div className="relative mt-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                    <input
                      value={productSearch}
                      onChange={(event) => void searchProducts(event.target.value)}
                      placeholder="Tìm theo tên sản phẩm..."
                      className="w-full rounded-xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {productLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <LoaderCircle size={18} className="animate-spin text-primary" />
                      </div>
                    ) : productOptions.length === 0 ? (
                      <div className="rounded-2xl bg-surface px-4 py-6 text-sm text-on-surface-variant">
                        Nhập từ khóa để tìm sản phẩm.
                      </div>
                    ) : (
                      productOptions.map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-on-surface/8 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold text-on-surface">{product.productName}</p>
                            <p className="text-xs text-on-surface-variant">
                              Tồn kho {product.quantityAvailable} {product.unit ?? ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addRecommendedProduct(product)}
                            className="rounded-full bg-primary px-3 py-1.5 text-xs font-black text-white transition hover:bg-primary/90"
                          >
                            Thêm
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-on-surface/8 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Sản phẩm đã map
                    </p>
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-black text-on-surface">
                      {form.recommendedProducts.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {form.recommendedProducts.length === 0 ? (
                      <div className="rounded-2xl bg-surface px-4 py-6 text-sm text-on-surface-variant">
                        Chưa có sản phẩm nào được map. Hệ thống sẽ dùng fallback keyword nếu có.
                      </div>
                    ) : (
                      form.recommendedProducts.map((item, index) => (
                        <div
                          key={item.productId}
                          className="rounded-2xl border border-on-surface/8 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-on-surface">
                                {item.product?.productName ?? item.productId}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                Thứ tự {index + 1}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRecommendedProduct(item.productId)}
                              className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                            >
                              Xóa
                            </button>
                          </div>

                          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                            <input
                              type="checkbox"
                              checked={item.isPrimary}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setForm((current) => ({
                                  ...current,
                                  recommendedProducts: current.recommendedProducts.map((product) => ({
                                    ...product,
                                    isPrimary: product.productId === item.productId ? checked : false,
                                  })),
                                }));
                              }}
                            />
                            Sản phẩm ưu tiên
                          </label>

                          <div className="mt-3 grid gap-3">
                            <input
                              value={item.note}
                              onChange={(event) =>
                                updateRecommendedProduct(item.productId, {
                                  note: event.target.value,
                                })
                              }
                              placeholder="Ghi chú sử dụng"
                              className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                            />
                            <input
                              value={item.rationale}
                              onChange={(event) =>
                                updateRecommendedProduct(item.productId, {
                                  rationale: event.target.value,
                                })
                              }
                              placeholder="Lý do đề xuất"
                              className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface transition hover:bg-on-surface/5"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm shadow-primary/20 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Lưu danh mục bệnh
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
