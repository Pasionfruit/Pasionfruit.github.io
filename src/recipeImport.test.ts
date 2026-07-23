// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectPlatform, importRecipeFromUrl } from './recipeImport'

const RECIPE_HTML = `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({
  '@type': 'Recipe',
  name: 'Test Soup',
  recipeIngredient: ['2 cups water', '1 tbsp salt'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water' }],
  recipeYield: '4',
  totalTime: 'PT30M',
})}</script>
</head><body>${'padding '.repeat(40)}</body></html>`

const PLAIN_HTML = `<!doctype html><html><body>${'no recipe here '.repeat(30)}</body></html>`

type MockResult = { ok: boolean; text: string } | 'reject'

function mockFetch(handler: (url: string) => MockResult) {
  const spy = vi.fn(async (input: string) => {
    const result = handler(String(input))
    if (result === 'reject') throw new Error('network down')
    return { ok: result.ok, status: result.ok ? 200 : 500, text: async () => result.text } as Response
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('detectPlatform', () => {
  it('classifies the source', () => {
    expect(detectPlatform('https://www.tiktok.com/@a/video/1')).toBe('tiktok')
    expect(detectPlatform('https://instagram.com/p/abc')).toBe('instagram')
    expect(detectPlatform('https://cooking.example.com/soup')).toBe('web')
  })
})

describe('importRecipeFromUrl', () => {
  it('skips the network for tiktok/instagram links', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    const draft = await importRecipeFromUrl('https://www.tiktok.com/@a/video/1')

    expect(spy).not.toHaveBeenCalled()
    expect(draft.source_platform).toBe('tiktok')
    expect(draft.video_link).toContain('tiktok.com')
    expect(draft.auto_extracted).toBe(false)
  })

  it('parses a recipe from Jina and marks it auto-extracted', async () => {
    mockFetch((url) => (url.includes('r.jina.ai') ? { ok: true, text: RECIPE_HTML } : { ok: false, text: '' }))

    const draft = await importRecipeFromUrl('https://cooking.example.com/soup')

    expect(draft.auto_extracted).toBe(true)
    expect(draft.recipe_name).toBe('Test Soup')
    expect(draft.ingredients.map((i) => i.name)).toEqual(['water', 'salt'])
    expect(draft.steps).toEqual(['Boil water'])
    expect(draft.cook_time).toBe('30 min')
  })

  it('requests HTML output from Jina via the return-format header', async () => {
    let jinaHeaders: RequestInit['headers']
    const spy = vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input).includes('r.jina.ai')) {
        jinaHeaders = init?.headers
      }
      return { ok: true, status: 200, text: async () => RECIPE_HTML } as Response
    })
    vi.stubGlobal('fetch', spy)

    await importRecipeFromUrl('https://cooking.example.com/soup')

    expect(jinaHeaders).toMatchObject({ 'x-return-format': 'html' })
  })

  it('falls through to a later proxy when an earlier one returns a non-recipe page', async () => {
    mockFetch((url) => {
      if (url.includes('r.jina.ai')) return { ok: true, text: PLAIN_HTML } // reachable, but no schema
      if (url.includes('allorigins')) return { ok: true, text: RECIPE_HTML }
      return { ok: false, text: '' }
    })

    const draft = await importRecipeFromUrl('https://cooking.example.com/soup')

    expect(draft.auto_extracted).toBe(true)
    expect(draft.recipe_name).toBe('Test Soup')
  })

  it('returns an empty draft (no error) when the page loads but has no recipe schema', async () => {
    mockFetch(() => ({ ok: true, text: PLAIN_HTML }))

    const draft = await importRecipeFromUrl('https://cooking.example.com/not-a-recipe')

    expect(draft.auto_extracted).toBe(false)
    expect(draft.recipe_name).toBe('')
    expect(draft.website_link).toBe('https://cooking.example.com/not-a-recipe')
  })

  it('throws when no proxy can reach the page', async () => {
    mockFetch(() => 'reject')

    await expect(importRecipeFromUrl('https://cooking.example.com/soup')).rejects.toThrow(/Could not reach the page/)
  })
})
