import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Leaf,
  LoaderCircle,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import {
  TRACKING_MODE_LABELS,
  TRACKING_SOURCE_LABELS,
  type OrderTracking,
} from '../../lib/order-tracking';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  primaryImageUrl: string | null;
  quantity: number;
  quantityDelivered?: number;
  returnableQuantity?: number;
  returnedQuantity?: number;
  returnDeadline?: string | null;
  canCreateReturn?: boolean;
  returnBlockedReason?: string | null;
  unitPrice: number;
  lineTotal: number;
};

type OrderDetailResponse = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDeadline?: string | null;
  paymentTimeRemainingSeconds?: number | null;
  canRetryPayment?: boolean;
  canCancelUnpaid?: boolean;
  paymentBlockedReason?: string | null;
  totalPayment: string;
  totalQuantity: number;
  subtotalAmount: string;
  discountAmount: string;
  deliveryCost: string;
  fulfillmentType: 'delivery' | 'pickup';
  deliveryMethodName: string | null;
  freeShippingApplied: boolean;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  fullName: string;
  phone: string;
  address: string;
  note: string | null;
  createdAt: string;
  returnWindowDays?: number;
  returnDeadline?: string | null;
  canCreateReturn?: boolean;
  returnBlockedReason?: string | null;
  items: OrderItem[];
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipping', 'delivered'];

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    icon: FC<{ size?: number; className?: string }>;
  }
> = {
  pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7', icon: Clock },
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#dbeafe', icon: CheckCircle2 },
  processing: { label: 'Đang xử lý', color: '#6d28d9', bg: '#ede9fe', icon: Package },
  shipping: { label: 'Đang giao hàng', color: '#0369a1', bg: '#e0f2fe', icon: Truck },
  delivered: { label: 'Đã giao thành công', color: '#15803d', bg: '#dcfce7', icon: CheckCircle2 },
  cancelled: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2', icon: XCircle },
  returned: { label: 'Đã trả hàng', color: '#9f1239', bg: '#ffe4e6', icon: AlertCircle },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: '#b45309' },
  paid: { label: 'Đã thanh toán', color: '#15803d' },
  failed: { label: 'Thanh toán thất bại', color: '#dc2626' },
  partial_refunded: { label: 'Hoàn tiền một phần', color: '#b45309' },
  refunded: { label: 'Đã hoàn tiền', color: '#6d28d9' },
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTrackingTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function getMapEmbedUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${
    longitude - 0.03
  },${latitude - 0.03},${longitude + 0.03},${latitude + 0.03}&layer=mapnik&marker=${latitude},${longitude}`;
}

function getReturnBlockedMessage(reason?: string | null) {
  if (reason === 'RETURN_WINDOW_EXPIRED') return 'Đã quá hạn 7 ngày kể từ khi nhận hàng.';
  if (reason === 'RETURN_NOT_DELIVERED_YET') return 'Chỉ tạo trả hàng sau khi đơn đã được giao.';
  return 'Hiện chưa thể tạo yêu cầu trả hàng cho đơn này.';
}

function formatCountdown(seconds?: number | null) {
  const safeSeconds = Math.max(0, Number(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes <= 0) return `${remainingSeconds} giây`;
  return `${minutes} phút ${remainingSeconds.toString().padStart(2, '0')} giây`;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useClientSession();

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const momoVerifiedRef = useRef(false);
  const vnpayVerifiedRef = useRef(false);

  // Return / Short-delivery modals
  type ReturnReason = 'damaged' | 'wrong_item' | 'quality' | 'other';
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [shortDeliveryModalOpen, setShortDeliveryModalOpen] = useState(false);
  const [returnItemId, setReturnItemId] = useState<string>('');
  const [returnQuantity, setReturnQuantity] = useState('1');
  const [returnReason, setReturnReason] = useState<ReturnReason>('damaged');
  const [returnDescription, setReturnDescription] = useState('');
  const [shortQuantities, setShortQuantities] = useState<Record<string, string>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const { addItem } = useCart();
  const { showToast } = useToast();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();

  const shouldShowTracking =
    order?.fulfillmentType !== 'pickup' &&
    (order?.status === 'shipping' || order?.status === 'delivered');
  const activeMapPoint = tracking?.activeLocation ?? tracking?.manualLocation ?? tracking?.gpsLocation ?? null;

  const handleReorder = async () => {
    if (!order?.items?.length || selectedItems.size === 0) return;
    setReordering(true);
    const itemsToAdd = order.items.filter((i) => selectedItems.has(i.id));
    let added = 0;
    let skipped = 0;
    try {
      for (const item of itemsToAdd) {
        try {
          await addItem(item.productId, item.quantity);
          added++;
        } catch {
          skipped++;
        }
      }
      if (added > 0 && skipped === 0) {
        showToast({ tone: 'success', title: 'Đã thêm vào giỏ hàng', description: `${added} sản phẩm đã được thêm.` });
      } else if (added > 0 && skipped > 0) {
        showToast({ tone: 'warning', title: 'Thêm một phần', description: `${added} sản phẩm đã thêm, ${skipped} không còn khả dụng.` });
      } else {
        showToast({ tone: 'error', title: 'Không thể thêm', description: 'Sản phẩm đã chọn hiện không còn bán.' });
      }
      if (added > 0) navigate('/client/cart');
    } finally {
      setReordering(false);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const refreshOrder = async (orderId: string, silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await clientApi.get<OrderDetailResponse>(`/users/me/orders/${orderId}`);
      setOrder(data);
      const canReorder = data.status === 'delivered' || data.status === 'cancelled' || data.status === 'returned';
      if (canReorder && data.items?.length) {
        setSelectedItems(new Set(data.items.map((i) => i.id)));
      }
    } catch {
      if (!silent) {
        void navigate('/client/orders');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const refreshTracking = async (orderId: string, silent = false) => {
    if (!silent) {
      setTrackingLoading(true);
    }

    try {
      const data = await clientApi.get<OrderTracking>(`/orders/${orderId}/tracking`);
      setTracking(data);
    } catch {
      if (!silent) {
        setTracking(null);
      }
    } finally {
      if (!silent) {
        setTrackingLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!session) {
      void navigate('/client/login');
      return;
    }
    if (!id) return;
    void refreshOrder(id);
  }, [session, id, navigate]);

  useEffect(() => {
    const resultCode = searchParams.get('resultCode');
    const requestId = searchParams.get('requestId');
    if (resultCode === null || !requestId || momoVerifiedRef.current) return;
    momoVerifiedRef.current = true;

    void clientApi
      .post('/payments/momo/verify', {
        orderId: searchParams.get('orderId'),
        requestId,
        resultCode: Number(resultCode),
        transId: searchParams.get('transId') ? Number(searchParams.get('transId')) : undefined,
        amount: searchParams.get('amount') ? Number(searchParams.get('amount')) : undefined,
        message: searchParams.get('message') ?? '',
        partnerCode: searchParams.get('partnerCode') ?? '',
        orderInfo: searchParams.get('orderInfo') ?? '',
        orderType: searchParams.get('orderType') ?? '',
        payType: searchParams.get('payType') ?? '',
        responseTime: searchParams.get('responseTime') ?? '',
        extraData: searchParams.get('extraData') ?? '',
        signature: searchParams.get('signature') ?? '',
      })
      .then(() => {
        if (id) {
          void refreshOrder(id, true);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams({}, { replace: true });
      });
  }, [id, searchParams, setSearchParams]);

  useEffect(() => {
    const vnpTxnRef = searchParams.get('vnp_TxnRef');
    const vnpSecureHash = searchParams.get('vnp_SecureHash');
    if (!vnpTxnRef || !vnpSecureHash || vnpayVerifiedRef.current) return;
    vnpayVerifiedRef.current = true;

    void clientApi
      .get(`/payments/vnpay/return?${searchParams.toString()}`)
      .then(() => {
        if (id) {
          void refreshOrder(id, true);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams({}, { replace: true });
      });
  }, [id, searchParams, setSearchParams]);

  useEffect(() => {
    if (!id || !shouldShowTracking) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) {
        return;
      }
      await Promise.all([refreshTracking(id, true), refreshOrder(id, true)]);
    };

    setTrackingLoading(true);
    void clientApi
      .get<OrderTracking>(`/orders/${id}/tracking`)
      .then((data) => {
        if (!cancelled) {
          setTracking(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTracking(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTrackingLoading(false);
        }
      });

    intervalId = setInterval(() => {
      void tick();
    }, 5_000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [id, shouldShowTracking]);

  const confirmReceived = async () => {
    if (!order || !id) return;
    const ok = await askConfirm({
      title: 'Xác nhận đã nhận hàng?',
      description: 'Sau khi xác nhận, đơn sẽ được ghi nhận là đã giao thành công và có thể mở quyền đánh giá/trả hàng theo chính sách.',
      tone: 'success',
      confirmLabel: 'Đã nhận hàng',
    });
    if (!ok) return;
    setConfirmingReceived(true);
    try {
      await clientApi.patch(`/orders/${id}/confirm-received`);
      await refreshOrder(id, false);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể xác nhận đã nhận hàng',
        description: error instanceof Error ? error.message : 'Vui lòng thử lại.',
      });
    } finally {
      setConfirmingReceived(false);
    }
  };

  const openReturnModal = () => {
    if (!order?.items?.length) return;
    if (!order.canCreateReturn) {
      showToast({
        tone: 'warning',
        title: 'Chưa thể tạo yêu cầu trả hàng',
        description: getReturnBlockedMessage(order.returnBlockedReason),
      });
      return;
    }
    const target = order.items.find((item) => Number(item.returnableQuantity ?? item.quantity) > 0);
    if (!target) {
      showToast({ tone: 'warning', title: 'Không còn sản phẩm có thể trả' });
      return;
    }
    setReturnItemId(target.id);
    setReturnQuantity('1');
    setReturnReason('damaged');
    setReturnDescription('');
    setReturnModalOpen(true);
  };

  const submitReturnRequest = async () => {
    if (!order || !returnItemId) return;
    const selectedReturnItem = order.items.find((item) => item.id === returnItemId);
    const quantity = Number(returnQuantity);
    if (
      !selectedReturnItem ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > Number(selectedReturnItem.returnableQuantity ?? selectedReturnItem.quantity)
    ) {
      showToast({
        tone: 'error',
        title: 'Số lượng trả không hợp lệ',
        description: 'Số lượng trả phải nằm trong số lượng đã mua của dòng hàng.',
      });
      return;
    }
    if (!returnDescription.trim()) {
      showToast({ tone: 'error', title: 'Thiếu thông tin', description: 'Vui lòng mô tả chi tiết vấn đề.' });
      return;
    }
    setSubmittingReturn(true);
    try {
      await clientApi.post('/returns', {
        orderId: order.id,
        orderItemId: returnItemId,
        returnQuantity: quantity,
        reason: returnReason,
        description: returnDescription.trim(),
      });
      showToast({ tone: 'success', title: 'Đã gửi yêu cầu trả hàng', description: 'Chúng tôi sẽ liên hệ trong 24h.' });
      setReturnModalOpen(false);
      await refreshOrder(order.id, true);
    } catch (error) {
      showToast({ tone: 'error', title: 'Không gửi được', description: error instanceof Error ? error.message : '' });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const openShortDeliveryModal = () => {
    if (!order?.items?.length) return;
    const initial: Record<string, string> = {};
    for (const it of order.items) initial[it.id] = String(it.quantity);
    setShortQuantities(initial);
    setShortDeliveryModalOpen(true);
  };

  const submitShortDelivery = async () => {
    if (!order) return;
    // Lọc các item nhận thiếu (qty thực nhận < qty đặt)
    const shortItems = order.items
      .map((it) => ({ item: it, actual: Number(shortQuantities[it.id] ?? it.quantity) }))
      .filter((x) => x.actual >= 0 && x.actual < x.item.quantity);

    if (shortItems.length === 0) {
      showToast({ tone: 'error', title: 'Chưa khai báo thiếu', description: 'Hãy nhập số lượng thực nhận nhỏ hơn số đã đặt.' });
      return;
    }
    setSubmittingReturn(true);
    try {
      for (const { item, actual } of shortItems) {
        const missing = item.quantity - actual;
        await clientApi.post('/returns', {
          orderId: order.id,
          orderItemId: item.id,
          returnQuantity: missing,
          reason: 'short_delivery',
          description: `Đã nhận ${actual}/${item.quantity}, thiếu ${missing} ${item.productName}.`,
        });
      }
      showToast({ tone: 'success', title: 'Đã báo nhận thiếu', description: `${shortItems.length} sản phẩm — chờ admin xác nhận.` });
      setShortDeliveryModalOpen(false);
      await refreshOrder(order.id, true);
    } catch (error) {
      showToast({ tone: 'error', title: 'Không gửi được', description: error instanceof Error ? error.message : '' });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const statusInfo = useMemo(() => {
    if (!order) return STATUS_CONFIG.pending;
    return STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  }, [order]);

  if (loading) {
    return (
      <div
        style={{ background: '#f2f0eb', minHeight: '60vh' }}
        className="flex items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  if (!order) return null;

  const StatusIcon = statusInfo.icon;
  const isCancelled = order.status === 'cancelled' || order.status === 'returned';
  const isDelivered = order.status === 'delivered';
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const shortId = order.id.slice(-8).toUpperCase();
  const paymentStatusInfo = PAYMENT_STATUS_LABELS[order.paymentStatus] ?? {
    label: order.paymentStatus,
    color: '#374151',
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryingPayment(true);
    try {
      const returnUrl = `${window.location.origin}/client/orders/${order.id}`;
      const paymentTransaction = await clientApi.post<{
        transactionRef: string;
        paymentUrl: string;
        expiresAt?: string;
      }>(`/payments/orders/${order.id}/initiate`, { returnUrl });

      if (
        paymentTransaction.paymentUrl &&
        !paymentTransaction.paymentUrl.includes('payment-gateway.local')
      ) {
        window.location.href = paymentTransaction.paymentUrl;
        return;
      }

      showToast({
        tone: 'warning',
        title: 'Cổng thanh toán chưa sẵn sàng',
        description: 'Không lấy được đường dẫn thanh toán. Vui lòng thử lại sau hoặc chọn hỗ trợ.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showToast({
        tone: 'error',
        title: 'Không thể thanh toán lại',
        description:
          message || 'Đơn hàng đã quá hạn hoặc hiện không thể tạo giao dịch thanh toán mới.',
      });
      await refreshOrder(order.id, true);
    } finally {
      setRetryingPayment(false);
    }
  };
  const isPickup = order.fulfillmentType === 'pickup';
  const isOnlinePayment = ['momo', 'vnpay', 'zalopay'].includes(order.paymentMethod);
  const canRetryPayment = Boolean(order.canRetryPayment);
  const canCancelUnpaid = Boolean(order.canCancelUnpaid);
  const isPaymentExpired =
    order.paymentBlockedReason === 'PAYMENT_EXPIRED' ||
    (isOnlinePayment &&
      ['unpaid', 'failed'].includes(order.paymentStatus) &&
      Number(order.paymentTimeRemainingSeconds ?? 0) <= 0);

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      {ConfirmDialog}
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/client/orders"
              className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#006241] hover:underline"
            >
              <ArrowLeft size={14} /> Lịch sử đơn hàng
            </Link>
            <h1 className="text-2xl font-black text-[#1E3932]">Đơn hàng #{shortId}</h1>
            <p className="mt-1 text-xs text-gray-400">{formatDate(order.createdAt)}</p>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black"
            style={{ background: statusInfo.bg, color: statusInfo.color }}
          >
            <StatusIcon size={16} />
            {statusInfo.label}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {shouldShowTracking && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-400">
                    <Navigation size={13} /> Theo dõi giao hàng realtime
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-on-surface-variant">
                      {tracking ? TRACKING_MODE_LABELS[tracking.mode] : 'No mode'}
                    </span>
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-on-surface-variant">
                      {tracking ? TRACKING_SOURCE_LABELS[tracking.activeSource] : 'No signal'}
                    </span>
                    {tracking?.activeSource === 'gps' && tracking.gpsSignalFresh ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        Live
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  className="relative mx-5 mb-5 overflow-hidden rounded-xl bg-gray-100"
                  style={{ height: 260 }}
                >
                  {trackingLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <LoaderCircle size={20} className="animate-spin text-gray-400" />
                    </div>
                  ) : activeMapPoint ? (
                    <iframe
                      title="delivery-map"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={getMapEmbedUrl(activeMapPoint.latitude, activeMapPoint.longitude)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                      <MapPin size={28} />
                      <p className="text-xs">Chưa có vị trí giao hàng</p>
                    </div>
                  )}

                  {activeMapPoint ? (
                    <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1E3932] shadow backdrop-blur">
                      <span className="mr-1.5">Lat/Lng:</span>
                      {activeMapPoint.latitude}, {activeMapPoint.longitude}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-px bg-black/5 md:grid-cols-4">
                  <TrackingStat
                    label="Nguồn"
                    value={tracking ? TRACKING_SOURCE_LABELS[tracking.activeSource] : '-'}
                  />
                  <TrackingStat
                    label="Cập nhật"
                    value={tracking ? formatTrackingTime(tracking.activeLocation?.updatedAt ?? null) : '-'}
                  />
                  <TrackingStat
                    label="Tốc độ"
                    value={
                      tracking?.activeLocation?.speedKph !== null &&
                      tracking?.activeLocation?.speedKph !== undefined
                        ? `${tracking.activeLocation.speedKph} km/h`
                        : '-'
                    }
                  />
                  <TrackingStat
                    label="GPS fresh"
                    value={tracking?.gpsSignalFresh ? 'Yes' : 'No'}
                  />
                </div>

                {tracking?.activeLocation?.note ? (
                  <div className="border-t border-black/5 px-5 py-4 text-sm text-on-surface-variant">
                    {tracking.activeLocation.note}
                  </div>
                ) : null}
              </div>
            )}

            {!isCancelled && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-5 text-sm font-black uppercase tracking-wider text-gray-400">
                  Trạng thái đơn hàng
                </h3>
                <div className="relative">
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-black/8" />
                  <div className="space-y-5">
                    {STATUS_STEPS.map((step, index) => {
                      const stepInfo = STATUS_CONFIG[step];
                      const StepIcon = stepInfo.icon;
                      const isDone = currentStepIdx >= index;
                      const isCurrent = currentStepIdx === index;
                      return (
                        <div key={step} className="relative flex items-start gap-4 pl-9">
                          <div
                            className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                            style={{
                              background: isDone ? '#006241' : 'white',
                              borderColor: isDone ? '#006241' : '#e5e7eb',
                            }}
                          >
                            <StepIcon
                              size={14}
                              className={isDone ? 'text-white' : 'text-gray-300'}
                            />
                          </div>
                          <div className={`pb-1 ${!isCurrent ? 'opacity-60' : ''}`}>
                            <p
                              className={`text-sm font-bold ${
                                isDone ? 'text-[#1E3932]' : 'text-gray-400'
                              }`}
                            >
                              {stepInfo.label}
                            </p>
                            {isCurrent ? (
                              <p className="text-xs text-[#006241]">Trạng thái hiện tại</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-400">
                  Sản phẩm đã đặt
                </h3>
                {(isCancelled || isDelivered) && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = new Set(order.items.map((i) => i.id));
                      const allSelected = order.items.every((i) => selectedItems.has(i.id));
                      setSelectedItems(allSelected ? new Set() : allIds);
                    }}
                    className="text-xs font-semibold text-[#006241] hover:underline"
                  >
                    {order.items.every((i) => selectedItems.has(i.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {order.items.map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl p-2.5 transition ${
                      (isCancelled || isDelivered)
                        ? isSelected
                          ? 'bg-[#006241]/5 ring-1 ring-[#006241]/20'
                          : 'cursor-pointer hover:bg-gray-50'
                        : ''
                    }`}
                    onClick={() => (isCancelled || isDelivered) && toggleSelectItem(item.id)}
                  >
                    {(isCancelled || isDelivered) && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[#006241]"
                      />
                    )}
                    {item.primaryImageUrl ? (
                      <Link
                        to={`/client/products/${item.productId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#006241]/10 bg-[#f2f0eb]"
                      >
                        <img
                          src={item.primaryImageUrl}
                          alt={item.productName}
                          className="h-full w-full object-cover transition hover:scale-105"
                          loading="lazy"
                        />
                      </Link>
                    ) : (
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: '#d4e9e2' }}
                      >
                        <Leaf size={18} style={{ color: '#006241' }} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/client/products/${item.productId}`}
                        className="line-clamp-2 text-sm font-semibold text-[#1E3932] hover:text-[#006241]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.productName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {formatPrice(item.unitPrice)} x {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-[#006241]">
                      {formatPrice(item.lineTotal)}
                    </p>
                    {isDelivered ? (
                      <Link
                        to={`/client/products/${item.productId}#reviews`}
                        className="shrink-0 flex items-center gap-1 rounded-full border border-[#006241]/20 px-2.5 py-1 text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star size={10} /> Đánh giá
                      </Link>
                    ) : null}
                  </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Tạm tính</span>
                  <span>{formatPrice(order.subtotalAmount)}</span>
                </div>
                {Number(order.discountAmount) > 0 ? (
                  <div className="flex justify-between text-[#c82014]">
                    <span>Giảm giá</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-gray-500">
                  <span>{isPickup ? 'Phí nhận hàng' : 'Phí vận chuyển'}</span>
                  <span>
                    {Number(order.deliveryCost) === 0
                      ? 'Miễn phí'
                      : formatPrice(order.deliveryCost)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
                  <span className="text-[#1E3932]">Tổng thanh toán</span>
                  <span className="text-[#006241]">{formatPrice(order.totalPayment)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
                <MapPin size={13} /> {isPickup ? 'Nhận tại cửa hàng' : 'Địa chỉ giao hàng'}
              </h3>
              <p className="text-sm font-semibold text-[#1E3932]">{order.fullName}</p>
              <p className="text-sm text-gray-500">{order.phone}</p>
              <p className="mt-1 text-sm text-gray-600">{order.address}</p>
              {order.deliveryMethodName ? (
                <p className="mt-2 text-xs font-semibold text-[#006241]">
                  {isPickup ? 'Phương thức nhận hàng' : 'Phương thức vận chuyển'}: {order.deliveryMethodName}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
                <CreditCard size={13} /> Thanh toán
              </h3>
              <p className="text-sm text-[#1E3932]">
                {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: paymentStatusInfo.color }}>
                {paymentStatusInfo.label}
              </p>
              {isOnlinePayment && ['unpaid', 'failed'].includes(order.paymentStatus) ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-semibold ${
                    isPaymentExpired
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {isPaymentExpired
                    ? 'Đã quá hạn thanh toán. Đơn sẽ được tự hủy hoặc đã bị hủy bởi hệ thống.'
                    : `Đơn sẽ tự hủy sau ${formatCountdown(order.paymentTimeRemainingSeconds)} nếu chưa thanh toán.`}
                </div>
              ) : null}
            </div>

            {order.note ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">
                  Ghi chú
                </h3>
                <p className="text-sm text-gray-600">{order.note}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              {order.status === 'shipping' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void confirmReceived()}
                    disabled={confirmingReceived}
                    className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
                    style={{ background: '#15803d' }}
                  >
                    {confirmingReceived ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Đã nhận được hàng (đủ)
                  </button>
                  <button
                    type="button"
                    onClick={openShortDeliveryModal}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-amber-300 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-50 active:scale-95"
                  >
                    <AlertCircle size={15} />
                    Báo nhận thiếu
                  </button>
                </>
              ) : null}
              {(order.status === 'delivered' || order.status === 'partial_delivered') ? (
                <div className="space-y-2">
                  <p className={`rounded-2xl px-4 py-3 text-xs font-semibold ${
                    order.canCreateReturn === false
                      ? 'border border-amber-200 bg-amber-50 text-amber-800'
                      : 'bg-[#d4e9e2] text-[#1E3932]'
                  }`}>
                    {order.canCreateReturn === false
                      ? getReturnBlockedMessage(order.returnBlockedReason)
                      : `Có thể yêu cầu trả hàng đến ${order.returnDeadline ? formatDate(order.returnDeadline) : 'hết thời hạn 7 ngày'}.`}
                  </p>
                  <button
                    type="button"
                    onClick={openReturnModal}
                    disabled={order.canCreateReturn === false || !order.items.some((item) => Number(item.returnableQuantity ?? item.quantity) > 0)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    Tạo yêu cầu trả hàng
                  </button>
                </div>
              ) : null}
              {canRetryPayment ? (
                <button
                  type="button"
                  onClick={() => void handleRetryPayment()}
                  disabled={retryingPayment}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#006241] py-2.5 text-sm font-black text-white transition hover:bg-[#005234] active:scale-95 disabled:opacity-60"
                >
                  {retryingPayment ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <CreditCard size={15} />
                  )}
                  Thanh toán lại
                </button>
              ) : null}
              {canCancelUnpaid ? (
                <button
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: 'Hủy đơn hàng?',
                      description: 'Đơn chưa thanh toán sẽ được hủy và hệ thống hoàn lại phần tồn kho đang giữ.',
                      tone: 'danger',
                      confirmLabel: 'Hủy đơn',
                    });
                    if (!ok) return;
                    try {
                      await clientApi.patch(`/orders/${order.id}/cancel`);
                      setOrder((current) =>
                        current
                          ? {
                              ...current,
                              status: 'cancelled',
                              canRetryPayment: false,
                              canCancelUnpaid: false,
                              paymentBlockedReason: 'ORDER_CANCELLED',
                            }
                          : current,
                      );
                    } catch (error) {
                      showToast({
                        tone: 'error',
                        title: 'Không thể hủy đơn hàng',
                        description:
                          error instanceof Error
                            ? error.message
                            : 'Đơn đã thu tiền cần được hỗ trợ hoàn tiền trước khi hủy.',
                      });
                    }
                  }}
                  className="w-full rounded-full border border-red-200 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95"
                >
                  Hủy đơn hàng
                </button>
              ) : null}
              {order.status === 'pending' &&
              (order.paymentStatus === 'paid' ||
                order.paymentStatus === 'partial_refunded') ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Đơn đã thu tiền. Hủy đơn cần nhân viên xác nhận hoàn tiền trước.
                </p>
              ) : null}
              {(isCancelled || isDelivered) && (
                <button
                  type="button"
                  onClick={() => void handleReorder()}
                  disabled={reordering || selectedItems.size === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-black text-white transition active:scale-95 disabled:opacity-50"
                  style={{ background: selectedItems.size > 0 ? '#006241' : '#9ca3af' }}
                >
                  {reordering ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  {selectedItems.size > 0
                    ? `Mua lại (${selectedItems.size})`
                    : 'Chọn sản phẩm để mua lại'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (id) {
                    void Promise.all([refreshOrder(id, true), refreshTracking(id, true)]);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#006241]/20 py-2.5 text-sm font-bold text-[#006241] transition hover:bg-[#006241]/10"
              >
                <RefreshCw size={15} /> Làm mới tracking
              </button>
              <Link
                to="/client/products"
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition active:scale-95"
                style={{ background: '#00754A' }}
              >
                <Leaf size={15} /> Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tạo yêu cầu trả hàng */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submittingReturn && setReturnModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <RotateCcw size={20} className="text-red-600" />
              <h3 className="text-lg font-black text-[#1E3932]">Tạo yêu cầu trả hàng</h3>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase text-gray-500">Sản phẩm cần trả</span>
                <select
                  value={returnItemId}
                  onChange={(e) => {
                    setReturnItemId(e.target.value);
                    setReturnQuantity('1');
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {order.items
                    .filter((it) => Number(it.returnableQuantity ?? it.quantity) > 0)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.productName} × còn trả {it.returnableQuantity ?? it.quantity}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-gray-500">Số lượng trả</span>
                <input
                  type="number"
                  min="1"
                  max={order.items.find((item) => item.id === returnItemId)?.returnableQuantity ?? order.items.find((item) => item.id === returnItemId)?.quantity ?? 1}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-gray-500">Lý do</span>
                <select value={returnReason} onChange={(e) => setReturnReason(e.target.value as ReturnReason)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="damaged">Hàng hư hỏng / bao bì rách</option>
                  <option value="wrong_item">Giao sai sản phẩm</option>
                  <option value="quality">Không đạt chất lượng</option>
                  <option value="other">Lý do khác</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-gray-500">Mô tả chi tiết *</span>
                <textarea value={returnDescription} onChange={(e) => setReturnDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Mô tả tình trạng sản phẩm, lý do trả..." />
              </label>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Yêu cầu sẽ chờ admin xét duyệt. Bạn sẽ nhận thông báo khi có cập nhật.
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setReturnModalOpen(false)} disabled={submittingReturn} className="flex-1 rounded-full border border-gray-200 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
                  Hủy
                </button>
                <button onClick={() => void submitReturnRequest()} disabled={submittingReturn} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
                  {submittingReturn && <LoaderCircle size={14} className="animate-spin" />}
                  Gửi yêu cầu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Báo nhận thiếu */}
      {shortDeliveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submittingReturn && setShortDeliveryModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-600" />
              <h3 className="text-lg font-black text-[#1E3932]">Báo nhận thiếu</h3>
            </div>
            <p className="mb-3 text-xs text-gray-600">Nhập số lượng <strong>thực tế</strong> bạn nhận được. Các sản phẩm nhận đủ giữ nguyên số đã đặt.</p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {order.items.map((it) => {
                const actual = Number(shortQuantities[it.id] ?? it.quantity);
                const isShort = actual < it.quantity;
                return (
                  <div key={it.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isShort ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#1E3932]">{it.productName}</p>
                      <p className="text-xs text-gray-500">Đã đặt: {it.quantity}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={it.quantity}
                      value={shortQuantities[it.id] ?? String(it.quantity)}
                      onChange={(e) => setShortQuantities((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm font-bold"
                    />
                    {isShort && <span className="text-xs font-bold text-amber-700">Thiếu {it.quantity - actual}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Sau khi gửi, admin sẽ xác minh với đơn vị vận chuyển và xử lý hoàn tiền/giao bù phần thiếu.
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShortDeliveryModalOpen(false)} disabled={submittingReturn} className="flex-1 rounded-full border border-gray-200 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={() => void submitShortDelivery()} disabled={submittingReturn} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-600 py-2 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50">
                {submittingReturn && <LoaderCircle size={14} className="animate-spin" />}
                Báo nhận thiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-black text-[#1E3932]">{value}</p>
    </div>
  );
}

