export class ClientApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let json: { ok: boolean; data?: T; error?: string; details?: unknown } | null = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok || !json?.ok) {
    throw new ClientApiError(json?.error ?? "مشکلی پیش آمد. دوباره تلاش کنید.", res.status, json?.details);
  }

  return json.data as T;
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url, { method: "GET" }),
  post: <T>(url: string, body?: unknown) => apiFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) => apiFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};
