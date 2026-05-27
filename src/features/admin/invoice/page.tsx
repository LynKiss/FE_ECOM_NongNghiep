import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  quantityDelivered?: number;
  unitPrice: string;
  lineTotal: string;
  discountAllocated?: string | null;
}

interface OrderDetail {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fullName: string;
  phone: string;
  address: string;
  note: string | null;
  subtotalAmount: string;
  discountAmount: string;
  deliveryCost: string;
  fulfillmentType: 'delivery' | 'pickup';
  deliveryMethodName: string | null;
  freeShippingApplied: boolean;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  totalPayment: string;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const STATUS_VI: Record<string, string> = {
  pending: 'Chờ xử lý',
  backordered: 'Chờ hàng',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  delivered: 'Đã giao thành công',
  partial_delivered: 'Giao một phần',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng',
  partial_returned: 'Trả hàng một phần',
};

const PAYMENT_STATUS_VI: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
  partial_refunded: 'Hoàn tiền một phần',
};

const PAYMENT_METHOD_VI: Record<string, string> = {
  cod: 'COD - Thanh toán khi nhận hàng',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  paypal: 'PayPal',
  credit: 'Công nợ khách sỉ',
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ'];

function formatMoney(value: string | number | null | undefined) {
  return currency.format(Number(value ?? 0));
}

function readTriple(input: number, full = false) {
  const hundred = Math.floor(input / 100);
  const ten = Math.floor((input % 100) / 10);
  const one = input % 10;
  const parts: string[] = [];

  if (hundred > 0 || full) {
    parts.push(`${DIGITS[hundred]} trăm`);
  }
  if (ten > 1) {
    parts.push(`${DIGITS[ten]} mươi`);
    if (one === 1) parts.push('mốt');
    else if (one === 5) parts.push('lăm');
    else if (one > 0) parts.push(DIGITS[one]);
  } else if (ten === 1) {
    parts.push('mười');
    if (one === 5) parts.push('lăm');
    else if (one > 0) parts.push(DIGITS[one]);
  } else if (one > 0) {
    if (hundred > 0 || full) parts.push('lẻ');
    parts.push(DIGITS[one]);
  }

  return parts.join(' ').trim();
}

function amountInWords(amount: number) {
  const rounded = Math.max(0, Math.round(amount));
  if (rounded === 0) return 'Không đồng';
  const groups: number[] = [];
  let rest = rounded;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (group === 0) continue;
    const full = i < groups.length - 1;
    words.push(`${readTriple(group, full)} ${UNITS[i]}`.trim());
  }
  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} đồng`;
}

function shortCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function InvoicePrintPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    apiClient
      .get<OrderDetail>(`/orders/${orderId}`)
      .then((data) => {
        setOrder(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được đơn hàng'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const totals = useMemo(() => {
    if (!order) return null;
    return {
      subtotal: Number(order.subtotalAmount || 0),
      discount: Number(order.discountAmount || 0),
      delivery: Number(order.deliveryCost || 0),
      total: Number(order.totalPayment || 0),
    };
  }, [order]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-on-surface-variant">Đang tải hóa đơn...</p>
      </div>
    );
  }

  if (error || !order || !totals) {
    return (
      <div className="space-y-3 p-8">
        <p className="text-red-600">{error ?? 'Không tìm thấy đơn hàng'}</p>
        <Link to="/admin/orders" className="text-primary hover:underline">
          Quay lại danh sách đơn hàng
        </Link>
      </div>
    );
  }

  const isPickup = order.fulfillmentType === 'pickup';
  const receiverName = isPickup ? order.pickupContactName || order.fullName : order.fullName;
  const receiverPhone = isPickup ? order.pickupContactPhone || order.phone : order.phone;
  const receiverAddress = isPickup ? 'Nhận tại cửa hàng' : order.address;

  return (
    <>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .invoice-page { width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          .invoice-table { page-break-inside: auto; }
          .invoice-table tr { page-break-inside: avoid; page-break-after: auto; }
        }
        @page { size: A4 portrait; margin: 12mm; }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/admin/orders?search=${order.id}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} /> Quay lại đơn hàng
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Printer size={16} /> In hóa đơn
          </button>
          <button
            onClick={() => {
              const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `hoa-don-${shortCode(order.id)}.html`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5"
          >
            <Download size={16} /> Tải HTML
          </button>
        </div>
      </div>

      <main className="invoice-page mx-auto max-w-[210mm] rounded-2xl border border-outline-variant bg-white p-10 text-[#1f2933] shadow-sm">
        <header className="border-b-4 border-primary pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">Nông nghiệp Việt</p>
              <h1 className="mt-2 text-3xl font-black uppercase">Hóa đơn bán hàng</h1>
              <p className="mt-1 text-sm text-slate-500">Hóa đơn nội bộ phục vụ bán hàng và đối soát đơn hàng</p>
            </div>
            <div className="max-w-xs text-right text-sm">
              <p className="font-black">Cửa hàng Vật Tư Nông Nghiệp</p>
              <p>Địa chỉ: 123 Đường Nông Nghiệp, TP. Hà Nội</p>
              <p>Hotline: 1800 6863</p>
              <p>Email: support@cultivatedledger.vn</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Số hóa đơn</p>
            <p className="mt-1 font-mono text-lg font-black">HD-{shortCode(order.id)}</p>
            <p className="mt-1 text-xs text-slate-500">Mã đơn: {order.id}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Ngày lập</p>
            <p className="mt-1 font-bold">{formatDateTime(order.createdAt)}</p>
            <p className="mt-1 text-xs text-slate-500">Cập nhật: {formatDateTime(order.updatedAt)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Trạng thái</p>
            <p className="mt-1 font-bold">{STATUS_VI[order.status] ?? order.status}</p>
            <p className="mt-1 text-xs font-bold text-primary">{PAYMENT_STATUS_VI[order.paymentStatus] ?? order.paymentStatus}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Thông tin khách hàng</p>
            <p className="mt-2 text-lg font-black">{receiverName}</p>
            <p className="text-sm">SĐT: {receiverPhone || '-'}</p>
            <p className="mt-1 text-sm text-slate-600">Địa chỉ: {receiverAddress || '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Giao nhận & thanh toán</p>
            <p className="mt-2 text-sm">
              <b>Phương thức nhận hàng:</b> {isPickup ? 'Nhận tại cửa hàng' : order.deliveryMethodName || 'Giao hàng'}
            </p>
            <p className="mt-1 text-sm">
              <b>Phương thức thanh toán:</b> {PAYMENT_METHOD_VI[order.paymentMethod] ?? order.paymentMethod}
            </p>
            <p className="mt-1 text-sm">
              <b>Miễn phí vận chuyển:</b> {order.freeShippingApplied ? 'Có' : 'Không'}
            </p>
          </div>
        </section>

        <section className="mt-7">
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Danh sách sản phẩm</p>
          <table className="invoice-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-2 py-2 text-center">STT</th>
                <th className="border border-slate-300 px-3 py-2">Tên sản phẩm</th>
                <th className="border border-slate-300 px-2 py-2 text-center">SL</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Đơn giá</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Giảm dòng</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const discount = Number(item.discountAllocated ?? 0);
                return (
                  <tr key={item.id}>
                    <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                    <td className="border border-slate-300 px-3 py-2">
                      <p className="font-semibold">{item.productName}</p>
                      <p className="text-[11px] text-slate-500">Mã SP: {item.productId}</p>
                      {item.quantityDelivered !== undefined && item.quantityDelivered < item.quantity ? (
                        <p className="mt-1 text-[11px] font-bold text-amber-700">
                          Đã giao {item.quantityDelivered}/{item.quantity}
                        </p>
                      ) : null}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-center">{item.quantity}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{discount > 0 ? formatMoney(discount) : '-'}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-bold">{formatMoney(item.lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-6 flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tổng tiền hàng</span>
              <b>{formatMoney(totals.subtotal)}</b>
            </div>
            <div className="flex justify-between">
              <span>Giảm giá</span>
              <b>-{formatMoney(totals.discount)}</b>
            </div>
            <div className="flex justify-between">
              <span>{isPickup ? 'Phí nhận hàng' : 'Phí giao hàng'}</span>
              <b>{formatMoney(totals.delivery)}</b>
            </div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg font-black">
              <span>Tổng thanh toán</span>
              <span className="text-primary">{formatMoney(totals.total)}</span>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
          <p>
            <b>Số tiền bằng chữ:</b> <span className="italic">{amountInWords(totals.total)}</span>
          </p>
          {order.note ? (
            <p className="mt-2">
              <b>Ghi chú đơn hàng:</b> {order.note}
            </p>
          ) : null}
        </section>

        <section className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
          {['Người lập phiếu', 'Khách hàng', isPickup ? 'Nhân viên cửa hàng' : 'Thủ kho/Giao hàng'].map((label) => (
            <div key={label}>
              <p className="font-black uppercase">{label}</p>
              <p className="mt-1 text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</p>
              <div className="mt-16 border-t border-slate-300 pt-2">{label === 'Khách hàng' ? receiverName : ''}</div>
            </div>
          ))}
        </section>

        <footer className="mt-10 border-t border-dashed border-slate-300 pt-3 text-center text-[11px] text-slate-500">
          Hóa đơn được tạo tự động từ hệ thống lúc {new Date().toLocaleString('vi-VN')}. Vui lòng kiểm tra thông tin trước khi in.
        </footer>
      </main>
    </>
  );
}
