/**
 * News for the admin dashboard: Google News RSS, fetched server-side because
 * news.google.com sends no CORS headers, and handed back as JSON.
 *
 * Routes: GET /news?feed=nation|world   or   GET /news?place=…&region=…
 *         GET /article?url=… (plain article text for an on-request Ace summary)
 *
 * Admin-only, like every other Worker here, but it holds none of the auth
 * secrets: the bearer is checked by the db Worker's /auth/verify over a service
 * binding, so SESSION_SECRET stays in one place instead of being copied to a
 * fourth Worker. The binding is an in-process call, not a public HTTP hop.
 *
 * No Cache API: it is a no-op on workers.dev. Responses carry a short private
 * max-age instead, so the browser does not refetch on every tab switch.
 */

import { createHttp } from '../shared/admin.js'
import { feedUrl, parseFeed } from './feed.js'
import { publicArticleUrl, readArticle } from './article.js'

const { json, deny, preflight } = createHttp({ methods: 'GET, OPTIONS' })

/** Real feeds are ~150 KB; anything far past that is not a news feed. */
const MAX_FEED_BYTES = 2_000_000
const CACHE_SECONDS = 600

async function verifyCaller(request, env) {
  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return { ok: false, reason: 'Missing bearer token' }
  }

  const response = await env.DB_API.fetch(
    new Request('https://db.internal/auth/verify', { headers: { Authorization: authorization } }),
  )
  if (response.ok) {
    return { ok: true }
  }

  const body = await response.json().catch(() => ({}))
  return { ok: false, reason: body.error ?? 'Not an authorised account' }
}

/** Read a response body as text, giving up past `limit` bytes. */
async function readCapped(response, limit) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > limit) {
      await reader.cancel()
      throw new Error(`feed larger than ${limit} bytes`)
    }
    text += decoder.decode(value, { stream: true })
  }

  return text + decoder.decode()
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return preflight(request, env)
    }

    const url = new URL(request.url)
    if (url.pathname !== '/news' && url.pathname !== '/article') {
      return deny(404, 'No such route', request, env)
    }
    if (request.method !== 'GET') {
      return deny(405, 'GET only', request, env)
    }

    const auth = await verifyCaller(request, env)
    if (!auth.ok) {
      return deny(403, auth.reason, request, env)
    }

    if (url.pathname === '/article') {
      const articleUrl = publicArticleUrl(url.searchParams.get('url'))
      if (!articleUrl) return deny(400, 'Use a public HTTPS article link', request, env)
      try {
        const response = json(await readArticle(articleUrl.href), request, env)
        response.headers.set('Cache-Control', `private, max-age=${CACHE_SECONDS}`)
        return response
      } catch {
        return deny(502, 'Ace could not read this article. Paste the article text into the chat to summarize it.', request, env)
      }
    }

    const upstream = feedUrl(url.searchParams)
    if (!upstream) {
      return deny(400, 'Ask for ?feed=nation, ?feed=world, or ?place=…', request, env)
    }

    try {
      const feed = await fetch(upstream, {
        headers: { Accept: 'application/rss+xml, application/xml' },
      })
      if (!feed.ok || !feed.body) {
        throw new Error(`upstream returned ${feed.status}`)
      }

      const items = parseFeed(await readCapped(feed, MAX_FEED_BYTES))
      const response = json({ items }, request, env)
      response.headers.set('Cache-Control', `private, max-age=${CACHE_SECONDS}`)
      return response
    } catch (error) {
      console.error(
        JSON.stringify({ message: 'news feed failed', upstream, error: String(error?.message ?? error) }),
      )
      return deny(502, 'The news feed is unavailable right now', request, env)
    }
  },
}
