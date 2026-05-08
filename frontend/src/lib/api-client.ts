import axios, { AxiosError } from 'axios';

/**
 * Browser → backend HTTP client.
 *
 * `withCredentials: true` is required so the access_token httpOnly cookie
 * set by /auth/login flows back on subsequent calls. The backend has CORS
 * configured to allow this origin with credentials.
 */
export const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

/** Translate axios errors into a consistent shape for UI messages. */
export interface ApiError {
  status: number;
  code: string | number | null;
  message: string;
}

export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string | string[]; error?: { message?: string | string[] } }>;
    const data = ax.response?.data;
    let msg: string | undefined;
    if (data) {
      const candidate = data.error?.message ?? data.message;
      if (Array.isArray(candidate)) msg = candidate.join(', ');
      else msg = candidate;
    }
    return {
      status: ax.response?.status ?? 0,
      code: ax.response?.status ?? null,
      message: msg ?? ax.message,
    };
  }
  return {
    status: 0,
    code: null,
    message: err instanceof Error ? err.message : 'unknown-error',
  };
}
