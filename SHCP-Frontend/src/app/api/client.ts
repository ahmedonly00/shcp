import axios, { AxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 only: try to refresh the token once, then force logout
// 403 (Forbidden) is NOT retried — a new token won't grant more permissions
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const status = error.response?.status;
    if (status === 401 && !original?._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
          const data = res.data?.data ?? res.data;
          const newToken: string = data.accessToken;
          localStorage.setItem('accessToken', newToken);
          if (original?.headers) {
            original.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(original!);
        } catch (refreshErr) {
          const refreshStatus = (refreshErr as AxiosError)?.response?.status;
          // Only force logout if the refresh token is actually invalid (401/403)
          // Network errors or 5xx should not log the user out
          if (refreshStatus === 401 || refreshStatus === 403) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.reload();
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Extract the payload from either a wrapped { data: T } or a bare T response */
export function unwrap<T>(res: { data: T | { data: T } }): T {
  const body = res.data as { data?: T };
  return body?.data !== undefined ? (body.data as T) : (res.data as T);
}

/** Extract content array from a Spring Page response: { data: { content: T[] } } */
export function unwrapPage<T>(res: { data: unknown }): T[] {
  const body = res.data as { data?: { content?: T[] } | T[] };
  const data = body?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object' && 'content' in data) return (data as { content: T[] }).content ?? [];
  return [];
}
