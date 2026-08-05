// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRouteMeta } from './routeMeta'

const AD_SCRIPT = '#adsbygoogle-script'

function robots() {
  return document.head.querySelector('meta[name="robots"]')?.getAttribute('content')
}

function hasAdScript() {
  return document.head.querySelector(AD_SCRIPT) !== null
}

describe('useRouteMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it.each(['/', '/login', '/finances', '/tasks', '/weekly-reset', '/gaming/server', '/unknown-route'])(
    'does not load ads on non-content route %s',
    (path) => {
      renderHook(() => useRouteMeta(path))
      expect(hasAdScript()).toBe(false)
    },
  )

  it.each(['/cooking/recipes', '/training/records', '/experiences', '/mrpasionfruit'])(
    'loads ads on content route %s',
    (path) => {
      renderHook(() => useRouteMeta(path))
      expect(hasAdScript()).toBe(true)
    },
  )

  it('removes the ad script when navigating from a content route to a utility route', () => {
    const { rerender } = renderHook(({ path }) => useRouteMeta(path), {
      initialProps: { path: '/cooking/recipes' },
    })
    expect(hasAdScript()).toBe(true)

    rerender({ path: '/login' })
    expect(hasAdScript()).toBe(false)
  })

  it.each(['/login', '/finances', '/tasks', '/weekly-reset', '/unknown-route'])(
    'marks private route %s noindex',
    (path) => {
      renderHook(() => useRouteMeta(path))
      expect(robots()).toBe('noindex,nofollow')
    },
  )

  it.each(['/', '/cooking', '/training/data', '/gaming/server'])(
    'marks public route %s indexable',
    (path) => {
      renderHook(() => useRouteMeta(path))
      expect(robots()).toBe('index,follow')
    },
  )

  it('gives each route a unique title and description', () => {
    const paths = ['/', '/cooking', '/cooking/recipes', '/training', '/experiences']
    const titles = new Set<string>()

    for (const path of paths) {
      document.head.innerHTML = ''
      renderHook(() => useRouteMeta(path))
      titles.add(document.title)
      expect(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
      ).toBeTruthy()
    }

    expect(titles.size).toBe(paths.length)
  })

  it('normalizes trailing slashes', () => {
    renderHook(() => useRouteMeta('/cooking/recipes/'))
    expect(hasAdScript()).toBe(true)
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://pasionfruit.github.io/cooking/recipes',
    )
  })
})
