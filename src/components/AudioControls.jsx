import { useEffect, useMemo, useRef, useState } from 'react'
import {
  playCustomFx,
  readSoundFxEnabledMap,
  writeSoundFxEnabledMap,
} from '../lib/soundFx'

const STORAGE_KEY = 'casino-lobby-audio'
const DEFAULT_VOLUME = 0.5

function readInitialAudioSettings() {
  try {
    const storedSettings = localStorage.getItem(STORAGE_KEY)

    if (!storedSettings) {
      return { volume: DEFAULT_VOLUME, isMuted: false }
    }

    const parsed = JSON.parse(storedSettings)

    return {
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_VOLUME,
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : false,
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return { volume: DEFAULT_VOLUME, isMuted: false }
  }
}

function AudioControls() {
  const [volume, setVolume] = useState(() => readInitialAudioSettings().volume)
  const [isMuted, setIsMuted] = useState(() => readInitialAudioSettings().isMuted)
  const [hasStarted, setHasStarted] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [fxEnabledMap, setFxEnabledMap] = useState(() => readSoundFxEnabledMap())
  const [fxTestMessage, setFxTestMessage] = useState('')
  const audioRef = useRef(null)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(isMuted)

  const volumePercent = useMemo(() => Math.round(volume * 100), [volume])
  const lobbyThemePath = useMemo(() => {
    const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
    return `${base}/audio/lobby-theme.mp3`
  }, [])

  useEffect(() => {
    const audio = new Audio(lobbyThemePath)
    audio.loop = true
    audio.volume = volumeRef.current
    audio.muted = mutedRef.current

    const handleAudioError = () => {
      setIsAvailable(false)
    }

    audio.addEventListener('error', handleAudioError)
    audioRef.current = audio

    const startPlayback = async () => {
      if (!audioRef.current) {
        return
      }

      try {
        await audioRef.current.play()
        setHasStarted(true)
        window.removeEventListener('pointerdown', startPlayback)
      } catch {
        // Browsers may block playback until a clear user gesture.
      }
    }

    window.addEventListener('pointerdown', startPlayback)

    return () => {
      window.removeEventListener('pointerdown', startPlayback)
      audio.removeEventListener('error', handleAudioError)
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [lobbyThemePath])

  useEffect(() => {
    if (!audioRef.current) {
      return
    }

    volumeRef.current = volume
    mutedRef.current = isMuted

    audioRef.current.volume = volume
    audioRef.current.muted = isMuted

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        volume,
        isMuted,
      }),
    )
  }, [isMuted, volume])

  const ensurePlayback = async () => {
    if (!audioRef.current) {
      return
    }

    try {
      await audioRef.current.play()
      setHasStarted(true)
    } catch {
      // Playback can still be blocked in some browsers until another user gesture.
    }
  }

  const toggleMute = () => {
    setIsMuted((muted) => {
      const nextMuted = !muted

      if (!nextMuted) {
        void ensurePlayback()
      }

      return nextMuted
    })
  }

  const handleVolumeChange = (event) => {
    const next = Number(event.target.value) / 100
    setVolume(next)

    if (next > 0 && isMuted) {
      setIsMuted(false)
    }

    if (next > 0) {
      void ensurePlayback()
    }
  }

  const fxRows = [
    { key: 'win', label: 'Winning' },
    { key: 'jackpot', label: 'Jackpot' },
    { key: 'ballSpin', label: 'Ball Spinning' },
    { key: 'slotSpin', label: 'Slot Spinning' },
    { key: 'finalCard', label: 'Dramatic Final Card' },
    { key: 'cardFlip', label: 'Card Flip' },
    { key: 'buttonClick', label: 'Button Click' },
  ]

  const setFxEnabled = (effectKey, nextValue) => {
    const next = {
      ...fxEnabledMap,
      [effectKey]: nextValue,
    }

    setFxEnabledMap(next)
    writeSoundFxEnabledMap(next)
  }

  const testFx = (effectKey) => {
    const ok = playCustomFx(effectKey)
    if (ok) {
      setFxTestMessage('')
      return
    }

    const label = fxRows.find((fx) => fx.key === effectKey)?.label || effectKey
    if (!fxEnabledMap[effectKey]) {
      setFxTestMessage(`${label} is Off.`)
      return
    }

    setFxTestMessage(`${label} could not play. Check file in public/audio/effects.`)
  }

  return (
    <section className="audio-dock" aria-label="Casino audio controls">
      <div className="audio-title-bar">
        <p className="audio-title">Casino Music</p>
        <button
          className="audio-collapse-button"
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand audio controls' : 'Collapse audio controls'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>
      {!isCollapsed && (
        <>
          <div className="audio-row">
            <button className="mute-button" type="button" onClick={toggleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <label className="volume-label" htmlFor="volume-slider">
              Volume {volumePercent}%
            </label>
            <input
              id="volume-slider"
              className="volume-slider"
              type="range"
              min="0"
              max="100"
              value={volumePercent}
              onChange={handleVolumeChange}
              aria-label="Adjust lobby music volume"
            />
          </div>
          {!isAvailable ? (
            <p className="audio-hint">Add public/audio/lobby-theme.mp3 to enable music.</p>
          ) : !hasStarted ? (
            <p className="audio-hint">Tap or click once anywhere to start music.</p>
          ) : (
            <p className="audio-hint">Music is active.</p>
          )}

          <div className="fx-panel" aria-label="Custom effects library">
            <p className="fx-title">Effects Library</p>
            {fxRows.map((fx) => (
              <div className="fx-row" key={fx.key}>
                <span className="fx-label">{fx.label}</span>
                <button className="fx-action" type="button" onClick={() => testFx(fx.key)}>
                  Test
                </button>
                <button
                  className={`fx-action secondary ${fxEnabledMap[fx.key] ? 'active' : ''}`}
                  type="button"
                  onClick={() => setFxEnabled(fx.key, true)}
                >
                  On
                </button>
                <button
                  className={`fx-action secondary ${!fxEnabledMap[fx.key] ? 'active' : ''}`}
                  type="button"
                  onClick={() => setFxEnabled(fx.key, false)}
                >
                  Off
                </button>
              </div>
            ))}
            <p className="audio-hint">Drop files into public/audio/effects with the configured names.</p>
            {fxTestMessage ? <p className="audio-hint">{fxTestMessage}</p> : null}
          </div>
        </>
      )}
    </section>
  )
}

export default AudioControls
