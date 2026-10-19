import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker from './worker.js'

const ID = 'photo-0001-abcd'
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

/** A stand-in R2 bucket that keeps objects in a Map. */
function fakeBucket() {
  const objects = new Map()
  return {
    objects,
    async put(key, value, options) {
      objects.set(key, { body: value, httpMetadata: options?.httpMetadata })
    },
    async get(key) {
      const object = objects.get(key)
      return object ? { body: object.body, httpMetadata: object.httpMetadata } : null
    },
    async delete(key) {
      objects.delete(key)
    },
  }
}

function env(bucket = fakeBucket()) {
  return { DB: {}, PHOTOS: bucket, ADMIN_EMAIL: 'pasionabe@gmail.com', SESSION_SECRET: 'x' }
}

function request(method, token, { type = 'image/jpeg', body = JPEG } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  if (method === 'POST') headers['Content-Type'] = type
  return new Request(`https://db.example/photos/${ID}`, {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
  })
}

// Google's tokeninfo says this token belongs to the admin; any other token is rejected.
function stubGoogle(email = 'pasionabe@gmail.com') {
  vi.stubGlobal(
    'fetch',
    async (url) =>
      String(url).includes('tokeninfo') && email
        ? new Response(JSON.stringify({ email, email_verified: 'true' }), { status: 200 })
        : new Response('{}', { status: 400 }),
  )
}

describe('timeline photos', () => {
  beforeEach(() => stubGoogle())
  afterEach(() => vi.unstubAllGlobals())

  it('lets the admin upload, read back and delete a photo', async () => {
    const bucket = fakeBucket()

    const posted = await worker.fetch(request('POST', 'admin-token'), env(bucket))
    expect(posted.status).toBe(200)
    expect(bucket.objects.get(`timeline/${ID}`).httpMetadata.contentType).toBe('image/jpeg')

    const read = await worker.fetch(request('GET', 'admin-token'), env(bucket))
    expect(read.status).toBe(200)
    expect(read.headers.get('Content-Type')).toBe('image/jpeg')
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(JPEG)

    const deleted = await worker.fetch(request('DELETE', 'admin-token'), env(bucket))
    expect(deleted.status).toBe(200)
    expect(bucket.objects.has(`timeline/${ID}`)).toBe(false)
  })

  it('refuses everyone but the admin', async () => {
    stubGoogle('someone@example.com')
    const bucket = fakeBucket()

    for (const method of ['GET', 'POST', 'DELETE']) {
      const response = await worker.fetch(request(method, 'other-token'), env(bucket))
      expect(response.status).toBe(403)
    }
    expect(bucket.objects.size).toBe(0)
  })

  it('refuses a missing token', async () => {
    const response = await worker.fetch(request('POST', ''), env())
    expect(response.status).toBe(403)
  })

  it('accepts only JPEG, PNG or WebP', async () => {
    const bucket = fakeBucket()
    const response = await worker.fetch(request('POST', 'admin-token', { type: 'text/html' }), env(bucket))
    expect(response.status).toBe(415)
    expect(bucket.objects.size).toBe(0)
  })

  it('refuses a photo over 10 MB', async () => {
    const bucket = fakeBucket()
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    const response = await worker.fetch(request('POST', 'admin-token', { body: big }), env(bucket))
    expect(response.status).toBe(413)
    expect(bucket.objects.size).toBe(0)
  })

  it('answers 404 for a path that is not a photo id', async () => {
    const response = await worker.fetch(
      new Request('https://db.example/photos/../../x', { method: 'GET', headers: { Authorization: 'Bearer admin-token' } }),
      env(),
    )
    expect(response.status).toBe(404)
  })
})
