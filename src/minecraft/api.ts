// Centralized Minecraft Server Manager API client.
//
// Configuration comes from env vars so no key ever lands in committed source:
//   VITE_API_URL — base URL of the server manager (default: https://api.abepasion.com)
//   VITE_API_KEY — X-API-Key value; leave empty once a Cloudflare Worker proxy
//                  handles auth server-side (the header is simply omitted).
//
// The UI only ever calls the exported functions, so swapping the backend for a
// proxy later is a config change, not a rewrite.

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://api.abepasion.com'
const API_KEY = (import.meta.env.VITE_API_KEY as string | undefined)?.trim() ?? ''

const GET_TIMEOUT_MS = 10_000
const ACTION_TIMEOUT_MS = 30_000

export type ServerStatus = {
  online: boolean
  players?: number
  maxPlayers?: number
  version?: string
}

export type ServerMetrics = {
  cpu?: number
  ramUsedGB?: number
  ramTotalGB?: number
  uptime?: string
}

export type ApiErrorKind = 'timeout' | 'unreachable' | 'http'

export class ApiError extends Error {
  kind: ApiErrorKind
  status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

async function request<T>(
  path: string,
  { method = 'GET', timeoutMs = GET_TIMEOUT_MS }: { method?: 'GET' | 'POST'; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('timeout', `Request timed out: ${path}`)
    }
    throw new ApiError('unreachable', `Could not reach server manager: ${path}`)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new ApiError('http', `API error ${response.status}: ${path}`, response.status)
  }

  return response.json() as Promise<T>
}

export function getServerStatus(): Promise<ServerStatus> {
  return request<ServerStatus>('/status')
}

export function startServer(): Promise<unknown> {
  return request('/start', { method: 'POST', timeoutMs: ACTION_TIMEOUT_MS })
}

export function stopServer(): Promise<unknown> {
  return request('/stop', { method: 'POST', timeoutMs: ACTION_TIMEOUT_MS })
}

export function restartServer(): Promise<unknown> {
  return request('/restart', { method: 'POST', timeoutMs: ACTION_TIMEOUT_MS })
}

export function getServerMetrics(): Promise<ServerMetrics> {
  return request<ServerMetrics>('/metrics')
}

export async function getServerLogs(): Promise<string[]> {
  const data = await request<unknown>('/logs')
  if (Array.isArray(data)) return data.map(String)
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.lines)) return record.lines.map(String)
    if (Array.isArray(record.logs)) return record.logs.map(String)
  }
  return []
}
