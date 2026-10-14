import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNews } from './client'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('technology feed compatibility', () => {
  it('uses the place search when an older Worker rejects the tech feed', async () => {
    const items = [{ title: 'Technology story', url: 'https://publisher.test/story', source: 'Publisher', publishedAt: '' }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Ask for ?feed=nation, ?feed=world, or ?place=…' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items })))
    expect(await getNews('token', { feed: 'tech' })).toEqual(items)
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('/news?place=technology')
    expect(vi.mocked(fetch).mock.calls[1][1]!.headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('uses the dedicated technology feed when supported', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] })))
    await getNews('token', { feed: 'tech' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('feed=tech')
  })

  it('does not hide authorization or upstream failures behind a fallback', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 }))
    await expect(getNews('token', { feed: 'tech' })).rejects.toThrow('Not authorized')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
