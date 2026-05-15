const BASE = '/api'

// WebSocket connections bypass the Vite proxy and connect directly to the backend.
// Assumes backend runs on port 3000 on the same host (override via __WS_BASE__ global).
export function wsUrl(path: string): string {
  const httpBase = (window as any).__WS_BASE__ ?? `http://${window.location.hostname}:3000`
  const wsBase = (httpBase as string).replace(/^https/, 'wss').replace(/^http/, 'ws')
  return `${wsBase}/api${path}`
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body != null
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
    ...options,
  })

  if (res.status === 401) {
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  // Raw text (no Content-Type override — used for file write)
  postText: async (path: string, text: string) => {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    })
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); throw new Error(e.error) }
    return res
  },

  // Upload file(s) via multipart
  upload: async (path: string, files: File[]) => {
    const form = new FormData()
    for (const f of files) form.append('files[]', f, f.name)
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      method: 'POST',
      body: form,
    })
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); throw new Error(e.error) }
    return res
  },

  // Get raw text (for file contents)
  getText: async (path: string) => {
    const res = await fetch(`${BASE}${path}`, { credentials: 'include' })
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); throw new Error(e.error) }
    return res.text()
  },
}
