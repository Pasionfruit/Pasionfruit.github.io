import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coords } from './openMeteo'

type RainViewerFrame = { time: number; path: string }
type RainViewerResponse = {
  host: string
  radar?: { past?: RainViewerFrame[]; nowcast?: RainViewerFrame[] }
}

// CARTO basemaps come in light/dark so the map tracks the site theme.
const BASEMAPS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}
const BASEMAP_ATTRIBUTION = '© OpenStreetMap, © CARTO · Radar © RainViewer'

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function radarTileUrl(host: string, path: string): string {
  // 256px tiles, color scheme 4 (Universal Blue), smoothed, with snow.
  return `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`
}

export function RadarMap({ coords }: { coords: Coords }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.TileLayer | null>(null)
  const radarLayerRef = useRef<L.TileLayer | null>(null)
  const framesRef = useRef<RainViewerFrame[]>([])
  const frameIndexRef = useRef(0)
  const hostRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [frameLabel, setFrameLabel] = useState('')
  const [hasRadar, setHasRadar] = useState(true)

  function showFrame(index: number) {
    const frames = framesRef.current
    const map = mapRef.current
    if (!map || frames.length === 0) return

    const frame = frames[index]
    const nextLayer = L.tileLayer(radarTileUrl(hostRef.current, frame.path), {
      opacity: 0.7,
      zIndex: 2,
    })
    nextLayer.addTo(map)

    const previous = radarLayerRef.current
    // Swap once the new frame is drawn to avoid a flash between frames.
    nextLayer.once('load', () => {
      if (previous && previous !== nextLayer) {
        map.removeLayer(previous)
      }
    })
    radarLayerRef.current = nextLayer
    frameIndexRef.current = index
    setFrameLabel(new Date(frame.time * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
  }

  function stopAnimation() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function startAnimation() {
    stopAnimation()
    if (framesRef.current.length < 2) return
    timerRef.current = setInterval(() => {
      const next = (frameIndexRef.current + 1) % framesRef.current.length
      showFrame(next)
    }, 700)
  }

  // Create the map once, tied to the initial coordinates.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [coords.latitude, coords.longitude],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    const base = L.tileLayer(BASEMAPS[currentTheme()], {
      attribution: BASEMAP_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    })
    base.addTo(map)
    baseLayerRef.current = base

    L.circleMarker([coords.latitude, coords.longitude], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
    }).addTo(map)

    // The card mounts this after layout settles; recalc so tiles fill the grid cell.
    const sizeTimer = setTimeout(() => map.invalidateSize(), 0)

    // Re-fit whenever the container resizes — window resize, and crucially when
    // the mobile collapse toggle reveals a map that mounted at zero size.
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientHeight > 0) {
        map.invalidateSize()
      }
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((response) => response.json() as Promise<RainViewerResponse>)
      .then((payload) => {
        if (cancelled || !mapRef.current) return
        const past = payload.radar?.past ?? []
        const nowcast = payload.radar?.nowcast ?? []
        const frames = [...past, ...nowcast]
        if (frames.length === 0) {
          setHasRadar(false)
          return
        }
        hostRef.current = payload.host
        framesRef.current = frames
        // Start on the most recent observed frame.
        showFrame(Math.max(0, past.length - 1))
        startAnimation()
      })
      .catch(() => {
        if (!cancelled) setHasRadar(false)
      })

    return () => {
      cancelled = true
      clearTimeout(sizeTimer)
      resizeObserver.disconnect()
      stopAnimation()
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
      radarLayerRef.current = null
      framesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recenter when the resolved location changes.
  useEffect(() => {
    mapRef.current?.setView([coords.latitude, coords.longitude], mapRef.current.getZoom())
  }, [coords.latitude, coords.longitude])

  // Swap the basemap when the site theme toggles.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const map = mapRef.current
      if (!map) return
      baseLayerRef.current?.remove()
      const base = L.tileLayer(BASEMAPS[currentTheme()], {
        attribution: BASEMAP_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 19,
      })
      base.setZIndex(1)
      base.addTo(map)
      baseLayerRef.current = base
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  function togglePlay() {
    setIsPlaying((playing) => {
      const next = !playing
      if (next) startAnimation()
      else stopAnimation()
      return next
    })
  }

  return (
    <div className="weather-radar">
      <div ref={containerRef} className="weather-radar-map" role="img" aria-label="Precipitation radar map" />
      {hasRadar ? (
        <div className="weather-radar-controls">
          <button
            type="button"
            className="weather-radar-play"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          {frameLabel ? <span className="weather-radar-time">{frameLabel}</span> : null}
        </div>
      ) : (
        <p className="weather-radar-empty">Radar unavailable right now.</p>
      )}
    </div>
  )
}
