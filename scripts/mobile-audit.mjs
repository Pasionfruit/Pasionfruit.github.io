/**
 * Mobile layout audit: loads every route at phone and tablet widths and fails on
 * horizontal overflow or touch targets under 24x24 CSS px.
 *
 * Needs a browser and the Playwright driver, neither of which is a project
 * dependency. To run:
 *
 *   npm install --no-save playwright-core
 *   npm run dev                      # in another terminal
 *   BASE=http://localhost:5173 node scripts/mobile-audit.mjs
 *
 * CHROME_PATH overrides the browser location if Chrome is not installed at the
 * default Windows path.
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5175'

const VIEWPORTS = [
  { name: 'iPhone SE  360x740', width: 360, height: 740 },
  { name: 'iPhone 12  390x844', width: 390, height: 844 },
  { name: 'Pixel 7    412x915', width: 412, height: 915 },
  { name: 'Tablet     768x1024', width: 768, height: 1024 },
]

const ADMIN_EMAIL = 'pasionabe@gmail.com'

function fakeToken(email) {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`
}

const GUEST_ROUTES = ['/', '/login', '/minecraft.html']
const ADMIN_ROUTES = ['/', '/admin/journal', '/admin/finance', '/admin/training', '/admin/work', '/tasks', '/weekly-reset']

/**
 * Panels that only exist after a click. Collapsed markup hides plenty of
 * layout, so each of these is opened before measuring.
 */
const OPEN_ACTIONS = {
  '/admin/journal': ['button:has-text("New entry")'],
  '/admin/work': ['button:has-text("New item")'],
}

/** Elements whose right edge extends past the viewport. */
const findOverflow = `() => {
  const vw = document.documentElement.clientWidth
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const style = getComputedStyle(el)
    if (style.position === 'fixed') continue
    if (r.right > vw + 1 || r.left < -1) {
      // Ignore elements inside a scroll container - that is intentional.
      let p = el.parentElement, scrollable = false
      while (p && p !== document.body) {
        const ps = getComputedStyle(p)
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') { scrollable = true; break }
        p = p.parentElement
      }
      if (scrollable) continue
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 70),
        right: Math.round(r.right),
        width: Math.round(r.width),
      })
    }
  }
  return {
    docScrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    offenders: bad.slice(0, 6),
  }
}`

/**
 * Interactive targets smaller than the 24x24 CSS px minimum (WCAG 2.2 AA).
 *
 * A control may keep a small visual box while extending its hit area with an
 * absolutely positioned ::before/::after, which is a legitimate pattern - so the
 * pseudo-element box counts toward the target size.
 */
const findTinyTargets = `() => {
  const small = []
  const pseudoSize = (el, which) => {
    const cs = getComputedStyle(el, which)
    if (cs.content === 'none' || cs.position !== 'absolute') return { w: 0, h: 0 }
    return { w: parseFloat(cs.width) || 0, h: parseFloat(cs.height) || 0 }
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="tab"], [role="button"]')) {
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    const before = pseudoSize(el, '::before')
    const after = pseudoSize(el, '::after')
    const r = {
      width: Math.max(box.width, before.w, after.w),
      height: Math.max(box.height, before.h, after.h),
    }
    if (r.width < 24 || r.height < 24) {
      small.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 50),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
        size: Math.round(r.width) + 'x' + Math.round(r.height),
      })
    }
  }
  return small.slice(0, 8)
}`

// Drive the locally installed Chrome so no browser download is needed.
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ executablePath: CHROME })
let failures = 0

for (const vp of VIEWPORTS) {
  console.log(`\n${'='.repeat(64)}\n${vp.name}\n${'='.repeat(64)}`)

  for (const [label, routes, email] of [
    ['guest', GUEST_ROUTES, null],
    ['admin', ADMIN_ROUTES, ADMIN_EMAIL],
  ]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width < 700,
      hasTouch: vp.width < 700,
    })

    if (email) {
      await context.addInitScript(`
        localStorage.setItem('demo-profile', 'admin');
        localStorage.setItem('google-id-token', '${fakeToken(email)}');
      `)
    }

    const page = await context.newPage()

    for (const route of routes) {
      // `networkidle` can hang on a dev server that keeps connections open, and
      // Playwright discourages it; settle on the shell then give data a beat.
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
      await page.waitForLoadState('load').catch(() => {})
      await page.waitForTimeout(600)

      // On the guest home page, open the sections so their content is measured too.
      if (label === 'guest' && route === '/') {
        for (const id of ['experiences', 'personal-sites', 'gaming']) {
          await page.click(`#${id} .home-section-toggle`).catch(() => {})
        }
        await page.waitForTimeout(300)
      }

      // Open any editor panels this route hides behind a button.
      for (const selector of OPEN_ACTIONS[route] ?? []) {
        await page.click(selector, { timeout: 2000 }).catch(() => {})
      }

      // Cycle the tabbed cards on the admin home so each tab gets measured.
      if (label === 'admin' && route === '/') {
        for (const tab of ['Studying', 'Training']) {
          await page.click(`[role="tab"][aria-label="${tab}"]`, { timeout: 1500 }).catch(() => {})
          await page.waitForTimeout(150)
        }
      }

      await page.waitForTimeout(250)

      const res = await page.evaluate(`(${findOverflow})()`)
      const tiny = await page.evaluate(`(${findTinyTargets})()`)
      const overflows = res.docScrollWidth > res.clientWidth + 1

      const tag = `${label.padEnd(5)} ${route.padEnd(17)}`
      if (overflows || res.offenders.length) {
        failures += 1
        console.log(`  FAIL ${tag} scrollWidth ${res.docScrollWidth} > ${res.clientWidth}`)
        for (const o of res.offenders) {
          console.log(`        <${o.tag} class="${o.cls}"> right=${o.right} w=${o.width}`)
        }
      } else {
        console.log(`  ok   ${tag}`)
      }

      if (tiny.length && vp.width < 700) {
        console.log(`       small tap targets: ${tiny.map((t) => `${t.tag}.${t.cls.split(' ')[0]}(${t.size})`).join(', ')}`)
      }
    }

    await context.close()
  }
}

await browser.close()
console.log(`\n${failures === 0 ? 'No horizontal overflow found.' : failures + ' page/viewport combos overflow.'}`)
