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
  '/': {
    title: `${SITE_NAME} — training, cooking, and engineering notes`,
    description:
      'A personal site where Abe Pasion writes up endurance training, recipes and grocery cost research, actuarial study notes, and the software projects behind it all.',
    ads: false,
    index: true,
  },
  '/login': {
    title: `Sign in — ${SITE_NAME}`,
    description: 'Sign in to access private sections of the site.',
    ads: false,
    index: false,
  },

  '/mrpasionfruit': {
    title: `About Abe Pasion — ${SITE_NAME}`,
    description:
      'Who I am, how I spend my time, the cats I live with, and the running bucket list of things I still want to build, visit, and learn.',
    ads: true,
    index: true,
  },
  '/mrpasionfruit/oreo-gang': {
    title: `Oreo Gang — ${SITE_NAME}`,
    description:
      'The cats I live with, how they ended up here, and what daily life with them actually looks like.',
    ads: true,
    index: true,
  },
  '/mrpasionfruit/interests': {
    title: `Interests — ${SITE_NAME}`,
    description:
      'The books, projects, and creators I keep returning to, and what each of them changed about how I work.',
    ads: true,
    index: true,
  },

  '/training': {
    title: `Training — ${SITE_NAME}`,
    description:
      'How I structure endurance and strength training around a full-time job: the weekly layout, the events I am pointing at, and what the log actually shows.',
    ads: true,
    index: true,
  },
  '/training/records': {
    title: `Training records and personal bests — ${SITE_NAME}`,
    description:
      'Personal bests, training consistency over time, race history, and the gear and nutrition I have settled on after testing.',
    ads: true,
    index: true,
  },
  '/training/data': {
    title: `Training data analysis — ${SITE_NAME}`,
    description:
      'What I do with data from Garmin, RingConn, and Apple Health: which metrics are worth watching, what the common terms mean, and how to read the trends without over-fitting.',
    ads: true,
    index: true,
  },
  '/training/learn': {
    title: `Training notes and lessons — ${SITE_NAME}`,
    description:
      'Technique cues, mistakes worth remembering, and small training experiments with their results.',
    ads: true,
    index: true,
  },

  '/experiences': {
    title: `Experience and background — ${SITE_NAME}`,
    description:
      'Professional background in BI development, data analysis, and cybersecurity, plus education and the technical skills behind the work.',
    ads: true,
    index: true,
  },
  '/experiences/studying': {
    title: `Actuarial exam studying — ${SITE_NAME}`,
    description:
      'How I study for actuarial exams alongside a full-time job: the current plan, the materials that worked, and the session structure I use.',
    ads: true,
    index: true,
  },

  '/cooking': {
    title: `Cooking — ${SITE_NAME}`,
    description:
      'Recipes I actually repeat, a weekly meal plan that survives a work week, kitchen technique notes, and grocery price research across four stores.',
    ads: true,
    index: true,
  },
  '/cooking/recipes': {
    title: `Recipes worth repeating — ${SITE_NAME}`,
    description:
      'A working collection of meals kept for being good, practical, or cheap, with cook times, tools, storage life, and notes from each attempt.',
    ads: true,
    index: true,
  },
  '/cooking/plan': {
    title: `Weekly meal plan — ${SITE_NAME}`,
    description:
      'The weekly cooking map: what gets cooked which night, the grocery list it produces, and what the week costs.',
    ads: true,
    index: true,
  },
  '/cooking/learn': {
    title: `Cooking techniques and lessons — ${SITE_NAME}`,
    description:
      'Technique notes, how individual ingredients change a dish, equipment that earned its place, and the trial and error behind both.',
    ads: true,
    index: true,
  },
  '/cooking/deals': {
    title: `Grocery price tracking and deals — ${SITE_NAME}`,
    description:
      'Grocery prices compared across Walmart, Target, Publix, and Aldi, with current store deals and manufacturer coupons refreshed daily.',
    ads: true,
    index: true,
  },

  '/gaming': {
    title: `Gaming — ${SITE_NAME}`,
    description:
      'The games I keep coming back to and the servers I run for friends.',
    ads: true,
    index: true,
  },
  '/gaming/server': {
    title: `Minecraft server status and how to join — ${SITE_NAME}`,
    description:
      'Live status for the Minecraft server, how it is hosted, and step-by-step connection instructions.',
    ads: false,
    index: true,
  },

  '/finances': {
    title: `Finances — ${SITE_NAME}`,
    description: 'Private budget and spending dashboard for approved accounts.',
    ads: false,
    index: false,
  },
  '/tasks': {
    title: `Tasks — ${SITE_NAME}`,
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
