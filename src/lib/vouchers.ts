import { getClientSession } from './client-session';
import { clientApi } from './client-api';

export type Voucher = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'percent' | 'fixed' | string;
  value: string | number;
  appliesTo?: string;
  minOrderValue: string | number;
  maxDiscountAmount: string | number | null;
  expiresAt: string;
  isPrivate: boolean;
  usageLimit?: number | null;
  usedCount?: number;
  remainingUses?: number | null;
  isSaved?: boolean;
  eligible?: boolean;
  isUsed?: boolean;
  missingAmount?: string | number;
  discountAmount?: string | number;
  finalPrice?: string | number;
  reason?: string;
};

export type DiscountResult = {
  valid: boolean;
  discountId: string;
  code: string;
  name: string;
  type: string;
  value: number | string;
  discountAmount: string;
  finalPrice: string;
  appliesTo: string;
};

type VoucherQuery = {
  orderValue: number;
  productIds?: string[];
  items?: Array<{
    productId: string;
    quantity: number;
    unitPrice: string | number;
  }>;
};

export async function fetchVouchersForCart(query: VoucherQuery) {
  const payload = {
    orderValue: String(Math.max(0, query.orderValue)),
    ...(query.productIds?.length ? { productIds: query.productIds } : {}),
    ...(query.items?.length
      ? {
          items: query.items.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        }
      : {}),
  };

  if (getClientSession()) {
    return clientApi.post<Voucher[]>('/discounts/available-for-cart', payload);
  }

  return [];
}

export async function fetchSavedVouchers() {
  return clientApi.get<Voucher[]>('/discounts/my-saved');
}

export async function saveVoucherToWallet(voucherId: string) {
  return clientApi.post<{ saved: boolean; savedAt?: string; voucher?: Voucher }>(
    `/discounts/${voucherId}/save`,
  );
}

export function validateVoucherCode(
  discountCode: string,
  query: VoucherQuery,
) {
  return clientApi.post<DiscountResult>('/discounts/validate', {
    discountCode: discountCode.trim().toUpperCase(),
    orderValue: String(Math.max(0, query.orderValue)),
    ...(query.productIds?.length ? { productIds: query.productIds } : {}),
    ...(query.items?.length
      ? {
          items: query.items.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        }
      : {}),
  });
}

export function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function voucherValueLabel(voucher: Pick<Voucher, 'type' | 'value'>) {
  const type = String(voucher.type ?? '').toLowerCase();
  if (type === 'percent' || type === 'percentage') {
    return `-${Number(voucher.value).toLocaleString('vi-VN')}%`;
  }

  return `-${money(voucher.value)}`;
}

export function voucherSavings(voucher: Voucher) {
  return Number(voucher.discountAmount ?? 0);
}

export function voucherMissingAmount(voucher: Voucher) {
  return Number(voucher.missingAmount ?? 0);
}

export function voucherMinOrder(voucher: Voucher) {
  return Number(voucher.minOrderValue ?? 0);
}

export function getVoucherProgress(voucher: Voucher, subtotal: number) {
  const minOrderValue = voucherMinOrder(voucher);
  if (minOrderValue <= 0) return 100;
  return Math.min(100, Math.round((subtotal / minOrderValue) * 100));
}

export function sortVouchers(vouchers: Voucher[]) {
  return [...vouchers].sort((left, right) => {
    const leftEligible = left.eligible ? 1 : 0;
    const rightEligible = right.eligible ? 1 : 0;
    if (leftEligible !== rightEligible) return rightEligible - leftEligible;

    const savingsDiff = voucherSavings(right) - voucherSavings(left);
    if (savingsDiff !== 0) return savingsDiff;

    const missingDiff = voucherMissingAmount(left) - voucherMissingAmount(right);
    if (missingDiff !== 0) return missingDiff;

    return Date.parse(left.expiresAt) - Date.parse(right.expiresAt);
  });
}

export function voucherExpiryLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Không rõ hạn';

  const now = Date.now();
  const diffDays = Math.ceil((time - now) / 86_400_000);
  if (diffDays <= 0) return 'Hết hạn hôm nay';
  if (diffDays === 1) return 'Còn 1 ngày';
  if (diffDays <= 7) return `Còn ${diffDays} ngày`;

  return new Date(time).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function voucherExpiryDateTimeLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Không rõ hạn';

  return new Date(time).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function voucherRemainingUsesLabel(voucher: Voucher) {
  if (voucher.remainingUses === null || voucher.remainingUses === undefined) {
    return 'Không giới hạn lượt';
  }

  return `Còn ${Math.max(0, Number(voucher.remainingUses)).toLocaleString(
    'vi-VN',
  )} lượt`;
}

export function voucherScopeLabel(voucher: Pick<Voucher, 'appliesTo'>) {
  const scope = String(voucher.appliesTo ?? '').toLowerCase();
  if (scope === 'product') return 'Theo sản phẩm';
  if (scope === 'category') return 'Theo danh mục';
  return 'Toàn đơn';
}

export function voucherShortMeta(voucher: Voucher) {
  return [
    `Hạn ${voucherExpiryLabel(voucher.expiresAt)}`,
    voucherRemainingUsesLabel(voucher),
    voucher.isSaved ? 'Đã nhận' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
