import { useEffect } from 'react'

const ADSENSE_CLIENT_ID = 'ca-pub-7419917678778631'
const ADSENSE_SCRIPT_ID = 'adsbygoogle-script'

// Only these routes are established, publisher-content pages. Everything else
// (home nav grid, login, private/gated finances, personal tools like tasks and
// weekly-reset, the gaming server status widget, and all redirect-only routes)
// must never serve Google ads per AdSense's "ads without publisher-content" policy.
const AD_ELIGIBLE_PATHS = new Set([
  '/mrpasionfruit',
  '/mrpasionfruit/oreo-gang',
  '/mrpasionfruit/interests',
  '/training',
  '/training/records',
  '/training/data',
  '/training/learn',
  '/experiences',
  '/experiences/studying',
  '/cooking',
  '/cooking/recipes',
  '/cooking/plan',
  '/cooking/learn',
  '/cooking/deals',
  '/gaming',
])

function removeInjectedAds() {
  document
    .querySelectorAll('ins.adsbygoogle, .google-auto-placed, [id^="aswift_"], [id^="google_ads_iframe"]')
    .forEach((el) => el.remove())
}

export function useAdSenseGate(pathname: string) {
  useEffect(() => {
    const existingScript = document.getElementById(ADSENSE_SCRIPT_ID)

    if (AD_ELIGIBLE_PATHS.has(pathname)) {
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = ADSENSE_SCRIPT_ID
        script.async = true
        script.crossOrigin = 'anonymous'
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
        document.head.appendChild(script)
      }
    } else {
      existingScript?.remove()
      removeInjectedAds()
    }
  }, [pathname])
}
