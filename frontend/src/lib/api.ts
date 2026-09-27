import type { ApiError } from './types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(json !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined && !isFormData ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiRequestError('Не удалось связаться с сервером. Попробуйте ещё раз.', 0, 'NETWORK_ERROR');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new ApiRequestError(
      err.error?.message || 'Ошибка запроса',
      res.status,
      err.error?.code || 'ERROR'
    );
  }
  return (data.data ?? data) as T;
}

/** Files are stored by the backend under /uploads; resolve them against the API origin. */
export function fileUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function uploadFile<T = { fileUrl: string; fileName: string; size: number; mimeType: string }>(
  endpoint: string,
  file: File,
  field = 'file'
) {
  const formData = new FormData();
  formData.append(field, file);
  return api<T>(endpoint, { method: 'POST', body: formData });
}

export { API_URL };
