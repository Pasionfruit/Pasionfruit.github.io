import { aceJson, getAceConfig } from '../admin/ace/client'
import type { SkinMark } from './client'

/** Longest edge sent to the vision model. Bigger costs time and VRAM without finding more spots. */
const MAX_EDGE = 896
const MAX_MARKS = 80

/** Ollama tag of a vision model that can point at things (Qwen2.5-VL returns pixel boxes). */
export function skinVisionModel(): string {
  return (import.meta.env.VITE_SKIN_VISION_MODEL as string | undefined)?.trim() || 'qwen2.5vl:7b'
}

const SCHEMA = {
  type: 'object',
  properties: {
    spots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['acne', 'scar'] },
          bbox_2d: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
        },
        required: ['kind', 'bbox_2d'],
      },
    },
  },
  required: ['spots'],
}

type RawSpot = { kind?: unknown; bbox_2d?: unknown }

/**
 * Turn the model's pixel boxes into circles. Anything malformed, outside the
 * image, absurdly large or sitting on top of another circle is dropped, so a
 * rambling model cannot flood the photo.
 */
export function parseMarks(raw: { spots?: RawSpot[] } | null | undefined, width: number, height: number): SkinMark[] {
  const marks: SkinMark[] = []
  for (const spot of raw?.spots ?? []) {
    const kind = spot.kind === 'scar' ? 'scar' : spot.kind === 'acne' ? 'acne' : null
    const box = Array.isArray(spot.bbox_2d) ? spot.bbox_2d.map(Number) : []
    if (!kind || box.length !== 4 || box.some((n) => !Number.isFinite(n))) continue
    const [x1, y1, x2, y2] = box
    const w = Math.abs(x2 - x1)
    const h = Math.abs(y2 - y1)
    if (w <= 0 || h <= 0 || w > width * 0.25 || h > width * 0.25) continue // a spot is small
    const x = (x1 + x2) / 2 / width
    const y = (y1 + y2) / 2 / width
    if (x < 0 || x > 1 || y < 0 || y > height / width) continue
    const r = Math.max(0.012, Math.max(w, h) / 2 / width)
    if (marks.some((m) => Math.hypot(m.x - x, m.y - y) < Math.min(m.r, r))) continue
    marks.push({ kind, x, y, r })
    if (marks.length >= MAX_MARKS) break
  }
  return marks
}

export async function prepareImage(blob: Blob): Promise<{ data: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob).catch(() => {
    throw new Error("Couldn't read that photo.")
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { data: url.slice(url.indexOf(',') + 1), width: canvas.width, height: canvas.height }
}

/**
 * Ask the local vision model (on the Ace host, through the Ace gateway) to find
 * acne and scars. The photo goes to your own machine only. The result is a
 * first guess for the user to correct, never a diagnosis.
 */
export async function detectSkinMarks(idToken: string, photo: Blob, angle: string): Promise<SkinMark[]> {
  const base = getAceConfig()
  if (!base) throw new Error('Ace is not configured (VITE_ACE_BASE_URL), so there is no local model to ask.')

  const { data, width, height } = await prepareImage(photo)
  const where =
    angle === 'back' ? "a person's back" : angle === 'front' || angle === 'face' ? "a person's face, seen from the front" : `the ${angle} side of a person's face`
  const result = await aceJson<{ spots?: RawSpot[] }>({
    config: { ...base, model: skinVisionModel() },
    idToken,
    format: SCHEMA,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content:
          `This is a photo of ${where}, ${width}x${height} pixels. Find every active acne spot (red or inflamed pimples, whiteheads, cysts) ` +
          'and every acne scar (flat or pitted marks, dark or red post-acne marks). ' +
          'Return JSON {"spots":[{"kind":"acne"|"scar","bbox_2d":[x1,y1,x2,y2]}]} with boxes in pixel coordinates of this image. ' +
          'Mark each spot separately and tightly. Ignore freckles, moles, hair, eyes, lips and nostrils. If you see none, return {"spots":[]}.',
        images: [data],
      },
    ],
  })
  return parseMarks(result, width, height)
}
