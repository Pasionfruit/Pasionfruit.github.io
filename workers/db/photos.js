/**
 * Timeline photo bytes, stored in R2 (binding PHOTOS) under `timeline/<id>`.
 *
 * The metadata (date, caption) is a row in the `timeline_photos` table, which
 * the table router in worker.js serves; this route only stores and serves the
 * image itself. Every method needs the admin, because the photos are private.
 */

import { verifyAdmin } from '../shared/admin.js'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const PATH = /^\/photos\/([A-Za-z0-9-]{8,64})$/

export async function photoRoute(request, env, { json, deny, corsHeaders }) {
  const match = PATH.exec(new URL(request.url).pathname)
  if (!match) {
    return deny(404, 'No such route', request, env)
  }
  if (!env.PHOTOS) {
    return deny(500, 'PHOTOS bucket is not bound on this worker', request, env)
  }

  const auth = await verifyAdmin(request, env)
  if (!auth.ok) {
    return deny(403, auth.reason, request, env)
  }

  const key = `timeline/${match[1]}`

  if (request.method === 'GET') {
    const object = await env.PHOTOS.get(key)
    if (!object) {
      return deny(404, 'No such photo', request, env)
    }
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
        ...corsHeaders(request, env),
      },
    })
  }

  if (request.method === 'POST') {
    const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
    if (!TYPES.includes(type)) {
      return deny(415, 'Photos must be JPEG, PNG or WebP', request, env)
    }
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BYTES) {
      return deny(413, 'Photo is larger than 10 MB', request, env)
    }

    const bytes = await request.arrayBuffer()
    if (bytes.byteLength === 0) {
      return deny(400, 'Photo is empty', request, env)
    }
    if (bytes.byteLength > MAX_BYTES) {
      return deny(413, 'Photo is larger than 10 MB', request, env)
    }

    await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } })
    return json({ ok: true }, request, env)
  }

  if (request.method === 'DELETE') {
    await env.PHOTOS.delete(key)
    return json({ ok: true }, request, env)
  }

  return deny(405, 'Method not allowed', request, env)
}
