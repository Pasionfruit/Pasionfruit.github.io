const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const API_MODE = (import.meta.env.VITE_API_MODE || '').trim().toLowerCase()
const IS_APPS_SCRIPT_URL = /script\.google\.com\/macros\/s\/.+\/exec/i.test(API_BASE_URL)
const IS_APPS_SCRIPT_MODE = API_MODE === 'apps-script' || IS_APPS_SCRIPT_URL
const USE_POST_FOR_UPDATES =
  String(import.meta.env.VITE_API_USE_POST_FOR_UPDATES || '').toLowerCase() === 'true'
  || IS_APPS_SCRIPT_MODE

function appendQueryParam(url, key, value) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function appendQueryParams(url, params) {
  let next = url
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    next = appendQueryParam(next, key, String(value))
  })
  return next
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!API_BASE_URL) return normalizedPath

  if (IS_APPS_SCRIPT_MODE) {
    return appendQueryParam(API_BASE_URL, 'path', normalizedPath)
  }

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

  // In Apps Script mode, profile write calls are sent as query-based GET requests.
  // This avoids cross-origin POST limitations that some web app deployments hit.
  if (IS_APPS_SCRIPT_MODE && method !== 'GET' && path.startsWith('/profiles')) {
    const mutationMethod = USE_POST_FOR_UPDATES && method === 'PUT' ? 'PUT' : method
    const url = appendQueryParams(buildApiUrl(path), {
      _method: mutationMethod,
      ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}),
    })
    return fetch(url, { method: 'GET' })
  }

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
