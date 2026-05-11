import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  KeyRound,
  ImagePlus,
  LoaderCircle,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';
import Modal from '../components/shared/Modal';

type UserRole = 'admin' | 'staff' | 'customer';
type StatusFilter = 'all' | 'active' | 'inactive';
type AvatarThemeId =
  | 'forest'
  | 'sunset'
  | 'ocean'
  | 'ember'
  | 'violet'
  | 'slate'
  | 'mint'
  | 'coral'
  | 'navy'
  | 'gold'
  | 'berry'
  | 'teal';

type AvatarHairStyle =
  | 'bob'
  | 'long'
  | 'short'
  | 'side'
  | 'wave'
  | 'curly';

type AvatarAccessory = 'none' | 'glasses' | 'cap';

type AvatarOutfit = 'hoodie' | 'tee' | 'collar';

type AvatarFaceShape = 'soft' | 'oval';

type Customer = {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  role: {
    _id: UserRole;
    name: UserRole;
  };
  isActive: boolean;
  isWholesale?: boolean;
  createdAt: string;
  updatedAt?: string;
};

type CustomerDetail = Customer & {
  statistics: {
    addressesCount: number;
    ordersCount: number;
  };
};

type CustomersResponse = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  items: Customer[];
};

type CustomerFormState = {
  username: string;
  email: string;
  password: string;
  avatarUrl: string;
  role: UserRole;
  isActive: boolean;
  isWholesale: boolean;
};

type CustomerFormErrors = Partial<Record<keyof CustomerFormState, string>>;

const defaultFormState: CustomerFormState = {
  username: '',
  email: '',
  password: '',
  avatarUrl: '',
  role: 'customer',
  isActive: true,
  isWholesale: false,
};

const DEFAULT_AVATAR_THEME: AvatarThemeId = 'forest';

const AVATAR_THEMES: Array<{
  id: AvatarThemeId;
  label: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  ring: string;
  skin: string;
  skinShadow: string;
  hair: string;
  hairShine: string;
  shirt: string;
  shirtShadow: string;
  eye: string;
  hairStyle: AvatarHairStyle;
  accessory: AvatarAccessory;
  outfit: AvatarOutfit;
  faceShape: AvatarFaceShape;
}> = [
  {
    id: 'forest',
    label: 'Nữ tóc bob',
    bgStart: '#d8f3c8',
    bgEnd: '#77c061',
    accent: '#1f5c1b',
    ring: '#eaf6e3',
    skin: '#f0c7a1',
    skinShadow: '#d49a72',
    hair: '#284822',
    hairShine: '#49753f',
    shirt: '#1f5c1b',
    shirtShadow: '#153e12',
    eye: '#22311d',
    hairStyle: 'bob',
    accessory: 'none',
    outfit: 'hoodie',
    faceShape: 'soft',
  },
  {
    id: 'sunset',
    label: 'Nữ tóc dài',
    bgStart: '#ffe0b8',
    bgEnd: '#ff9b6a',
    accent: '#9a3412',
    ring: '#fff2e0',
    skin: '#f4c9b4',
    skinShadow: '#d69a7b',
    hair: '#7c2d12',
    hairShine: '#c45b2d',
    shirt: '#c2410c',
    shirtShadow: '#9a3412',
    eye: '#4a2216',
    hairStyle: 'long',
    accessory: 'none',
    outfit: 'collar',
    faceShape: 'soft',
  },
  {
    id: 'ocean',
    label: 'Nam tóc ngắn',
    bgStart: '#c7f0ff',
    bgEnd: '#5db7ff',
    accent: '#0f4c81',
    ring: '#e4f7ff',
    skin: '#f1cfb2',
    skinShadow: '#d5a27c',
    hair: '#103a63',
    hairShine: '#2f6da2',
    shirt: '#0f4c81',
    shirtShadow: '#0b395f',
    eye: '#17324d',
    hairStyle: 'short',
    accessory: 'none',
    outfit: 'tee',
    faceShape: 'oval',
  },
  {
    id: 'ember',
    label: 'Nữ tóc xoăn',
    bgStart: '#ffd5d5',
    bgEnd: '#ff7b7b',
    accent: '#a61b1b',
    ring: '#ffeaea',
    skin: '#eab998',
    skinShadow: '#cd8767',
    hair: '#671515',
    hairShine: '#b12d2d',
    shirt: '#991b1b',
    shirtShadow: '#7f1d1d',
    eye: '#391818',
    hairStyle: 'curly',
    accessory: 'none',
    outfit: 'hoodie',
    faceShape: 'soft',
  },
  {
    id: 'violet',
    label: 'Nữ đeo kính',
    bgStart: '#eadcff',
    bgEnd: '#b486ff',
    accent: '#6d28d9',
    ring: '#f3ebff',
    skin: '#f3cbb7',
    skinShadow: '#d39a83',
    hair: '#4c1d95',
    hairShine: '#7f56d9',
    shirt: '#6d28d9',
    shirtShadow: '#4c1d95',
    eye: '#2f1d52',
    hairStyle: 'wave',
    accessory: 'glasses',
    outfit: 'collar',
    faceShape: 'soft',
  },
  {
    id: 'slate',
    label: 'Nam đeo kính',
    bgStart: '#e5edf3',
    bgEnd: '#94a3b8',
    accent: '#334155',
    ring: '#f3f6f9',
    skin: '#efc5ab',
    skinShadow: '#cb9476',
    hair: '#1f2937',
    hairShine: '#4b5563',
    shirt: '#334155',
    shirtShadow: '#1e293b',
    eye: '#111827',
    hairStyle: 'side',
    accessory: 'glasses',
    outfit: 'collar',
    faceShape: 'oval',
  },
  {
    id: 'mint',
    label: 'Nam đội mũ',
    bgStart: '#d7fff1',
    bgEnd: '#6ee7b7',
    accent: '#0f766e',
    ring: '#ebfffa',
    skin: '#efc7a9',
    skinShadow: '#cc936f',
    hair: '#12524a',
    hairShine: '#2f8277',
    shirt: '#0f766e',
    shirtShadow: '#115e59',
    eye: '#163b37',
    hairStyle: 'short',
    accessory: 'cap',
    outfit: 'hoodie',
    faceShape: 'oval',
  },
  {
    id: 'coral',
    label: 'Nữ tóc dài sáng',
    bgStart: '#ffe5dd',
    bgEnd: '#fb7185',
    accent: '#be123c',
    ring: '#fff1ed',
    skin: '#f6cfb7',
    skinShadow: '#d79d84',
    hair: '#9f1239',
    hairShine: '#fb7185',
    shirt: '#e11d48',
    shirtShadow: '#9f1239',
    eye: '#4c1727',
    hairStyle: 'long',
    accessory: 'none',
    outfit: 'tee',
    faceShape: 'soft',
  },
  {
    id: 'navy',
    label: 'Nam tóc side',
    bgStart: '#dbeafe',
    bgEnd: '#2563eb',
    accent: '#1d4ed8',
    ring: '#eff6ff',
    skin: '#efc8aa',
    skinShadow: '#cd9571',
    hair: '#142f6e',
    hairShine: '#3b82f6',
    shirt: '#1d4ed8',
    shirtShadow: '#1e3a8a',
    eye: '#14213d',
    hairStyle: 'side',
    accessory: 'none',
    outfit: 'collar',
    faceShape: 'oval',
  },
  {
    id: 'gold',
    label: 'Nữ bob sáng',
    bgStart: '#fef3c7',
    bgEnd: '#fbbf24',
    accent: '#b45309',
    ring: '#fffbeb',
    skin: '#f4ccaf',
    skinShadow: '#d49c78',
    hair: '#b45309',
    hairShine: '#f59e0b',
    shirt: '#ca8a04',
    shirtShadow: '#a16207',
    eye: '#5b3415',
    hairStyle: 'bob',
    accessory: 'none',
    outfit: 'hoodie',
    faceShape: 'soft',
  },
  {
    id: 'berry',
    label: 'Nữ tóc gợn',
    bgStart: '#fce7f3',
    bgEnd: '#ec4899',
    accent: '#9d174d',
    ring: '#fdf2f8',
    skin: '#f2c6b0',
    skinShadow: '#d08e7a',
    hair: '#831843',
    hairShine: '#db2777',
    shirt: '#be185d',
    shirtShadow: '#9d174d',
    eye: '#4a1230',
    hairStyle: 'wave',
    accessory: 'none',
    outfit: 'tee',
    faceShape: 'soft',
  },
  {
    id: 'teal',
    label: 'Nam hoodie',
    bgStart: '#ccfbf1',
    bgEnd: '#14b8a6',
    accent: '#0f766e',
    ring: '#f0fdfa',
    skin: '#f0c9a9',
    skinShadow: '#cc9370',
    hair: '#134e4a',
    hairShine: '#2dd4bf',
    shirt: '#0f766e',
    shirtShadow: '#134e4a',
    eye: '#173f3b',
    hairStyle: 'short',
    accessory: 'none',
    outfit: 'hoodie',
    faceShape: 'oval',
  },
];

function normalizeCustomer<T extends Customer>(customer: T): T {
  return {
    ...customer,
    isActive: Boolean(customer.isActive),
  };
}

export default function Customers() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>(
    (searchParams.get('role') as UserRole | 'all') ?? 'all',
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) ?? 'all',
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersMeta, setCustomersMeta] = useState<CustomersResponse['meta']>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));
  const [limit, setLimit] = useState(Number(searchParams.get('limit') ?? '12'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CustomerFormState>(defaultFormState);
  const [selectedAvatarTheme, setSelectedAvatarTheme] = useState<AvatarThemeId | null>(DEFAULT_AVATAR_THEME);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (search.trim()) nextParams.set('search', search.trim());
    if (roleFilter !== 'all') nextParams.set('role', roleFilter);
    if (statusFilter !== 'all') nextParams.set('status', statusFilter);
    if (page > 1) nextParams.set('page', String(page));
    if (limit !== 12) nextParams.set('limit', String(limit));
    setSearchParams(nextParams, { replace: true });
  }, [limit, page, roleFilter, search, setSearchParams, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
          ...(statusFilter !== 'all'
            ? { isActive: String(statusFilter === 'active') }
            : {}),
        });
        const data = await apiClient.get<CustomersResponse>(`/users?${query.toString()}`);

        if (!cancelled) {
          setCustomers(data.items.map(normalizeCustomer));
          setCustomersMeta(data.meta);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
                ? 'Không tải được danh sách tài khoản'
                : 'Unable to load accounts',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCustomers();
    return () => {
      cancelled = true;
    };
  }, [isVietnamese, limit, page, roleFilter, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const activeUsers = customers.filter((customer) => customer.isActive).length;
    const admins = customers.filter((customer) => customer.role._id === 'admin').length;
    const staff = customers.filter((customer) => customer.role._id === 'staff').length;

    return { activeUsers, admins, staff };
  }, [customers]);

  function updateCustomerInList(nextCustomer: Customer) {
    setCustomers((current) =>
      current.map((customer) =>
        customer._id === nextCustomer._id
          ? normalizeCustomer({ ...customer, ...nextCustomer })
          : customer,
      ),
    );
  }

  function resetForm() {
    setFormMode('create');
    setEditingCustomerId(null);
    setFormState(defaultFormState);
    setSelectedAvatarTheme(DEFAULT_AVATAR_THEME);
    setAvatarFile(null);
    setAvatarPickerOpen(false);
    setFormErrors({});
    setFormOpen(false);
  }

  function closeDetailModal() {
    setDetailOpen(false);
    setSelectedCustomer(null);
    setSelectedCustomerId(null);
  }

  function openResetPasswordModal() {
    setResetPasswordValue('');
    setResetPasswordError(null);
    setResetPasswordOpen(true);
  }

  async function handleResetPassword() {
    if (!selectedCustomer) return;

    if (resetPasswordValue.trim().length < 6) {
      setResetPasswordError(
        isVietnamese ? 'Mật khẩu mới tối thiểu 6 ký tự' : 'New password must be at least 6 characters',
      );
      return;
    }

    setResettingPassword(true);

    try {
      await apiClient.patch(`/users/admin/customers/${selectedCustomer._id}/reset-password`, {
        newPassword: resetPasswordValue.trim(),
      });
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã reset mật khẩu' : 'Password reset',
        description: selectedCustomer.username,
      });
      setResetPasswordOpen(false);
      setResetPasswordValue('');
      setResetPasswordError(null);
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : isVietnamese
            ? 'Không reset được mật khẩu'
            : 'Unable to reset password';
      setResetPasswordError(message);
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleDeleteCustomer() {
    if (!selectedCustomer) return;

    setDeletingCustomer(true);

    try {
      await apiClient.delete(`/users/admin/customers/${selectedCustomer._id}`);
      setCustomers((current) =>
        current.filter((customer) => customer._id !== selectedCustomer._id),
      );
      setCustomersMeta((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã xóa tài khoản' : 'Account deleted',
        description: selectedCustomer.username,
      });
      setDeleteOpen(false);
      closeDetailModal();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : isVietnamese
            ? 'Không xóa được tài khoản'
            : 'Unable to delete account';
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Xóa tài khoản thất bại' : 'Delete failed',
        description: message,
      });
    } finally {
      setDeletingCustomer(false);
    }
  }

  function openCreateModal() {
    setFormMode('create');
    setEditingCustomerId(null);
    setFormState(defaultFormState);
    setSelectedAvatarTheme(DEFAULT_AVATAR_THEME);
    setAvatarPickerOpen(false);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEditModal(customer: Customer | CustomerDetail) {
    setFormMode('edit');
    setEditingCustomerId(customer._id);
    setFormErrors({});
    setFormState({
      username: customer.username,
      email: customer.email,
      password: '',
      avatarUrl: customer.avatarUrl ?? '',
      role: customer.role._id,
      isActive: Boolean(customer.isActive),
      isWholesale: Boolean(customer.isWholesale),
    });
    setSelectedAvatarTheme(parseGeneratedAvatarTheme(customer.avatarUrl) ?? null);
    setAvatarFile(null);
    setAvatarPickerOpen(false);
    setFormOpen(true);
  }

  async function openDetailModal(customerId: string) {
    setDetailOpen(true);
    setSelectedCustomerId(customerId);
    setDetailLoading(true);

    try {
      const data = await apiClient.get<CustomerDetail>(`/users/admin/customers/${customerId}`);
      setSelectedCustomer(normalizeCustomer(data) as CustomerDetail);
    } catch (detailError) {
      const message =
        detailError instanceof Error
          ? detailError.message
          : isVietnamese
            ? 'Không tải được chi tiết tài khoản'
            : 'Unable to load account detail';
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Tải tài khoản thất bại' : 'Unable to load account',
        description: message,
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function validateForm() {
    const nextErrors: CustomerFormErrors = {};

    if (!formState.username.trim()) {
      nextErrors.username = isVietnamese ? 'Tên tài khoản là bắt buộc' : 'Username is required';
    }

    if (!formState.email.trim()) {
      nextErrors.email = isVietnamese ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formState.email.trim())) {
      nextErrors.email = isVietnamese ? 'Email không hợp lệ' : 'Invalid email';
    }

    if (formMode === 'create' && !formState.password.trim()) {
      nextErrors.password = isVietnamese ? 'Mật khẩu là bắt buộc' : 'Password is required';
    } else if (formState.password.trim() && formState.password.trim().length < 6) {
      nextErrors.password = isVietnamese ? 'Mật khẩu tối thiểu 6 ký tự' : 'Password must be at least 6 characters';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const payload = {
      username: formState.username.trim(),
      email: formState.email.trim(),
      password: formState.password.trim() || undefined,
      avatarUrl: buildSelectedAvatarUrl(
        formState.username,
        selectedAvatarTheme,
        formState.avatarUrl,
      ),
      role: formState.role,
      isActive: formState.isActive,
      isWholesale: formState.isWholesale,
    };

    try {
      const savedCustomer =
        formMode === 'create'
          ? await apiClient.post<Customer>('/users/admin/customers', payload)
          : await apiClient.patch<Customer>(
              `/users/admin/customers/${editingCustomerId}`,
              payload,
            );
      const normalizedSavedCustomer = normalizeCustomer(savedCustomer);
      let finalSavedCustomer = normalizedSavedCustomer;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploaded = await apiClient.postForm<Customer>(
          `/users/admin/customers/${normalizedSavedCustomer._id}/avatar`,
          formData,
        );
        finalSavedCustomer = normalizeCustomer(uploaded);
      }

      if (formMode === 'create') {
        setPage(1);
      } else {
        updateCustomerInList(finalSavedCustomer);
        if (selectedCustomer?._id === finalSavedCustomer._id) {
          setSelectedCustomer((current) =>
            current
              ? {
                  ...current,
                  ...finalSavedCustomer,
                }
              : current,
          );
        }
      }

      showToast({
        tone: 'success',
        title:
          formMode === 'create'
            ? isVietnamese
              ? 'Tạo tài khoản thành công'
              : 'Account created'
            : isVietnamese
              ? 'Cập nhật tài khoản thành công'
              : 'Account updated',
        description: finalSavedCustomer.username,
      });

      resetForm();
      if (formMode === 'create') {
        setSearch('');
        setRoleFilter('all');
        setStatusFilter('all');
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : isVietnamese
            ? 'Không lưu được tài khoản'
            : 'Unable to save account';
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lưu tài khoản thất bại' : 'Save failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAccountStatus(customer: Customer | CustomerDetail) {
    setStatusUpdating(true);

    try {
      const updatedCustomer = await apiClient.patch<Customer>(
        `/users/admin/customers/${customer._id}/status`,
        {
          isActive: !customer.isActive,
        },
      );
      const normalizedUpdatedCustomer = normalizeCustomer(updatedCustomer);

      updateCustomerInList(normalizedUpdatedCustomer);
      if (selectedCustomer?._id === normalizedUpdatedCustomer._id) {
        setSelectedCustomer((current) =>
          current
            ? {
                ...current,
                ...normalizedUpdatedCustomer,
              }
            : current,
        );
      }

      showToast({
        tone: 'success',
        title: normalizedUpdatedCustomer.isActive
          ? isVietnamese
            ? 'Đã kích hoạt tài khoản'
            : 'Account activated'
          : isVietnamese
            ? 'Đã khóa tài khoản'
            : 'Account disabled',
        description: normalizedUpdatedCustomer.username,
      });
    } catch (statusError) {
      const message =
        statusError instanceof Error
          ? statusError.message
          : isVietnamese
            ? 'Không cập nhật được trạng thái'
            : 'Unable to update status';
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật trạng thái thất bại' : 'Status update failed',
        description: message,
      });
    } finally {
      setStatusUpdating(false);
    }
  }

  function exportCustomers() {
    const headers = ['id', 'username', 'email', 'role', 'isActive', 'createdAt'];
    const rows = customers.map((customer) => [
      customer._id,
      customer.username,
      customer.email,
      customer.role.name,
      customer.isActive ? 'true' : 'false',
      customer.createdAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'accounts-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-headline text-[2.75rem] font-black leading-tight tracking-tight text-primary">
            {isVietnamese ? 'Khách hàng và tài khoản' : 'Customers and Accounts'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Quan tri toan bo tai khoan nguoi dung: loc, xem chi tiet, tao moi, chinh sua va khoa mo tai khoan.'
              : 'Manage all user accounts: filter, inspect, create, update, and enable or disable access.'}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={exportCustomers}
            className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white px-6 py-3 text-sm font-bold text-primary transition-all hover:border-primary/20"
          >
            <Download size={18} />
            <span>{isVietnamese ? 'Xuất dữ liệu' : 'Export'}</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-all hover:shadow-sm"
          >
            <Plus size={18} />
            <span>{isVietnamese ? 'Thêm tài khoản' : 'Add account'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KpiCard
          title={isVietnamese ? 'Tổng tài khoản' : 'Total accounts'}
          value={String(customersMeta.total)}
          growth={isVietnamese ? '+truc tiep' : '+live'}
        />
        <KpiCard
          title={isVietnamese ? 'Người dùng hoạt động' : 'Active users'}
          value={String(stats.activeUsers)}
          growth={isVietnamese ? '+dong bo' : '+synced'}
        />
        <KpiCard
          title={isVietnamese ? 'Admin / Nhan su' : 'Admin / Staff'}
          value={`${stats.admins} / ${stats.staff}`}
          highlight={isVietnamese ? 'Phân tách vai trò' : 'Role split'}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-on-surface-variant/5 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-on-surface-variant/5 bg-white/50 p-6 backdrop-blur-sm">
          <div className="flex flex-wrap gap-3">
            <FilterChip
              active={roleFilter === 'all'}
              label={isVietnamese ? 'Tất cả vai trò' : 'All roles'}
              onClick={() => setRoleFilter('all')}
            />
            <FilterChip
              active={roleFilter === 'admin'}
              label={isVietnamese ? 'Quản trị' : 'Admin'}
              onClick={() => setRoleFilter('admin')}
            />
            <FilterChip
              active={roleFilter === 'staff'}
              label={isVietnamese ? 'Nhân sự' : 'Staff'}
              onClick={() => setRoleFilter('staff')}
            />
            <FilterChip
              active={roleFilter === 'customer'}
              label={isVietnamese ? 'Khách hàng' : 'Customer'}
              onClick={() => setRoleFilter('customer')}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder={isVietnamese ? 'Tim kiem nguoi dung...' : 'Search users...'}
                className="w-full rounded-full border-none bg-on-surface-variant/5 py-2.5 pl-12 pr-6 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="flex rounded-full bg-on-surface-variant/5 p-1">
              <StatusTab
                active={statusFilter === 'all'}
                label={isVietnamese ? 'Tất cả' : 'All'}
                onClick={() => setStatusFilter('all')}
              />
              <StatusTab
                active={statusFilter === 'active'}
                label={isVietnamese ? 'Hoạt động' : 'Active'}
                onClick={() => setStatusFilter('active')}
              />
              <StatusTab
                active={statusFilter === 'inactive'}
                label={isVietnamese ? 'Tạm khóa' : 'Inactive'}
                onClick={() => setStatusFilter('inactive')}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="m-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-on-surface-variant/[0.02]">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                  {isVietnamese ? 'Tài khoản' : 'Account'}
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                  Email
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                  {isVietnamese ? 'Vai trò' : 'Role'}
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                  {isVietnamese ? 'Trạng thái' : 'Status'}
                </th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-sm text-on-surface-variant">
                    {isVietnamese ? 'Dang tai danh sach tai khoan...' : 'Loading accounts...'}
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Users2 className="text-primary/60" size={28} />
                      <div>
                        <p className="font-black text-primary">
                          {isVietnamese ? 'Không có tài khoản phù hợp' : 'No matching accounts'}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {isVietnamese
                            ? 'Backend khong tra ve nguoi dung nao voi bo loc hien tai.'
                            : 'The backend returned no users for the current filters.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer._id}
                    className="group transition-colors hover:bg-on-surface-variant/[0.02]"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          name={customer.username}
                          avatarUrl={customer.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <p className="text-base font-bold text-on-surface">{customer.username}</p>
                          <p className="text-xs font-medium text-on-surface-variant/60">{customer._id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-on-surface-variant">
                      {customer.email}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-primary/5 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                          {translateRole(customer.role.name, isVietnamese)}
                        </span>
                        {customer.isWholesale && (
                          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                            Khách sỉ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge isActive={customer.isActive} isVietnamese={isVietnamese} />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetailModal(customer._id)}
                        className="rounded-xl p-2 text-on-surface-variant transition-all hover:bg-primary/5 hover:text-primary"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 pb-6 sm:px-8">
          <Pagination
            page={customersMeta.page}
            limit={customersMeta.limit}
            total={customersMeta.total}
            totalPages={customersMeta.totalPages}
            isVietnamese={isVietnamese}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            pageSizeOptions={[12, 24, 48]}
          />
        </div>
      </div>

      <Modal
        open={detailOpen}
        onClose={closeDetailModal}
        size="lg"
        title={isVietnamese ? 'Chi tiết tài khoản' : 'Account detail'}
        footer={
          selectedCustomer ? (
            <>
              <button
                type="button"
                onClick={() => openEditModal(selectedCustomer)}
                className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface"
              >
                <UserCog size={16} />
                {isVietnamese ? 'Chỉnh sửa tài khoản' : 'Edit account'}
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => void toggleAccountStatus(selectedCustomer)}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
              >
                {statusUpdating ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {selectedCustomer.isActive
                  ? isVietnamese
                    ? 'Khóa tài khoản'
                    : 'Disable account'
                  : isVietnamese
                    ? 'Kích hoạt tài khoản'
                    : 'Activate account'}
              </button>
              <button
                type="button"
                onClick={openResetPasswordModal}
                className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface"
              >
                <KeyRound size={16} />
                {isVietnamese ? 'Reset mật khẩu' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
              >
                <Trash2 size={16} />
                {isVietnamese ? 'Xóa tài khoản' : 'Delete account'}
              </button>
            </>
          ) : undefined
        }
      >
        {detailLoading || !selectedCustomer ? (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            {isVietnamese ? 'Dang tai chi tiet tai khoan...' : 'Loading account detail...'}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl border border-on-surface/10 bg-surface px-5 py-4">
              <UserAvatar
                name={selectedCustomer.username}
                avatarUrl={selectedCustomer.avatarUrl}
                size="lg"
              />
              <div>
                <h4 className="text-xl font-black text-primary">{selectedCustomer.username}</h4>
                <p className="mt-1 text-sm text-on-surface-variant">{selectedCustomer.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    {translateRole(selectedCustomer.role.name, isVietnamese)}
                  </span>
                  <StatusBadge isActive={selectedCustomer.isActive} isVietnamese={isVietnamese} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard
                label={isVietnamese ? 'Mã tài khoản' : 'Account ID'}
                value={selectedCustomer._id}
              />
              <DetailCard
                label={isVietnamese ? 'Cập nhật lần cuối' : 'Last updated'}
                value={formatDate(selectedCustomer.updatedAt ?? selectedCustomer.createdAt, language)}
              />
              <DetailCard
                label={isVietnamese ? 'Địa chỉ giao hàng' : 'Shipping addresses'}
                value={String(selectedCustomer.statistics.addressesCount)}
              />
              <DetailCard
                label={isVietnamese ? 'Tổng đơn hàng' : 'Total orders'}
                value={String(selectedCustomer.statistics.ordersCount)}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={resetPasswordOpen}
        onClose={() => {
          setResetPasswordOpen(false);
          setResetPasswordValue('');
          setResetPasswordError(null);
        }}
        size="md"
        title={isVietnamese ? 'Reset mật khẩu' : 'Reset password'}
        description={
          selectedCustomer
            ? isVietnamese
              ? `Dat mat khau moi cho tai khoan ${selectedCustomer.username}.`
              : `Set a new password for ${selectedCustomer.username}.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setResetPasswordOpen(false);
                setResetPasswordValue('');
                setResetPasswordError(null);
              }}
              className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant"
            >
              {isVietnamese ? 'Đóng' : 'Close'}
            </button>
            <button
              type="button"
              disabled={resettingPassword}
              onClick={() => void handleResetPassword()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
            >
              {resettingPassword ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {isVietnamese ? 'Xác nhận reset' : 'Confirm reset'}
            </button>
          </>
        }
      >
        <FieldLabel label={isVietnamese ? 'Mật khẩu mới' : 'New password'}>
          <input
            type="password"
            value={resetPasswordValue}
            onChange={(event) => {
              setResetPasswordValue(event.target.value);
              setResetPasswordError(null);
            }}
            className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          />
        </FieldLabel>
        {resetPasswordError ? <FieldError message={resetPasswordError} /> : null}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="md"
        title={isVietnamese ? 'Xác nhận xóa tài khoản' : 'Confirm account deletion'}
        description={
          selectedCustomer
            ? isVietnamese
              ? `Tài khoản ${selectedCustomer.username} sẽ bị xóa vĩnh viễn nếu không có dữ liệu giao dịch ràng buộc.`
              : `The account ${selectedCustomer.username} will be permanently deleted if it has no blocking transaction history.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant"
            >
              {isVietnamese ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deletingCustomer}
              onClick={() => void handleDeleteCustomer()}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
            >
              {deletingCustomer ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xóa tài khoản' : 'Delete account'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-6 text-on-surface-variant">
          {isVietnamese
            ? 'Tài khoản có đơn hàng, trả hàng hoặc giao dịch thanh toán sẽ không được xóa để tránh làm hỏng lịch sử nghiệp vụ.'
            : 'Accounts with orders, returns, or payment transactions cannot be deleted to preserve operational history.'}
        </p>
      </Modal>

      <Modal
        open={formOpen}
        onClose={resetForm}
        size="lg"
        title={
          formMode === 'create'
            ? isVietnamese
              ? 'Tạo tài khoản mới'
              : 'Create account'
            : isVietnamese
              ? 'Cập nhật tài khoản'
              : 'Update account'
        }
        footer={
          <>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface-variant"
            >
              {isVietnamese ? 'Đóng' : 'Close'}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
              {formMode === 'create'
                ? isVietnamese
                  ? 'Xác nhận tạo'
                  : 'Create account'
                : isVietnamese
                  ? 'Lưu cập nhật'
                  : 'Save changes'}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FieldLabel label={isVietnamese ? 'Tên tài khoản' : 'Username'}>
            <input
              value={formState.username}
              onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
              className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
            />
          </FieldLabel>
          <FieldError message={formErrors.username} />

          <FieldLabel label="Email">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
              <input
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none"
              />
            </div>
          </FieldLabel>
          <FieldError message={formErrors.email} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label={isVietnamese ? 'Mật khẩu' : 'Password'}>
              <input
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                placeholder={formMode === 'edit' ? (isVietnamese ? 'Để trống nếu không đổi' : 'Leave blank to keep current') : ''}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              />
            </FieldLabel>
            <div className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                {isVietnamese ? 'Avatar đại diện' : 'Profile avatar'}
              </span>
              <div className="flex items-center gap-4 rounded-xl border border-on-surface/10 bg-surface px-4 py-4">
                <UserAvatar
                  name={formState.username || (isVietnamese ? 'Tài khoản mới' : 'New account')}
                  avatarUrl={getAvatarPreviewUrl(
                    formState.username,
                    selectedAvatarTheme,
                    formState.avatarUrl,
                  )}
                  size="lg"
                />
                <div className="space-y-2 text-sm text-on-surface-variant">
                  <p className="font-bold text-on-surface">
                    {isVietnamese ? 'Chon avatar cartoon tu bo preset rieng.' : 'Pick a cartoon avatar from the preset gallery.'}
                  </p>
                  <p>
                    {selectedAvatarTheme
                      ? isVietnamese
                        ? 'Dang dung avatar mau va ten tai khoan se tu dong cap nhat lai preview.'
                        : 'Using a selected preset and the preview updates with the account name.'
                      : isVietnamese
                        ? 'Dang giu avatar hien tai cho den khi ban chon mau moi.'
                        : 'Keeping the current avatar until you pick a new preset.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-black text-primary transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <UserCog size={14} />
                    {isVietnamese ? 'Chọn avatar' : 'Choose avatar'}
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-black text-primary transition hover:border-primary/30 hover:bg-primary/5">
                    <ImagePlus size={14} />
                    {avatarFile ? avatarFile.name : isVietnamese ? 'Tai anh that' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        setAvatarFile(event.target.files?.[0] ?? null);
                        setSelectedAvatarTheme(null);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <FieldError message={formErrors.password} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label={isVietnamese ? 'Vai trò' : 'Role'}>
              <select
                value={formState.role}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
                className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="admin">{translateRole('admin', isVietnamese)}</option>
                <option value="staff">{translateRole('staff', isVietnamese)}</option>
                <option value="customer">{translateRole('customer', isVietnamese)}</option>
              </select>
            </FieldLabel>

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                {isVietnamese ? 'Trạng thái' : 'Status'}
              </span>
              <div className="flex h-full items-center rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="mr-3 h-4 w-4 accent-primary"
                />
                {formState.isActive
                  ? isVietnamese
                    ? 'Tài khoản đang hoạt động'
                    : 'Account is active'
                  : isVietnamese
                    ? 'Tài khoản tạm khóa'
                    : 'Account is inactive'}
              </div>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
              {isVietnamese ? 'Loại khách hàng' : 'Customer type'}
            </span>
            <div className="flex h-full items-center rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={formState.isWholesale}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isWholesale: event.target.checked,
                  }))
                }
                className="mr-3 h-4 w-4 accent-amber-500"
              />
              <span className={formState.isWholesale ? 'font-bold text-amber-700' : 'text-on-surface-variant'}>
                {formState.isWholesale
                  ? isVietnamese ? 'Khách sỉ (được mua nợ)' : 'Wholesale customer (credit allowed)'
                  : isVietnamese ? 'Khách lẻ thông thường' : 'Regular retail customer'}
              </span>
            </div>
          </label>
        </div>
      </Modal>

      <Modal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        size="lg"
        title={isVietnamese ? 'Chọn avatar tài khoản' : 'Choose account avatar'}
        footer={
          <>
            {formState.avatarUrl && selectedAvatarTheme === null ? (
              <button
                type="button"
                onClick={() => setSelectedAvatarTheme(DEFAULT_AVATAR_THEME)}
                className="rounded-2xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-primary"
              >
                {isVietnamese ? 'Dùng avatar mẫu' : 'Use preset avatar'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(false)}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
            >
              {isVietnamese ? 'Xong' : 'Done'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-on-surface/10 bg-surface px-5 py-4">
            <UserAvatar
              name={formState.username || (isVietnamese ? 'Tài khoản mới' : 'New account')}
              avatarUrl={getAvatarPreviewUrl(
                formState.username,
                selectedAvatarTheme,
                formState.avatarUrl,
              )}
              size="lg"
            />
            <div className="text-sm leading-6 text-on-surface-variant">
              <p className="font-bold text-on-surface">
                {isVietnamese
                  ? 'Bo avatar gom nhieu mau nam, nu, kinh, mu va toc dai-ngan.'
                  : 'This gallery includes male, female, glasses, cap, and long-short hair presets.'}
              </p>
              <p>
                {isVietnamese
                  ? 'Chon mot mau de ap dung ngay cho tai khoan. Preview se doi theo ten dang nhap.'
                  : 'Pick a preset to apply it immediately. The preview updates with the username.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {AVATAR_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedAvatarTheme(theme.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedAvatarTheme === theme.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-on-surface/10 bg-white hover:border-primary/20'
                }`}
              >
                <GeneratedAvatarSwatch
                  initials={getInitials(formState.username || (isVietnamese ? 'Tài khoản' : 'Account'))}
                  themeId={theme.id}
                />
                <p className="mt-3 text-sm font-black text-on-surface">{theme.label}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {describeAvatarTheme(theme, isVietnamese)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition ${
        active ? 'bg-primary text-white' : 'bg-on-surface-variant/5 text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  );
}

function StatusTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-bold transition ${
        active ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  isActive,
  isVietnamese,
}: {
  isActive: boolean;
  isVietnamese: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-on-surface-variant/5 px-3 py-1.5">
      <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
      <span className="text-xs font-bold text-on-surface-variant">
        {isActive
          ? isVietnamese
            ? 'Hoạt động'
            : 'Active'
          : isVietnamese
            ? 'Tạm khóa'
            : 'Inactive'}
      </span>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-on-surface/10 bg-white px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
        {label}
      </p>
      <p className="mt-2 break-all text-base font-bold text-on-surface">{value}</p>
    </div>
  );
}

function UserAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl?: string | null;
  size: 'sm' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);
  const resolvedAvatarUrl = resolveAvatarUrl(name, avatarUrl);
  const shouldRenderImage = Boolean(resolvedAvatarUrl) && !failed;
  const sizeClass = size === 'lg' ? 'h-16 w-16 rounded-full text-xl' : 'h-12 w-12 rounded-full text-sm';

  useEffect(() => {
    setFailed(false);
  }, [resolvedAvatarUrl]);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/80 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(226,232,240,0.55))] font-black text-primary shadow-md shadow-slate-900/10 ${sizeClass}`}
    >
      {shouldRenderImage ? (
        <img
          src={resolvedAvatarUrl ?? ''}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function GeneratedAvatarSwatch({
  initials,
  themeId,
}: {
  initials: string;
  themeId: AvatarThemeId;
}) {
  return (
    <img
      src={generateAvatarDataUrl(initials, themeId)}
      alt={initials}
      className="mx-auto h-16 w-16 rounded-full object-cover"
    />
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="-mt-2 text-xs font-semibold text-red-600">{message}</p>;
}

function translateRole(role: UserRole, isVietnamese: boolean) {
  if (!isVietnamese) {
    return role;
  }

  if (role === 'admin') return 'Quản trị';
  if (role === 'staff') return 'Nhân sự';
  return 'Khách hàng';
}

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getAvatarPreviewUrl(
  username: string,
  selectedAvatarTheme: AvatarThemeId | null,
  currentAvatarUrl: string,
) {
  return selectedAvatarTheme
    ? buildGeneratedAvatarToken(selectedAvatarTheme)
    : currentAvatarUrl || undefined;
}

function buildSelectedAvatarUrl(
  username: string,
  selectedAvatarTheme: AvatarThemeId | null,
  currentAvatarUrl: string,
) {
  if (selectedAvatarTheme) {
    return buildGeneratedAvatarToken(selectedAvatarTheme);
  }

  return currentAvatarUrl.trim() || undefined;
}

function buildGeneratedAvatarToken(themeId: AvatarThemeId) {
  return `avatar:generated:${themeId}`;
}

function parseGeneratedAvatarTheme(avatarUrl?: string | null): AvatarThemeId | null {
  if (!avatarUrl?.startsWith('avatar:generated:')) {
    return null;
  }

  const themeId = avatarUrl.replace('avatar:generated:', '') as AvatarThemeId;
  return AVATAR_THEMES.some((theme) => theme.id === themeId) ? themeId : null;
}

function resolveAvatarUrl(name: string, avatarUrl?: string | null) {
  const generatedTheme = parseGeneratedAvatarTheme(avatarUrl);
  if (generatedTheme) {
    return generateAvatarDataUrl(getInitials(name || 'Account'), generatedTheme);
  }

  return avatarUrl || undefined;
}

function describeAvatarTheme(
  theme: (typeof AVATAR_THEMES)[number],
  isVietnamese: boolean,
) {
  const genderText =
    theme.faceShape === 'soft'
      ? isVietnamese
        ? 'Nữ'
        : 'Female'
      : isVietnamese
        ? 'Nam'
        : 'Male';
  const accessoryText =
    theme.accessory === 'glasses'
      ? isVietnamese
        ? 'kính'
        : 'glasses'
      : theme.accessory === 'cap'
        ? isVietnamese
          ? 'mũ'
          : 'cap'
        : isVietnamese
          ? 'không phụ kiện'
          : 'no accessory';
  const hairText =
    theme.hairStyle === 'long'
      ? isVietnamese
        ? 'tóc dài'
        : 'long hair'
      : theme.hairStyle === 'bob'
        ? isVietnamese
          ? 'tóc bob'
          : 'bob cut'
        : theme.hairStyle === 'curly'
          ? isVietnamese
            ? 'tóc xoăn'
            : 'curly hair'
          : theme.hairStyle === 'wave'
            ? isVietnamese
              ? 'tóc gợn sóng'
              : 'wavy hair'
            : theme.hairStyle === 'side'
              ? isVietnamese
                ? 'tóc side part'
                : 'side part'
              : isVietnamese
                ? 'tóc ngắn'
                : 'short hair';

  return `${genderText}, ${hairText}, ${accessoryText}`;
}

function generateAvatarDataUrl(initials: string, themeId: AvatarThemeId) {
  const theme = AVATAR_THEMES.find((item) => item.id === themeId) ?? AVATAR_THEMES[0];
  const hairPath =
    theme.hairStyle === 'bob'
      ? `M43 72c4-24 19-40 37-40 22 0 39 15 41 38-8-9-19-15-31-18-17-4-34 2-47 20z`
      : theme.hairStyle === 'long'
        ? `M41 71c4-25 21-39 40-39 23 0 40 16 42 39-10-11-24-17-43-17-14 0-28 5-39 17z`
        : theme.hairStyle === 'side'
          ? `M42 74c2-27 20-42 41-42 19 0 37 10 42 37-12-9-27-15-45-14-13 0-26 7-38 19z`
          : theme.hairStyle === 'wave'
            ? `M40 72c4-24 21-40 40-40 23 0 41 18 42 41-8-8-18-16-33-17-19-2-34 4-49 16z`
            : theme.hairStyle === 'curly'
              ? `M42 74c3-24 20-39 39-39 20 0 38 14 40 37-6-5-12-10-17-13-18-8-42-4-62 15z`
              : `M41 74c0-27 18-42 39-42 24 0 42 15 43 41-10-10-23-17-39-17-16 0-31 5-43 18z`;
  const sideHairPath =
    theme.hairStyle === 'long'
      ? `M43 82c-6 14-7 30 0 44 7-7 9-16 8-27l-8-17zm74 0c6 14 7 30 0 44-7-7-9-16-8-27l8-17z`
      : theme.hairStyle === 'curly'
        ? `M44 83c-6 12-7 28-1 40 5-4 8-10 8-16-3-8-5-16-7-24zm72 0c6 12 7 28 1 40-5-4-8-10-8-16 3-8 5-16 7-24z`
        : `M47 83c-4 10-5 23-1 33 4-4 6-10 6-16l-5-17zm66 0c4 10 5 23 1 33-4-4-6-10-6-16l5-17z`;
  const shirtPath =
    theme.outfit === 'hoodie'
      ? `M28 138c7-22 24-34 52-34s45 12 52 34v16H28v-16z`
      : theme.outfit === 'collar'
        ? `M27 140c10-22 27-33 53-33s43 11 53 33v14H27v-14z`
        : `M26 139c9-23 25-34 54-34s45 11 54 34v15H26v-15z`;
  const collarPath =
    theme.outfit === 'hoodie'
      ? `M58 109c5 7 12 12 22 12s17-5 22-12l9 15H49l9-15z`
      : theme.outfit === 'collar'
        ? `M61 109l19 18 19-18 8 13H53l8-13z`
        : `M60 109h40l-7 13H67l-7-13z`;
  const facePath =
    theme.faceShape === 'soft'
      ? `M52 83c0-20 12-34 28-34s28 14 28 34v8c0 19-13 35-28 35S52 110 52 91v-8z`
      : `M50 82c0-20 13-33 30-33s30 13 30 33v9c0 20-13 35-30 35S50 111 50 91v-9z`;
  const mouthPath = theme.faceShape === 'soft' ? `M68 104c5 6 19 6 24 0` : `M67 103c4 4 22 4 26 0`;
  const blushOpacity = theme.faceShape === 'soft' ? '0.26' : '0.16';
  const accessorySvg =
    theme.accessory === 'glasses'
      ? `<g stroke="${theme.eye}" stroke-width="2.4" fill="none" opacity="0.85">
          <rect x="56" y="84" rx="6" ry="6" width="19" height="14" />
          <rect x="85" y="84" rx="6" ry="6" width="19" height="14" />
          <path d="M75 91h10" />
        </g>`
      : theme.accessory === 'cap'
        ? `<g>
          <path d="M46 64c7-16 20-24 36-24 19 0 31 10 35 24-6-3-15-5-26-5-15 0-31 3-45 5z" fill="${theme.accent}" />
          <path d="M48 65c17-8 45-10 69-2-2 7-11 10-20 10H66c-9 0-16-2-18-8z" fill="${theme.hair}" fill-opacity="0.95" />
        </g>`
        : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.bgStart}" />
          <stop offset="100%" stop-color="${theme.bgEnd}" />
        </linearGradient>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="${theme.ring}" />
        </linearGradient>
        <linearGradient id="shirt" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.shirt}" />
          <stop offset="100%" stop-color="${theme.shirtShadow}" />
        </linearGradient>
        <linearGradient id="skin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.skin}" />
          <stop offset="100%" stop-color="${theme.skinShadow}" />
        </linearGradient>
        <linearGradient id="hair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.hairShine}" />
          <stop offset="100%" stop-color="${theme.hair}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="18%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="76" fill="url(#bg)" />
      <circle cx="80" cy="80" r="66" fill="url(#g)" />
      <circle cx="80" cy="72" r="56" fill="url(#glow)" />
      <path d="${shirtPath}" fill="url(#shirt)" />
      <path d="${collarPath}" fill="#ffffff" fill-opacity="0.88" />
      <path d="${facePath}" fill="url(#skin)" />
      <path d="${hairPath}" fill="url(#hair)" />
      <path d="${sideHairPath}" fill="${theme.hair}" fill-opacity="0.96" />
      <path d="${hairPath}" fill="${theme.hairShine}" fill-opacity="0.18" />
      ${accessorySvg}
      <ellipse cx="68" cy="90" rx="4" ry="4.8" fill="${theme.eye}" />
      <ellipse cx="92" cy="90" rx="4" ry="4.8" fill="${theme.eye}" />
      <circle cx="69" cy="88.5" r="1.1" fill="#ffffff" fill-opacity="0.8" />
      <circle cx="93" cy="88.5" r="1.1" fill="#ffffff" fill-opacity="0.8" />
      <path d="M61 80c4-3 8-4 12-3" fill="none" stroke="${theme.hair}" stroke-width="3" stroke-linecap="round" />
      <path d="M87 77c4-1 8 0 12 3" fill="none" stroke="${theme.hair}" stroke-width="3" stroke-linecap="round" />
      <path d="${mouthPath}" fill="none" stroke="${theme.eye}" stroke-width="3" stroke-linecap="round" />
      <circle cx="58" cy="97" r="4.5" fill="#f39aa6" fill-opacity="${blushOpacity}" />
      <circle cx="102" cy="97" r="4.5" fill="#f39aa6" fill-opacity="${blushOpacity}" />
    </svg>
  `.replace(/\s{2,}/g, ' ').trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function KpiCard({
  title,
  value,
  growth,
  highlight,
}: {
  title: string;
  value: string;
  growth?: string;
  highlight?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-on-surface-variant/5 bg-white p-8 shadow-sm">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary/5 transition-transform duration-500 group-hover:scale-125" />
      <div className="mb-6 flex items-start justify-between text-[10px] font-black uppercase tracking-[0.2em]">
        <p className="text-on-surface-variant/60">{title}</p>
        {growth ? (
          <span className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-primary">
            <Users2 size={12} /> {growth}
          </span>
        ) : (
          <span className="rounded-lg bg-on-surface-variant/5 px-3 py-1 text-on-surface-variant/40">
            {highlight}
          </span>
        )}
      </div>
      <h3 className="text-5xl font-black tracking-tighter text-primary">{value}</h3>
    </div>
  );
}
