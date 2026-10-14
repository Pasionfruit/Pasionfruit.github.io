import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aceChat } from './client'

const config = { baseUrl: 'https://ace.test', model: 'qwen3:8b' }
const options = { config, idToken: 'token', messages: [{ role: 'user' as const, content: 'Summarize the supplied article.' }], purpose: 'news' as const }
const allocationError = 'llama-server process has terminated: ggml_backend_cpu_buffer_type_alloc_buffer: failed to allocate buffer of size 33566752'
const completion = () => new Response(JSON.stringify({ message: { content: 'A short summary.' }, done: true }))

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('Ace memory limits and streaming', () => {
  it('uses bounded news context and compute buffers, and reads a final line without a newline', async () => {
    vi.mocked(fetch).mockResolvedValue(completion())
    expect(await aceChat(options)).toBe('A short summary.')
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ think: false, options: { num_ctx: 4096, num_batch: 64, num_predict: 512 } })
  })

  it('retries a host allocation failure once with a smaller batch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: allocationError }), { status: 500 }))
      .mockResolvedValueOnce(completion())
    expect(await aceChat(options)).toBe('A short summary.')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).options).toMatchObject({ num_ctx: 4096, num_batch: 16 })
  })

  it('also retries allocation errors sent inside an HTTP 200 stream', async () => {
    const onProgress = vi.fn()
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: allocationError })))
      .mockResolvedValueOnce(completion())
    expect(await aceChat({ ...options, onProgress })).toBe('A short summary.')
    expect(onProgress).toHaveBeenCalledWith('')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('stops after one retry and replaces the raw crash with an actionable error', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ error: allocationError }), { status: 500 }))
    await expect(aceChat(options)).rejects.toThrow('Ace ran out of memory on the host')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry authentication failures', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Forbidden', { status: 403 }))
    await expect(aceChat(options)).rejects.toThrow('sign in again')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry after cancellation', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockImplementation(async () => {
      controller.abort()
      return new Response(JSON.stringify({ error: allocationError }), { status: 500 })
    })
    await expect(aceChat({ ...options, signal: controller.signal })).rejects.toThrow('failed to allocate')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
