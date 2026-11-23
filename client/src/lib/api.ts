export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path.startsWith("/") ? path : `/api/${path}`, {
    method: opts.method || (opts.body !== undefined || opts.form ? "POST" : "GET"),
    headers: { "X-Requested-With": "fetch", ...(opts.form ? {} : opts.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    if (data?.code === "MUST_CHANGE_PASSWORD" && !location.pathname.startsWith("/admin/cambia-password")) location.href = "/admin/cambia-password";
    if (res.status === 401 && location.pathname.startsWith("/admin") && !location.pathname.startsWith("/admin/login")) location.href = "/admin/login";
    throw new ApiError(res.status, (data && data.error) || "Errore di rete", data?.code);
  }
  return data as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: "POST", body: body ?? {} });
export const patch = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PATCH", body });
export const put = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PUT", body });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });
export const upload = <T = any>(p: string, form: FormData) => api<T>(p, { method: "POST", form });
