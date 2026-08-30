/**
 * Talks to the locally hosted model.
 *
 * The site is static and served from GitHub Pages, so it cannot host a model of
 * its own — Ollama runs on the desktop. Requests go to a Cloudflare Worker that
 * verifies the caller's Google ID token and proxies through a named tunnel to
 * Ollama, which has no authentication of its own and must never be exposed
 * directly. `VITE_ACE_BASE_URL` is therefore safe to ship in the public bundle:
 * it is only a hostname, and the Worker rejects anyone who is not the admin.
 *
 * Pointing `VITE_ACE_BASE_URL` straight at `http://localhost:11434` also works
 * when the browser is on the machine running Ollama — Chrome exempts localhost
 * from mixed-content blocking — provided `OLLAMA_ORIGINS` allows this origin.
 */

export type AceRole = 'system' | 'user' | 'assistant'

export type AceMessage = {
  role: AceRole
  content: string
}

export type AceConfig = {
  baseUrl: string
  model: string
}

/** Ollama unloads an idle model; holding it resident keeps chat turns snappy. */
const KEEP_ALIVE = '30m'

/** Qwen3 handles this comfortably and it fits an 8 GB card alongside the weights. */
const CONTEXT_TOKENS = 16384

export function getAceConfig(): AceConfig | null {
  const baseUrl = import.meta.env.VITE_ACE_BASE_URL?.trim()
  if (!baseUrl) {
    return null
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model: import.meta.env.VITE_ACE_MODEL?.trim() || 'qwen3:8b',
  }
}

/**
 * Reasoning models wrap their scratchpad in <think> blocks. Whether one appears
 * depends on the model and the Ollama version, so it is stripped here rather
 * than suppressed with a request flag an older server would reject.
 */
export function stripThinking(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim()
}

async function readError(response: Response) {
  const body = await response.text().catch(() => '')

  if (response.status === 401 || response.status === 403) {
    return 'Ace refused the request — sign in again with the admin account.'
  }

  if (response.status === 404 && /model/i.test(body)) {
    return `That model is not pulled on the host yet. Run "ollama pull ${getAceConfig()?.model ?? 'qwen3:8b'}".`
  }

  return body.slice(0, 300) || `Ace returned ${response.status}.`
}

type ChatOptions = {
  config: AceConfig
  idToken: string
  messages: AceMessage[]
  signal?: AbortSignal
  /** Called with the running text as tokens arrive. */
  onProgress?: (text: string) => void
  /** JSON schema; when set the model is constrained to emit matching JSON. */
  format?: unknown
  temperature?: number
}

/**
 * One chat completion, streamed. Ollama streams NDJSON — one JSON object per
 * line — so the body is decoded incrementally rather than awaited whole, which
 * is what makes a local 8B model feel responsive despite its token rate.
 */
export async function aceChat({
  config,
  idToken,
  messages,
  signal,
  onProgress,
  format,
  temperature = 0.4,
}: ChatOptions): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Verified by the Worker. Ollama itself ignores it, so the same code path
      // works when talking to localhost directly.
      Authorization: `Bearer ${idToken}`,
    },
    signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      keep_alive: KEEP_ALIVE,
      ...(format ? { format } : {}),
      options: { temperature, num_ctx: CONTEXT_TOKENS },
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(await readError(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    // The final line of a chunk is usually a partial object; leave it buffered.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      let parsed: { message?: { content?: string }; error?: string }
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        continue
      }

      if (parsed.error) {
        throw new Error(parsed.error)
      }

      if (parsed.message?.content) {
        text += parsed.message.content
        onProgress?.(stripThinking(text))
      }
    }
  }

  return stripThinking(text)
}

/**
 * A completion constrained to a JSON schema, parsed and handed back.
 *
 * Schema-constrained decoding is what makes reminder extraction dependable on a
 * model this size — asked in prose for JSON, an 8B model drifts into prose
 * often enough to matter.
 */
export async function aceJson<T>(options: Omit<ChatOptions, 'onProgress'> & { format: unknown }): Promise<T> {
  const raw = await aceChat({ ...options, temperature: options.temperature ?? 0 })

  try {
    return JSON.parse(raw) as T
  } catch {
    // Constrained decoding can still be wrapped in a fence by some builds.
    const match = /\{[\s\S]*\}/.exec(raw)
    if (match) {
      return JSON.parse(match[0]) as T
    }
    throw new Error('Ace did not return usable JSON.')
  }
}

/**
 * Text to speech from the Kokoro model running beside Ollama. Same Worker,
 * same auth; the tunnel routes /api/tts to the TTS server by path.
 */
export async function aceTts({
  config,
  idToken,
  text,
  voice,
}: {
  config: AceConfig
  idToken: string
  text: string
  voice?: string
}): Promise<Blob> {
  const response = await fetch(`${config.baseUrl}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ text, ...(voice ? { voice } : {}) }),
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.blob()
}

/** Whether the host is reachable and the configured model is present. */
export async function aceHealth(config: AceConfig, idToken: string) {
  const response = await fetch(`${config.baseUrl}/api/tags`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  const body = (await response.json()) as { models?: { name?: string }[] }
  const names = (body.models ?? []).map((entry) => entry.name ?? '')

  return {
    models: names,
    // Ollama reports "qwen3:8b"; a bare "qwen3" in config means the latest tag.
    hasModel: names.some((name) => name === config.model || name.startsWith(`${config.model}:`)),
  }
}
