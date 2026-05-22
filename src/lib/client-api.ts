import { getClientSession, setClientSession, type ClientSession } from './client-session';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000/api/v1';

type ApiEnvelope<T> = {
  statusCode: number;
  message: string | string[];
  data: T;
  error?: string;
  path?: string;
};
export type ClientApiError = Error & {
  statusCode?: number;
  error?: string;
  path?: string;
};

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const payload = (await response.json()) as ApiEnvelope<T> | {
    message?: string | string[];
    error?: string;
    statusCode?: number;
    path?: string;
  };
  if (!response.ok) {
    const message =
      'message' in payload && payload.message
        ? payload.message
        : `Request failed with ${response.status}`;
    const error = new Error(Array.isArray(message) ? message[0] : message) as ClientApiError;
    error.statusCode = payload.statusCode ?? response.status;
    error.error = payload.error;
    error.path = payload.path;
    throw error;
  }
  return payload as ApiEnvelope<T>;
}

async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const session = getClientSession();
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (!isFormData) headers.set('Content-Type', 'application/json');
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
      await refreshClientSession();
      return request<T>(path, init, false);
    } catch {
      setClientSession(null);
    }
  }

  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

type LoginResponse = {
  access_token: string;
  access_token_expires_in: number;
  user: ClientSession['user'];
};

export async function loginClient(username: string, password: string) {
  const body = new URLSearchParams({ username, password }).toString();
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    credentials: 'include',
  });
  const envelope = await parseEnvelope<LoginResponse>(response);
  const session: ClientSession = {
    accessToken: envelope.data.access_token,
    user: envelope.data.user,
  };
  setClientSession(session);
  return session;
}

export async function registerClient(data: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phoneNumber?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  return parseEnvelope<unknown>(response);
}

export async function requestClientPasswordResetOtp(email: string) {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
  return parseEnvelope<{ message: string }>(response);
}

export async function resetClientPassword(data: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  return parseEnvelope<{ message: string }>(response);
}

export async function refreshClientSession() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'GET',
    credentials: 'include',
  });
  const envelope = await parseEnvelope<{ access_token: string; user: ClientSession['user'] }>(
    response,
  );
  const nextSession: ClientSession = {
    accessToken: envelope.data.access_token,
    user: envelope.data.user,
  };
  setClientSession(nextSession);
  return nextSession;
}

export async function logoutClient() {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } finally {
    setClientSession(null);
  }
}

export const clientApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, {
      method: 'POST',
      body,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
