export type RiceDiseaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiceDiagnosisRecommendationLevel = 'low' | 'review' | 'high';

export type RiceDisease = {
  diseaseId: string;
  diseaseKey: string;
  diseaseSlug: string;
  diseaseName: string;
  diseaseNameVi?: string | null;
  summary: string | null;
  symptoms: string | null;
  causes: string | null;
  treatmentGuidance: string | null;
  preventionGuidance: string | null;
  severity: RiceDiseaseSeverity;
  recommendedIngredients: string[];
  searchKeywords: string[];
  confidenceThreshold: number;
  coverImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RiceDiagnosisProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  quantityAvailable: number;
  unit: string | null;
  isShow: boolean;
  basePrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
  appliedDiscount: {
    id: string;
    code?: string;
    name?: string;
    type: string;
    value: number;
    appliesTo?: string;
  } | null;
  category: {
    categoryId: string;
    categoryName: string;
    categorySlug: string;
  } | null;
  origin: {
    originId: string;
    originName: string;
  } | null;
  ratingAverage: string;
  ratingCount: number;
};

export type RiceDiagnosisInferenceFlags = {
  lowConfidence: boolean;
  ambiguousPrediction: boolean;
  lowQuality: boolean;
  confidenceMargin: number | null;
  qualityIssues: string[];
};

export type RiceDiagnosisResult = {
  diagnosisId: string;
  savedToHistory: boolean;
  confidence: number;
  recommendationLevel: RiceDiagnosisRecommendationLevel;
  model: {
    version: string | null;
    task: string | null;
  };
  inferenceFlags: RiceDiagnosisInferenceFlags;
  disease: RiceDisease | null;
  topPredictions: Array<{
    label: string;
    canonicalLabel: string;
    normalizedKey: string;
    confidence: number;
    diseaseId: string | null;
    diseaseName: string;
    diseaseNameVi?: string | null;
    diseaseSlug: string | null;
  }>;
  recommendedProducts: RiceDiagnosisProduct[];
  advisory: {
    headline: string;
    disclaimer: string;
  };
};

export type RiceDiagnosisHistoryItem = {
  diagnosisId: string;
  confidence: number;
  recommendationLevel: RiceDiagnosisRecommendationLevel;
  predictedLabel: string | null;
  disease: RiceDisease | null;
  model: {
    version: string | null;
    task: string | null;
  };
  createdAt: string;
};

export type AdminRiceDisease = RiceDisease & {
  mappedProductCount: number;
  recommendedProducts?: Array<{
    recommendationId: string;
    productId: string;
    note: string | null;
    rationale: string | null;
    isPrimary: boolean;
    sortOrder: number;
    product: RiceDiagnosisProduct | null;
  }>;
};

export type AdminRiceDiseaseListResponse = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  items: AdminRiceDisease[];
};

export function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function getRiceSeverityLabel(severity: RiceDiseaseSeverity) {
  switch (severity) {
    case 'low':
      return 'Thấp';
    case 'medium':
      return 'Trung bình';
    case 'high':
      return 'Cao';
    case 'critical':
      return 'Rất cao';
    default:
      return severity;
  }
}

export function getRiceSeverityTone(severity: RiceDiseaseSeverity) {
  switch (severity) {
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'high':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'critical':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export function getRecommendationTone(level: RiceDiagnosisRecommendationLevel) {
  switch (level) {
    case 'low':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'review':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'high':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    default:
      return 'bg-slate-50 text-slate-800 border-slate-200';
  }
}

export function getRecommendationLabel(level: RiceDiagnosisRecommendationLevel) {
  switch (level) {
    case 'low':
      return 'Cần kiểm tra thêm';
    case 'review':
      return 'Mức tham khảo';
    case 'high':
      return 'Độ tin cậy cao';
    default:
      return level;
  }
}

export function getQualityIssueLabel(issue: string) {
  switch (issue) {
    case 'image_too_small':
      return 'Ảnh quá nhỏ';
    case 'too_dark':
      return 'Ảnh quá tối';
    case 'too_bright':
      return 'Ảnh quá sáng';
    case 'low_contrast':
      return 'Độ tương phản thấp';
    case 'blurry':
      return 'Ảnh bị mờ';
    case 'empty_image':
      return 'Ảnh không hợp lệ';
    default:
      return issue.replace(/[_-]+/g, ' ');
  }
}

export function openSupportChatWidget() {
  window.dispatchEvent(
    new CustomEvent('support-chat:open', {
      detail: { tab: 'support' },
    }),
  );
}
