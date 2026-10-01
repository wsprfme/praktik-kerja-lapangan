// REST API client untuk backend SQLite (server/index.js).
//
// Perubahan penting:
// - Error dari server SELALU JSON { error } sehingga pesan bisa ditampilkan apa adanya.
// - Upload memakai path `siswa/<studentId>/<folder>/<file>` (ACL per siswa di server).
// - Presensi tidak mengirim jam; server mencatat waktu WIB sebagai sumber kebenaran.

import type { Profile } from "@/lib/types"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3101"
const TOKEN_KEY = "pkl_token"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
    })
  } catch {
    throw new ApiError("Gagal menghubungi server. Periksa koneksi internet Anda.", 0)
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new ApiError(message && message.trim() ? message : `Permintaan gagal (${res.status}).`, res.status)
  }
  return body as T
}

export interface ListResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Versi `list` yang mengembalikan metadata pagination dari header. */
export async function listPaged<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
  pageSize = 25,
): Promise<ListResult<T>> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v))
  }
  qs.set("limit", String(pageSize))
  qs.set("page", String(params.page ?? 1))
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/${resource}?${qs.toString()}`, { headers })
  } catch {
    throw new ApiError("Gagal menghubungi server. Periksa koneksi internet Anda.", 0)
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new ApiError(message && message.trim() ? message : `Permintaan gagal (${res.status}).`, res.status)
  }
  const rows = (body as T[]) ?? []
  const total = Number(res.headers.get("X-Total-Count") ?? rows.length)
  const totalPages = Number(res.headers.get("X-Total-Pages") ?? 1)
  return {
    rows,
    total,
    page: Number(res.headers.get("X-Page") ?? 1),
    pageSize: Number(res.headers.get("X-Page-Size") ?? pageSize),
    totalPages: Math.max(1, totalPages),
  }
}

export const api = {
  base: API_BASE,
  login: (identity: string, password: string) =>
    request<{ token: string; user: Profile; detail: unknown }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ identity, password }),
    }),
  logout: () => request<{ ok: boolean }>(`/api/auth/logout`, { method: "POST" }),
  me: () => request<{ user: Profile; detail: unknown }>(`/api/me`),
  changePassword: (password: string) =>
    request<{ ok: boolean; reauth?: boolean }>(`/api/me/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  updateMe: (body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/me`, { method: "PUT", body: JSON.stringify(body) }),

  list: <T>(resource: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<T[]>(`/api/${resource}${qs ? `?${qs}` : ""}`)
  },
  create: <T>(resource: string, body: Record<string, unknown>) =>
    request<T>(`/api/${resource}`, { method: "POST", body: JSON.stringify(body) }),
  update: (resource: string, id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/${resource}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (resource: string, id: string) =>
    request<{ ok: boolean }>(`/api/${resource}/${id}`, { method: "DELETE" }),

  createUser: (body: Record<string, unknown>) =>
    request<{ user_id: string; warning?: string }>(`/api/users`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  setActive: (id: string, is_active: boolean) =>
    request<{ ok: boolean }>(`/api/users/${id}/active`, {
      method: "POST",
      body: JSON.stringify({ is_active }),
    }),

  upload: async (
    folder: "presensi" | "jurnal" | "izin" | "avatar",
    file: File | Blob,
    filename?: string,
    studentId?: string,
  ) => {
    const token = getToken()
    const form = new FormData()
    form.append("file", file, filename || (file instanceof File ? file.name : "foto.jpg"))
    const qs = new URLSearchParams({ folder })
    if (studentId) qs.set("student_id", studentId)
    const res = await fetch(`${API_BASE}/api/uploads?${qs.toString()}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (!res.ok) {
      const message = (body as { error?: string } | null)?.error
      throw new ApiError(message || `Upload gagal (${res.status}).`, res.status)
    }
    return body as { path: string; name: string }
  },

  /** Unduh file privat dengan header Authorization; mengembalikan object URL. */
  fetchFile: async (path: string): Promise<string> => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      let message = "Gagal memuat berkas."
      try {
        const body = await res.json()
        if (body?.error) message = body.error
      } catch {
        /* biarkan pesan default */
      }
      throw new ApiError(message, res.status)
    }
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },
}

/** Kompat: aksi lama(callAdminUsers) dipetakan ke REST API. */
export async function callAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const action = body.action as string
  if (action === "create" || action === "create_with_placement") {
    return (await api.createUser(body)) as T
  }
  if (action === "update" && body.user_id) {
    const { user_id, action: _action, ...rest } = body
    await api.updateUser(user_id as string, rest)
    return { user_id } as T
  }
  if (action === "reset_password" && body.user_id) {
    await api.resetPassword(body.user_id as string, body.password as string)
    return { user_id: body.user_id } as T
  }
  if (action === "set_active" && body.user_id) {
    await api.setActive(body.user_id as string, !!body.is_active)
    return { user_id: body.user_id } as T
  }
  throw new ApiError("Aksi tidak dikenal.", 400)
}
