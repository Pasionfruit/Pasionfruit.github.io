const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const API_MODE = (import.meta.env.VITE_API_MODE || '').trim().toLowerCase()
const USE_POST_FOR_UPDATES = String(import.meta.env.VITE_API_USE_POST_FOR_UPDATES || '').toLowerCase() === 'true'

const IS_APPS_SCRIPT_MODE = API_MODE === 'apps-script'

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!API_BASE_URL) return normalizedPath
  return `${API_BASE_URL}${normalizedPath}`
}

export function apiFetch(path, options) {
  return fetch(buildApiUrl(path), options)
}

export function apiJson(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body
  const headers = { ...(options.headers || {}) }

  let effectiveMethod = method
  let effectiveBody = body

  if (USE_POST_FOR_UPDATES && method === 'PUT') {
    effectiveMethod = 'POST'
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      effectiveBody = { ...body, _method: 'PUT' }
    }
  }

  const requestOptions = {
    ...options,
    method: effectiveMethod,
    headers,
  }

  if (effectiveBody !== undefined) {
    requestOptions.body = JSON.stringify(effectiveBody)

    // Apps Script endpoints are often easiest to call as simple requests
    // (no custom headers), which avoids preflight failures.
    if (!IS_APPS_SCRIPT_MODE) {
      requestOptions.headers = {
        ...headers,
        'Content-Type': 'application/json',
      }
    }
  }

  return apiFetch(path, requestOptions)
}
