import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

afterEach(() => vi.unstubAllGlobals())

describe('news Worker routes', () => {
  it('accepts an authenticated technology feed and returns publisher headlines', async () => {
    const env = {
      DB_API: { fetch: vi.fn(async () => new Response('{}')) },
      ALLOWED_ORIGINS: 'https://abepasion.com',
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel><item><title>Technology story</title><link>https://publisher.test/tech</link></item></channel></rss>')))
    const response = await worker.fetch(new Request('https://news.test/news?feed=tech', {
      headers: { Authorization: 'Bearer test-session', Origin: 'https://abepasion.com' },
    }), env)
    expect(response.status).toBe(200)
    expect((await response.json()).items[0].title).toBe('Technology story')
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=600')
  })
})
