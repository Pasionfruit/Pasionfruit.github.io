const FX_STORAGE_KEY = 'casino-custom-sfx-v1'
const FX_ENABLED_STORAGE_KEY = 'casino-custom-sfx-enabled-v1'

function withBasePath(relativePath) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  const normalized = String(relativePath || '').replace(/^\/+/, '')
  return `${base}/${normalized}`
}

const FX_FILENAMES = {
  win: 'win.mp3',
  jackpot: 'jackpot.mp3',
  ballSpin: 'ball-spinning.mp3',
  slotSpin: 'slot-spinning.mp3',
  finalCard: 'dramatic-final-card.mp3',
  cardFlip: 'card-flip.mp3',
  buttonClick: 'button-click.mp3',
}

const DEFAULT_FX_MAP = {
  win: withBasePath(`audio/effects/${FX_FILENAMES.win}`),
  jackpot: withBasePath(`audio/effects/${FX_FILENAMES.jackpot}`),
  ballSpin: withBasePath(`audio/effects/${FX_FILENAMES.ballSpin}`),
  slotSpin: withBasePath(`audio/effects/${FX_FILENAMES.slotSpin}`),
  finalCard: withBasePath(`audio/effects/${FX_FILENAMES.finalCard}`),
  cardFlip: withBasePath(`audio/effects/${FX_FILENAMES.cardFlip}`),
  buttonClick: withBasePath(`audio/effects/${FX_FILENAMES.buttonClick}`),
}

const LEGACY_FX_MAP = {
  win: withBasePath(`audio/${FX_FILENAMES.win}`),
  jackpot: withBasePath(`audio/${FX_FILENAMES.jackpot}`),
  ballSpin: withBasePath(`audio/${FX_FILENAMES.ballSpin}`),
  slotSpin: withBasePath(`audio/${FX_FILENAMES.slotSpin}`),
  finalCard: withBasePath(`audio/${FX_FILENAMES.finalCard}`),
  cardFlip: withBasePath(`audio/${FX_FILENAMES.cardFlip}`),
  buttonClick: withBasePath(`audio/${FX_FILENAMES.buttonClick}`),
}

const DEFAULT_FX_ENABLED_MAP = {
  win: true,
  jackpot: true,
  ballSpin: true,
  slotSpin: true,
  finalCard: true,
  cardFlip: true,
  buttonClick: true,
}

const activeLoopMap = new Map()

function normalizeStoredFxSrc(effectKey, rawValue) {
  const src = String(rawValue || '').trim()
  if (!src) {
    return DEFAULT_FX_MAP[effectKey]
  }

  const file = FX_FILENAMES[effectKey]
  if (!file) {
    return src
  }

  const lower = src.toLowerCase()
  if (lower.endsWith(`/audio/effects/${file}`) || lower.endsWith(`/audio/${file}`)) {
    return DEFAULT_FX_MAP[effectKey]
  }

  return src
}

function getFxCandidates(effectKey, preferredSrc) {
  const candidates = [
    String(preferredSrc || '').trim(),
    String(DEFAULT_FX_MAP[effectKey] || '').trim(),
    String(LEGACY_FX_MAP[effectKey] || '').trim(),
  ]

  return candidates.filter((candidate, index) => candidate && candidates.indexOf(candidate) === index)
}

export function readSoundFxMap() {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FX_MAP }

    const parsed = JSON.parse(raw)
    const safe = parsed && typeof parsed === 'object' ? parsed : {}

    return {
      ...DEFAULT_FX_MAP,
      win: normalizeStoredFxSrc('win', safe.win),
      jackpot: normalizeStoredFxSrc('jackpot', safe.jackpot),
      ballSpin: normalizeStoredFxSrc('ballSpin', safe.ballSpin),
      slotSpin: normalizeStoredFxSrc('slotSpin', safe.slotSpin),
      finalCard: normalizeStoredFxSrc('finalCard', safe.finalCard),
      cardFlip: normalizeStoredFxSrc('cardFlip', safe.cardFlip),
      buttonClick: normalizeStoredFxSrc('buttonClick', safe.buttonClick),
    }
  } catch {
    return { ...DEFAULT_FX_MAP }
  }
}

export function writeSoundFxMap(nextMap) {
  const normalized = {
    ...DEFAULT_FX_MAP,
    ...(nextMap && typeof nextMap === 'object' ? nextMap : {}),
  }

  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(normalized))
}

export function readSoundFxEnabledMap() {
  try {
    const raw = localStorage.getItem(FX_ENABLED_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FX_ENABLED_MAP }

    const parsed = JSON.parse(raw)
    const safe = parsed && typeof parsed === 'object' ? parsed : {}

    return {
      win: typeof safe.win === 'boolean' ? safe.win : DEFAULT_FX_ENABLED_MAP.win,
      jackpot: typeof safe.jackpot === 'boolean' ? safe.jackpot : DEFAULT_FX_ENABLED_MAP.jackpot,
      ballSpin: typeof safe.ballSpin === 'boolean' ? safe.ballSpin : DEFAULT_FX_ENABLED_MAP.ballSpin,
      slotSpin: typeof safe.slotSpin === 'boolean' ? safe.slotSpin : DEFAULT_FX_ENABLED_MAP.slotSpin,
      finalCard: typeof safe.finalCard === 'boolean' ? safe.finalCard : DEFAULT_FX_ENABLED_MAP.finalCard,
      cardFlip: typeof safe.cardFlip === 'boolean' ? safe.cardFlip : DEFAULT_FX_ENABLED_MAP.cardFlip,
      buttonClick: typeof safe.buttonClick === 'boolean' ? safe.buttonClick : DEFAULT_FX_ENABLED_MAP.buttonClick,
    }
  } catch {
    return { ...DEFAULT_FX_ENABLED_MAP }
  }
}

export function writeSoundFxEnabledMap(nextMap) {
  const normalized = {
    ...DEFAULT_FX_ENABLED_MAP,
    ...(nextMap && typeof nextMap === 'object' ? nextMap : {}),
  }

  localStorage.setItem(FX_ENABLED_STORAGE_KEY, JSON.stringify(normalized))
}

export function stopCustomFx(effectKey) {
  const active = activeLoopMap.get(effectKey)
  if (!active) return

  active.pause()
  active.currentTime = 0
  activeLoopMap.delete(effectKey)
}

export function playCustomFx(effectKey, options = {}) {
  const { loop = false, volume = 0.8, playbackRate = 1 } = options

  if (typeof Audio === 'undefined') {
    return false
  }

  const enabledMap = readSoundFxEnabledMap()
  if (!enabledMap[effectKey]) {
    return false
  }

  if (loop) {
    const active = activeLoopMap.get(effectKey)
    if (active) {
      return true
    }
  }

  const map = readSoundFxMap()
  const preferred = String(map[effectKey] || '').trim()
  const candidates = getFxCandidates(effectKey, preferred)
  if (!candidates.length) {
    return false
  }

  const normalizedVolume = Math.min(1, Math.max(0, Number(volume) || 0.8))
  const normalizedPlaybackRate = Math.min(2, Math.max(0.5, Number(playbackRate) || 1))

  const playCandidate = (index) => {
    if (index >= candidates.length) {
      return
    }

    let didFail = false
    const audio = new Audio(candidates[index])
    audio.loop = loop
    audio.volume = normalizedVolume
    audio.playbackRate = normalizedPlaybackRate

    const clearLoopRef = () => {
      if (loop && activeLoopMap.get(effectKey) === audio) {
        activeLoopMap.delete(effectKey)
      }
    }

    const handleFail = () => {
      if (didFail) {
        return
      }

      didFail = true
      clearLoopRef()
      playCandidate(index + 1)
    }

    audio.addEventListener('error', handleFail, { once: true })

    if (loop) {
      activeLoopMap.set(effectKey, audio)
      audio.addEventListener('ended', clearLoopRef)
    }

    const playPromise = audio.play()
    if (playPromise?.catch) {
      playPromise.catch(handleFail)
    }
  }

  try {
    playCandidate(0)
    return true
  } catch {
    return false
  }
}
