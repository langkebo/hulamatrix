import { useMatrixAuthStore } from '@/stores/matrixAuth'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function apiRequest<T = unknown>(
  path: string,
  opts?: { method?: Method; headers?: Record<string, string>; body?: unknown; query?: Record<string, string> }
): Promise<T> {
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  const urlObj = new URL(path, base || (typeof location !== 'undefined' ? location.origin : 'http://localhost'))
  if (opts?.query) Object.entries(opts.query).forEach(([k, v]) => urlObj.searchParams.set(k, v))
  const headers: Record<string, string> = { ...(opts?.headers || {}) }
  if (auth.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`
  if (opts?.body && !(opts.body instanceof FormData))
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  const fetchOptions: RequestInit = {
    method: opts?.method || 'GET',
    headers
  }
  const fetchBody = opts?.body instanceof FormData ? opts.body : opts?.body ? JSON.stringify(opts.body) : null
  if (fetchBody !== null) {
    fetchOptions.body = fetchBody
  }
  const res = await fetch(urlObj.toString(), fetchOptions)
  if (!res.ok) throw new Error(`http_${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as unknown as T
}
