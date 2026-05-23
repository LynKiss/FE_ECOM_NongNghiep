import {
  ChevronDown,
  ExternalLink,
  Leaf,
  LoaderCircle,
  LogIn,
  MessageCircle,
  Package,
  RefreshCw,
  Send,
  ShoppingCart,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClientSession } from '../../hooks/useClientSession';
import { refreshGlobalCart, useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { clientApi } from '../../lib/client-api';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_STYLES,
  type SupportConversation,
  type SupportMessage,
  createSupportChatSocket,
  sortSupportConversations,
} from '../../lib/support-chat';

type BotTab = 'bot' | 'support';

type SupportBotProductSuggestion = {
  productId: string;
  productName: string;
  effectivePrice: string;
  basePrice: string;
  unit: string | null;
  quantityAvailable: number;
  primaryImageUrl: string | null;
};

type SupportBotAction = {
  type:
    | 'navigate'
    | 'switch_tab'
    | 'send_message'
    | 'login'
    | 'view_product'
    | 'add_to_cart';
  label: string;
  target: string;
};

type SupportBotReply = {
  reply: string;
  source: 'ai' | 'fallback';
  handoffSuggested: boolean;
  products: SupportBotProductSuggestion[];
  intent: string;
  cartChanged?: boolean;
  actions?: SupportBotAction[];
  suggestedQuestions?: string[];
  severity?: 'info' | 'warning' | 'success';
};

type BotMessage = {
  id: number;
  from: 'user' | 'bot';
  text: string;
  products?: SupportBotProductSuggestion[];
  actions?: SupportBotAction[];
  suggestedQuestions?: string[];
  severity?: 'info' | 'warning' | 'success';
};

// Bỏ dấu tiếng Việt để match input không dấu của user.
// Vd: "giao hang" sẽ vẫn match keyword "giao hàng".
function stripDiacritics(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

const FAQ_RESPONSES: Array<{ keys: string[]; response: string }> = [
  {
    keys: ['giao hàng', 'van chuyen', 'ship', 'thoi gian giao'],
    response: '🚚 **Nhận hàng**\n• Bạn có thể chọn giao đến địa chỉ hoặc nhận tại cửa hàng khi checkout.\n• Phí, ngưỡng miễn phí và thời gian dự kiến được tính theo phương thức nhận hàng, khu vực và giá trị đơn hiện tại.\n• Hãy chọn địa chỉ nhận hàng để hệ thống báo phương thức phù hợp.',
  },
  {
    keys: ['đổi trả', 'tra hang', 'tra lai', 'hoan tra', 'doi san pham'],
    response: '↩️ **Đổi/Trả**\n• Trong 7 ngày kể từ ngày nhận hàng.\n• Áp dụng cho hàng lỗi, hư hỏng, sai mô tả.\n• Giữ nguyên bao bì + hóa đơn.\n• Bạn có thể tự tạo yêu cầu ngay trong trang "Đơn hàng của tôi".',
  },
  {
    keys: ['hoàn tiền', 'refund', 'tien'],
    response: '💸 **Hoàn tiền**\n• Sau khi admin duyệt trả hàng → 3–5 ngày làm việc.\n• Tiền về đúng phương thức thanh toán ban đầu (chuyển khoản/ví/COD = chuyển khoản về STK bạn cung cấp).',
  },
  {
    keys: ['thanh toán', 'payment', 'tra tien', 'cod', 'momo', 'vnpay', 'zalopay', 'chuyen khoan'],
    response: '💳 **Phương thức thanh toán**\n• COD (trả khi nhận)\n• Chuyển khoản ngân hàng\n• Ví điện tử: MoMo, VNPay, ZaloPay\n• Mua nợ (với khách doanh nghiệp được duyệt hạn mức)',
  },
  {
    keys: ['phân bón', 'phan bon', 'npk', 'urea', 'kali', 'lan'],
    response: '🌱 **Phân bón**\nCó đủ NPK, hữu cơ, vi sinh, urea, lân, kali...\n→ Vào trang Sản phẩm → lọc theo "Phân bón" để xem chi tiết và giá.',
  },
  {
    keys: ['thuốc', 'thuoc bvtv', 'thuoc tru sau', 'thuoc benh'],
    response: '🧪 **Thuốc BVTV**\nThuốc trừ sâu / trừ bệnh / trừ cỏ chính hãng có đầy đủ giấy phép lưu hành.\n⚠️ Việc kê đơn thuốc cụ thể cho cây trồng — vui lòng chuyển sang tab "Nhân viên" hoặc dùng tính năng "Chẩn đoán lúa AI".',
  },
  {
    keys: ['hạt giống', 'hat giong', 'seed', 'giong lua', 'giong rau'],
    response: '🌾 **Hạt giống**\n• Lúa OM5451, OM18, ST24, ST25\n• Rau màu, cây ăn quả\n• Tỷ lệ nảy mầm > 90%, có chứng nhận viện giống.',
  },
  {
    keys: ['dụng cụ', 'dung cu', 'cuoc', 'xeng', 'binh phun', 'may cay'],
    response: '🔧 **Dụng cụ nông nghiệp**\nCó đủ cuốc, xẻng, máy cày, máy phát cỏ, bình phun, hệ thống tưới nhỏ giọt...',
  },
  {
    keys: ['liên hệ', 'lien he', 'hotline', 'email', 'so dien thoai'],
    response: '📞 **Liên hệ**\n• Hotline: **1800 6863** (miễn phí)\n• Email: support@cultivatedledger.vn\n• Giờ làm việc: 7:00–21:00 mỗi ngày',
  },
  {
    keys: ['khuyến mãi', 'khuyen mai', 'giam gia', 'sale', 'voucher', 'coupon', 'ma giam'],
    response: '🎁 **Khuyến mãi**\n• Xem banner trang chủ.\n• Lọc "Đang giảm giá" trong trang Sản phẩm.\n• Mã voucher hiển thị ở trang "Ví voucher" sau khi đăng nhập.',
  },
  {
    keys: ['tài khoản', 'tai khoan', 'dang ky', 'register', 'account', 'mat khau'],
    response: '👤 **Tài khoản**\nBấm "Đăng ký" ở góc phải để tạo miễn phí (cần email + SĐT). Hoặc mua hàng theo dạng khách vãng lai.\nQuên mật khẩu? → "Quên mật khẩu" ở trang đăng nhập.',
  },
  {
    keys: ['kho', 'warehouse', 'tinh thanh', 'khu vuc'],
    response: '🏪 **Kho hàng**\nHệ thống kho trải khắp 3 miền, dùng FIFO/FEFO để ưu tiên xuất hàng sắp hết hạn.\n• Đơn HCM/HN/ĐN: 1–2 ngày\n• Các tỉnh khác: 2–4 ngày',
  },
  {
    keys: ['bảo hành', 'bao hanh', 'warranty'],
    response: '🛡️ **Bảo hành**\nTheo chính sách nhà sản xuất. Vui lòng giữ hóa đơn để được hỗ trợ tốt nhất.',
  },
  {
    keys: ['hủy đơn', 'huy don', 'cancel order'],
    response: '❌ **Hủy đơn hàng**\n• Đơn còn ở trạng thái "Chờ xử lý" → bạn tự hủy được ở trang "Đơn hàng của tôi".\n• Đơn đã xác nhận/đang giao → vui lòng liên hệ tab "Nhân viên".',
  },
  {
    keys: ['hạn sử dụng', 'han su dung', 'hsd', 'expiry', 'het han'],
    response: '⏱️ **Hạn sử dụng (HSD)**\nHệ thống FIFO/FEFO của chúng tôi luôn ưu tiên xuất lô sắp hết hạn trước.\nMỗi sản phẩm bạn nhận sẽ có HSD ≥ 3 tháng (trừ khi bạn chọn lô đang giảm giá vì cận date).',
  },
  {
    keys: ['lúa', 'rice', 'benh lua', 'chan doan'],
    response: '🌾 **Chẩn đoán bệnh lúa**\nDùng tính năng "Chẩn đoán lúa AI" trên menu chính: chụp ảnh lá lúa → AI gợi ý bệnh + thuốc phù hợp.\nKết quả mang tính tham khảo; với cây bị nặng, hãy chuyển nhân viên kỹ thuật.',
  },
];

const BOT_WELCOME =
  '👋 Chào bạn! Tôi là **trợ lý ảo** của Cultivated Ledger.\n\nTôi có thể giúp:\n🛒 Tìm sản phẩm (phân bón, hạt giống, thuốc BVTV, dụng cụ)\n📦 Tra cứu đơn hàng — gửi mã UUID hoặc đăng nhập\n💸 Chính sách giao hàng, đổi trả, thanh toán\n🌾 Hướng dẫn dùng chẩn đoán bệnh lúa AI\n\nChọn câu hỏi gợi ý bên dưới hoặc nhập câu hỏi tự do nhé!';

// Nhóm theo chủ đề để hiển thị có cấu trúc trong widget
const QUICK_QUESTION_GROUPS: Array<{ title: string; questions: string[] }> = [
  {
    title: '🚚 Vận chuyển & Đơn hàng',
    questions: [
      'Chính sách giao hàng?',
      'Tra cứu đơn hàng của tôi',
      'Hủy đơn được không?',
    ],
  },
  {
    title: '↩️ Đổi/Trả & Hoàn tiền',
    questions: [
      'Đổi trả như thế nào?',
      'Khi nào tôi nhận được tiền hoàn?',
      'Báo nhận thiếu hàng',
    ],
  },
  {
    title: '🛒 Sản phẩm',
    questions: [
      'Tìm phân NPK',
      'Có hạt giống lúa OM5451 không?',
      'Hạn sử dụng các lô hàng',
      'Khuyến mãi hôm nay',
    ],
  },
  {
    title: '💳 Khác',
    questions: [
      'Các hình thức thanh toán?',
      'Hotline liên hệ?',
      'Chẩn đoán bệnh lúa',
    ],
  },
];

const BUSINESS_QUICK_QUESTION_GROUPS: Array<{
  title: string;
  questions: string[];
}> = [
  {
    title: 'Đơn hàng',
    questions: ['Đơn hàng của tôi đang ở đâu?', 'Tôi muốn hủy đơn'],
  },
  {
    title: 'Sản phẩm',
    questions: ['Tìm phân NPK', 'Tư vấn hạt giống lúa'],
  },
  {
    title: 'Thanh toán',
    questions: ['Các hình thức thanh toán?', 'Mã giảm giá hôm nay'],
  },
  {
    title: 'Đổi trả',
    questions: ['Đổi trả như thế nào?', 'Bao lâu được hoàn tiền?'],
  },
  {
    title: 'Chẩn đoán lúa',
    questions: ['Cách dùng chẩn đoán bệnh lúa', 'Tôi cần kỹ thuật viên'],
  },
  {
    title: 'Tài khoản',
    questions: ['Tôi quên mật khẩu', 'Gặp nhân viên'],
  },
];

let botMessageIdCounter = 2;

function upsertConversation(
  current: SupportConversation[],
  incoming: SupportConversation,
) {
  const next = current.some(
    (conversation) => conversation.conversationId === incoming.conversationId,
  )
    ? current.map((conversation) =>
        conversation.conversationId === incoming.conversationId
          ? incoming
          : conversation,
      )
    : [incoming, ...current];

  return sortSupportConversations(next);
}

function appendMessage(current: SupportMessage[], incoming: SupportMessage) {
  if (current.some((message) => message.messageId === incoming.messageId)) {
    return current;
  }

  return [...current, incoming].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

function formatMessageTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function getBotResponse(text: string): Promise<string> {
  const raw = text.trim();
  const normalized = stripDiacritics(raw);

  // 1. Order tracking — UUID, "tra cuu don", "don hang cua toi", "ma don"
  const uuidMatch = raw.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (
    uuidMatch ||
    normalized.includes('tra cuu don') ||
    normalized.includes('don hang cua toi') ||
    normalized.includes('ma don') ||
    normalized.includes('order id') ||
    normalized.includes('don cua toi')
  ) {
    if (uuidMatch) {
      try {
        const order = await clientApi.get<any>(`/orders/${uuidMatch[0]}`);
        const STATUS_VI: Record<string, string> = {
          pending: '⏳ Chờ xử lý',
          backordered: '📦 Chờ hàng',
          confirmed: '✅ Đã xác nhận',
          processing: '🔄 Đang xử lý',
          shipping: '🚚 Đang giao',
          delivered: '🎉 Đã giao',
          partial_delivered: '📦 Giao một phần',
          partial_returned: '↩️ Trả một phần',
          cancelled: '❌ Đã hủy',
          returned: '↩️ Đã hoàn',
        };
        const dateStr = order.createdAt
          ? new Date(order.createdAt).toLocaleDateString('vi-VN')
          : '—';
        return [
          `📦 **Đơn hàng ${order.id?.slice(0, 8) ?? '...'}**`,
          `• Trạng thái: ${STATUS_VI[order.status] ?? order.status}`,
          `• Ngày đặt: ${dateStr}`,
          `• Tổng tiền: **${Number(order.totalPayment).toLocaleString('vi-VN')}₫**`,
          `• Số lượng: ${order.totalQuantity} sản phẩm`,
          `• Người nhận: ${order.fullName} (${order.phone})`,
        ].join('\n');
      } catch {
        return 'Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại hoặc đăng nhập để xem danh sách đơn của bạn ở trang "Đơn hàng của tôi".';
      }
    }
    return '📋 **Tra cứu đơn hàng**\n• Đăng nhập rồi vào "Đơn hàng của tôi" để xem toàn bộ.\n• Gửi tôi mã đơn (định dạng UUID 36 ký tự) để tra cứu nhanh.\n• Hoặc gọi hotline **1800 6863**.';
  }

  // 2. Product search
  if (
    normalized.includes('tim san pham') ||
    normalized.includes('tim kiem') ||
    normalized.startsWith('tim ') ||
    normalized.startsWith('mua ') ||
    normalized.includes('co ban ') ||
    normalized.includes('co loai ')
  ) {
    const query = raw
      .replace(/tìm (sản phẩm|kiếm)?|tim (san pham|kiem)?|mua\s+|có bán\s*|có loại\s*/gi, '')
      .trim();
    if (query.length < 2) {
      return 'Bạn muốn tìm sản phẩm gì? Hãy nhập tên sản phẩm cụ thể (VD: "tìm phân NPK 16-16-8").';
    }
    try {
      const data = await clientApi.get<{ items: any[] }>(
        `/products?search=${encodeURIComponent(query)}&limit=5&includeHidden=false`,
      );
      const items = data.items ?? [];
      if (items.length === 0) {
        return `🔍 Không tìm thấy sản phẩm nào khớp với "${query}".\nThử từ khóa khác hoặc vào trang Sản phẩm để xem danh mục đầy đủ.`;
      }
      const list = items
        .slice(0, 5)
        .map((p, i) => {
          const price = Number(p.effectivePrice ?? p.basePrice).toLocaleString('vi-VN');
          const stockNote = p.quantityAvailable > 0 ? `còn ${p.quantityAvailable}` : '⚠️ tạm hết';
          return `${i + 1}. **${p.productName}** — ${price}₫ (${stockNote})`;
        })
        .join('\n');
      return `🔍 Tìm thấy ${items.length} sản phẩm cho "${query}":\n${list}\n\n→ Bấm vào tên sản phẩm trên trang Sản phẩm để xem chi tiết và đặt mua.`;
    } catch {
      return 'Không tải được kết quả tìm kiếm. Vui lòng thử lại sau hoặc kiểm tra kết nối mạng.';
    }
  }

  // 3. Chính sách / FAQ (accent-insensitive)
  for (const item of FAQ_RESPONSES) {
    if (item.keys.some((k) => normalized.includes(stripDiacritics(k)))) {
      return item.response;
    }
  }

  // 4. Greetings
  if (/^(xin chao|chao|hello|hi|hey|alo|chao ban)/.test(normalized)) {
    return [
      'Chào bạn! 👋 Tôi là trợ lý ảo của Cultivated Ledger.',
      '',
      'Tôi có thể giúp:',
      '🛒 Tìm sản phẩm — nhập "tìm phân NPK"',
      '📦 Tra cứu đơn hàng — gửi mã đơn UUID',
      '💸 Chính sách: giao hàng, đổi trả, thanh toán, bảo hành',
      '🌾 Chẩn đoán bệnh lúa — vào menu chính',
      '',
      'Cần gặp nhân viên thật? → Bấm tab **"Nhân viên"** ở trên.',
    ].join('\n');
  }

  // 5. Thanks
  if (/cam on|cảm ơn|thanks|thank you|tks/.test(normalized)) {
    return 'Rất vui được giúp bạn 🙌. Còn câu hỏi nào nữa không?';
  }

  // 6. Default fallback
  return [
    'Tôi chưa hiểu rõ câu hỏi của bạn 🤔.',
    '',
    'Bạn thử các gợi ý sau:',
    '• "Chính sách giao hàng"',
    '• "Đổi trả như thế nào"',
    '• "Tìm phân NPK"',
    '• Gửi mã đơn UUID để tra cứu',
    '',
    'Nếu cần CSKH thật → bấm tab **"Nhân viên"** ở trên.',
  ].join('\n');
}

function buildBotHistory(messages: BotMessage[]) {
  return messages.slice(-10).map((message) => ({
    role: message.from === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));
}

function formatBotCurrency(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }

  return `${amount.toLocaleString('vi-VN')}đ`;
}

export default function Chatbox() {
  const { session } = useClientSession();
  const { showToast } = useToast();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BotTab>('bot');

  const [botMessages, setBotMessages] = useState<BotMessage[]>([
    { id: 1, from: 'bot', text: BOT_WELCOME },
  ]);
  const [botInput, setBotInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [botUnreadCount, setBotUnreadCount] = useState(0);
  const [quickPanelOpen, setQuickPanelOpen] = useState(true);

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<ReturnType<typeof createSupportChatSocket> | null>(
    null,
  );
  const currentConversationIdRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const activeTabRef = useRef<BotTab>('bot');
  const supportMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const botMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const botTimerRef = useRef<number | null>(null);

  const handleAddProductToCart = async (productId: string, productName: string) => {
    setAddingToCartId(productId);
    try {
      await addItem(productId, 1);
      showToast({
        tone: 'success',
        title: 'Đã thêm vào giỏ',
        description: productName,
      });
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Không thêm được',
        description: err instanceof Error ? err.message : 'Vui lòng thử lại sau.',
      });
    } finally {
      setAddingToCartId(null);
    }
  };

  const handleViewProduct = (productId: string) => {
    setOpen(false);
    void navigate(`/client/products/${productId}`);
  };

  const handleBotAction = (action: SupportBotAction) => {
    if (action.type === 'switch_tab') {
      setActiveTab('support');
      return;
    }

    if (action.type === 'send_message') {
      handleSendBotMessage(action.target);
      return;
    }

    if (action.type === 'login') {
      setOpen(false);
      void navigate('/client/login', {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }

    if (action.type === 'view_product') {
      handleViewProduct(action.target);
      return;
    }

    if (action.type === 'add_to_cart') {
      const product = botMessages
        .flatMap((message) => message.products ?? [])
        .find((item) => item.productId === action.target);

      if (product) {
        void handleAddProductToCart(product.productId, product.productName);
      }
      return;
    }

    setOpen(false);
    void navigate(action.target);
  };

  const renderBotText = (text: string) => (
    <div className="space-y-1">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={`gap-${index}`} className="h-1" />;
        }

        const withoutMarkdown = trimmed.replace(/\*\*/g, '');
        const isBullet = /^[-•]\s+/.test(withoutMarkdown);
        const content = withoutMarkdown.replace(/^[-•]\s+/, '');
        const isHeading = index === 0 && content.length <= 72;

        if (isBullet) {
          return (
            <p key={`${content}-${index}`} className="flex gap-1.5">
              <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[#006241]/70" />
              <span>{content}</span>
            </p>
          );
        }

        return (
          <p
            key={`${content}-${index}`}
            className={isHeading ? 'font-black text-[#1E3932]' : undefined}
          >
            {content}
          </p>
        );
      })}
    </div>
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    activeTabRef.current = activeTab;

    if (open && activeTab === 'bot') {
      setBotUnreadCount(0);
    }
  }, [activeTab, open]);

  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { tab?: BotTab } | undefined)
          : undefined;

      setOpen(true);
      setActiveTab(detail?.tab === 'support' ? 'support' : 'bot');
    };

    window.addEventListener('support-chat:open', handleOpenRequest as EventListener);
    return () =>
      window.removeEventListener(
        'support-chat:open',
        handleOpenRequest as EventListener,
      );
  }, []);

  useEffect(() => {
    currentConversationIdRef.current = conversation?.conversationId ?? null;
  }, [conversation?.conversationId]);

  useEffect(() => {
    if (open && activeTab === 'bot') {
      botMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, botMessages, open]);

  useEffect(() => {
    if (open && activeTab === 'support') {
      supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, messages, open]);

  useEffect(() => {
    if (!session?.accessToken) {
      setConversations([]);
      setConversation(null);
      setMessages([]);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    let cancelled = false;
    void clientApi
      .get<SupportConversation[]>('/support-chat/conversations/me')
      .then((items) => {
        if (!cancelled) {
          setConversations(sortSupportConversations(items));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversations([]);
        }
      });

    const socket = createSupportChatSocket(session.accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);

      if (currentConversationIdRef.current) {
        socket.emit('conversation:join', {
          conversationId: currentConversationIdRef.current,
        });
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('support:error', (payload: { message?: string }) => {
      if (payload?.message) {
        showToast({
          tone: 'error',
          title: 'Chat hỗ trợ gặp lỗi',
          description: payload.message,
        });
      }
    });

    socket.on('support:conversation', (incoming: SupportConversation) => {
      setConversations((current) => upsertConversation(current, incoming));
      setConversation((current) =>
        current?.conversationId === incoming.conversationId ? incoming : current,
      );
    });

    socket.on(
      'support:message',
      (payload: { conversationId: string; message: SupportMessage }) => {
        if (payload.conversationId !== currentConversationIdRef.current) {
          return;
        }

        setMessages((current) => appendMessage(current, payload.message));

        if (
          openRef.current &&
          activeTabRef.current === 'support' &&
          socketRef.current?.connected
        ) {
          socketRef.current.emit('conversation:read', {
            conversationId: payload.conversationId,
          });
          return;
        }

        if (
          openRef.current &&
          activeTabRef.current === 'support' &&
          !socketRef.current?.connected
        ) {
          void clientApi
            .patch<SupportConversation>(
              `/support-chat/conversations/${payload.conversationId}/read`,
            )
            .then((nextConversation) => {
              setConversation(nextConversation);
              setConversations((current) =>
                upsertConversation(current, nextConversation),
              );
            })
            .catch(() => {
              /* ignore disconnected read sync */
            });
        }
      },
    );

    socket.on(
      'conversation:joined',
      (
        payload:
          | {
              conversation: SupportConversation;
              messages: SupportMessage[];
            }
          | {
              data: {
                conversation: SupportConversation;
                messages: SupportMessage[];
              };
            },
      ) => {
        const resolved = 'data' in payload ? payload.data : payload;
        if (
          resolved.conversation.conversationId === currentConversationIdRef.current
        ) {
          setConversation(resolved.conversation);
          setConversations((current) =>
            upsertConversation(current, resolved.conversation),
          );
          setMessages(resolved.messages);
        }
      },
    );

    socket.on(
      'conversation:read',
      (
        payload:
          | SupportConversation
          | {
              data: SupportConversation;
            },
      ) => {
        const resolved = 'data' in payload ? payload.data : payload;
        setConversation((current) =>
          current?.conversationId === resolved.conversationId
            ? resolved
            : current,
        );
        setConversations((current) => upsertConversation(current, resolved));
      },
    );

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [session?.accessToken, showToast]);

  useEffect(() => {
    if (open && activeTab === 'support' && session) {
      void ensureConversation();
    }
  }, [activeTab, open, session]);

  useEffect(() => {
    if (
      !open ||
      activeTab !== 'support' ||
      !conversation?.conversationId ||
      socketConnected
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void Promise.all([
        clientApi.patch<SupportConversation>(
          `/support-chat/conversations/${conversation.conversationId}/read`,
        ),
        clientApi.get<SupportMessage[]>(
          `/support-chat/conversations/${conversation.conversationId}/messages?limit=100`,
        ),
      ])
        .then(([nextConversation, history]) => {
          setConversation(nextConversation);
          setConversations((current) =>
            upsertConversation(current, nextConversation),
          );
          setMessages(history);
        })
        .catch(() => {
          /* keep silent while polling fallback is active */
        });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, conversation?.conversationId, open, socketConnected]);

  useEffect(() => {
    return () => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
      }
    };
  }, []);

  const supportUnreadCount = useMemo(
    () =>
      conversations.reduce(
        (total, item) => total + (item.customerUnreadCount ?? 0),
        0,
      ),
    [conversations],
  );
  const totalUnreadCount = supportUnreadCount + botUnreadCount;
  const requireLogin = !session;

  async function ensureConversation() {
    if (!session) {
      return;
    }

    setLoading(true);

    try {
      const activeConversation = await clientApi.post<SupportConversation>(
        '/support-chat/conversations/me/start',
      );

      setConversation(activeConversation);
      setConversations((current) =>
        upsertConversation(current, activeConversation),
      );

      if (socketRef.current?.connected) {
        socketRef.current.emit('conversation:join', {
          conversationId: activeConversation.conversationId,
        });
        socketRef.current.emit('conversation:read', {
          conversationId: activeConversation.conversationId,
        });
      }

      const [readConversation, history] = await Promise.all([
        clientApi.patch<SupportConversation>(
          `/support-chat/conversations/${activeConversation.conversationId}/read`,
        ),
        clientApi.get<SupportMessage[]>(
          `/support-chat/conversations/${activeConversation.conversationId}/messages?limit=100`,
        ),
      ]);

      setConversation(readConversation);
      setConversations((current) =>
        upsertConversation(current, readConversation),
      );
      setMessages(history);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể mở chat hỗ trợ',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSendBotMessage(rawText: string) {
    const text = rawText.trim();

    if (!text || botTyping) {
      return;
    }

    const userMessage: BotMessage = {
      id: botMessageIdCounter++,
      from: 'user',
      text,
    };
    const history = buildBotHistory([...botMessages, userMessage]);

    setBotMessages((current) => [...current, userMessage]);
    setBotInput('');
    setBotTyping(true);

    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current);
    }

    botTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await clientApi.post<SupportBotReply>(
            session?.accessToken
              ? '/support-chat/bot/reply/me'
              : '/support-chat/bot/reply',
            {
              message: text,
              history,
            },
          );
          if (response.cartChanged) {
            void refreshGlobalCart();
          }
          const reply: BotMessage = {
            id: botMessageIdCounter++,
            from: 'bot',
            text: response.reply,
            products: response.products ?? [],
            actions: response.actions ?? [],
            suggestedQuestions: response.suggestedQuestions ?? [],
            severity: response.severity ?? 'info',
          };
          setBotMessages((current) => [...current, reply]);

          if (!openRef.current || activeTabRef.current !== 'bot') {
            setBotUnreadCount((current) => current + 1);
          }
        } catch {
          const fallbackReply: BotMessage = {
            id: botMessageIdCounter++,
            from: 'bot',
            text:
              'Chatbot đang gặp lỗi kết nối.\n- Bạn có thể thử lại sau vài phút.\n- Nếu cần xử lý đơn hàng, hoàn tiền hoặc tư vấn kỹ thuật, hãy chuyển sang nhân viên.',
            actions: [
              {
                type: 'switch_tab',
                label: 'Gặp nhân viên',
                target: 'support',
              },
            ],
            suggestedQuestions: ['Chính sách giao hàng?', 'Đổi trả như thế nào?'],
            severity: 'warning',
          };
          setBotMessages((current) => [...current, fallbackReply]);

          if (!openRef.current || activeTabRef.current !== 'bot') {
            setBotUnreadCount((current) => current + 1);
          }
        } finally {
          setBotTyping(false);
        }
      })();
    }, 700);
  }

  function handleBotSubmit(event: FormEvent) {
    event.preventDefault();
    handleSendBotMessage(botInput);
  }

  async function handleSendSupportMessage(event: FormEvent) {
    event.preventDefault();

    if (!conversation || !draft.trim()) {
      return;
    }

    const content = draft.trim();
    setSending(true);
    setDraft('');

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send', {
          conversationId: conversation.conversationId,
          content,
        });
      } else {
        const result = await clientApi.post<{
          conversation: SupportConversation;
          message: SupportMessage;
        }>(`/support-chat/conversations/${conversation.conversationId}/messages`, {
          content,
        });

        setConversation(result.conversation);
        setConversations((current) =>
          upsertConversation(current, result.conversation),
        );
        setMessages((current) => appendMessage(current, result.message));
      }
    } catch (error) {
      setDraft(content);
      showToast({
        tone: 'error',
        title: 'Gửi tin nhắn thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_6px_rgba(0,0,0,0.24),0_8px_12px_rgba(0,0,0,0.14)] transition-all hover:scale-105 active:scale-95"
        style={{ background: '#00754A' }}
        aria-label="Mở hộp chat"
      >
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {!open && totalUnreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#c82014] text-[10px] font-black text-white">
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="client-card fixed inset-x-2 bottom-20 z-50 flex flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[420px]"
          style={{ height: 'min(640px, calc(100vh - 88px))' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: '#1E3932' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: '#00754A' }}
              >
                <Leaf size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Hỗ trợ Cultivated Ledger
                </p>
                <p className="flex items-center gap-1 text-[10px] text-white/60">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activeTab === 'bot'
                        ? 'bg-green-400'
                        : socketConnected
                          ? 'bg-green-400'
                          : 'bg-amber-400'
                    }`}
                  />
                  {activeTab === 'bot'
                    ? 'Chatbot trả lời nhanh'
                    : socketConnected
                      ? 'Nhân viên đang trực'
                      : 'Đang đồng bộ lại'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 border-b border-black/5 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('bot')}
              className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                activeTab === 'bot'
                  ? 'bg-[#d4e9e2] text-[#006241]'
                  : 'text-gray-500 hover:bg-[#f2f0eb]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Chat bot
                {botUnreadCount > 0 ? (
                  <span className="rounded-full bg-[#c82014] px-2 py-0.5 text-[10px] text-white">
                    {botUnreadCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                activeTab === 'support'
                  ? 'bg-[#d4e9e2] text-[#006241]'
                  : 'text-gray-500 hover:bg-[#f2f0eb]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Nhân viên
                {supportUnreadCount > 0 ? (
                  <span className="rounded-full bg-[#c82014] px-2 py-0.5 text-[10px] text-white">
                    {supportUnreadCount}
                  </span>
                ) : null}
              </span>
            </button>
          </div>

          {activeTab === 'bot' ? (
            <>
              <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
                <div className="space-y-3">
                  {botMessages.map((message) => {
                    const isUser = message.from === 'user';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? 'rounded-br-sm text-white'
                              : 'rounded-bl-sm text-[#1E3932]'
                          }`}
                          style={
                            isUser
                              ? { background: '#006241' }
                              : { background: '#f2f0eb' }
                          }
                        >
                          {isUser ? (
                            <p className="whitespace-pre-line">{message.text}</p>
                          ) : (
                            renderBotText(message.text)
                          )}
                          {!isUser && message.actions?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.actions.map((action) => (
                                <button
                                  key={`${action.type}-${action.target}-${action.label}`}
                                  type="button"
                                  onClick={() => handleBotAction(action)}
                                  className="inline-flex items-center gap-1 rounded-full border border-[#006241]/20 bg-white px-2.5 py-1 text-[11px] font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white"
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {!isUser && message.suggestedQuestions?.length ? (
                            <div className="mt-2 grid grid-cols-1 gap-1.5">
                              {message.suggestedQuestions.slice(0, 3).map((question) => (
                                <button
                                  key={question}
                                  type="button"
                                  disabled={botTyping}
                                  onClick={() => handleSendBotMessage(question)}
                                  className="rounded-lg border border-[#006241]/15 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {question}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {!isUser && message.products?.length ? (
                            <div className="mt-3 space-y-2">
                              {message.products.map((product) => {
                                const outOfStock = product.quantityAvailable <= 0;
                                const isAdding = addingToCartId === product.productId;
                                const hasDiscount =
                                  Number(product.basePrice) >
                                  Number(product.effectivePrice);
                                return (
                                  <div
                                    key={product.productId}
                                    className="overflow-hidden rounded-xl border border-[#006241]/10 bg-white"
                                  >
                                    <div className="flex gap-2.5 p-2">
                                      {product.primaryImageUrl ? (
                                        <button
                                          type="button"
                                          onClick={() => handleViewProduct(product.productId)}
                                          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f2f0eb]"
                                        >
                                          <img
                                            src={product.primaryImageUrl}
                                            alt={product.productName}
                                            className="h-full w-full object-cover transition hover:scale-105"
                                            loading="lazy"
                                          />
                                        </button>
                                      ) : (
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f2f0eb] text-[#006241]/40">
                                          <Package size={24} />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#006241]/70">
                                          {outOfStock ? '⚠️ Tạm hết hàng' : `Còn ${product.quantityAvailable}${product.unit ? ` ${product.unit}` : ''}`}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => handleViewProduct(product.productId)}
                                          className="mt-0.5 line-clamp-2 text-left text-[13px] font-bold leading-snug text-[#1E3932] hover:text-[#006241]"
                                        >
                                          {product.productName}
                                        </button>
                                        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                                          <span className="text-sm font-black text-[#006241]">
                                            {formatBotCurrency(product.effectivePrice)}
                                          </span>
                                          {hasDiscount ? (
                                            <span className="text-[10px] text-gray-400 line-through">
                                              {formatBotCurrency(product.basePrice)}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex border-t border-[#006241]/10">
                                      <button
                                        type="button"
                                        disabled={outOfStock || isAdding}
                                        onClick={() =>
                                          void handleAddProductToCart(
                                            product.productId,
                                            product.productName,
                                          )
                                        }
                                        className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
                                        style={{
                                          color: outOfStock ? '#9ca3af' : '#006241',
                                        }}
                                      >
                                        {isAdding ? (
                                          <LoaderCircle size={12} className="animate-spin" />
                                        ) : (
                                          <ShoppingCart size={12} />
                                        )}
                                        {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
                                      </button>
                                      <div className="w-px bg-[#006241]/10" />
                                      <button
                                        type="button"
                                        onClick={() => handleViewProduct(product.productId)}
                                        className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-[#1E3932] transition hover:bg-[#006241]/5"
                                      >
                                        <ExternalLink size={12} />
                                        Chi tiết
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {botTyping ? (
                    <div className="flex justify-start">
                      <div
                        className="rounded-2xl rounded-bl-sm px-4 py-3"
                        style={{ background: '#f2f0eb' }}
                      >
                        <div className="flex gap-1">
                          {[0, 1, 2].map((index) => (
                            <span
                              key={index}
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#006241]"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div ref={botMessagesEndRef} />
                </div>
              </div>

              <div className="border-t border-black/5 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => setQuickPanelOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#006241]"
                >
                  <span>Câu hỏi nhanh</span>
                  <ChevronDown
                    size={15}
                    className={`transition ${quickPanelOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {quickPanelOpen ? (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {BUSINESS_QUICK_QUESTION_GROUPS.map((group) => (
                      <div key={group.title} className="min-w-0">
                        <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider text-[#006241]/60">
                          {group.title}
                        </p>
                        <div className="space-y-1">
                          {group.questions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              disabled={botTyping}
                              onClick={() => handleSendBotMessage(question)}
                              className="block w-full rounded-lg border border-[#006241]/15 bg-[#f8f7f3] px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-[#006241] transition hover:bg-[#d4e9e2] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <form
                onSubmit={handleBotSubmit}
                className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2.5"
              >
                <input
                  value={botInput}
                  onChange={(event) => setBotInput(event.target.value)}
                  placeholder="Hỏi chatbot điều bạn cần..."
                  className="flex-1 rounded-full bg-[#f2f0eb] px-4 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!botInput.trim() || botTyping}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: '#006241' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : requireLogin ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white px-6 text-center">
              <div className="rounded-full bg-[#d4e9e2] p-4 text-[#006241]">
                <MessageCircle size={26} />
              </div>
              <div>
                <p className="text-lg font-black text-[#1E3932]">
                  Đăng nhập để chat với nhân viên
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Tab này lưu lịch sử chat theo tài khoản khách hàng và đồng bộ
                  phản hồi từ nhân viên theo thời gian thực.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void navigate('/client/login', {
                    state: {
                      from: `${location.pathname}${location.search}`,
                    },
                  })
                }
                className="client-pill-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-bold"
              >
                <LogIn size={16} />
                Đi đến đăng nhập
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-black/5 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {conversation ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        SUPPORT_STATUS_STYLES[conversation.status]
                      }`}
                    >
                      {SUPPORT_STATUS_LABELS[conversation.status]}
                    </span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-[#f2f0eb] px-2.5 py-1 text-[11px] font-semibold text-[#1E3932]">
                    {conversation?.assignedStaff
                      ? `Nhân viên: ${conversation.assignedStaff.username}`
                      : 'Chờ nhân viên nhận chat'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void ensureConversation()}
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#006241]/15 px-2.5 py-1 text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/8"
                  >
                    <RefreshCw size={12} />
                    Đồng bộ
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <LoaderCircle
                      size={20}
                      className="animate-spin text-[#006241]"
                    />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                    Bắt đầu cuộc trò chuyện với nhân viên chăm sóc khách hàng.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isOwn = message.senderRole === 'customer';

                      return (
                        <div
                          key={message.messageId}
                          className={`flex ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                              isOwn
                                ? 'rounded-br-sm text-white'
                                : 'rounded-bl-sm text-[#1E3932]'
                            }`}
                            style={
                              isOwn
                                ? { background: '#006241' }
                                : { background: '#f2f0eb' }
                            }
                          >
                            <p>{message.content}</p>
                            <p
                              className={`mt-2 text-[11px] ${
                                isOwn ? 'text-white/70' : 'text-gray-500'
                              }`}
                            >
                              {message.sender.username} ·{' '}
                              {formatMessageTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={supportMessagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-black/5 bg-white px-3 py-3">
                {conversation?.status === 'resolved' ? (
                  <button
                    type="button"
                    onClick={() => void ensureConversation()}
                    className="client-pill-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold"
                  >
                    <RefreshCw size={15} />
                    Tạo cuộc trò chuyện mới
                  </button>
                ) : (
                  <form
                    onSubmit={(event) => void handleSendSupportMessage(event)}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Nhập tin nhắn của bạn..."
                      className="flex-1 rounded-full bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim() || !conversation}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: '#006241' }}
                    >
                      {sending ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
