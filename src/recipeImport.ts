export type ImportedIngredient = {
  name: string
  quantity: string
  unit: string
  note: string
}

export type ImportedRecipeDraft = {
  recipe_name: string
  category: string
  calories: string
  servings: string
  video_link: string
  website_link: string
  cook_time: string
  ingredients: ImportedIngredient[]
  steps: string[]
  source_platform: 'tiktok' | 'instagram' | 'web'
  auto_extracted: boolean
}

export function detectPlatform(url: string): 'tiktok' | 'instagram' | 'web' {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('tiktok.com')) return 'tiktok'
    if (hostname.includes('instagram.com')) return 'instagram'
  } catch {
    // invalid URL
  }
  return 'web'
}

function parseIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return iso
  const hours = parseInt(match[1] ?? '0')
  const mins = parseInt(match[2] ?? '0')
  if (hours && mins) return `${hours} hr ${mins} min`
  if (hours) return `${hours} hr`
  if (mins) return `${mins} min`
  return iso
}

function parseIngredientString(str: string): ImportedIngredient {
  // Try "2 cups flour" → { quantity: '2', unit: 'cups', name: 'flour' }
  const match = str.trim().match(/^([\d/.,]+(?:\s+\d+\/\d+)?)\s*([a-zA-Z]+(?:\.|s)?)?\s+(.+)$/)
  if (match && match[3]) {
    return {
      quantity: match[1].trim(),
      unit: match[2]?.trim() ?? '',
      name: match[3].trim(),
      note: '',
    }
  }
  return { name: str.trim(), quantity: '', unit: '', note: '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRecipeFromJsonLd(data: any): Partial<ImportedRecipeDraft> | null {
  if (!data) return null
  const type = data['@type']
  if (type !== 'Recipe' && !(Array.isArray(type) && type.includes('Recipe'))) return null

  const ingredients: ImportedIngredient[] = (data.recipeIngredient ?? [])
    .map((s: unknown) => parseIngredientString(String(s)))
    .filter((i: ImportedIngredient) => i.name)

  const steps: string[] = []
  const instructions: unknown[] = Array.isArray(data.recipeInstructions) ? data.recipeInstructions : []
  for (const item of instructions) {
    if (typeof item === 'string') {
      steps.push(item)
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      if (obj['@type'] === 'HowToStep') {
        steps.push(String(obj.text ?? obj.name ?? ''))
      } else if (obj['@type'] === 'HowToSection') {
        for (const step of (obj.itemListElement as unknown[] ?? [])) {
          if (step && typeof step === 'object') {
            const s = step as Record<string, unknown>
            steps.push(String(s.text ?? s.name ?? ''))
          }
        }
      }
    }
  }

  let cookTime = String(data.totalTime ?? data.cookTime ?? data.prepTime ?? '')
  if (cookTime.startsWith('PT')) cookTime = parseIsoDuration(cookTime)

  const nutritionCalories = data.nutrition?.calories
  const calories = nutritionCalories ? String(nutritionCalories).replace(/\D/g, '') : ''

  const yieldRaw = data.recipeYield
  const servings = Array.isArray(yieldRaw) ? String(yieldRaw[0] ?? '') : String(yieldRaw ?? '')

  const categoryRaw = [data.recipeCategory, data.recipeCuisine].flat().filter(Boolean)
  const category = categoryRaw.join(', ')

  return {
    recipe_name: String(data.name ?? ''),
    category,
    calories,
    servings,
    cook_time: cookTime,
    ingredients,
    steps: steps.filter(Boolean),
  }
}

function parseSchemaOrg(html: string): Partial<ImportedRecipeDraft> | null {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return null
  }

  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw: unknown = JSON.parse(script.textContent ?? '')
      const candidates: unknown[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && (raw as Record<string, unknown>)['@graph']
          ? (raw as Record<string, unknown[]>)['@graph']
          : [raw]

      for (const candidate of candidates) {
        const result = extractRecipeFromJsonLd(candidate)
        if (result) return result
      }
    } catch {
      continue
    }
  }
  return null
}

type ProxyCandidate = {
  name: string
  buildUrl: (encodedUrl: string, rawUrl: string) => string
  headers?: Record<string, string>
  timeoutMs: number
}

// Ordered by reliability. Jina AI Reader renders the target in a real browser
// and returns full HTML (recipe JSON-LD included), so it works even on sites
// that serve bot-challenge pages to the simple passthrough proxies — those stay
// on as quick fallbacks for pages Jina can't reach. corsproxy.io was dropped
// because it now blocks unregistered origins (403).
const PROXIES: ProxyCandidate[] = [
  {
    name: 'jina',
    buildUrl: (_encoded, raw) => `https://r.jina.ai/${raw}`,
    headers: { 'x-return-format': 'html' },
    timeoutMs: 20000,
  },
  {
    name: 'allorigins',
    buildUrl: (encoded) => `https://api.allorigins.win/raw?url=${encoded}`,
    timeoutMs: 10000,
  },
  {
    name: 'codetabs',
    buildUrl: (encoded) => `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
    timeoutMs: 10000,
  },
]

async function tryFetch(
  proxyUrl: string,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal, headers })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = await res.text()
    return text.trim().length > 200 ? text : null
  } catch {
    clearTimeout(timer)
    return null
  }
}

/**
 * Walks the proxy list until one returns HTML that parses into a recipe, and
 * returns that draft. If none parse, `reachable` reports whether any proxy at
 * least returned a page — so the caller can tell "no recipe schema on the page"
 * (fall back to manual entry) apart from "couldn't fetch it at all" (error).
 */
async function fetchAndParse(
  url: string,
): Promise<{ parsed: Partial<ImportedRecipeDraft> | null; reachable: boolean }> {
  const encoded = encodeURIComponent(url)
  let reachable = false

  for (const proxy of PROXIES) {
    const html = await tryFetch(proxy.buildUrl(encoded, url), proxy.headers, proxy.timeoutMs)
    if (!html) continue
    reachable = true
    const parsed = parseSchemaOrg(html)
    if (parsed) return { parsed, reachable: true }
  }

  return { parsed: null, reachable }
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipeDraft> {
  const platform = detectPlatform(url)
  const base: ImportedRecipeDraft = {
    recipe_name: '',
    category: '',
    calories: '',
    servings: '',
    video_link: platform !== 'web' ? url : '',
    website_link: platform === 'web' ? url : '',
    cook_time: '',
    ingredients: [],
    steps: [],
    source_platform: platform,
    auto_extracted: false,
  }

  if (platform !== 'web') {
    return base
  }

  const { parsed, reachable } = await fetchAndParse(url)
  if (parsed) {
    return { ...base, ...parsed, auto_extracted: true }
  }
  if (!reachable) {
    throw new Error('Could not reach the page — all proxies failed or the site blocks external access.')
  }

  // Page loaded but had no recipe schema — hand back an empty draft to fill in.
  return base
}
