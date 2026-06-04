import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Save,
  Send,
  Server,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiClient as api } from '../lib/api';
import { DEFAULT_SMTP_CONFIG, type SmtpConfig } from '../lib/commerce-settings';
import { useToast } from '../hooks/useToast';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

type ActiveTab = 'subscribers' | 'campaigns' | 'automation';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'unsubscribed';
  createdAt: string;
};

type CampaignStatus = 'draft' | 'scheduled' | 'sent';

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  sentAt: string | null;
  scheduledAt: string | null;
  recipientCount: number;
  totalRecipientCount: number;
  createdAt: string;
};

type SubscriberPage = {
  items: Subscriber[];
  total: number;
  page: number;
  limit: number;
};

type AutomationSettings = {
  smtp: SmtpConfig & {
    isConfigured: boolean;
    source: 'settings' | 'env' | 'none';
  };
  scheduler: {
    isEnabled: boolean;
    cron: string;
    intervalMinutes: number;
  };
  scheduledCampaigns: {
    total: number;
    nextScheduledAt: string | null;
  };
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  smtp: {
    ...DEFAULT_SMTP_CONFIG,
    isConfigured: false,
    source: 'none',
  },
  scheduler: {
    isEnabled: true,
    cron: '* * * * *',
    intervalMinutes: 1,
  },
  scheduledCampaigns: {
    total: 0,
    nextScheduledAt: null,
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getMinDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg: Record<CampaignStatus, { label: string; cls: string }> = {
    draft: { label: 'Bản nháp', cls: 'bg-amber-100 text-amber-700' },
    scheduled: { label: 'Đã lên lịch', cls: 'bg-sky-100 text-sky-700' },
    sent: { label: 'Đã gửi', cls: 'bg-emerald-100 text-emerald-700' },
  };

  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = 'text-primary',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
      <p className={`flex items-center justify-center gap-1 text-2xl font-black ${accent}`}>
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

export default function Newsletter() {
  const { showToast } = useToast();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<ActiveTab>('subscribers');

  const [subscriberData, setSubscriberData] = useState<SubscriberPage | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subStatus, setSubStatus] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingCamId, setDeletingCamId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);

  const [automation, setAutomation] = useState<AutomationSettings>(
    DEFAULT_AUTOMATION_SETTINGS,
  );
  const [smtpForm, setSmtpForm] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);

  const previewRef = useRef<HTMLIFrameElement>(null);

  const campaignStats = useMemo(() => {
    const draftCount = campaigns.filter((campaign) => campaign.status === 'draft').length;
    const scheduledCount = campaigns.filter(
      (campaign) => campaign.status === 'scheduled',
    ).length;
    const sentCount = campaigns.filter((campaign) => campaign.status === 'sent').length;

    return {
      total: campaigns.length,
      draftCount,
      scheduledCount,
      sentCount,
    };
  }, [campaigns]);

  const totalPages = subscriberData ? Math.ceil(subscriberData.total / subscriberData.limit) : 1;
  const minScheduleValue = useMemo(() => getMinDateTimeInputValue(), []);

  const syncAutomationState = (next: AutomationSettings) => {
    setAutomation(next);
    setSmtpForm({
      host: next.smtp.host,
      port: next.smtp.port,
      user: next.smtp.user,
      pass: next.smtp.pass,
      from: next.smtp.from,
      secure: next.smtp.secure,
    });
  };

  const loadSubscribers = async (page = subPage, status = subStatus) => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });

      if (status) {
        params.set('status', status);
      }

      const data = await api.get<SubscriberPage>(
        `/newsletter/subscribers?${params.toString()}`,
      );
      setSubscriberData(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không tải được danh sách người đăng ký',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSubLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setCampaignLoading(true);
    try {
      const data = await api.get<Campaign[]>('/newsletter/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không tải được chiến dịch email',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setCampaignLoading(false);
    }
  };

  const loadAutomation = async () => {
    setAutomationLoading(true);
    try {
      const data = await api.get<AutomationSettings>('/newsletter/automation');
      syncAutomationState(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không tải được cấu hình gửi mail tự động',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  const refreshCampaignArea = async () => {
    await Promise.all([loadCampaigns(), loadAutomation()]);
  };

  useEffect(() => {
    if (activeTab === 'subscribers') {
      void loadSubscribers(subPage, subStatus);
    }
  }, [activeTab, subPage, subStatus]);

  useEffect(() => {
    if (activeTab === 'campaigns' || activeTab === 'automation') {
      void loadAutomation();
    }

    if (activeTab === 'campaigns') {
      void loadCampaigns();
    }
  }, [activeTab]);

  useEffect(() => {
    if (previewCampaign && previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewCampaign.body);
        doc.close();
      }
    }
  }, [previewCampaign]);

  const openEditor = (campaign?: Campaign) => {
    setEditingCampaign(campaign ?? null);
    setFormSubject(campaign?.subject ?? '');
    setFormBody(campaign?.body ?? '');
    setFormScheduledAt(toDateTimeInputValue(campaign?.scheduledAt ?? null));
    setShowEditor(true);
  };

  const handleDeleteSubscriber = async (id: string) => {
    const ok = await askConfirm({
      title: 'Xóa người đăng ký?',
      description: 'Email này sẽ bị gỡ khỏi danh sách nhận newsletter.',
      tone: 'danger',
      confirmLabel: 'Xóa',
    });
    if (!ok) {
      return;
    }

    setDeletingSubId(id);
    try {
      await api.delete(`/newsletter/subscribers/${id}`);
      showToast({ tone: 'success', title: 'Đã xóa người đăng ký' });
      await loadSubscribers();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Xóa thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setDeletingSubId(null);
    }
  };

  const handleSaveCampaign = async () => {
    if (!formSubject.trim() || !formBody.trim()) {
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        subject: formSubject.trim(),
        body: formBody,
        scheduledAt: formScheduledAt
          ? new Date(formScheduledAt).toISOString()
          : null,
      };

      if (editingCampaign) {
        await api.put(`/newsletter/campaigns/${editingCampaign.id}`, payload);
      } else {
        await api.post('/newsletter/campaigns', payload);
      }

      setShowEditor(false);
      showToast({
        tone: 'success',
        title: editingCampaign ? 'Đã cập nhật chiến dịch' : 'Đã tạo chiến dịch',
      });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không lưu được chiến dịch',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setFormSaving(false);
    }
  };

  const handleSendCampaign = async (id: string, subject: string) => {
    const ok = await askConfirm({
      title: `Gửi chiến dịch "${subject}"?`,
      description: 'Chiến dịch sẽ được gửi ngay tới danh sách người đăng ký đang hoạt động.',
      tone: 'warning',
      confirmLabel: 'Gửi ngay',
    });
    if (!ok) {
      return;
    }

    setSendingId(id);
    try {
      const result = await api.post<{ sent: number; total: number }>(
        `/newsletter/campaigns/${id}/send`,
      );
      showToast({
        tone: 'success',
        title: `Đã gửi ${result.sent}/${result.total} email`,
      });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Gửi chiến dịch thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    const ok = await askConfirm({
      title: 'Xóa chiến dịch?',
      description: 'Bản nháp hoặc chiến dịch này sẽ bị xóa khỏi hệ thống newsletter.',
      tone: 'danger',
      confirmLabel: 'Xóa',
    });
    if (!ok) {
      return;
    }

    setDeletingCamId(id);
    try {
      await api.delete(`/newsletter/campaigns/${id}`);
      showToast({ tone: 'success', title: 'Đã xóa chiến dịch' });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Xóa thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setDeletingCamId(null);
    }
  };

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const smtp = await api.put<AutomationSettings['smtp']>(
        '/newsletter/automation/smtp',
        { smtp: smtpForm },
      );

      setAutomation((current) => ({
        ...current,
        smtp: {
          ...smtp,
        },
      }));

      setSmtpForm({
        host: smtp.host,
        port: smtp.port,
        user: smtp.user,
        pass: smtp.pass,
        from: smtp.from,
        secure: smtp.secure,
      });

      showToast({ tone: 'success', title: 'Đã lưu cấu hình SMTP' });
      await loadAutomation();
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

  return (
    <div className="space-y-6 pb-12">
      {ConfirmDialog}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          Newsletter & Email
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Quản lý subscriber, chiến dịch email và cấu hình gửi mail tự động.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border border-on-surface/8 bg-surface p-1">
        {([
          { id: 'subscribers', label: 'Người đăng ký', icon: Users },
          { id: 'campaigns', label: 'Chiến dịch', icon: FileText },
          { id: 'automation', label: 'Tự động gửi', icon: Mail },
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
            {id === 'subscribers' && subscriberData ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === id ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'
                }`}
              >
                {subscriberData.total}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'subscribers' && (
        <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
            <div className="flex items-center gap-3">
              <select
                value={subStatus}
                onChange={(event) => {
                  setSubStatus(event.target.value);
                  setSubPage(1);
                }}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang đăng ký</option>
                <option value="unsubscribed">Đã hủy</option>
              </select>
            </div>
            <p className="text-sm text-on-surface-variant">
              {subscriberData ? `${subscriberData.total} người đăng ký` : ''}
            </p>
          </div>

          {subLoading ? (
            <div className="flex justify-center py-16">
              <LoaderCircle size={28} className="animate-spin text-primary" />
            </div>
          ) : (subscriberData?.items.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <Mail size={36} className="mb-3 text-primary/30" />
              <p className="text-sm">Chưa có người đăng ký nào</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                    <tr>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Tên</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4">Ngày đăng ký</th>
                      <th className="px-5 py-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-on-surface/6 text-sm">
                    {subscriberData?.items.map((subscriber) => (
                      <tr key={subscriber.id} className="hover:bg-surface/40">
                        <td className="px-5 py-4 font-medium text-on-surface">
                          {subscriber.email}
                        </td>
                        <td className="px-5 py-4 text-on-surface-variant">
                          {subscriber.name || '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                              subscriber.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {subscriber.status === 'active' ? 'Đang đăng ký' : 'Đã hủy'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-on-surface-variant">
                          {formatDate(subscriber.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSubscriber(subscriber.id)}
                            disabled={deletingSubId === subscriber.id}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                  <p className="text-sm text-on-surface-variant">
                    Trang {subPage}/{totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSubPage((current) => Math.max(1, current - 1))}
                      disabled={subPage === 1}
                      className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSubPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={subPage === totalPages}
                      className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'campaigns' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Tổng chiến dịch"
              value={campaignStats.total}
              icon={<FileText size={14} />}
            />
            <StatCard
              label="Bản nháp"
              value={campaignStats.draftCount}
              icon={<Pencil size={14} />}
              accent="text-amber-600"
            />
            <StatCard
              label="Đã lên lịch"
              value={campaignStats.scheduledCount}
              icon={<CalendarClock size={14} />}
              accent="text-sky-600"
            />
            <StatCard
              label="Đã gửi"
              value={campaignStats.sentCount}
              icon={<CheckCircle2 size={14} />}
              accent="text-emerald-600"
            />
          </div>

          <section
            className={`rounded-xl border px-5 py-4 shadow-sm ${
              automation.smtp.isConfigured
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-on-surface">
                  {automation.smtp.isConfigured
                    ? 'Hệ thống sẵn sàng gửi mail tự động'
                    : 'Chưa có SMTP để gửi mail tự động'}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Server quét chiến dịch đến hạn mỗi {automation.scheduler.intervalMinutes}{' '}
                  phút. Lần gửi tiếp theo:{' '}
                  {automation.scheduledCampaigns.nextScheduledAt
                    ? formatDate(automation.scheduledCampaigns.nextScheduledAt)
                    : 'chưa có'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('automation')}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition hover:bg-primary hover:text-white"
              >
                Mở cấu hình gửi tự động
              </button>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openEditor()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              <Plus size={16} />
              Tạo chiến dịch mới
            </button>
          </div>

          {campaignLoading ? (
            <div className="flex justify-center py-16">
              <LoaderCircle size={28} className="animate-spin text-primary" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-on-surface/8 bg-white py-16 text-on-surface-variant shadow-sm">
              <FileText size={40} className="mb-3 text-primary/30" />
              <p className="text-sm">Chưa có chiến dịch nào. Hãy tạo chiến dịch đầu tiên.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <section
                  key={campaign.id}
                  className="rounded-xl border border-on-surface/8 bg-white px-6 py-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        campaign.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-600'
                          : campaign.status === 'scheduled'
                            ? 'bg-sky-100 text-sky-600'
                            : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {campaign.status === 'sent' ? (
                        <CheckCircle2 size={20} />
                      ) : campaign.status === 'scheduled' ? (
                        <CalendarClock size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-lg font-black text-on-surface">
                          {campaign.subject}
                        </h2>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        {campaign.status === 'sent'
                          ? `Đã gửi ${campaign.recipientCount}/${campaign.totalRecipientCount} người vào ${formatDate(campaign.sentAt)}`
                          : campaign.status === 'scheduled'
                            ? `Hẹn gửi vào ${formatDate(campaign.scheduledAt)}`
                            : `Tạo lúc ${formatDate(campaign.createdAt)}`}
                      </p>
                      {campaign.status === 'sent' &&
                      campaign.totalRecipientCount > campaign.recipientCount ? (
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Còn {campaign.totalRecipientCount - campaign.recipientCount} email gửi thất bại.
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                        {campaign.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewCampaign(campaign)}
                        className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface hover:text-primary"
                        title="Xem trước"
                      >
                        <Eye size={16} />
                      </button>

                      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditor(campaign)}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface hover:text-primary"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSendCampaign(campaign.id, campaign.subject)}
                            disabled={sendingId === campaign.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {sendingId === campaign.id ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Gửi
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCampaign(campaign.id)}
                            disabled={deletingCamId === campaign.id}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'automation' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="SMTP"
              value={automation.smtp.isConfigured ? 'Sẵn sàng' : 'Chưa xong'}
              icon={<Server size={14} />}
              accent={automation.smtp.isConfigured ? 'text-emerald-600' : 'text-amber-600'}
            />
            <StatCard
              label="Tần suất quét"
              value={`Mỗi ${automation.scheduler.intervalMinutes} phút`}
              icon={<Clock size={14} />}
              accent="text-sky-600"
            />
            <StatCard
              label="Chờ gửi"
              value={automation.scheduledCampaigns.total}
              icon={<CalendarClock size={14} />}
              accent="text-primary"
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-on-surface/8 bg-white shadow-sm">
            <div className="border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                Cấu hình gửi mail tự động
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Hệ thống sẽ tự động gửi campaign có <code className="rounded bg-surface px-1">`scheduledAt`</code> đến hạn. SMTP này
                cũng được dùng cho email thông báo.
              </p>
            </div>

            {automationLoading ? (
              <div className="flex justify-center py-16">
                <LoaderCircle size={28} className="animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-3 border-b border-on-surface/8 bg-surface/50 px-6 py-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Trạng thái SMTP
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.smtp.isConfigured ? 'Đã sẵn sàng' : 'Chưa đầy đủ'}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Nguồn cấu hình:{' '}
                      {automation.smtp.source === 'settings'
                        ? 'admin settings'
                        : automation.smtp.source === 'env'
                          ? '.env fallback'
                          : 'chưa có'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Cron Scheduler
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.scheduler.cron}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Server quét chiến dịch mỗi {automation.scheduler.intervalMinutes}{' '}
                      phút.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Lần gửi sắp tới
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.scheduledCampaigns.nextScheduledAt
                        ? formatDate(automation.scheduledCampaigns.nextScheduledAt)
                        : 'Chưa có'}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Đang chờ gửi: {automation.scheduledCampaigns.total} chiến dịch
                    </p>
                  </div>
                </div>

                {!automation.smtp.isConfigured && (
                  <div className="mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <p>
                        Chưa có đủ cấu hình SMTP. Campaign lên lịch sẽ không gửi được
                        cho đến khi host, user và password hợp lệ được lưu.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                      SMTP Host
                    </label>
                    <input
                      value={smtpForm.host}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.port}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.user}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      Mật khẩu / App password
                    </label>
                    <input
                      type="password"
                      value={smtpForm.pass}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
                          ...current,
                          pass: event.target.value,
                        }))
                      }
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                      From Email
                    </label>
                    <input
                      value={smtpForm.from}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                        checked={smtpForm.secure}
                        onChange={(event) =>
                          setSmtpForm((current) => ({
                            ...current,
                            secure: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-on-surface/20"
                      />
                      Bật Secure Mode (thường dùng với port 465)
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                  <p className="text-xs text-on-surface-variant">
                    Nếu để trống, backend vẫn có thể fallback sang SMTP trong <code className="rounded bg-surface px-1">.env</code>.
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
              </>
            )}
          </section>
        </>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-sm"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                {editingCampaign ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch mới'}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(event) => setFormSubject(event.target.value)}
                  placeholder="VD: Khuyến mãi tháng 5"
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Lên lịch gửi (tùy chọn)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(event) => setFormScheduledAt(event.target.value)}
                  min={minScheduleValue}
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                />
                <p className="mt-1 text-xs text-on-surface-variant">
                  Nếu để trống, campaign sẽ ở trạng thái bản nháp. Nếu có thời gian,
                  cron sẽ gửi tự động khi đến hạn.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Nội dung email (HTML) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formBody}
                  onChange={(event) => setFormBody(event.target.value)}
                  rows={12}
                  placeholder={'<h2>Xin chào</h2>\n<p>Chúng tôi có ưu đãi mới dành cho bạn...</p>'}
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-on-surface/8 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCampaign()}
                disabled={formSaving || !formSubject.trim() || !formBody.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {formSaving ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Lưu chiến dịch
              </button>
            </div>
          </div>
        </div>
      )}

      {previewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-sm"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                Xem trước: {previewCampaign.subject}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              <iframe
                ref={previewRef}
                title="Newsletter preview"
                className="h-full w-full rounded-2xl border border-on-surface/8"
                style={{ minHeight: 420 }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
