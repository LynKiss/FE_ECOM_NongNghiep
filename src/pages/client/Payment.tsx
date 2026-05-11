import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Leaf,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Timer,
  Truck,
  X,
} from 'lucide-react';
import {
  DEFAULT_PUBLIC_PAYMENT_SETTINGS,
  PaymentMethodKey,
  PublicCommerceSettings,
  PublicPaymentSettings,
} from '../../lib/commerce-settings';
import { clientApi } from '../../lib/client-api';
import { clearGuestCart, refreshGlobalCart, useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';

type GuestShipping = {
  recipientName: string;
  phone: string;
  email?: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province: string;
};

type LocationState = {
  shippingAddressId?: string;
  guestShipping?: GuestShipping;
  deliveryId?: string;
  shippingAddress?: string;
  deliveryName?: string;
  shippingCost?: number;
  note?: string;
  discountCode?: string;
  discountAmount?: number;
  subtotal?: number;
  total?: number;
};

type CreateOrderResponse = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalPayment: string;
  totalQuantity: number;
  createdAt: string;
  address: string;
};

const PAYMENT_METHODS: Array<{
  id: PaymentMethodKey;
  label: string;
  desc: string;
  icon: typeof Truck;
  emoji: string;
  online: boolean;
  color?: string;
}> = [
  {
    id: 'cod',
    label: 'Thanh toán khi nhận hàng (COD)',
    desc: 'Trả tiền mặt khi nhận được hàng. Không phụ thu.',
    icon: Truck,
    emoji: '💵',
    online: false,
  },
  {
    id: 'bank_transfer',
    label: 'Chuyển khoản ngân hàng',
    desc: 'Chuyển khoản và đợi đối chiếu giao dịch.',
    icon: Banknote,
    emoji: '🏦',
    online: true,
    color: '#0065AC',
  },
  {
    id: 'momo',
    label: 'Ví MoMo',
    desc: 'Quét mã QR thanh toán nhanh qua ứng dụng MoMo.',
    icon: CreditCard,
    emoji: '📱',
    online: true,
    color: '#AE2070',
  },
  {
    id: 'vnpay',
    label: 'VNPay',
    desc: 'Thanh toán qua cổng VNPay.',
    icon: CreditCard,
    emoji: '💳',
    online: true,
    color: '#005BAA',
  },
  {
    id: 'zalopay',
    label: 'ZaloPay',
    desc: 'Thanh toán qua ứng dụng ZaloPay hoặc mã QR.',
    icon: CreditCard,
    emoji: '🔵',
    online: true,
    color: '#0068FF',
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

function mergePublicPaymentSettings(
  settings?: Partial<PublicPaymentSettings> | null,
): PublicPaymentSettings {
  return {
    ...DEFAULT_PUBLIC_PAYMENT_SETTINGS,
    ...(settings ?? {}),
    bank_transfer: {
      ...DEFAULT_PUBLIC_PAYMENT_SETTINGS.bank_transfer,
      ...(settings?.bank_transfer ?? {}),
    },
  };
}

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const { cart } = useCart();
  const state = (location.state as LocationState) || {};

  const [method, setMethod] = useState<PaymentMethodKey | 'credit'>('cod');
  const [placing, setPlacing] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings>(
    DEFAULT_PUBLIC_PAYMENT_SETTINGS,
  );
  const [creditLimit, setCreditLimit] = useState<{
    creditLimit: number;
    currentDebt: number;
    availableCredit: number;
    isActive: boolean;
  } | null>(null);
  const [success, setSuccess] = useState<{
    orderId: string;
    totalPayment: string;
    paymentMethod: PaymentMethodKey | 'credit';
    isBackorder?: boolean;
    isGuest?: boolean;
  } | null>(null);
  // Idempotency key — sinh 1 lần khi component mount, gửi cùng request /orders.
  // Nếu user double-click hoặc retry sau timeout, BE sẽ trả về order cũ thay vì tạo mới.
  const idempotencyKeyRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
  );
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simOrderId, setSimOrderId] = useState<string | null>(null);
  const [simRef, setSimRef] = useState<string | null>(null);
  const [simIsGuest, setSimIsGuest] = useState(false);
  const [simCountdown, setSimCountdown] = useState(600);
  const [simConfirming, setSimConfirming] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSettings(true);

    void clientApi
      .get<PublicCommerceSettings>('/settings/public/commerce')
      .then((data) => {
        if (!cancelled) {
          setPaymentSettings(mergePublicPaymentSettings(data.payments));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelledCredit = false;
    void clientApi
      .get<{ creditLimit: number; currentDebt: number; availableCredit: number; isActive: boolean } | null>(
        '/credit-limits/my-limit',
      )
      .then((data) => {
        if (!cancelledCredit) setCreditLimit(data);
      })
      .catch(() => {
        if (!cancelledCredit) setCreditLimit(null);
      });
    return () => {
      cancelledCredit = true;
    };
  }, [session]);

  const availableMethods = PAYMENT_METHODS.filter(
    (paymentMethod) => paymentSettings[paymentMethod.id]?.isActive,
  );

  const isCreditAvailable = !!session && creditLimit !== null && creditLimit.isActive;

  useEffect(() => {
    if (!availableMethods.length && !isCreditAvailable) return;
    if (method === 'credit') return;
    if (!availableMethods.some((paymentMethod) => paymentMethod.id === method)) {
      if (availableMethods.length > 0) setMethod(availableMethods[0].id);
    }
  }, [availableMethods, isCreditAvailable, method]);

  useEffect(() => {
    if (simulateOpen) {
      setSimCountdown(600);
      countdownRef.current = setInterval(() => {
        setSimCountdown((current) => {
          if (current <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            setSimulateOpen(false);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } else if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [simulateOpen]);

  const isGuest = !session;

  if (!state.deliveryId || (!state.shippingAddressId && !state.guestShipping)) {
    void navigate('/client/checkout');
    return null;
  }

  const subtotal = state.subtotal ?? Number(cart?.totalAmount ?? 0);
  const discountAmount = state.discountAmount ?? 0;
  const shipping = state.shippingCost ?? 0;
  const total = state.total ?? subtotal - discountAmount + shipping;

  const handleConfirmSimPayment = async () => {
    if (!simOrderId || !simRef) {
      return;
    }

    setSimConfirming(true);
    try {
      await clientApi.post(`/payments/callback/${method}`, {
        orderId: simOrderId,
        transactionRef: simRef,
        success: true,
        amount: String(total),
        gatewayCode: 'DEMO_SUCCESS',
        gatewayMessage: 'Thanh toán thành công (demo)',
        rawPayload: { demo: true },
      });
      setSimulateOpen(false);
      setSuccess({
        orderId: simOrderId,
        totalPayment: String(total),
        paymentMethod: method,
        isGuest: simIsGuest,
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Xac nhan thanh toan that bai. Vui long thu lai.',
      );
    } finally {
      setSimConfirming(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!availableMethods.length) {
      alert('Hiện tại không có phương thức thanh toán nào khả dụng.');
      return;
    }

    setPlacing(true);
    try {
      let order: CreateOrderResponse;

      if (isGuest) {
        if (!cart?.items.length || !state.guestShipping) {
          alert('Giỏ hàng trống hoặc thiếu thông tin giao hàng.');
          return;
        }
        order = await clientApi.post<CreateOrderResponse>(
          '/orders/guest',
          {
            shipping: state.guestShipping,
            deliveryId: state.deliveryId,
            paymentMethod: method,
            note: state.note || undefined,
            discountCode: state.discountCode || undefined,
            items: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
          { 'X-Idempotency-Key': idempotencyKeyRef.current },
        );
        clearGuestCart();
        const selectedMethod = PAYMENT_METHODS.find(
          (paymentMethod) => paymentMethod.id === method,
        );
        if (selectedMethod?.online) {
          try {
            const returnUrl = `${window.location.origin}/client/payment`;
            const paymentTransaction = await clientApi.post<{
              transactionRef: string;
              paymentUrl: string;
            }>(`/payments/guest/orders/${order.id}/initiate`, {
              returnUrl,
              phone: state.guestShipping.phone,
            });

            if (
              paymentTransaction.paymentUrl &&
              !paymentTransaction.paymentUrl.includes('payment-gateway.local')
            ) {
              window.location.href = paymentTransaction.paymentUrl;
              return;
            }

            setSimRef(paymentTransaction.transactionRef);
          } catch {
            setSimRef(`${order.id}-${Date.now()}`);
          }

          setSimOrderId(order.id);
          setSimIsGuest(true);
          setSimulateOpen(true);
          return;
        }

        setSuccess({ orderId: order.id, totalPayment: order.totalPayment, paymentMethod: method, isGuest: true });
        return;
      }

      order = await clientApi.post<CreateOrderResponse>(
        '/orders',
        {
          shippingAddressId: state.shippingAddressId,
          deliveryId: state.deliveryId,
          paymentMethod: method,
          note: state.note || undefined,
          discountCode: state.discountCode || undefined,
        },
        { 'X-Idempotency-Key': idempotencyKeyRef.current },
      );

      await refreshGlobalCart();

      const selectedMethod = PAYMENT_METHODS.find(
        (paymentMethod) => paymentMethod.id === method,
      );
      if (selectedMethod?.online) {
        try {
          const returnUrl = `${window.location.origin}/client/orders/${order.id}`;
          const paymentTransaction = await clientApi.post<{
            transactionRef: string;
            paymentUrl: string;
          }>(`/payments/orders/${order.id}/initiate`, { returnUrl });

          if (
            paymentTransaction.paymentUrl &&
            !paymentTransaction.paymentUrl.includes('payment-gateway.local')
          ) {
            window.location.href = paymentTransaction.paymentUrl;
            return;
          }

          setSimRef(paymentTransaction.transactionRef);
        } catch {
          setSimRef(`${order.id}-${Date.now()}`);
        }

        setSimOrderId(order.id);
        setSimIsGuest(false);
        setSimulateOpen(true);
      } else {
        setSuccess({
          orderId: order.id,
          totalPayment: order.totalPayment,
          paymentMethod: method,
        });
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Đặt hàng thất bại. Vui lòng thử lại.',
      );
    } finally {
      setPlacing(false);
    }
  };

  const selectedMethodInfo =
    availableMethods.find((paymentMethod) => paymentMethod.id === method) ??
    PAYMENT_METHODS.find((paymentMethod) => paymentMethod.id === method);
  const bankTransferConfig = paymentSettings.bank_transfer;
  const fmtCountdown = `${String(Math.floor(simCountdown / 60)).padStart(
    2,
    '0',
  )}:${String(simCountdown % 60).padStart(2, '0')}`;

  if (success) {
    return (
      <div
        style={{ background: '#f2f0eb', minHeight: '80vh' }}
        className="flex items-center justify-center px-4"
      >
        <div className="w-full max-w-md text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: '#d4e9e2' }}
          >
            <CheckCircle2 size={40} className="text-[#006241]" />
          </div>
          <h1 className="text-2xl font-black text-[#1E3932]">
            Đặt hàng thành công!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Cảm ơn bạn đã tin tưởng Cultivated Ledger. Chúng tôi sẽ xử lý đơn
            hàng của bạn sớm nhất.
          </p>

          <div className="mt-6 rounded-2xl bg-white p-5 text-left shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Tổng thanh toán
              </p>
              <p className="text-xl font-black text-[#006241]">
                {formatPrice(Number(success.totalPayment))}
              </p>
            </div>

            {success.paymentMethod === 'cod' && (
              <p className="text-sm text-gray-600">
                Vui lòng chuẩn bị{' '}
                <span className="font-bold text-[#1E3932]">
                  {formatPrice(Number(success.totalPayment))}
                </span>{' '}
                khi nhận hàng.
              </p>
            )}

            {success.paymentMethod === 'bank_transfer' && (
              <div className="rounded-xl bg-[#f2f0eb] p-3">
                <p className="text-xs font-bold text-[#1E3932]">
                  Thông tin chuyển khoản:
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Ngân hàng: {bankTransferConfig.bankName || 'Đang cập nhật'}
                  <br />
                  STK:{' '}
                  {bankTransferConfig.accountNumber || 'Đang cập nhật'}
                  <br />
                  Chu TK:{' '}
                  {bankTransferConfig.accountHolder || 'Đang cập nhật'}
                  <br />
                  Nội dung: DH{success.orderId.slice(-8).toUpperCase()}
                </p>
              </div>
            )}

            {success.paymentMethod === 'momo' && (
              <div className="rounded-xl bg-pink-50 p-3 text-sm text-pink-800">
                Đã xác nhận thanh toán MoMo thành công.
              </div>
            )}
            {success.paymentMethod === 'vnpay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                Đã xác nhận thanh toán VNPay thành công.
              </div>
            )}
            {success.paymentMethod === 'zalopay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                Đã xác nhận thanh toán ZaloPay thành công.
              </div>
            )}

            {success.paymentMethod === 'credit' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-bold">Đơn hàng mua nợ đã được ghi nhận.</p>
                <p className="mt-1">Vui lòng thanh toán công nợ theo thỏa thuận với cửa hàng.</p>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">
              Đơn hàng sẽ được giao trong 2-4 ngày làm việc. Bạn có thể theo dõi
              trong mục đơn hàng.
            </p>
          </div>

          {success.isGuest && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="text-xs font-bold text-amber-700">Lưu lại thông tin đơn hàng</p>
              <p className="mt-1 text-sm font-black text-[#1E3932]">Mã đơn: #{success.orderId.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500">Dùng mã đơn + số điện thoại để tra cứu trạng thái đơn hàng.</p>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {!success.isGuest && (
              <Link
                to={`/client/orders/${success.orderId}`}
                className="flex-1 rounded-full border border-[#006241] py-3 text-sm font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white"
              >
                Xem đơn hàng
              </Link>
            )}
            <Link
              to="/client"
              className={`rounded-full py-3 text-sm font-bold text-white transition active:scale-95 ${success.isGuest ? 'flex-1' : ''}`}
              style={{ background: '#00754A' }}
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {simulateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="client-card w-full max-w-sm overflow-hidden">
            <div
              className="px-6 py-5 text-center text-white"
              style={{ background: selectedMethodInfo?.color ?? '#1E3932' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-black">
                  {selectedMethodInfo?.emoji} {selectedMethodInfo?.label}
                </p>
                <button
                  onClick={() => setSimulateOpen(false)}
                  className="rounded-xl p-1.5 transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-sm text-white/70">Dang cho thanh toan...</p>
            </div>

            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
                <div className="grid grid-cols-7 gap-0.5 p-2">
                  {Array.from({ length: 49 }).map((_, index) => {
                    const pattern = [
                      0, 1, 2, 8, 9, 11, 14, 16, 18, 22, 24, 25, 26, 28, 30,
                      32, 36, 38, 40, 42, 44, 45, 46, 47, 48,
                    ];
                    return (
                      <div
                        key={index}
                        className={`h-5 w-5 rounded-sm ${
                          pattern.includes(index)
                            ? 'bg-gray-800'
                            : 'bg-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-gray-500">Quet ma QR de thanh toan</p>
              <p className="mt-1 text-xl font-black text-[#1E3932]">
                {formatPrice(total)}
              </p>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-orange-500">
                <Timer size={15} />
                <span>Het han sau {fmtCountdown}</span>
              </div>

              {simRef && (
                <p className="mt-2 text-[11px] text-gray-400">
                  Ma GD: {simRef.slice(-12).toUpperCase()}
                </p>
              )}

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => void handleConfirmSimPayment()}
                  disabled={simConfirming}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
                  style={{ background: selectedMethodInfo?.color ?? '#006241' }}
                >
                  {simConfirming ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Xac nhan da thanh toan (Demo)
                </button>
                <button
                  onClick={() => setSimulateOpen(false)}
                  className="w-full rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
                >
                  Huy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
        <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
          <div className="mb-8 flex items-center justify-center gap-3 text-sm">
            {[
              { label: 'Giỏ hàng', done: true },
              { label: 'Địa chỉ & Vận chuyển', done: true },
              { label: 'Thanh toán', active: true },
              { label: 'Xác nhận' },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight size={14} className="text-gray-300" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    step.done
                      ? 'text-[#006241]'
                      : step.active
                        ? 'font-black text-[#1E3932]'
                        : 'text-gray-400'
                  }`}
                >
                  {step.done ? '✓ ' : ''}
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <CreditCard size={20} className="text-[#006241]" /> Phương thức
                thanh toán
              </h2>

              {loadingSettings ? (
                <div className="flex justify-center rounded-2xl bg-white py-12">
                  <LoaderCircle size={22} className="animate-spin text-[#006241]" />
                </div>
              ) : availableMethods.length === 0 && !isCreditAvailable ? (
                <div className="rounded-2xl bg-white p-5 text-sm text-gray-500">
                  Hiện tại admin đã tắt tất cả phương thức thanh toán. Vui lòng
                  liên hệ cửa hàng để được hỗ trợ.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableMethods.map((paymentMethod) => (
                    <button
                      key={paymentMethod.id}
                      onClick={() => setMethod(paymentMethod.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${
                        method === paymentMethod.id
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/20'
                      }`}
                    >
                      <span className="mt-0.5 text-2xl">
                        {paymentMethod.emoji}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-[#1E3932]">
                          {paymentMethod.label}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {paymentSettings[paymentMethod.id]?.description ||
                            paymentMethod.desc}
                        </p>
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          method === paymentMethod.id
                            ? 'border-[#006241] bg-[#006241]'
                            : 'border-gray-300'
                        }`}
                      >
                        {method === paymentMethod.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  ))}

                  {isCreditAvailable && creditLimit && (
                    <button
                      onClick={() => setMethod('credit')}
                      className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${
                        method === 'credit'
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/20'
                      }`}
                    >
                      <span className="mt-0.5 text-2xl">📋</span>
                      <div className="flex-1">
                        <p className="font-bold text-[#1E3932]">Mua nợ (Công nợ khách sỉ)</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Nhận hàng trước, thanh toán sau theo thỏa thuận với cửa hàng.
                        </p>
                        <p className="mt-1 text-xs font-semibold text-amber-600">
                          Hạn mức còn lại: {formatPrice(creditLimit.availableCredit)} / {formatPrice(creditLimit.creditLimit)}
                        </p>
                        {total > creditLimit.availableCredit && (
                          <p className="mt-0.5 text-xs font-bold text-red-500">
                            Không đủ hạn mức cho đơn hàng này!
                          </p>
                        )}
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          method === 'credit'
                            ? 'border-[#006241] bg-[#006241]'
                            : 'border-gray-300'
                        }`}
                      >
                        {method === 'credit' && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  )}
                </div>
              )}

              {(state.shippingAddress || state.deliveryName) && (
                <div className="mt-4 space-y-2 rounded-2xl bg-white p-4">
                  {state.shippingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-[#006241]"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Địa chỉ nhận hàng
                        </p>
                        <p className="text-sm text-[#1E3932]">
                          {state.shippingAddress}
                        </p>
                      </div>
                    </div>
                  )}

                  {state.deliveryName && (
                    <div className="flex items-start gap-2">
                      <Truck
                        size={15}
                        className="mt-0.5 shrink-0 text-[#006241]"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Phương thức vận chuyển
                        </p>
                        <p className="text-sm text-[#1E3932]">
                          {state.deliveryName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#d4e9e2] p-4 text-sm text-[#1E3932]">
                <ShieldCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-[#006241]"
                />
                <p>
                  Thông tin thanh toán của bạn được bảo mật. Chúng tôi không lưu
                  trữ thông tin thẻ.
                </p>
              </div>

              <div className="mt-4 flex gap-3">
                <Link
                  to="/client/checkout"
                  className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-gray-500 hover:text-[#006241]"
                >
                  <ArrowLeft size={15} /> Quay lại
                </Link>
                <button
                  onClick={() => void handlePlaceOrder()}
                  disabled={
                    placing ||
                    loadingSettings ||
                    (!availableMethods.length && !isCreditAvailable) ||
                    (method === 'credit' && creditLimit !== null && total > creditLimit.availableCredit)
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-95"
                  style={{ background: '#00754A' }}
                >
                  {placing ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : null}
                  {placing
                    ? 'Đang xử lý...'
                    : `Đặt hàng · ${formatPrice(total)}`}
                </button>
              </div>
            </div>

            <div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                  Xác nhận đơn hàng
                </p>
                {cart && (
                  <div className="max-h-52 space-y-3 overflow-y-auto">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0eb]">
                          {item.primaryImageUrl ? (
                            <img
                              src={item.primaryImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Leaf
                                size={18}
                                className="text-[#006241]/30"
                              />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-semibold text-[#1E3932]">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-400">
                            x{item.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-bold text-[#006241]">
                          {formatPrice(Number(item.lineTotal))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tạm tính</span>
                    <span className="font-semibold">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Giảm giá{state.discountCode ? ` (${state.discountCode})` : ''}
                      </span>
                      <span className="font-semibold text-red-500">
                        -{formatPrice(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vận chuyển</span>
                    <span
                      className={`font-semibold ${
                        shipping === 0 ? 'text-[#006241]' : ''
                      }`}
                    >
                      {shipping === 0 ? 'Miễn phí' : formatPrice(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
                    <span className="text-[#1E3932]">Tổng cộng</span>
                    <span className="text-[#006241]">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
