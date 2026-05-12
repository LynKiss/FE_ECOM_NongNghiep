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

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderDetailResponse = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalPayment: string;
  totalQuantity: number;
  subtotalAmount: string;
  discountAmount: string;
  deliveryCost: string;
  fullName: string;
  phone: string;
  address: string;
  note: string | null;
  createdAt: string;
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const momoVerifiedRef = useRef(false);

  const { addItem } = useCart();
  const { showToast } = useToast();

  const shouldShowTracking = order?.status === 'shipping' || order?.status === 'delivered';
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
    if (!window.confirm('Xác nhận bạn đã nhận được hàng?')) return;
    setConfirmingReceived(true);
    try {
      await clientApi.patch(`/orders/${id}/confirm-received`);
      await refreshOrder(id, false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể xác nhận. Vui lòng thử lại.');
    } finally {
      setConfirmingReceived(false);
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

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
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
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: '#d4e9e2' }}
                    >
                      <Leaf size={18} style={{ color: '#006241' }} />
                    </div>
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
                  <span>Phí vận chuyển</span>
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
                <MapPin size={13} /> Địa chỉ giao hàng
              </h3>
              <p className="text-sm font-semibold text-[#1E3932]">{order.fullName}</p>
              <p className="text-sm text-gray-500">{order.phone}</p>
              <p className="mt-1 text-sm text-gray-600">{order.address}</p>
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
                  Đã nhận được hàng
                </button>
              ) : null}
              {order.status === 'pending' ? (
                <button
                  onClick={async () => {
                    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
                    try {
                      await clientApi.patch(`/orders/${order.id}/cancel`);
                      setOrder((current) =>
                        current ? { ...current, status: 'cancelled' } : current,
                      );
                    } catch (error) {
                      alert(
                        error instanceof Error
                          ? error.message
                          : 'Không thể hủy đơn hàng',
                      );
                    }
                  }}
                  className="w-full rounded-full border border-red-200 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95"
                >
                  Hủy đơn hàng
                </button>
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
