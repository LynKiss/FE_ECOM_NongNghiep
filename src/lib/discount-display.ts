export type DiscountDisplayInput = {
  type?: string | null;
  value?: string | number | null;
};

export function isPercentDiscountType(type?: string | null) {
  const normalized = String(type ?? '').trim().toLowerCase();
  return ['percent', 'percentage', 'percent_off'].includes(normalized);
}

export function discountValueLabel(
  discount: DiscountDisplayInput | null | undefined,
  formatPrice: (value: number) => string,
) {
  if (!discount) return '';
  const value = Number(discount.value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return isPercentDiscountType(discount.type)
    ? `Giảm ${value}%`
    : `Giảm ${formatPrice(value)}`;
}
