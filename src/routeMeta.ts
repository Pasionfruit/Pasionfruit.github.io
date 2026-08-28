import { useEffect } from 'react'

const ADSENSE_CLIENT_ID = 'ca-pub-7419917678778631'
const ADSENSE_SCRIPT_ID = 'adsbygoogle-script'
const SITE_NAME = 'mrpasionfruit'
const SITE_ORIGIN = 'https://pasionfruit.github.io'

type RouteMeta = {
  title: string
  description: string
  // Ads are only allowed on pages that stand on their own as published writing.
  // AdSense policy forbids ads on navigation, auth, placeholder, and utility screens.
  ads: boolean
  // Private dashboards and personal tools are excluded from search indexes so they
  // are not judged as public content.
  index: boolean
}

const ROUTE_META: Record<string, RouteMeta> = {
  // The three public sections are collapsible blocks on this page rather than
  // routes of their own, so the home page is now the site's only content page —
  // and the only one carrying ads.
  '/': {
    title: `${SITE_NAME} — experience, side projects, and gaming`,
    description:
      'Abe Pasion — BI developer and data analyst in Florida. Professional background, education, and technical skills, plus deployed side projects you can try and the game server I run for friends.',
    ads: true,
    index: true,
  },
  '/login': {
    title: `Sign in — ${SITE_NAME}`,
    description: 'Sign in to access private sections of the site.',
    ads: false,
    index: false,
  },

  // Private dashboards. Never indexed, never carry ads.
  '/admin': {
    title: `Dashboards — ${SITE_NAME}`,
    description: 'Private dashboards for the admin account.',
    ads: false,
    index: false,
  },
  '/admin/journal': {
    title: `Journal — ${SITE_NAME}`,
    description: 'Private journal.',
    ads: false,
    index: false,
  },
  '/admin/finance': {
    title: `Finance — ${SITE_NAME}`,
    description: 'Private budget and spending dashboard for approved accounts.',
    ads: false,
    index: false,
  },
  '/admin/training': {
    title: `Training — ${SITE_NAME}`,
    description: 'Private training and health data dashboard.',
    ads: false,
    index: false,
  },
  '/admin/work': {
    title: `Work — ${SITE_NAME}`,
    description: 'Private work project tracker.',
    ads: false,
    index: false,
  },

  '/tasks': {
    title: `Task manager — ${SITE_NAME}`,
    description: 'Personal task list.',
    ads: false,
    index: false,
  },
  '/weekly-reset': {
    title: `Weekly reset — ${SITE_NAME}`,
    description: 'Personal weekly planning tool.',
    ads: false,
    index: false,
  },
}

const FALLBACK_META: RouteMeta = {
  title: SITE_NAME,
  description: ROUTE_META['/'].description,
  ads: false,
  index: false,
}

function setMetaTag(selector: string, attribute: 'name' | 'rel', key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)

  if (!tag) {
    tag = document.createElement(attribute === 'rel' ? 'link' : 'meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }

  tag.setAttribute(attribute === 'rel' ? 'href' : 'content', value)
}

function removeInjectedAds() {
  document
    .querySelectorAll('ins.adsbygoogle, .google-auto-placed, [id^="aswift_"], [id^="google_ads_iframe"]')
    .forEach((element) => element.remove())
}

function syncAdScript(enabled: boolean) {
  const existing = document.getElementById(ADSENSE_SCRIPT_ID)

  if (!enabled) {
    existing?.remove()
    removeInjectedAds()
    return
  }

  if (existing) {
    return
  }

  const script = document.createElement('script')
  script.id = ADSENSE_SCRIPT_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
  document.head.appendChild(script)
}

export function useRouteMeta(pathname: string) {
  useEffect(() => {
    const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    const meta = ROUTE_META[normalized] ?? FALLBACK_META

    document.title = meta.title
    setMetaTag('meta[name="description"]', 'name', 'description', meta.description)
    setMetaTag(
      'meta[name="robots"]',
      'name',
      'robots',
      meta.index ? 'index,follow' : 'noindex,nofollow',
    )
    setMetaTag('link[rel="canonical"]', 'rel', 'canonical', `${SITE_ORIGIN}${normalized}`)

    syncAdScript(meta.ads)
  }, [pathname])
}
