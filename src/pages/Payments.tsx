import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LoaderCircle,
  Mail,
  RefreshCw,
  Save,
  Search,
  Settings,
  ToggleLeft,
  ToggleRight,
  UserRound,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import {
  AdminCommerceSettings,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SMTP_CONFIG,
  PaymentMethodConfig,
  PaymentMethodKey,
  PaymentSettings,
  SmtpConfig,
} from '../lib/commerce-settings';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';

type TxStatus = 'pending' | 'success' | 'failed';

type TxItem = {
  id: string;
  orderId: string;
  provider: string;
  transactionRef: string;
  transactionStatus: TxStatus;
  paymentStatus: string;
  amount: string;
  gatewayCode: string | null;
  gatewayMessage: string | null;
  createdAt: string;
  user: { username: string; email: string } | null;
};

type TxResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: TxItem[];
};

type RefundStatus = 'pending' | 'approved' | 'completed' | 'failed';
type RefundReason =
  | 'return'
  | 'cancel_paid_order'
  | 'short_delivery'
  | 'manual_adjustment';

type RefundItem = {
  refundId: string;
  orderId: string;
  returnId: string | null;
  reason: RefundReason;
  amount: string;
  refundStatus: RefundStatus;
  paymentProvider: string | null;
  manualReference: string | null;
  createdBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalPayment: string;
    fullName: string;
    phone: string;
  } | null;
  user: { username: string; email: string } | null;
};

type RefundResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: RefundItem[];
};

type PaymentTab = 'config' | 'transactions' | 'refunds' | 'smtp';

type MethodFieldKey = Exclude<
  keyof PaymentMethodConfig,
  'isActive' | 'description'
>;

type MethodField = {
  key: MethodFieldKey;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
};

const PAYMENT_METHODS: Array<{
  key: PaymentMethodKey;
  label: string;
  description: string;
  color: string;
  icon: string;
  fields?: MethodField[];
}> = [
  {
    key: 'cod',
    label: 'COD (Thanh toán khi nhận hàng)',
    description: 'Khách hàng thanh toán trực tiếp khi nhận hàng.',
    color: '#6b7280',
    icon: '💵',
  },
  {
    key: 'bank_transfer',
    label: 'Chuyển khoản ngân hàng',
    description: 'Chuyển khoản qua tài khoản ngân hàng của cửa hàng.',
    color: '#0065AC',
    icon: '🏦',
    fields: [
      {
        key: 'bankName',
        label: 'Tên ngân hàng',
        placeholder: 'VD: Vietcombank',
      },
      {
        key: 'accountNumber',
        label: 'Số tài khoản',
        placeholder: '0123456789',
      },
      {
        key: 'accountHolder',
        label: 'Chủ tài khoản',
        placeholder: 'CONG TY ABC',
      },
    ],
  },
  {
    key: 'momo',
    label: 'MoMo',
    description: 'Thanh toán qua ví điện tử MoMo.',
    color: '#AE2070',
    icon: '💗',
    fields: [
      {
        key: 'partnerCode',
        label: 'Partner code',
        placeholder: 'MOMO',
      },
      {
        key: 'accessKey',
        label: 'Access key',
        placeholder: 'MoMo access key',
      },
      {
        key: 'secretKey',
        label: 'Secret key',
        placeholder: 'MoMo secret key',
        type: 'password',
      },
    ],
  },
  {
    key: 'vnpay',
    label: 'VNPay',
    description: 'Thanh toán qua cổng thanh toán VNPay.',
    color: '#005BAA',
    icon: '🔵',
    fields: [
      {
        key: 'tmnCode',
        label: 'TMN code',
        placeholder: 'VNPay TMN code',
      },
      {
        key: 'hashSecret',
        label: 'Hash secret',
        placeholder: 'VNPay hash secret',
        type: 'password',
      },
    ],
  },
  {
    key: 'zalopay',
    label: 'ZaloPay',
    description: 'Thanh toán qua ví ZaloPay.',
    color: '#0068FF',
    icon: '⚡',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'ZaloPay app id',
      },
      {
        key: 'key1',
        label: 'Key 1',
        placeholder: 'ZaloPay key 1',
        type: 'password',
      },
      {
        key: 'key2',
        label: 'Key 2',
        placeholder: 'ZaloPay key 2',
        type: 'password',
      },
    ],
  },
];

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  cod: { label: 'COD', color: '#6b7280' },
  bank_transfer: { label: 'Chuyển khoản', color: '#0065AC' },
  momo: { label: 'MoMo', color: '#AE2070' },
  vnpay: { label: 'VNPay', color: '#005BAA' },
  zalopay: { label: 'ZaloPay', color: '#0068FF' },
  paypal: { label: 'PayPal', color: '#003087' },
  credit: { label: 'Công nợ', color: '#007A4D' },
};

const STATUS_CFG: Record<TxStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'bg-amber-100 text-amber-700' },
  success: { label: 'Thành công', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Thất bại', cls: 'bg-red-100 text-red-700' },
};

const REFUND_STATUS_CFG: Record<RefundStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Đã duyệt', cls: 'bg-sky-100 text-sky-700' },
  completed: { label: 'Đã hoàn', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Thất bại', cls: 'bg-red-100 text-red-700' },
};

const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  return: 'Trả hàng',
  cancel_paid_order: 'Hủy đơn đã thu tiền',
  short_delivery: 'Giao thiếu',
  manual_adjustment: 'Điều chỉnh thủ công',
};

function formatVND(amount: string | number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(amount));
}

function mergePaymentSettings(
  settings?: Partial<PaymentSettings> | null,
): PaymentSettings {
  const next: PaymentSettings = {
    cod: { ...DEFAULT_PAYMENT_SETTINGS.cod },
    bank_transfer: { ...DEFAULT_PAYMENT_SETTINGS.bank_transfer },
    momo: { ...DEFAULT_PAYMENT_SETTINGS.momo },
    vnpay: { ...DEFAULT_PAYMENT_SETTINGS.vnpay },
    zalopay: { ...DEFAULT_PAYMENT_SETTINGS.zalopay },
  };
  if (!settings) {
    return next;
  }

  for (const method of PAYMENT_METHODS) {
    next[method.key] = {
      ...next[method.key],
      ...(settings[method.key] ?? {}),
    };
  }

  return next;
}

function mergeSmtpConfig(settings?: Partial<SmtpConfig> | null): SmtpConfig {
  return {
    ...DEFAULT_SMTP_CONFIG,
    ...(settings ?? {}),
  };
}

function resolvePaymentTab(value: string | null): PaymentTab {
  return value === 'transactions' || value === 'refunds' || value === 'smtp'
    ? value
    : 'config';
}

export default function Payments() {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PaymentTab>(() =>
    resolvePaymentTab(searchParams.get('tab')),
  );

  const [config, setConfig] = useState<PaymentSettings>(
    DEFAULT_PAYMENT_SETTINGS,
  );
  const [smtp, setSmtp] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const [items, setItems] = useState<TxItem[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [refundMeta, setRefundMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundReloadKey, setRefundReloadKey] = useState(0);
  const [refundActionId, setRefundActionId] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterProvider, setFilterProvider] = useState(
    searchParams.get('provider') ?? '',
  );
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get('status') ?? '',
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));
  const [refundStatus, setRefundStatus] = useState(
    searchParams.get('refundStatus') ?? '',
  );
  const [refundReason, setRefundReason] = useState(
    searchParams.get('reason') ?? '',
  );
  const [refundOrderId, setRefundOrderId] = useState(
    searchParams.get('orderId') ?? '',
  );
  const [refundPage, setRefundPage] = useState(
    Number(searchParams.get('refundPage') ?? '1'),
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [isVi],
  );

  useEffect(() => {
    const nextTab = resolvePaymentTab(searchParams.get('tab'));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);

    void apiClient
      .get<AdminCommerceSettings>('/settings/admin/commerce')
      .then((data) => {
        if (cancelled) {
          return;
        }

        setConfig(mergePaymentSettings(data.payments));
        setSmtp(mergeSmtpConfig(data.smtp));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: 'Không tải được cấu hình thanh toán',
            description: error instanceof Error ? error.message : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setConfigLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);

    if (activeTab === 'transactions') {
      if (search.trim()) {
        next.set('search', search.trim());
      }
      if (filterProvider) {
        next.set('provider', filterProvider);
      }
      if (filterStatus) {
        next.set('status', filterStatus);
      }
      if (page > 1) {
        next.set('page', String(page));
      }
    }
    if (activeTab === 'refunds') {
      if (refundStatus) {
        next.set('refundStatus', refundStatus);
      }
      if (refundReason) {
        next.set('reason', refundReason);
      }
      if (refundOrderId.trim()) {
        next.set('orderId', refundOrderId.trim());
      }
      if (refundPage > 1) {
        next.set('refundPage', String(refundPage));
      }
    }

    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    filterProvider,
    filterStatus,
    page,
    refundOrderId,
    refundPage,
    refundReason,
    refundStatus,
    search,
    setSearchParams,
  ]);

  useEffect(() => {
    setPage(1);
  }, [filterProvider, filterStatus, search]);

  useEffect(() => {
    setRefundPage(1);
  }, [refundReason, refundStatus, refundOrderId]);

  useEffect(() => {
    if (activeTab !== 'transactions') {
      return;
    }

    let cancelled = false;
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      limit: '20',
    });
    if (filterProvider) {
      query.set('provider', filterProvider);
    }
    if (filterStatus) {
      query.set('status', filterStatus);
    }

    void apiClient
      .get<TxResponse>(`/payments/admin/transactions?${query.toString()}`)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setItems(data.items ?? []);
        setMeta(data.meta);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: 'Không tải được giao dịch',
            description: error instanceof Error ? error.message : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    filterProvider,
    filterStatus,
    page,
    reloadKey,
    showToast,
  ]);

  useEffect(() => {
    if (activeTab !== 'refunds') {
      return;
    }

    let cancelled = false;
    setRefundLoading(true);
    const query = new URLSearchParams({
      page: String(refundPage),
      limit: '20',
    });
    if (refundStatus) query.set('status', refundStatus);
    if (refundReason) query.set('reason', refundReason);
    if (refundOrderId.trim()) query.set('orderId', refundOrderId.trim());

    void apiClient
      .get<RefundResponse>(`/payments/admin/refunds?${query.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setRefundItems(data.items ?? []);
          setRefundMeta(data.meta);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: 'Không tải được danh sách hoàn tiền',
            description: error instanceof Error ? error.message : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRefundLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    refundOrderId,
    refundPage,
    refundReason,
    refundReloadKey,
    refundStatus,
    showToast,
  ]);

  const filteredItems = search.trim()
    ? items.filter((item) => {
        const normalizedSearch = search.toLowerCase();
        return (
          item.transactionRef.toLowerCase().includes(normalizedSearch) ||
          item.orderId.toLowerCase().includes(normalizedSearch) ||
          item.user?.username?.toLowerCase().includes(normalizedSearch) ||
          item.user?.email?.toLowerCase().includes(normalizedSearch)
        );
      })
    : items;

  const totalSuccess = items.filter(
    (item) => item.transactionStatus === 'success',
  ).length;
  const totalFailed = items.filter(
    (item) => item.transactionStatus === 'failed',
  ).length;
  const totalRevenue = items
    .filter((item) => item.transactionStatus === 'success')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const handleToggle = (key: PaymentMethodKey) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        isActive: !current[key].isActive,
      },
    }));
  };

  const handleDescChange = (key: PaymentMethodKey, value: string) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        description: value,
      },
    }));
  };

  const handleFieldChange = (
    key: PaymentMethodKey,
    field: MethodFieldKey,
    value: string,
  ) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  };

  const persistPaymentSettings = async (
    successTitle: string,
    key?: PaymentMethodKey,
  ) => {
    setPaymentSaving(true);
    try {
      const saved = await apiClient.put<PaymentSettings>(
        '/settings/admin/payments',
        { payments: config },
      );
      setConfig(mergePaymentSettings(saved));
      if (key) {
        setSavedKey(key);
        window.setTimeout(() => setSavedKey(null), 2000);
      }
      showToast({ tone: 'success', title: successTitle });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không lưu được cấu hình thanh toán',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSaveMethod = async (key: PaymentMethodKey) => {
    await persistPaymentSettings('Đã lưu cấu hình thanh toán', key);
  };

  const handleSaveAll = async () => {
    await persistPaymentSettings('Đã lưu tất cả cấu hình thanh toán');
  };

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const saved = await apiClient.put<SmtpConfig>('/settings/admin/smtp', {
        smtp,
      });
      setSmtp(mergeSmtpConfig(saved));
      showToast({ tone: 'success', title: 'Đã lưu cấu hình SMTP' });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không lưu được cấu hình SMTP',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleRefundStatus = async (
    refund: RefundItem,
    status: RefundStatus,
  ) => {
    let manualReference: string | undefined;
    let note: string | undefined;
    if (status === 'completed') {
      manualReference =
        window.prompt(
          'Nhập mã chứng từ hoặc tham chiếu hoàn tiền thủ công:',
          refund.manualReference ?? '',
        )?.trim() || undefined;
      if (!manualReference) {
        showToast({ tone: 'warning', title: 'Cần mã chứng từ hoàn tiền' });
        return;
      }
    }
    if (status === 'failed') {
      note =
        window.prompt('Ghi chú lý do hoàn tiền thất bại:', refund.note ?? '')
          ?.trim() || undefined;
    }

    setRefundActionId(refund.refundId);
    try {
      await apiClient.patch(`/payments/admin/refunds/${refund.refundId}/status`, {
        status,
        manualReference,
        note,
      });
      setRefundReloadKey((current) => current + 1);
      showToast({
        tone: 'success',
        title:
          status === 'completed'
            ? 'Đã chốt hoàn tiền'
            : status === 'approved'
              ? 'Đã duyệt hoàn tiền'
              : 'Đã cập nhật hoàn tiền',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không cập nhật được hoàn tiền',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setRefundActionId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVi ? 'Quản lý thanh toán' : 'Payment Management'}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {isVi
              ? 'Cấu hình cổng thanh toán, SMTP và theo dõi giao dịch.'
              : 'Configure payment gateways, SMTP and track transactions.'}
          </p>
        </div>
        {activeTab === 'config' && (
          <button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={configLoading || paymentSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={15} /> Lưu tất cả
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-2xl border border-on-surface/8 bg-surface p-1 w-fit">
        {([
          {
            id: 'config',
            label: isVi ? 'Phương thức thanh toán' : 'Payment methods',
            icon: Settings,
          },
          {
            id: 'smtp',
            label: isVi ? 'SMTP / Email' : 'SMTP / Email',
            icon: Mail,
          },
          {
            id: 'transactions',
            label: isVi ? 'Lịch sử giao dịch' : 'Transactions',
            icon: BarChart3,
          },
          {
            id: 'refunds',
            label: isVi ? 'Hoàn tiền' : 'Refunds',
            icon: RefreshCw,
          },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === id
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <>
          {configLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {PAYMENT_METHODS.map((method) => {
                const cfg = config[method.key];
                const isSaved = savedKey === method.key;
                return (
                  <section
                    key={method.key}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                      cfg.isActive
                        ? 'border-on-surface/12'
                        : 'border-on-surface/6 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-4 border-b border-on-surface/8 px-6 py-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{ background: `${method.color}18` }}
                      >
                        {method.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-on-surface">
                          {method.label}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {cfg.isActive
                            ? isVi
                              ? 'Đang hoạt động'
                              : 'Active'
                            : isVi
                              ? 'Đang tắt'
                              : 'Inactive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(method.key)}
                        className="shrink-0 transition"
                        title={cfg.isActive ? 'Tắt' : 'Bật'}
                      >
                        {cfg.isActive ? (
                          <ToggleRight
                            size={36}
                            style={{ color: method.color }}
                          />
                        ) : (
                          <ToggleLeft
                            size={36}
                            className="text-on-surface-variant/30"
                          />
                        )}
                      </button>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                          Mô tả hiển thị cho khách
                        </label>
                        <textarea
                          value={cfg.description}
                          onChange={(event) =>
                            handleDescChange(method.key, event.target.value)
                          }
                          rows={3}
                          className="w-full resize-none rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                        />
                      </div>

                      <div className="rounded-2xl bg-surface p-4 text-sm text-on-surface-variant">
                        <p className="font-bold text-on-surface">Trạng thái</p>
                        <p className="mt-1">
                          {cfg.isActive
                            ? 'Phương thức này sẽ hiển thị cho khách và được backend cho phép sử dụng.'
                            : 'Phương thức này sẽ bị ẩn ở client và backend từ chối nếu client gọi trực tiếp.'}
                        </p>
                      </div>

                      {method.fields?.map((field) => (
                        <div key={`${method.key}-${field.key}`}>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                            {field.label}
                          </label>
                          <input
                            type={field.type ?? 'text'}
                            value={String(cfg[field.key] ?? '')}
                            onChange={(event) =>
                              handleFieldChange(
                                method.key,
                                field.key,
                                event.target.value,
                              )
                            }
                            placeholder={field.placeholder}
                            className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end border-t border-on-surface/6 px-6 py-3">
                      <button
                        type="button"
                        onClick={() => void handleSaveMethod(method.key)}
                        disabled={paymentSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500"
                            />{' '}
                            Đã lưu
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Lưu
                          </>
                        )}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'smtp' && (
        <>
          {configLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
              <div className="border-b border-on-surface/8 px-6 py-5">
                <h2 className="text-lg font-black text-on-surface">
                  Cấu hình SMTP
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Newsletter và email notification sẽ dùng chung cấu hình này.
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    SMTP host
                  </label>
                  <input
                    value={smtp.host}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        host: event.target.value,
                      }))
                    }
                    placeholder="smtp.gmail.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Port
                  </label>
                  <input
                    value={smtp.port}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        port: event.target.value,
                      }))
                    }
                    placeholder="587"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Username
                  </label>
                  <input
                    value={smtp.user}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        user: event.target.value,
                      }))
                    }
                    placeholder="user@example.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Password / App password
                  </label>
                  <input
                    type="password"
                    value={smtp.pass}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        pass: event.target.value,
                      }))
                    }
                    placeholder="******"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    From email
                  </label>
                  <input
                    value={smtp.from}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                    placeholder="no-reply@example.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={smtp.secure}
                      onChange={(event) =>
                        setSmtp((current) => ({
                          ...current,
                          secure: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-on-surface/20"
                    />
                    Bật secure mode (thường dùng cho port 465)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                <p className="text-xs text-on-surface-variant">
                  Nếu bỏ trống, backend sẽ tiếp tục fallback sang biến môi trường
                  `.env`.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveSmtp()}
                  disabled={smtpSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {smtpSaving ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Lưu SMTP
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'refunds' && (
        <>
          <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_210px_auto]">
              <input
                value={refundOrderId}
                onChange={(event) => setRefundOrderId(event.target.value)}
                placeholder="Tìm theo mã đơn"
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
              />
              <select
                value={refundStatus}
                onChange={(event) => setRefundStatus(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(REFUND_STATUS_CFG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <select
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả lý do</option>
                {Object.entries(REFUND_REASON_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRefundReloadKey((current) => current + 1)}
                disabled={refundLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                <RefreshCw size={15} className={refundLoading ? 'animate-spin' : ''} />
                Làm mới
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  <tr>
                    <th className="px-4 py-4">Đơn hàng</th>
                    <th className="px-4 py-4">Khách</th>
                    <th className="px-4 py-4">Lý do</th>
                    <th className="px-4 py-4">Số tiền</th>
                    <th className="px-4 py-4">Chứng từ</th>
                    <th className="px-4 py-4">Trạng thái</th>
                    <th className="px-4 py-4">Ngày tạo</th>
                    <th className="px-4 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6">
                  {refundLoading ? (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">Đang tải hoàn tiền...</td></tr>
                  ) : refundItems.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">Chưa có hoàn tiền cần hiển thị.</td></tr>
                  ) : (
                    refundItems.map((refund) => {
                      const status = REFUND_STATUS_CFG[refund.refundStatus];
                      const busy = refundActionId === refund.refundId;
                      return (
                        <tr key={refund.refundId} className="align-top hover:bg-surface/40">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-primary">#{refund.orderId.slice(-8).toUpperCase()}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">{refund.order?.paymentStatus ?? '-'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{refund.order?.fullName ?? refund.user?.username ?? '-'}</p>
                            <p className="text-xs text-on-surface-variant">{refund.order?.phone ?? refund.user?.email ?? '-'}</p>
                          </td>
                          <td className="px-4 py-3">{REFUND_REASON_LABEL[refund.reason]}</td>
                          <td className="px-4 py-3 font-bold">{formatVND(refund.amount)}</td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{refund.manualReference ?? '-'}</p>
                            {refund.note ? <p className="mt-1 max-w-56 text-xs text-on-surface-variant">{refund.note}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.cls}`}>{status.label}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{dateFormatter.format(new Date(refund.createdAt))}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {refund.refundStatus === 'pending' ? (
                                <button type="button" onClick={() => void handleRefundStatus(refund, 'approved')} disabled={busy} className="rounded-xl border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700 disabled:opacity-50">Duyệt</button>
                              ) : null}
                              {refund.refundStatus === 'pending' || refund.refundStatus === 'approved' ? (
                                <>
                                  <button type="button" onClick={() => void handleRefundStatus(refund, 'completed')} disabled={busy} className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Hoàn tất</button>
                                  <button type="button" onClick={() => void handleRefundStatus(refund, 'failed')} disabled={busy} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50">Thất bại</button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {refundMeta.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4">
                <p className="text-xs text-on-surface-variant">Trang {refundMeta.page}/{refundMeta.totalPages} · {refundMeta.total} hoàn tiền</p>
                <div className="flex gap-2">
                  <button type="button" disabled={refundPage <= 1} onClick={() => setRefundPage((current) => current - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 disabled:opacity-40"><ChevronLeft size={16} /></button>
                  <button type="button" disabled={refundPage >= refundMeta.totalPages} onClick={() => setRefundPage((current) => current + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 disabled:opacity-40"><ChevronRight size={16} /></button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Lịch sử giao dịch dùng để đối soát MoMo, VNPay, COD và thu tiền công nợ. Dữ liệu ở đây giúp kiểm tra giao dịch thành công, chờ xử lý, thất bại, callback muộn và các khoản thu thủ công cần chứng từ.
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Tổng GD', value: meta.total, color: 'text-primary' },
              {
                label: 'Thành công',
                value: totalSuccess,
                color: 'text-emerald-600',
              },
              {
                label: 'Thất bại',
                value: totalFailed,
                color: 'text-red-500',
              },
              {
                label: 'Doanh thu',
                value: formatVND(totalRevenue),
                color: 'text-primary',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm"
              >
                <p className={`text-2xl font-black ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto]">
              <label className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã GD, đơn hàng, người dùng..."
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
                />
              </label>

              <select
                value={filterProvider}
                onChange={(event) => setFilterProvider(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả phương thức</option>
                {Object.entries(PROVIDER_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xử lý</option>
                <option value="success">Thành công</option>
                <option value="failed">Thất bại</option>
              </select>

              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? 'animate-spin' : ''}
                />
                Làm mới
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  <tr>
                    <th className="px-4 py-4">Mã giao dịch</th>
                    <th className="px-4 py-4">Đơn hàng</th>
                    <th className="px-4 py-4">Người dùng</th>
                    <th className="px-4 py-4">Phương thức</th>
                    <th className="px-4 py-4">Số tiền</th>
                    <th className="px-4 py-4 text-center">Trạng thái</th>
                    <th className="px-4 py-4">Ngày</th>
                    <th className="px-4 py-4">Mã GW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6 text-sm">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-on-surface-variant"
                      >
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle size={16} className="animate-spin" />{' '}
                          Đang tải...
                        </span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-on-surface-variant"
                      >
                        <CreditCard
                          size={28}
                          className="mx-auto mb-3 text-primary/30"
                        />
                        Không có giao dịch
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((transaction) => {
                      const providerInfo =
                        PROVIDER_LABELS[transaction.provider] ?? {
                          label: transaction.provider,
                          color: '#6b7280',
                        };
                      const statusInfo =
                        STATUS_CFG[transaction.transactionStatus] ?? {
                          label: transaction.transactionStatus,
                          cls: 'bg-gray-100 text-gray-700',
                        };

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-surface/40"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                            {transaction.transactionRef
                              .slice(-12)
                              .toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="cursor-pointer text-primary hover:underline">
                              {transaction.orderId.slice(-8).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {transaction.user ? (
                              <div>
                                <p className="font-semibold text-on-surface">
                                  {transaction.user.username}
                                </p>
                                <p className="text-[11px] text-on-surface-variant/60">
                                  {transaction.user.email}
                                </p>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black text-white"
                              style={{ background: providerInfo.color }}
                            >
                              {providerInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-on-surface">
                            {formatVND(transaction.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.cls}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                            {dateFormatter.format(
                              new Date(transaction.createdAt),
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">
                            {transaction.gatewayCode ?? '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4">
                <p className="text-xs text-on-surface-variant">
                  Trang {meta.page}/{meta.totalPages} · {meta.total} giao dịch
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
