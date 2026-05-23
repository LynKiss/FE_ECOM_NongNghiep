import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  Mail,
  MapPin,
  Newspaper,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

type SupportConfig = {
  title: string;
  eyebrow: string;
  intro: string;
  icon: typeof ShoppingBag;
  primaryCta: string;
  primaryHref?: string;
  onPrimaryClick?: () => void;
  steps: Array<{ title: string; description: string }>;
  notes: string[];
};

const openSupportChat = () => {
  window.dispatchEvent(
    new CustomEvent('support-chat:open', { detail: { tab: 'support' } }),
  );
};

const supportPages: Record<string, SupportConfig> = {
  'buying-guide': {
    title: 'Hướng dẫn mua hàng',
    eyebrow: 'Mua sắm',
    intro:
      'Từ chọn vật tư, nhận voucher đến theo dõi đơn hàng, quy trình được thiết kế để bạn đặt đúng sản phẩm và kiểm soát chi phí trước khi thanh toán.',
    icon: ShoppingBag,
    primaryCta: 'Bắt đầu mua sắm',
    primaryHref: '/client/products',
    steps: [
      {
        title: 'Chọn sản phẩm phù hợp',
        description:
          'Dùng danh mục, tìm kiếm và trang chi tiết để kiểm tra giá, mô tả, tồn kho và sản phẩm liên quan.',
      },
      {
        title: 'Thêm vào giỏ và săn voucher',
        description:
          'Mở icon hộp quà để nhận voucher vào ví, sau đó áp dụng mã đủ điều kiện ngay trong giỏ hàng.',
      },
      {
        title: 'Chọn địa chỉ, giao hàng và thanh toán',
        description:
          'Xác nhận thông tin nhận hàng, phương thức vận chuyển, ghi chú và chuyển sang bước thanh toán.',
      },
      {
        title: 'Theo dõi đơn hàng',
        description:
          'Sau khi đặt hàng, vào tài khoản để xem trạng thái xử lý, giao hàng và lịch sử mua.',
      },
    ],
    notes: [
      'Phí nhận hàng và điều kiện miễn phí được tính ở checkout theo phương thức, khu vực và giá trị đơn hiện tại.',
      'Voucher có thể có hạn dùng, số lượt và điều kiện đơn tối thiểu.',
      'Bạn nên đăng nhập trước khi đặt hàng để lưu địa chỉ và theo dõi đơn dễ hơn.',
    ],
  },
  returns: {
    title: 'Chính sách đổi trả',
    eyebrow: 'Sau bán hàng',
    intro:
      'Chính sách đổi trả hỗ trợ khách hàng xử lý sản phẩm lỗi, sai mô tả hoặc phát sinh vấn đề trong quá trình nhận hàng.',
    icon: RefreshCw,
    primaryCta: 'Mở chat hỗ trợ',
    onPrimaryClick: openSupportChat,
    steps: [
      {
        title: 'Kiểm tra điều kiện',
        description:
          'Sản phẩm còn trong 7 ngày từ lúc nhận hàng, có lỗi hoặc không đúng mô tả, còn bao bì và hóa đơn liên quan.',
      },
      {
        title: 'Gửi yêu cầu hỗ trợ',
        description:
          'Liên hệ qua chat, hotline hoặc email kèm mã đơn, ảnh sản phẩm và mô tả vấn đề cần xử lý.',
      },
      {
        title: 'Xác nhận phương án',
        description:
          'Đội ngũ hỗ trợ kiểm tra thông tin và xác nhận đổi sản phẩm, hoàn tiền hoặc phương án phù hợp.',
      },
      {
        title: 'Theo dõi kết quả',
        description:
          'Trạng thái xử lý được cập nhật qua kênh liên hệ và lịch sử đơn hàng nếu yêu cầu gắn với tài khoản.',
      },
    ],
    notes: [
      'Không áp dụng đổi trả với sản phẩm đã sử dụng sai hướng dẫn bảo quản.',
      'Thời gian hoàn tiền phụ thuộc phương thức thanh toán và ngân hàng xử lý.',
      'Giữ lại ảnh, video và hóa đơn để quá trình xác minh nhanh hơn.',
    ],
  },
  warranty: {
    title: 'Chính sách bảo hành',
    eyebrow: 'Cam kết',
    intro:
      'Bảo hành áp dụng theo tiêu chuẩn nhà sản xuất và điều kiện sử dụng thực tế của từng nhóm vật tư, thiết bị.',
    icon: ShieldCheck,
    primaryCta: 'Liên hệ bảo hành',
    onPrimaryClick: openSupportChat,
    steps: [
      {
        title: 'Xác định nhóm sản phẩm',
        description:
          'Thiết bị, dụng cụ và vật tư có quy định bảo hành khác nhau theo nhà sản xuất hoặc nhà phân phối.',
      },
      {
        title: 'Chuẩn bị thông tin',
        description:
          'Cần mã đơn, hóa đơn, ảnh tem nhãn, tình trạng sản phẩm và mô tả lỗi đang gặp.',
      },
      {
        title: 'Gửi yêu cầu kiểm tra',
        description:
          'Đội ngũ hỗ trợ tiếp nhận, xác minh điều kiện và hướng dẫn gửi sản phẩm nếu cần kiểm tra trực tiếp.',
      },
      {
        title: 'Nhận kết quả xử lý',
        description:
          'Tùy tình trạng, sản phẩm có thể được sửa chữa, đổi mới hoặc hướng dẫn phương án thay thế phù hợp.',
      },
    ],
    notes: [
      'Bảo hành không áp dụng với hao mòn tự nhiên hoặc lỗi do sử dụng sai hướng dẫn.',
      'Không tự tháo lắp thiết bị trước khi liên hệ nếu sản phẩm còn bảo hành.',
      'Thời gian xử lý phụ thuộc nhà sản xuất và mức độ lỗi.',
    ],
  },
  'news-knowledge': {
    title: 'Tin tức – Kiến thức',
    eyebrow: 'Nông nghiệp hôm nay',
    intro:
      'Tổng hợp kiến thức canh tác, thị trường vật tư, hướng dẫn sử dụng sản phẩm và kinh nghiệm chăm sóc mùa vụ.',
    icon: Newspaper,
    primaryCta: 'Xem tin tức',
    primaryHref: '/client/news',
    steps: [
      {
        title: 'Kiến thức canh tác',
        description:
          'Các bài viết về dinh dưỡng cây trồng, phòng trừ sâu bệnh và quản lý mùa vụ theo thực tế sản xuất.',
      },
      {
        title: 'Hướng dẫn sử dụng vật tư',
        description:
          'Nội dung giúp đọc nhãn, dùng đúng liều lượng, phối hợp sản phẩm và bảo quản an toàn.',
      },
      {
        title: 'Cập nhật thị trường',
        description:
          'Theo dõi xu hướng giá, nguồn cung và thông tin hữu ích trước khi lên kế hoạch mua vật tư.',
      },
      {
        title: 'Kết nối hỗ trợ kỹ thuật',
        description:
          'Khi cần tư vấn sâu hơn, bạn có thể mở chat để đội ngũ hỗ trợ xem tình huống cụ thể.',
      },
    ],
    notes: [
      'Nội dung kiến thức mang tính tham khảo và cần đối chiếu điều kiện canh tác thực tế.',
      'Các bài viết mới được cập nhật trong mục Tin tức của website.',
      'Có thể dùng AI chẩn đoán bệnh lúa khi cần tham khảo nhanh từ ảnh lá.',
    ],
  },
  contact: {
    title: 'Liên hệ chúng tôi',
    eyebrow: 'Hỗ trợ trực tiếp',
    intro:
      'Kết nối với đội ngũ Cultivated Ledger để được tư vấn đơn hàng, voucher, đổi trả, bảo hành và kỹ thuật nông nghiệp.',
    icon: Headphones,
    primaryCta: 'Mở chat hỗ trợ',
    onPrimaryClick: openSupportChat,
    steps: [
      {
        title: 'Hotline',
        description: '1800 6863, hỗ trợ trong khung giờ 7:00 - 21:00 mỗi ngày.',
      },
      {
        title: 'Email',
        description: 'support@cultivatedledger.vn cho yêu cầu cần gửi hình ảnh, hóa đơn hoặc hồ sơ chi tiết.',
      },
      {
        title: 'Địa chỉ',
        description: '123 Đường Nông Nghiệp, Quận 12, TP.HCM.',
      },
      {
        title: 'Chat hỗ trợ',
        description: 'Mở chat ngay trên website để trao đổi nhanh với chatbot hoặc nhân viên trực.',
      },
    ],
    notes: [
      'Chuẩn bị mã đơn nếu cần hỗ trợ về giao hàng, thanh toán hoặc đổi trả.',
      'Gửi ảnh rõ nét giúp đội hỗ trợ xác minh sản phẩm và tình trạng nhanh hơn.',
      'Các yêu cầu ngoài giờ làm việc sẽ được phản hồi ở ca trực tiếp theo.',
    ],
  },
};

export default function SupportLanding() {
  const { slug = 'buying-guide' } = useParams();
  const config = supportPages[slug] ?? supportPages['buying-guide'];
  const Icon = config.icon;

  return (
    <div className="client-surface min-h-[80vh]">
      <section style={{ background: '#1E3932' }} className="text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-white/60">
              {config.eyebrow}
            </p>
            <h1 className="text-4xl font-black leading-tight md:text-5xl">
              {config.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
              {config.intro}
            </p>
            {config.primaryHref ? (
              <Link
                to={config.primaryHref}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-[#00754A] transition active:scale-95"
              >
                {config.primaryCta} <ArrowRight size={16} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={config.onPrimaryClick}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-[#00754A] transition active:scale-95"
              >
                {config.primaryCta} <ArrowRight size={16} />
              </button>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/8 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00754A]">
              <Icon size={30} />
            </div>
            <div className="mt-6 grid gap-3 text-sm text-white/72">
              <p className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#d4e9e2]" />
                Hỗ trợ 7:00 - 21:00 mỗi ngày
              </p>
              <p className="flex items-center gap-2">
                <Mail size={16} className="text-[#d4e9e2]" />
                support@cultivatedledger.vn
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={16} className="text-[#d4e9e2]" />
                Giao hàng toàn quốc
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          {config.steps.map((step, index) => (
            <article key={step.title} className="client-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#d4e9e2] text-sm font-black text-[#006241]">
                {index + 1}
              </div>
              <h2 className="text-xl font-black text-[#1E3932]">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {step.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-xl bg-[#edebe9] p-6">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#1E3932]">
            <PackageCheck size={20} className="text-[#006241]" />
            Lưu ý quan trọng
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {config.notes.map((note) => (
              <p key={note} className="rounded-xl bg-white px-4 py-3 text-sm leading-6 text-gray-600">
                {note}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
