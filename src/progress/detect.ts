import { DB_BASE_URL, type SkinMark } from './client'

/** Longest edge sent to Claude. Bigger costs more tokens without finding more spots. */
const MAX_EDGE = 1280
const MAX_MARKS = 120

type RawSpot = { kind?: unknown; x?: unknown; y?: unknown }

/**
 * Turn Claude's spots (0-1 fractions of the image) into circles. The counts are
 * what matters; positions are approximate, so circles are a fixed small size and
 * anything malformed, outside the image or on top of another is dropped.
 */
export function parseMarks(raw: { spots?: RawSpot[] } | null | undefined, width: number, height: number): SkinMark[] {
  const marks: SkinMark[] = []
  for (const spot of raw?.spots ?? []) {
    const kind = spot.kind === 'scar' ? 'scar' : spot.kind === 'acne' ? 'acne' : null
    const fx = Number(spot.x)
    const fy = Number(spot.y)
    if (!kind || !Number.isFinite(fx) || !Number.isFinite(fy) || fx < 0 || fx > 1 || fy < 0 || fy > 1) continue
    const x = fx
    const y = (fy * height) / width // marks use the image width as the unit
    if (marks.some((m) => Math.hypot(m.x - x, m.y - y) < 0.012)) continue
    marks.push({ kind, x, y, r: 0.018 })
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
 * Ask Claude Haiku (through the db Worker, which holds the API key) to count
 * acne and scars. The photo is sent to Anthropic for this one request. The
 * result is a first guess for the user to correct, never a diagnosis.
 */
export async function detectSkinMarks(idToken: string, photo: Blob, angle: string): Promise<SkinMark[]> {
  const { data, width, height } = await prepareImage(photo)
  const response = await fetch(`${DB_BASE_URL}/skin/count`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: data, angle }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Counting failed: ${response.status}`)
  }
  return parseMarks((await response.json()) as { spots?: RawSpot[] }, width, height)
}
