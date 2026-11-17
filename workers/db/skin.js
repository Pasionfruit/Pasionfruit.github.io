/**
 * POST /skin/count — count acne and scars in one skin photo with a small, cheap
 * Claude model (Haiku). Admin only. Needs the ANTHROPIC_API_KEY secret.
 *
 * Body: { image: <base64 JPEG>, angle: 'front'|'left'|'right'|'back' }
 * Reply: { acne, scar, spots: [{ kind, x, y }] } with x, y as 0-1 fractions of
 * the image width and height. The positions are approximate: they only seed the
 * circles the user then corrects, the counts are the point.
 */

import { verifyAdmin } from '../shared/admin.js'

const MODEL = 'claude-haiku-5-5'
const MAX_IMAGE_CHARS = 6 * 1024 * 1024 // base64 characters, about 4.5 MB of JPEG
const ANGLES = ['front', 'left', 'right', 'back']

const TOOL = {
  name: 'report_spots',
  description: 'Report every acne spot and acne scar found in the photo.',
  input_schema: {
    type: 'object',
    properties: {
      spots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['acne', 'scar'] },
            x: { type: 'number', description: 'Horizontal centre, 0 (left edge) to 1 (right edge)' },
            y: { type: 'number', description: 'Vertical centre, 0 (top edge) to 1 (bottom edge)' },
          },
          required: ['kind', 'x', 'y'],
        },
      },
    },
    required: ['spots'],
  },
}

export function whereText(angle) {
  if (angle === 'back') return "a person's back"
  if (angle === 'front') return "a person's face, seen from the front"
  return `the ${angle} side of a person's face`
}

/** Keep only well-formed spots inside the image, and drop near-duplicates. */
export function cleanSpots(raw) {
  const spots = []
  for (const s of Array.isArray(raw) ? raw : []) {
    const kind = s?.kind === 'scar' ? 'scar' : s?.kind === 'acne' ? 'acne' : null
    const x = Number(s?.x)
    const y = Number(s?.y)
    if (!kind || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) continue
    if (spots.some((p) => Math.hypot(p.x - x, p.y - y) < 0.012)) continue
    spots.push({ kind, x, y })
    if (spots.length >= 120) break
  }
  return spots
}

export async function skinRoute(request, env, { json, deny }) {
  if (request.method !== 'POST') return deny(405, 'Use POST', request, env)
  const auth = await verifyAdmin(request, env)
  if (!auth.ok) return deny(403, auth.reason, request, env)
  if (!env.ANTHROPIC_API_KEY) return deny(500, 'ANTHROPIC_API_KEY is not set on this worker', request, env)

  let body
  try {
    body = await request.json()
  } catch {
    return deny(400, 'Invalid JSON', request, env)
  }
  const image = typeof body?.image === 'string' ? body.image : ''
  const angle = ANGLES.includes(body?.angle) ? body.angle : 'front'
  if (!image || image.length > MAX_IMAGE_CHARS) return deny(400, 'Send a JPEG under about 4 MB as base64', request, env)

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            {
              type: 'text',
              text:
                `This is a photo of ${whereText(angle)}, for a personal skin log. Count every active acne spot ` +
                '(red or inflamed pimples, whiteheads, cysts) and every acne scar (flat or pitted marks, dark or red post-acne marks). ' +
                'List each one separately with the centre of the spot as fractions of the image. ' +
                'Ignore freckles, moles, hair, eyes, lips and nostrils. If there are none, report an empty list.',
            },
          ],
        },
      ],
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => null)
    const reason = detail?.error?.message ? `: ${detail.error.message}` : ''
    if (upstream.status === 401) {
      return deny(502, 'Anthropic rejected the API key. Re-set it with: npx wrangler secret put ANTHROPIC_API_KEY (in workers/db), then redeploy.', request, env)
    }
    return deny(502, `Claude returned ${upstream.status}${reason}`, request, env)
  }
  const data = await upstream.json().catch(() => null)
  const block = data?.content?.find?.((c) => c.type === 'tool_use')
  const spots = cleanSpots(block?.input?.spots)
  return json(
    { acne: spots.filter((s) => s.kind === 'acne').length, scar: spots.filter((s) => s.kind === 'scar').length, spots },
    request,
    env,
  )
}
