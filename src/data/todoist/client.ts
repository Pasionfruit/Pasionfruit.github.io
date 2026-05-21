function getTodoistToken() {
  const token = import.meta.env.VITE_TODOIST_API_TOKEN?.trim() ?? ''
  if (!token) {
    throw new Error('Todoist is not configured (missing VITE_TODOIST_API_TOKEN).')
  }

  return token
}

async function readResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getErrorMessage(status: number, payload: unknown) {
  if (status === 401 || status === 403) {
    return 'Todoist token is invalid or does not have access.'
  }

  if (status === 410) {
    return 'Todoist returned 410. This usually indicates a deprecated endpoint or stale resource. The app should use Todoist API v1 paths.'
  }

  if (typeof payload === 'object' && payload && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return `Todoist request failed: ${status}`
}

export async function todoistRequest<T>(
  path: string,
  options: Omit<RequestInit, 'headers'> = {},
): Promise<T> {
  const isDev = import.meta.env.DEV
  const baseUrl = isDev ? '/api/todoist' : 'https://api.todoist.com/api/v1'
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (!isDev) {
    const token = getTodoistToken()
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      'Unable to reach Todoist. If you are in local dev, restart `npm run dev` so the Todoist proxy picks up your .env token.',
    )
  }

  if (!response.ok) {
    const payload = await readResponse(response)
    throw new Error(getErrorMessage(response.status, payload))
  }

  const payload = await readResponse(response)
  return payload as T
}
