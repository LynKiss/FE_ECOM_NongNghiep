import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  quantityDelivered?: number;
  unitPrice: string;
  lineTotal: string;
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
  delivered: 'Đã giao',
  partial_delivered: 'Giao một phần',
  cancelled: 'Đã hủy',
  returned: 'Đã hoàn',
};

const PAYMENT_VI: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Đã hoàn tiền',
  cod: 'COD - Thanh toán khi nhận',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  paypal: 'PayPal',
};

function fmtMoney(n: string | number) {
  return Number(n).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
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
      .then((d) => setOrder(d))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được đơn hàng'),
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-on-surface-variant">Đang tải hóa đơn...</p>
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="space-y-3 p-8">
        <p className="text-red-600">{error ?? 'Không tìm thấy đơn'}</p>
        <Link to="/admin/orders" className="text-primary hover:underline">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const today = new Date(order.createdAt);
  const isPickup = order.fulfillmentType === 'pickup';

  return (
    <>
      {/* Print-only inline styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print mb-4 flex items-center justify-between print:hidden">
        <Link
          to={`/admin/orders?search=${order.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={16} /> Quay lại đơn hàng
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow hover:opacity-90"
          >
            <Printer size={15} /> In hóa đơn
          </button>
          <button
            onClick={() => {
              const html = document.documentElement.outerHTML;
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `hoa-don-${order.id.slice(0, 8)}.html`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5"
          >
            <Download size={15} /> Tải HTML
          </button>
        </div>
      </div>

      {/* Invoice page */}
      <div className="print-page mx-auto max-w-3xl rounded-2xl border border-on-surface-variant/10 bg-white p-10 shadow-sm">
        {/* Header */}
        <div className="border-b-4 border-primary pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">
                Cultivated Ledger
              </p>
              <h1 className="mt-2 text-3xl font-black text-on-surface">HÓA ĐƠN BÁN HÀNG</h1>
              <p className="mt-1 text-xs text-on-surface-variant">
                (VAT INVOICE — bản nội bộ)
              </p>
            </div>
            <div className="text-right text-xs text-on-surface-variant">
              <p className="font-black text-on-surface">CÔNG TY TNHH NÔNG NGHIỆP VIỆT</p>
              <p>123 Đường ABC, Phường XYZ, TP. Hà Nội</p>
              <p>MST: 0123456789 — Hotline: 1800 6863</p>
              <p>Email: contact@nongnghiepviet.vn</p>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60">
              Khách hàng
            </p>
            <p className="mt-1 font-bold text-on-surface">{order.fullName}</p>
            <p className="text-on-surface-variant">{order.phone}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{order.address}</p>
            <p className="mt-1 text-xs font-semibold text-primary">
              {isPickup ? 'Nhận tại cửa hàng' : 'Giao hàng'}
              {order.deliveryMethodName ? ` · ${order.deliveryMethodName}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60">
              Số hóa đơn
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-on-surface">
              HĐ-{order.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Ngày: {today.toLocaleDateString('vi-VN')}
            </p>
            <p className="text-xs text-on-surface-variant">
              Trạng thái: <span className="font-bold">{STATUS_VI[order.status] ?? order.status}</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              Thanh toán:{' '}
              <span className="font-bold">
                {PAYMENT_VI[order.paymentStatus]} ({PAYMENT_VI[order.paymentMethod] ?? order.paymentMethod})
              </span>
            </p>
          </div>
        </div>

        {/* Items table */}
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-on-surface text-left">
              <th className="py-2 pr-2 text-xs font-black uppercase tracking-widest">#</th>
              <th className="py-2 pr-2 text-xs font-black uppercase tracking-widest">Sản phẩm</th>
              <th className="py-2 pr-2 text-right text-xs font-black uppercase tracking-widest">SL</th>
              <th className="py-2 pr-2 text-right text-xs font-black uppercase tracking-widest">Đơn giá</th>
              <th className="py-2 text-right text-xs font-black uppercase tracking-widest">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => (
              <tr key={it.id} className="border-b border-on-surface-variant/10">
                <td className="py-3 pr-2 font-semibold text-on-surface-variant">{idx + 1}</td>
                <td className="py-3 pr-2 font-semibold text-on-surface">
                  {it.productName}
                  {it.quantityDelivered !== undefined && it.quantityDelivered < it.quantity && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Đã giao: {it.quantityDelivered}/{it.quantity}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-2 text-right">{it.quantity}</td>
                <td className="py-3 pr-2 text-right">{fmtMoney(it.unitPrice)}</td>
                <td className="py-3 text-right font-semibold">{fmtMoney(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals — bao gồm VAT breakdown nếu giá bao gồm VAT 10% (mặc định VN) */}
        <div className="ml-auto mt-4 w-80 space-y-1 text-sm">
          {(() => {
            const subtotal = Number(order.subtotalAmount);
            const taxRate = 10; // % — đồng bộ với settings nếu cần
            const taxIncluded = subtotal > 0;
            const netAmount = taxIncluded ? subtotal / (1 + taxRate / 100) : subtotal;
            const vatAmount = subtotal - netAmount;
            return (
              <>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Tiền hàng (chưa VAT):</span>
                  <span>{fmtMoney(Math.round(netAmount))}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>VAT ({taxRate}%):</span>
                  <span>{fmtMoney(Math.round(vatAmount))}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant border-t border-dashed pt-1">
                  <span>Tạm tính (bao gồm VAT):</span>
                  <span>{fmtMoney(order.subtotalAmount)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Giảm giá:</span>
                  <span>-{fmtMoney(order.discountAmount)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>{isPickup ? 'Phí nhận hàng:' : 'Phí giao hàng:'}</span>
                  <span>{fmtMoney(order.deliveryCost)}</span>
                </div>
                <div className="border-t border-on-surface pt-2 flex justify-between text-base font-black">
                  <span>TỔNG CỘNG:</span>
                  <span className="text-primary">{fmtMoney(order.totalPayment)}</span>
                </div>
              </>
            );
          })()}
        </div>

        {order.note && (
          <div className="mt-6 rounded-xl bg-surface p-4 text-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60">
              Ghi chú
            </p>
            <p className="mt-1 italic text-on-surface-variant">{order.note}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <p className="font-black uppercase tracking-widest text-on-surface-variant/60">
              Người mua hàng
            </p>
            <p className="mt-1 italic text-on-surface-variant/60">(Ký, ghi rõ họ tên)</p>
            <div className="mt-12 border-t border-on-surface-variant/30 pt-1 text-on-surface">
              {order.fullName}
            </div>
          </div>
          <div>
            <p className="font-black uppercase tracking-widest text-on-surface-variant/60">
              Người bán hàng
            </p>
            <p className="mt-1 italic text-on-surface-variant/60">(Ký, ghi rõ họ tên)</p>
            <div className="mt-12 border-t border-on-surface-variant/30 pt-1 text-on-surface">
              ............................
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-dashed border-on-surface-variant/20 pt-4 text-center text-[10px] text-on-surface-variant/50">
          Hóa đơn được tạo tự động từ hệ thống lúc {new Date().toLocaleString('vi-VN')} • Trang 1/1
        </div>
      </div>
    </>
  );
}
