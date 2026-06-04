import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSuperAdminSession } from '../hooks/useSuperAdminSession';
import { superAdminApiClient } from '../lib/super-admin-api';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

type Project = {
  _id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  status: 'active' | 'disabled';
  syncSecretConfigured: boolean;
};

type Permission = {
  _id?: string;
  key: string;
  name: string;
};

type ProjectAdmin = {
  _id: string;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  isActive: boolean;
  permissions: Permission[];
};

type AuditLog = {
  _id: string;
  actorEmail?: string | null;
  action: string;
  projectId?: string | null;
  targetUserId?: string | null;
  createdAt?: string;
};

const emptyProjectForm = {
  projectId: '',
  name: '',
  baseUrl: 'http://localhost:8000',
  syncSecret: '',
};

export default function SuperAdminConfig() {
  const { session } = useSuperAdminSession();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [admins, setAdmins] = useState<ProjectAdmin[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const selectedAdmin = admins.find((admin) => admin._id === selectedAdminId) ?? null;

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const group = permission.key.split('_')[1] ?? 'general';
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  useEffect(() => {
    if (!session) return;
    void loadProjects();
  }, [session]);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProjectData(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const admin = admins.find((item) => item._id === selectedAdminId);
    setSelectedPermissionKeys(admin?.permissions.map((permission) => permission.key) ?? []);
  }, [admins, selectedAdminId]);

  if (!session) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-amber-800">
        <ShieldAlert size={28} />
        <h1 className="mt-4 text-2xl font-black">Yêu cầu đăng nhập super admin</h1>
        <p className="mt-2 text-sm">
          Vui lòng đăng nhập vào tài khoản super admin trước khi truy cập trang này.
        </p>
        <Link to="/super-admin/login" className="mt-5 inline-flex rounded-xl bg-amber-700 px-5 py-3 text-sm font-black text-white">
          Đăng nhập super admin
        </Link>
      </div>
    );
  }

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApiClient.get<Project[]>('/projects');
      setProjects(data);
      setSelectedProjectId((current) => current || data[0]?.projectId || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectData(projectId: string) {
    setSyncing(true);
    setError(null);
    try {
      const [adminsData, permissionsData, auditData] = await Promise.all([
        superAdminApiClient.get<ProjectAdmin[]>(`/projects/${projectId}/admins`),
        superAdminApiClient.get<Permission[]>(`/projects/${projectId}/permissions`),
        superAdminApiClient.get<AuditLog[]>(`/audit-logs?projectId=${encodeURIComponent(projectId)}&limit=20`),
      ]);
      setAdmins(adminsData);
      setPermissions(permissionsData);
      setAuditLogs(auditData);
      setSelectedAdminId((current) => current || adminsData[0]?._id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu dự án');
      setAdmins([]);
      setPermissions([]);
    } finally {
      setSyncing(false);
    }
  }

  async function createProject() {
    const { projectId, name, baseUrl, syncSecret } = projectForm;
    if (!projectId.trim() || !name.trim() || !baseUrl.trim() || !syncSecret.trim()) {
      setError('Vui lòng điền đầy đủ tất cả các trường');
      return;
    }
    if (syncSecret.length < 16) {
      setError('Khóa đồng bộ phải có ít nhất 16 ký tự');
      return;
    }
    setCreating(true);
    setError(null);
    setStatus(null);
    try {
      await superAdminApiClient.post<Project>('/projects', projectForm);
      setProjectForm(emptyProjectForm);
      setStatus('Dự án đã được đăng ký');
      await loadProjects();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo dự án');
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(projectId: string, name: string) {
    const ok = await askConfirm({
      title: `Xóa dự án "${name}"?`,
      description: 'Thao tác này không thể hoàn tác. Toàn bộ cấu hình đồng bộ của dự án sẽ bị gỡ khỏi Super Admin.',
      tone: 'danger',
      confirmLabel: 'Xóa dự án',
    });
    if (!ok) return;
    setError(null);
    try {
      await superAdminApiClient.delete(`/projects/${projectId}`);
      setSelectedProjectId('');
      setSelectedAdminId('');
      setAdmins([]);
      setPermissions([]);
      await loadProjects();
      setStatus('Đã xóa dự án');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa dự án');
    }
  }

  async function savePermissions() {
    if (!selectedProjectId || !selectedAdmin) return;
    if (selectedPermissionKeys.length === 0) {
      const confirmed = await askConfirm({
        title: 'Xóa toàn bộ quyền?',
        description: `Thao tác này sẽ xóa TOÀN BỘ quyền của ${selectedAdmin.email}. Admin này có thể mất quyền truy cập sau khi đăng nhập lại.`,
        tone: 'danger',
        confirmLabel: 'Xóa quyền',
      });
      if (!confirmed) return;
    }
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      await superAdminApiClient.put(
        `/projects/${selectedProjectId}/admins/${selectedAdmin._id}/permissions`,
        {
          permissionKeys: selectedPermissionKeys,
          targetEmail: selectedAdmin.email,
        },
      );
      setStatus('Đã đồng bộ quyền — có hiệu lực sau khi admin đăng nhập lại');
      await loadProjectData(selectedProjectId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể đồng bộ quyền');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {ConfirmDialog}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/60">
            Super admin
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-primary">
            Quản lý quyền đa dự án
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Đang đăng nhập: <span className="font-semibold">{session.user.email}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => selectedProjectId && loadProjectData(selectedProjectId)}
          disabled={!selectedProjectId || syncing}
          className="admin-pill admin-pill-outline inline-flex items-center gap-2 px-4 py-3 text-sm font-black disabled:opacity-50"
        >
          {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div> : null}
      {status ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">{status}</div> : null}

      <section className="admin-panel p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
          <input
            value={projectForm.projectId}
            onChange={(event) => setProjectForm((value) => ({ ...value, projectId: event.target.value }))}
            placeholder="mã dự án"
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm outline-none focus:border-primary/40"
          />
          <input
            value={projectForm.name}
            onChange={(event) => setProjectForm((value) => ({ ...value, name: event.target.value }))}
            placeholder="tên dự án"
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm outline-none focus:border-primary/40"
          />
          <input
            value={projectForm.baseUrl}
            onChange={(event) => setProjectForm((value) => ({ ...value, baseUrl: event.target.value }))}
            placeholder="http://localhost:8000"
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm outline-none focus:border-primary/40"
          />
          <input
            value={projectForm.syncSecret}
            onChange={(event) => setProjectForm((value) => ({ ...value, syncSecret: event.target.value }))}
            placeholder="khóa đồng bộ"
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm outline-none focus:border-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={() => void createProject()}
          disabled={creating}
          className="admin-pill admin-pill-primary mt-4 inline-flex items-center gap-2 px-5 py-3 text-sm font-black disabled:opacity-60"
        >
          {creating ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
          Đăng ký dự án
        </button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <section className="admin-panel p-4">
          <p className="px-2 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
            Dự án
          </p>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="p-6 text-center text-on-surface-variant">
                <LoaderCircle className="mx-auto animate-spin" size={18} />
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.projectId}
                  className={`group flex items-start gap-2 rounded-xl border px-4 py-3 transition ${
                    selectedProjectId === project.projectId
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-on-surface/8 bg-white hover:border-primary/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { setSelectedProjectId(project.projectId); setSelectedAdminId(''); }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-black">{project.name}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{project.baseUrl}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteProject(project.projectId, project.name)}
                    className="mt-0.5 shrink-0 text-red-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    title="Xóa dự án"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel p-5">
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                Quản trị viên
              </p>
              <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {admins.map((admin) => (
                  <button
                    key={admin._id}
                    type="button"
                    onClick={() => setSelectedAdminId(admin._id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedAdminId === admin._id
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-on-surface/8 bg-white hover:border-primary/20'
                    }`}
                  >
                    <p className="truncate font-black">{admin.fullName || admin.username}</p>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{admin.email}</p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/50">
                      {admin.role} · {admin.permissions.length} quyền
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                    Ghi đè quyền
                  </p>
                  <h2 className="mt-1 text-xl font-black text-primary">
                    {selectedAdmin ? selectedAdmin.email : 'Chọn quản trị viên'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void savePermissions()}
                  disabled={!selectedAdmin || syncing}
                  className="admin-pill admin-pill-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-black disabled:opacity-60"
                >
                  {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  Đồng bộ quyền
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {groupedPermissions.map(([group, items]) => (
                  <div key={group} className="rounded-xl border border-on-surface/8 bg-white">
                    <div className="flex items-center justify-between border-b border-on-surface/8 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary/70">
                        {group}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const keys = items.map((permission) => permission.key);
                          const allSelected = keys.every((key) => selectedPermissionKeys.includes(key));
                          setSelectedPermissionKeys((current) =>
                            allSelected
                              ? current.filter((key) => !keys.includes(key))
                              : [...new Set([...current, ...keys])],
                          );
                        }}
                        className="text-xs font-bold text-primary/70 hover:text-primary"
                      >
                        Bật/tắt nhóm
                      </button>
                    </div>
                    <div className="grid gap-2 p-3 md:grid-cols-2">
                      {items.map((permission) => (
                        <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedPermissionKeys.includes(permission.key)}
                            onChange={() =>
                              setSelectedPermissionKeys((current) =>
                                current.includes(permission.key)
                                  ? current.filter((key) => key !== permission.key)
                                  : [...current, permission.key],
                              )
                            }
                            className="mt-1 h-4 w-4 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-on-surface">{permission.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{permission.key}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-panel p-5">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <KeyRound size={18} />
          <h2 className="text-lg font-black">Nhật ký kiểm tra</h2>
          <ShieldCheck size={18} className="ml-auto" />
        </div>
        <div className="overflow-hidden rounded-xl border border-on-surface/8 bg-white">
          {auditLogs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-on-surface-variant">Chưa có sự kiện nào</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log._id} className="grid gap-2 border-b border-on-surface/8 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1.2fr_1fr_1fr]">
                <span className="font-bold text-on-surface">{log.action}</span>
                <span className="truncate text-on-surface-variant">{log.actorEmail || 'hệ thống'}</span>
                <span className="text-on-surface-variant">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
