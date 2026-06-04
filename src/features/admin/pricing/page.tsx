import {
  Calculator,
  CheckCircle,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  productId: string;
  productName: string;
  productPrice: string;
  costPrice: string | null;
  bulkPrice: string | null;
  unit: string | null;
};

type Suggestion = {
  suggestionId: string;
  productId: string;
  landedCost: string;
  wastePct: string;
  sellingCostPct: string;
  profitPct: string;
  bulkDiscountPct: string;
  unitPerBulk: number;
  suggestedRetail: string;
  suggestedBulk: string;
  appliedRetail: string | null;
  appliedBulk: string | null;
  appliedAt: string | null;
  notes: string | null;
  createdAt: string;
};

type PreviewResult = {
  landedCost: number;
  totalMarkupPct: number;
  rawRetail: number;
  suggestedRetail: number;
  unitPerBulk: number;
  bulkDiscountPct: number;
  suggestedBulk: number;
};

type CalcResult = {
  suggestionId: string;
  suggestedRetail: string;
  suggestedBulk: string;
  breakdown: PreviewResult;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: string | number) =>
  Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + '₫';

const inputCls =
  'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';
const selectCls =
  'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';

function FieldWrap({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-on-surface-variant/50">{hint}</span>}
    </label>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    void apiClient.get<{ items: Product[] }>('/products?limit=500&includeHidden=true').then((d) =>
      setProducts(d.items ?? []),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiClient
      .get<{ items: Suggestion[]; meta: Meta }>(`/pricing/suggestions?page=${page}&limit=20`)
      .then((d) => { if (!cancelled) { setSuggestions(d.items); setMeta(d.meta); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, reloadKey]);

  async function handleApplyFromList(s: Suggestion) {
    setApplyingId(s.suggestionId);
    try {
      await apiClient.post(`/pricing/suggestions/${s.suggestionId}/apply`, {
        retailPrice: Number(s.suggestedRetail),
      });
      showToast({ tone: 'success', title: 'Đã áp dụng giá lên sản phẩm' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Áp dụng thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setApplyingId(null);
    }
  }

  const filteredSuggestions = search.trim()
    ? suggestions.filter((s) => {
        const prod = products.find((p) => p.productId === s.productId);
        return prod?.productName.toLowerCase().includes(search.toLowerCase());
      })
    : suggestions;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">Định giá bán</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tính toán và đề xuất giá bán dựa trên giá vốn, chi phí và mức lợi nhuận mong muốn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCalcModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
        >
          <Calculator size={16} />
          Tính giá mới
        </button>
      </div>

      {/* List */}
      <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên sản phẩm..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4 text-right">Giá vốn</th>
                <th className="px-5 py-4 text-right">Hao hụt + CP bán</th>
                <th className="px-5 py-4 text-right">% Lãi</th>
                <th className="px-5 py-4 text-right">Giá lẻ đề xuất</th>
                <th className="px-5 py-4 text-center">Đã áp dụng</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : filteredSuggestions.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-on-surface-variant">
                  <Tag size={28} className="mx-auto mb-3 text-primary/30" />
                  Chưa có đề xuất giá nào
                </td></tr>
              ) : filteredSuggestions.map((s) => {
                const prod = products.find((p) => p.productId === s.productId);
                return (
                  <tr key={s.suggestionId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-semibold text-on-surface">{prod?.productName ?? s.productId}</td>
                    <td className="px-5 py-3.5 text-right text-on-surface-variant">{fmt(s.landedCost)}</td>
                    <td className="px-5 py-3.5 text-right text-on-surface-variant">
                      {Number(s.wastePct) + Number(s.sellingCostPct)}%
                    </td>
                    <td className="px-5 py-3.5 text-right text-on-surface-variant">{Number(s.profitPct)}%</td>
                    <td className="px-5 py-3.5 text-right font-bold text-primary">{fmt(s.suggestedRetail)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {s.appliedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          <CheckCircle size={11} /> Đã áp dụng
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40">Chưa áp</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-on-surface-variant">
                      {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!s.appliedAt && (
                        <button
                          type="button"
                          onClick={() => void handleApplyFromList(s)}
                          disabled={applyingId === s.suggestionId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {applyingId === s.suggestionId ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Áp dụng
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} đề xuất</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {calcModalOpen && (
        <CalcModal
          products={products}
          onClose={() => setCalcModalOpen(false)}
          onSaved={() => { setCalcModalOpen(false); setReloadKey((k) => k + 1); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── Calc Modal ───────────────────────────────────────────────────────────────

function CalcModal({
  products,
  onClose,
  onSaved,
  showToast,
}: {
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (opts: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [productId, setProductId] = useState('');
  const [landedCost, setLandedCost] = useState(0);
  const [wastePct, setWastePct] = useState(2);
  const [sellingCostPct, setSellingCostPct] = useState(5);
  const [profitPct, setProfitPct] = useState(20);
  // Giá thùng (bulk) không dùng — gửi default cho BE (1 đơn vị, 0% chiết khấu)
  const unitPerBulk = 1;
  const bulkDiscountPct = 0;
  const [notes, setNotes] = useState('');

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);

  // Apply state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyRetail, setApplyRetail] = useState(0);
  const [applying, setApplying] = useState(false);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fill landed cost from product's cost_price
  useEffect(() => {
    if (!productId) return;
    const prod = products.find((p) => p.productId === productId);
    if (prod?.costPrice) setLandedCost(Number(prod.costPrice));
  }, [productId, products]);

  function triggerPreview() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => void doPreview(), 400);
  }

  async function doPreview() {
    if (landedCost <= 0) { setPreview(null); return; }
    setPreviewing(true);
    try {
      const result = await apiClient.post<PreviewResult>('/pricing/suggestions/preview', {
        productId: productId || 'preview',
        landedCost,
        wastePct,
        sellingCostPct,
        profitPct,
        bulkDiscountPct,
        unitPerBulk,
      });
      setPreview(result);
    } catch {
      // ignore
    } finally {
      setPreviewing(false);
    }
  }

  // Trigger preview whenever inputs change
  useEffect(() => { triggerPreview(); }, [landedCost, wastePct, sellingCostPct, profitPct]);

  async function handleCalculate() {
    if (!productId) { showToast({ tone: 'error', title: 'Chọn sản phẩm' }); return; }
    if (landedCost <= 0) { showToast({ tone: 'error', title: 'Nhập giá vốn > 0' }); return; }
    setSaving(true);
    try {
      const result = await apiClient.post<CalcResult>('/pricing/suggestions/calculate', {
        productId,
        landedCost,
        wastePct,
        sellingCostPct,
        profitPct,
        bulkDiscountPct,
        unitPerBulk,
        notes: notes || undefined,
      });
      setCalcResult(result);
      setApplyRetail(result.breakdown.suggestedRetail);
      showToast({ tone: 'success', title: 'Đã lưu đề xuất giá' });
    } catch (err) {
      showToast({ tone: 'error', title: 'Tính giá thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    if (!calcResult) return;
    setApplying(true);
    try {
      await apiClient.post(`/pricing/suggestions/${calcResult.suggestionId}/apply`, {
        retailPrice: applyRetail,
      });
      showToast({ tone: 'success', title: 'Đã áp dụng giá lên sản phẩm' });
      setApplyModalOpen(false);
      onSaved();
    } catch (err) {
      showToast({ tone: 'error', title: 'Áp dụng thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setApplying(false);
    }
  }

  const selectedProduct = products.find((p) => p.productId === productId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
      <div className="w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-sm" style={{ maxHeight: '92vh' }}>
        <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
          <h2 className="text-xl font-black text-on-surface">Tính giá bán đề xuất</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
            <X size={17} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {/* Product selector */}
          <FieldWrap label="Sản phẩm *">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={selectCls}>
              <option value="">— Chọn sản phẩm —</option>
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productName}{p.costPrice ? ` — GV hiện tại: ${fmt(p.costPrice)}` : ''}
                </option>
              ))}
            </select>
          </FieldWrap>

          {selectedProduct && (
            <div className="rounded-xl bg-surface px-4 py-3 text-xs text-on-surface-variant grid grid-cols-2 gap-2">
              <p>Giá bán hiện tại: <strong className="text-on-surface">{fmt(selectedProduct.productPrice)}</strong></p>
              <p>Giá vốn hiện tại: <strong className="text-on-surface">{selectedProduct.costPrice ? fmt(selectedProduct.costPrice) : '—'}</strong></p>
            </div>
          )}

          {/* Cost inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrap label="Giá vốn (₫) *" hint="Giá nhập thực tế sau khi tính phí vận chuyển">
              <input
                type="number"
                min={0}
                value={landedCost}
                onChange={(e) => { setLandedCost(Number(e.target.value)); }}
                className={inputCls}
              />
            </FieldWrap>
            <FieldWrap label="% Hao hụt" hint="Tỷ lệ hàng hỏng, mất mát dự kiến">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={wastePct}
                  onChange={(e) => setWastePct(Number(e.target.value))}
                  className={inputCls + ' pr-8'}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">%</span>
              </div>
            </FieldWrap>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrap label="% Chi phí bán hàng" hint="Bao bì, vận chuyển đến khách, marketing...">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={sellingCostPct}
                  onChange={(e) => setSellingCostPct(Number(e.target.value))}
                  className={inputCls + ' pr-8'}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">%</span>
              </div>
            </FieldWrap>
            <FieldWrap label="% Lợi nhuận mong muốn *">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  value={profitPct}
                  onChange={(e) => setProfitPct(Number(e.target.value))}
                  className={inputCls + ' pr-8'}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">%</span>
              </div>
            </FieldWrap>
          </div>

          {/* Live preview */}
          {(preview || previewing) && (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/60">
                <Calculator size={13} />
                Xem trước kết quả
                {previewing && <LoaderCircle size={12} className="animate-spin ml-1" />}
              </div>
              {preview && (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-on-surface-variant/60 font-black">Giá vốn</p>
                      <p className="mt-1 font-bold text-on-surface">{fmt(preview.landedCost)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-on-surface-variant/60 font-black">Tổng markup</p>
                      <p className="mt-1 font-bold text-on-surface">{preview.totalMarkupPct}%</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm border border-primary/20">
                      <p className="text-[10px] uppercase tracking-wide text-primary/70 font-black">Giá lẻ đề xuất</p>
                      <p className="mt-1 font-bold text-primary text-base">{fmt(preview.suggestedRetail)}</p>
                      <p className="text-[10px] text-on-surface-variant/50">Trước làm tròn: {fmt(preview.rawRetail)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant/60">
                    Công thức: {fmt(preview.landedCost)} × (1 + {preview.totalMarkupPct}%) = {fmt(preview.rawRetail)} → làm tròn lên hàng nghìn = <strong className="text-primary">{fmt(preview.suggestedRetail)}</strong>
                  </p>
                </>
              )}
            </div>
          )}

          <FieldWrap label="Ghi chú">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </FieldWrap>

          {/* Saved result + Apply */}
          {calcResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Đề xuất đã được lưu</p>
              <div className="text-sm">
                <p>Giá lẻ đề xuất: <strong className="text-primary">{fmt(calcResult.suggestedRetail)}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow hover:bg-emerald-700"
              >
                <CheckCircle size={15} />
                Áp dụng giá lên sản phẩm
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
          <button
            type="button"
            onClick={() => void handleCalculate()}
            disabled={saving || !productId || landedCost <= 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Calculator size={15} />}
            Lưu đề xuất
          </button>
        </div>
      </div>

      {/* Apply confirmation dialog */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm space-y-5">
            <h3 className="text-lg font-black text-on-surface">Áp dụng giá lên sản phẩm</h3>
            <p className="text-sm text-on-surface-variant">Bạn có thể điều chỉnh giá trước khi áp dụng:</p>
            <div className="space-y-4">
              <FieldWrap label="Giá lẻ áp dụng (₫)">
                <input type="number" min={0} value={applyRetail} onChange={(e) => setApplyRetail(Number(e.target.value))} className={inputCls} />
              </FieldWrap>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setApplyModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Hủy</button>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={applying || applyRetail <= 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow disabled:opacity-60"
              >
                {applying && <LoaderCircle size={15} className="animate-spin" />}
                Xác nhận áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
