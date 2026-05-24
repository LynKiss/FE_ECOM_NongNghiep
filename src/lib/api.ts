import { getAdminSession, setAdminSession, type AdminSession } from './admin-session';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000/api/v1';

type ApiEnvelope<T> = {
  statusCode: number;
  message: string;
  data: T;
  error?: string;
  path?: string;
};

type ApiPayload<T> = Partial<Omit<ApiEnvelope<T>, 'message'>> & {
  message?: string | string[];
  error?: string;
  path?: string;
};

export type AdminApiError = Error & {
  statusCode?: number;
  error?: string;
  path?: string;
};

type LoginResponse = {
  access_token: string;
  access_token_expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  user: AdminSession['user'];
};

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let payload: ApiPayload<T>;
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || payload.error || `API request failed with ${response.status}`;
    const error = new Error(message) as AdminApiError;
    error.statusCode = payload.statusCode ?? response.status;
    error.error = payload.error;
    error.path = payload.path;
    throw error;
  }

  return payload as ApiEnvelope<T>;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
): Promise<T> {
  const session = getAdminSession();
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    const isFormData =
      typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (!isFormData) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && allowRefresh && session?.accessToken) {
    try {
      await refreshAdminSession();
      return request<T>(path, init, false);
    } catch {
      setAdminSession(null);
    }
  }

  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

export async function loginAdmin(username: string, password: string) {
  const body = new URLSearchParams({ username, password }).toString();
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    credentials: 'include',
  });

  const envelope = await parseEnvelope<LoginResponse>(response);
  const session = {
    accessToken: envelope.data.access_token,
    user: envelope.data.user,
  };

  setAdminSession(session);
  return session;
}

export async function refreshAdminSession() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'GET',
    credentials: 'include',
  });

  const envelope = await parseEnvelope<{
    access_token: string;
    access_token_expires_in: number;
    user: AdminSession['user'];
  }>(response);

  const nextSession = {
    accessToken: envelope.data.access_token,
    user: envelope.data.user,
  };

  setAdminSession(nextSession);
  return nextSession;
}

export async function logoutAdmin() {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } finally {
    setAdminSession(null);
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, {
      method: 'POST',
      body,
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
};
