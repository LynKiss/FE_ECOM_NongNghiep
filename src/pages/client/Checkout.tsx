import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertTriangle, MapPin, Plus, Check, ChevronRight, ArrowLeft, Leaf, Truck, BadgePercent, CheckCircle2, Tag } from 'lucide-react';

const VIETNAM_PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước',
  'Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên',
  'Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An',
  'Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng',
  'Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh',
  'Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];
import { clientApi } from '../../lib/client-api';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import {
  type Voucher,
  fetchVouchersForCart,
  getVoucherProgress,
  money,
  sortVouchers,
  validateVoucherCode,
  voucherExpiryDateTimeLabel,
  voucherExpiryLabel,
  voucherMissingAmount,
  voucherRemainingUsesLabel,
  voucherSavings,
  voucherValueLabel,
} from '../../lib/vouchers';

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province: string;
  isDefault: boolean;
  label?: string;
};

type DeliveryMethod = {
  id: string;
  name: string;
  type: 'delivery' | 'pickup';
  description: string | null;
  basePrice: number;
  minOrderAmount: number;
  freeShippingThreshold: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  eligible: boolean;
  shippingFee: number;
  freeShippingApplied: boolean;
  ineligibleReason: 'MIN_ORDER' | 'OUT_OF_AREA' | null;
  isDefault: boolean;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function deliveryMethodReason(method: DeliveryMethod) {
  if (method.ineligibleReason === 'MIN_ORDER') {
    return `Đơn cần đạt tối thiểu ${formatPrice(method.minOrderAmount)}.`;
  }
  if (method.ineligibleReason === 'OUT_OF_AREA') {
    return 'Phương thức này chưa áp dụng cho khu vực đã chọn.';
  }
  return '';
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const { cart, fetchCart } = useCart();

  const state = (location.state as { discountCode?: string; discountAmount?: number } | null) ?? {};
  const [appliedDiscountCode, setAppliedDiscountCode] = useState(state.discountCode ?? '');
  const [appliedDiscountAmount, setAppliedDiscountAmount] = useState(state.discountAmount ?? 0);
  const [voucherInput, setVoucherInput] = useState(state.discountCode ?? '');
  const [voucherError, setVoucherError] = useState('');
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [loadingDeliveryQuotes, setLoadingDeliveryQuotes] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [note, setNote] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);

  const [form, setForm] = useState({
    recipientName: session?.user.fullName ?? session?.user.username ?? '',
    phone: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
    label: '',
  });

  const [guestForm, setGuestForm] = useState({
    recipientName: '',
    phone: '',
    email: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
  });
  const [pickupContact, setPickupContact] = useState({
    recipientName: session?.user.fullName ?? session?.user.username ?? '',
    phone: '',
  });

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    if (!session) {
      setLoadingAddresses(false);
      return;
    }

    void clientApi.get<Address[]>('/users/me/addresses').then((addrs) => {
      const addrList = addrs ?? [];

      setAddresses(addrList);
      const def = addrList.find((a) => a.isDefault);
      if (def) setSelectedAddressId(def.id);
      else if (addrList[0]) setSelectedAddressId(addrList[0].id);
    }).catch(() => {}).finally(() => setLoadingAddresses(false));
  }, [session]);

  const subtotal = Number(cart?.totalAmount ?? 0);
  const productIds = useMemo(
    () => cart?.items.map((item) => item.productId) ?? [],
    [cart],
  );
  const voucherItems = useMemo(
    () =>
      cart?.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) ?? [],
    [cart],
  );
  const sortedVouchers = useMemo(() => sortVouchers(vouchers), [vouchers]);
  const quickVouchers = sortedVouchers.slice(0, 3);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
  const quoteLocation = session
    ? {
        province: selectedAddress?.province ?? '',
        district: selectedAddress?.district ?? '',
      }
    : {
        province: guestForm.province,
        district: guestForm.district,
      };

  useEffect(() => {
    if (!cart?.items.length) {
      setDeliveryMethods([]);
      return;
    }

    let cancelled = false;
    setLoadingDeliveryQuotes(true);
    setDeliveryQuoteError('');
    void clientApi
      .post<DeliveryMethod[]>('/delivery-methods/quote', {
        subtotal,
        province: quoteLocation.province || undefined,
        district: quoteLocation.district || undefined,
      })
      .then((methods) => {
        if (cancelled) return;
        const list = methods ?? [];
        setDeliveryMethods(list);
        setSelectedDeliveryId((current) => {
          if (current && list.some((method) => method.id === current && method.eligible)) {
            return current;
          }
          return (
            list.find((method) => method.isDefault && method.eligible)?.id ??
            list.find((method) => method.eligible)?.id ??
            null
          );
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setDeliveryMethods([]);
        setSelectedDeliveryId(null);
        setDeliveryQuoteError(
          error instanceof Error
            ? error.message
            : 'Không thể tính phương thức nhận hàng lúc này.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDeliveryQuotes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cart?.items.length, subtotal, quoteLocation.province, quoteLocation.district]);

  useEffect(() => {
    if (!cart?.items.length) {
      setVouchers([]);
      return;
    }

    let cancelled = false;
    setLoadingVouchers(true);

    fetchVouchersForCart({ orderValue: subtotal, productIds, items: voucherItems })
      .then((data) => {
        if (!cancelled) setVouchers(data);
      })
      .catch(() => {
        if (!cancelled) setVouchers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVouchers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cart, subtotal, productIds.join('|'), voucherItems]);

  const applyVoucher = async (code: string) => {
    if (!cart) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    setVoucherInput(normalized);
    setVoucherError('');
    setValidatingVoucher(true);
    try {
      const result = await validateVoucherCode(normalized, {
        orderValue: subtotal,
        productIds,
        items: voucherItems,
      });
      setAppliedDiscountCode(result.code);
      setAppliedDiscountAmount(Number(result.discountAmount));
    } catch (error) {
      setAppliedDiscountCode('');
      setAppliedDiscountAmount(0);
      setVoucherError(
        error instanceof Error
          ? error.message
          : 'Voucher không hợp lệ hoặc đã hết hạn',
      );
    } finally {
      setValidatingVoucher(false);
    }
  };

  if (!cart) return null;

  const selectedDelivery = deliveryMethods.find((d) => d.id === selectedDeliveryId);
  const isPickup = selectedDelivery?.type === 'pickup';
  const shipping = selectedDelivery?.eligible ? selectedDelivery.shippingFee : 0;
  const total = Math.max(0, subtotal - appliedDiscountAmount) + shipping;
  const hasBlockedItems = cart.items.some((item) => item.isUnavailable || item.stockIssue);
  const hasPriceChanges = cart.items.some((item) => item.priceChanged);

  const handleSaveAddress = async () => {
    if (!form.recipientName || !form.phone || !form.addressLine || !form.province) return;
    setSavingAddress(true);
    try {
      const newAddr = await clientApi.post<Address>('/users/me/addresses', {
        recipientName: form.recipientName,
        phone: form.phone,
        addressLine: form.addressLine,
        ward: form.ward || undefined,
        district: form.district || undefined,
        province: form.province,
        label: form.label || undefined,
      });
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddressId(newAddr.id);
      setAddingAddress(false);
      setForm({ recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', label: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu địa chỉ');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleContinue = () => {
    if (hasBlockedItems) return;
    if (!selectedDeliveryId || !selectedDelivery?.eligible) return;
    if (!session) {
      if (isPickup) {
        if (!pickupContact.recipientName || !pickupContact.phone) return;
        void navigate('/client/payment', {
          state: {
            fulfillmentType: 'pickup',
            pickupContact,
            deliveryId: selectedDeliveryId,
            shippingAddress: `${pickupContact.recipientName}, ${pickupContact.phone}`,
            deliveryName: selectedDelivery.name,
            shippingCost: shipping,
            note,
            discountCode: appliedDiscountCode || undefined,
            discountAmount: appliedDiscountAmount,
            subtotal,
            total,
          },
        });
        return;
      }
      if (!guestForm.recipientName || !guestForm.phone || !guestForm.addressLine || !guestForm.province) return;
      const addrText = [guestForm.recipientName, guestForm.phone, guestForm.addressLine, guestForm.ward, guestForm.district, guestForm.province].filter(Boolean).join(', ');
      void navigate('/client/payment', {
        state: {
          fulfillmentType: 'delivery',
          guestShipping: {
            recipientName: guestForm.recipientName,
            phone: guestForm.phone,
            email: guestForm.email || undefined,
            addressLine: guestForm.addressLine,
            ward: guestForm.ward || undefined,
            district: guestForm.district || undefined,
            province: guestForm.province,
          },
          deliveryId: selectedDeliveryId,
          shippingAddress: addrText,
          deliveryName: selectedDelivery?.name ?? '',
          shippingCost: shipping,
          note,
          discountCode: appliedDiscountCode || undefined,
          discountAmount: appliedDiscountAmount,
          subtotal,
          total,
        },
      });
      return;
    }
    if (isPickup) {
      if (!pickupContact.recipientName || !pickupContact.phone) return;
      void navigate('/client/payment', {
        state: {
          fulfillmentType: 'pickup',
          pickupContact,
          deliveryId: selectedDeliveryId,
          shippingAddress: `${pickupContact.recipientName}, ${pickupContact.phone}`,
          deliveryName: selectedDelivery.name,
          shippingCost: shipping,
          note,
          discountCode: appliedDiscountCode || undefined,
          discountAmount: appliedDiscountAmount,
          subtotal,
          total,
        },
      });
      return;
    }
    if (!selectedAddressId) return;
    const addr = addresses.find((a) => a.id === selectedAddressId);
    const addrText = addr
      ? [addr.recipientName, addr.phone, addr.addressLine, addr.ward, addr.district, addr.province]
          .filter(Boolean)
          .join(', ')
      : '';
    void navigate('/client/payment', {
      state: {
        fulfillmentType: 'delivery',
        shippingAddressId: selectedAddressId,
        deliveryId: selectedDeliveryId,
        shippingAddress: addrText,
        deliveryName: selectedDelivery?.name ?? '',
        shippingCost: shipping,
        note,
        discountCode: appliedDiscountCode || undefined,
        discountAmount: appliedDiscountAmount,
        subtotal,
        total,
      },
    });
  };

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        {/* Steps */}
        <div className="mb-8 flex items-center justify-center gap-3 text-sm">
          {[
            { label: 'Giỏ hàng', done: true },
            { label: 'Địa chỉ & Vận chuyển', active: true },
            { label: 'Thanh toán' },
            { label: 'Xác nhận' },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
              <span
                className={`text-sm font-semibold ${
                  step.done ? 'text-[#006241]' : step.active ? 'text-[#1E3932] font-black' : 'text-gray-400'
                }`}
              >
                {step.done ? '✓ ' : ''}{step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {hasBlockedItems || hasPriceChanges ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-black">Giỏ hàng vừa được kiểm tra lại</p>
                    <p className="mt-1 text-xs font-semibold text-orange-800/80">
                      {hasBlockedItems
                        ? 'Có sản phẩm hết hàng, ngừng bán hoặc vượt tồn kho. Vui lòng quay lại giỏ hàng để xử lý.'
                        : 'Một số sản phẩm có giá mới. Tổng tiền đang dùng giá hiện tại.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Addresses */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <MapPin size={20} className="text-[#006241]" /> {isPickup ? 'Thông tin người nhận tại cửa hàng' : 'Địa chỉ giao hàng'}
              </h2>

              {isPickup ? (
                <div className="client-card border-2 border-[#006241] p-5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#006241]">
                    Nhận tại cửa hàng
                  </p>
                  <p className="mb-4 text-xs text-gray-500">
                    Cửa hàng dùng thông tin này để xác nhận người đến nhận đơn.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">Họ và tên *</label>
                      <input
                        value={pickupContact.recipientName}
                        onChange={(event) => setPickupContact((current) => ({ ...current, recipientName: event.target.value }))}
                        placeholder="Nguyễn Văn A"
                        className="client-input w-full px-4 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">Số điện thoại *</label>
                      <input
                        value={pickupContact.phone}
                        onChange={(event) => setPickupContact((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="0901234567"
                        className="client-input w-full px-4 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ) : !session ? (
                <div className="client-card border-2 border-[#006241] p-5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#006241]">Đặt hàng với tư cách khách</p>
                  <p className="mb-4 text-xs text-gray-400">Thông tin giao hàng của bạn</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { key: 'recipientName', label: 'Họ và tên *', placeholder: 'Nguyễn Văn A' },
                      { key: 'phone', label: 'Số điện thoại *', placeholder: '0901234567' },
                      { key: 'email', label: 'Email (tùy chọn, nhận thông báo)', placeholder: 'email@example.com', span: true },
                      { key: 'addressLine', label: 'Địa chỉ cụ thể *', placeholder: '123 Đường ABC', span: true },
                      { key: 'ward', label: 'Phường/Xã', placeholder: 'Phường 5' },
                      { key: 'district', label: 'Quận/Huyện', placeholder: 'Quận 12' },
                    ] as Array<{ key: string; label: string; placeholder: string; span?: boolean }>).map((field) => (
                      <div key={field.key} className={field.span ? 'sm:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">{field.label}</label>
                        <input
                          value={guestForm[field.key as keyof typeof guestForm]}
                          onChange={(e) => setGuestForm((f) => ({ ...f, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="client-input w-full px-4 py-2.5 text-sm"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">Tỉnh/Thành phố *</label>
                      <select
                        value={guestForm.province}
                        onChange={(e) => setGuestForm((f) => ({ ...f, province: e.target.value }))}
                        className="client-input w-full px-4 py-2.5 text-sm"
                      >
                        <option value="">-- Chọn tỉnh/thành phố --</option>
                        {VIETNAM_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Đã có tài khoản?{' '}
                    <a href="/client/login" className="font-semibold text-[#006241] hover:underline">Đăng nhập</a>{' '}
                    để tích điểm và theo dõi đơn hàng dễ hơn.
                  </p>
                </div>
              ) : loadingAddresses ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#006241] border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => { setSelectedAddressId(addr.id); setAddingAddress(false); }}
                      className={`w-full rounded-xl border-2 p-4 text-left transition ${
                        selectedAddressId === addr.id && !addingAddress
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#1E3932]">{addr.recipientName}</p>
                            {addr.isDefault && (
                              <span className="rounded-full bg-[#006241]/10 px-2 py-0.5 text-[10px] font-black text-[#006241]">
                                Mặc định
                              </span>
                            )}
                            {addr.label && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                                {addr.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500">{addr.phone}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            {[addr.addressLine, addr.ward, addr.district, addr.province].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        {selectedAddressId === addr.id && !addingAddress && (
                          <Check size={18} className="shrink-0 text-[#006241]" />
                        )}
                      </div>
                    </button>
                  ))}

                  {!addingAddress ? (
                    <button
                      onClick={() => { setAddingAddress(true); setSelectedAddressId(null); }}
                      className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-[#006241]/20 bg-white px-5 py-4 text-sm font-semibold text-[#006241] transition hover:border-[#006241]/40"
                    >
                      <Plus size={16} /> Thêm địa chỉ mới
                    </button>
                  ) : (
                    <div className="client-card border-2 border-[#006241] p-5">
                      <h3 className="mb-4 font-bold text-[#1E3932]">Địa chỉ mới</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { key: 'recipientName', label: 'Họ và tên *', placeholder: 'Nguyễn Văn A' },
                          { key: 'phone', label: 'Số điện thoại *', placeholder: '0901234567' },
                          { key: 'addressLine', label: 'Địa chỉ cụ thể *', placeholder: '123 Đường ABC', span: true },
                          { key: 'ward', label: 'Phường/Xã', placeholder: 'Phường 5' },
                          { key: 'district', label: 'Quận/Huyện', placeholder: 'Quận 12' },
                          { key: 'label', label: 'Nhãn (tùy chọn)', placeholder: 'Nhà, Công ty...' },
                        ].map((field) => (
                          <div key={field.key} className={(field as { span?: boolean }).span ? 'sm:col-span-2' : ''}>
                            <label className="mb-1 block text-xs font-semibold text-gray-500">{field.label}</label>
                            <input
                              value={form[field.key as keyof typeof form]}
                              onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="client-input w-full px-4 py-2.5 text-sm"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-500">Tỉnh/Thành phố *</label>
                          <select
                            value={form.province}
                            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                            className="client-input w-full px-4 py-2.5 text-sm"
                          >
                            <option value="">-- Chọn tỉnh/thành phố --</option>
                            {VIETNAM_PROVINCES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => void handleSaveAddress()}
                          disabled={savingAddress}
                          className="client-pill-primary flex-1 py-2.5 text-sm font-bold disabled:opacity-60"
                        >
                          {savingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
                        </button>
                        <button
                          onClick={() => setAddingAddress(false)}
                          className="client-pill-dark-outline px-4 py-2.5 text-sm font-semibold"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery methods */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <Truck size={20} className="text-[#006241]" /> Phương thức nhận hàng
              </h2>
              {loadingDeliveryQuotes ? (
                <div className="client-card flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#006241] border-t-transparent" />
                </div>
              ) : deliveryQuoteError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {deliveryQuoteError}
                </div>
              ) : deliveryMethods.length === 0 ? (
                <div className="client-card p-4 text-sm text-gray-500">
                  Chưa có phương thức nhận hàng phù hợp. Vui lòng kiểm tra lại địa chỉ hoặc liên hệ cửa hàng.
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveryMethods.map((dm) => {
                    const reason = deliveryMethodReason(dm);
                    const eta =
                      dm.etaMinDays != null && dm.etaMaxDays != null
                        ? `${dm.etaMinDays}-${dm.etaMaxDays} ngày`
                        : null;
                    return (
                      <button
                        key={dm.id}
                        type="button"
                        onClick={() => dm.eligible && setSelectedDeliveryId(dm.id)}
                        disabled={!dm.eligible}
                        className={`w-full rounded-xl border-2 p-4 text-left transition ${
                          !dm.eligible
                            ? 'cursor-not-allowed border-transparent bg-white/65 opacity-75'
                            : selectedDeliveryId === dm.id
                              ? 'border-[#006241] bg-[#006241]/5'
                              : 'border-transparent bg-white hover:border-[#006241]/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-[#1E3932]">{dm.name}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                dm.type === 'pickup'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-[#d4e9e2] text-[#006241]'
                              }`}>
                                {dm.type === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao hàng'}
                              </span>
                            </div>
                            {dm.description && (
                              <p className="mt-1 text-xs text-gray-500">{dm.description}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500">
                              {eta ? <span>Dự kiến {eta}</span> : null}
                              {dm.freeShippingThreshold ? (
                                <span>Miễn phí từ {formatPrice(dm.freeShippingThreshold)}</span>
                              ) : null}
                              {dm.minOrderAmount > 0 ? (
                                <span>Đơn tối thiểu {formatPrice(dm.minOrderAmount)}</span>
                              ) : null}
                            </div>
                            {reason ? (
                              <p className="mt-1 text-xs font-bold text-orange-600">{reason}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <span className={`block text-sm font-black ${
                                dm.shippingFee === 0 ? 'text-[#006241]' : 'text-[#1E3932]'
                              }`}>
                                {dm.shippingFee === 0 ? 'Miễn phí' : formatPrice(dm.shippingFee)}
                              </span>
                              {dm.freeShippingApplied ? (
                                <span className="text-[10px] font-black text-[#006241]">Đã áp dụng</span>
                              ) : null}
                            </div>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                                selectedDeliveryId === dm.id
                                  ? 'border-[#006241] bg-[#006241]'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedDeliveryId === dm.id && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E3932]">
                Ghi chú đơn hàng (tùy chọn)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Hướng dẫn giao hàng, yêu cầu đặc biệt..."
                className="client-input w-full bg-white px-4 py-3 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Link
                to="/client/cart"
                className="client-pill-dark-outline flex items-center gap-2 px-5 py-3 text-sm font-semibold transition hover:border-[#006241] hover:text-[#006241]"
              >
                <ArrowLeft size={15} /> Quay lại giỏ hàng
              </Link>
              <button
                onClick={handleContinue}
                disabled={
                hasBlockedItems ||
                !selectedDeliveryId ||
                !selectedDelivery?.eligible ||
                loadingDeliveryQuotes ||
                (isPickup
                  ? (!pickupContact.recipientName || !pickupContact.phone)
                  : session
                    ? (!selectedAddressId || addingAddress)
                    : (!guestForm.recipientName || !guestForm.phone || !guestForm.addressLine || !guestForm.province))
              }
                className="client-pill-primary flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50"
              >
                Tiếp tục thanh toán <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="space-y-4">
            <div className="client-card p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E3932]">
                <Tag size={15} /> Voucher cho đơn này
              </p>

              {appliedDiscountCode ? (
                <div className="mb-3 rounded-xl border border-[#006241]/15 bg-[#d4e9e2]/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-[#006241]">
                        <CheckCircle2 size={16} /> {appliedDiscountCode}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#1E3932]/80">
                        Đang giảm {formatPrice(appliedDiscountAmount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedDiscountCode('');
                        setAppliedDiscountAmount(0);
                        setVoucherInput('');
                        setVoucherError('');
                      }}
                      className="text-xs font-bold text-gray-400 hover:text-red-500"
                    >
                      Đổi mã
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  value={voucherInput}
                  onChange={(event) => setVoucherInput(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void applyVoucher(voucherInput);
                  }}
                  placeholder="Nhập mã voucher"
                  className="client-input min-w-0 flex-1 px-4 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void applyVoucher(voucherInput)}
                  disabled={validatingVoucher || !voucherInput.trim()}
                  className="client-pill-primary px-4 py-2.5 text-sm font-bold disabled:opacity-60"
                >
                  {validatingVoucher ? '...' : 'Áp dụng'}
                </button>
              </div>
              {voucherError ? (
                <p className="mt-2 text-xs font-semibold text-red-500">
                  {voucherError}
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                {loadingVouchers ? (
                  <div className="rounded-xl bg-[#edebe9] px-4 py-5 text-center text-xs font-semibold text-gray-500">
                    Đang gợi ý voucher...
                  </div>
                ) : quickVouchers.length ? (
                  quickVouchers.map((voucher) => (
                    <div key={voucher.id}>
                      <CheckoutVoucherCard
                        voucher={voucher}
                        subtotal={subtotal}
                        selected={appliedDiscountCode === voucher.code}
                        onApply={() => void applyVoucher(voucher.code)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-[#edebe9] px-4 py-5 text-center text-xs font-semibold text-gray-500">
                    Chưa có voucher phù hợp.
                  </div>
                )}
              </div>
            </div>

            <div className="client-card p-5">
              <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                Đơn hàng ({cart.totalItems} sản phẩm)
              </p>
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0eb]">
                      {item.primaryImageUrl ? (
                        <img
                          src={item.primaryImageUrl}
                          alt={item.productName ?? ''}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Leaf size={18} className="text-[#006241]/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2 text-xs font-semibold text-[#1E3932]">
                        {item.productName}
                      </p>
                      <p className="text-xs text-gray-400">x{item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-[#006241]">
                      {formatPrice(Number(item.lineTotal))}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tạm tính</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>
                {appliedDiscountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giảm giá</span>
                    <span className="font-semibold text-red-500">-{formatPrice(appliedDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Vận chuyển</span>
                  <span className={`font-semibold ${shipping === 0 ? 'text-[#006241]' : ''}`}>
                    {selectedDelivery
                      ? shipping === 0 ? 'Miễn phí' : formatPrice(shipping)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-base">
                  <span className="font-black text-[#1E3932]">Tổng cộng</span>
                  <span className="font-black text-[#006241]">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutVoucherCard({
  voucher,
  subtotal,
  selected,
  onApply,
}: {
  voucher: Voucher;
  subtotal: number;
  selected: boolean;
  onApply: () => void;
}) {
  const eligible = Boolean(voucher.eligible);
  const progress = getVoucherProgress(voucher, subtotal);
  const missingAmount = voucherMissingAmount(voucher);

  return (
    <div
      className={`rounded-xl border p-3 ${
        selected
          ? 'border-[#006241] bg-[#d4e9e2]/45'
          : eligible
            ? 'border-[#006241]/15 bg-white'
            : 'border-black/6 bg-[#fbfaf7]'
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#006241] text-white">
          <BadgePercent size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#1E3932]">{voucher.code}</p>
              <p className="line-clamp-1 text-xs font-semibold text-gray-500">
                {voucher.name}
              </p>
            </div>
            <span className="rounded-full bg-[#d4e9e2] px-2 py-1 text-[11px] font-black text-[#006241]">
              {voucherValueLabel(voucher)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-[#00754A]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-gray-500">
              {eligible
                ? `Giảm ${money(voucherSavings(voucher))}`
                : `Mua thêm ${money(missingAmount)}`}
            </p>
            <button
              type="button"
              onClick={onApply}
              disabled={!eligible || selected}
              className="client-pill-primary px-3 py-1.5 text-[11px] font-black disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
            >
              {selected ? 'Đã chọn' : eligible ? 'Áp dụng' : 'Chưa đủ'}
            </button>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-gray-400">
            Hạn: {voucherExpiryLabel(voucher.expiresAt)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-gray-400">
            {voucherExpiryDateTimeLabel(voucher.expiresAt)} · {voucherRemainingUsesLabel(voucher)}
            {voucher.isSaved ? ' · Đã nhận' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
