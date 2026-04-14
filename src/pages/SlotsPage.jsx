import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

const ROW_HEIGHT = 72
const REEL_COUNT = 5
const REEL_DURATIONS_MS = [1700, 2400, 3100, 3800, 4600]
const SYMBOLS = [
  { id: 'cherry', label: 'Cherry', icon: '🍒', weight: 32 },
  { id: 'bell', label: 'Bell', icon: '🔔', weight: 20 },
  { id: 'seven', label: 'Seven', icon: '7️⃣', weight: 7 },
  { id: 'clover', label: 'Clover', icon: '🍀', weight: 27 },
  { id: 'diamond', label: 'Diamond', icon: '💎', weight: 14 },
]

const PAYOUTS = {
  cherry: { 3: 1.6, 4: 3.5, 5: 8 },
  bell: { 3: 2.2, 4: 4.5, 5: 10 },
  clover: { 3: 1.8, 4: 4, 5: 9 },
  diamond: { 3: 3, 4: 6, 5: 14 },
  seven: { 3: 5, 4: 10, 5: 22 },
}

const TOTAL_SYMBOL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0)

function randomSymbol() {
  let roll = Math.random() * TOTAL_SYMBOL_WEIGHT

  for (const symbol of SYMBOLS) {
    roll -= symbol.weight
    if (roll <= 0) {
      return symbol
    }
  }

  return SYMBOLS[SYMBOLS.length - 1]
}

function getLeadingStreak(outcomes) {
  const first = outcomes[0]
  if (!first) return { symbol: null, count: 0 }

  let count = 1
  for (let index = 1; index < outcomes.length; index += 1) {
    if (outcomes[index].id !== first.id) break
    count += 1
  }

  return { symbol: first, count }
}

function createStrip(finalSymbol, length) {
  const strip = []

  for (let index = 0; index < length; index += 1) {
    strip.push(randomSymbol())
  }

  // Keep the outcome on the center payline when the reel settles.
  strip[length - 2] = finalSymbol
  return strip
}

function createInitialReel() {
  const center = randomSymbol()
  return {
    strip: [randomSymbol(), center, randomSymbol()],
    offset: 0,
    duration: 0,
    final: center,
  }
}

function SlotsPage() {
  const [bet, setBet] = useState(25)
  const [reels, setReels] = useState(() => Array.from({ length: REEL_COUNT }, () => createInitialReel()))
  const [spinSequence, setSpinSequence] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [isLeverPulled, setIsLeverPulled] = useState(false)
  const [result, setResult] = useState('Place your bet and spin the reels.')
  const { balance, placeBet, payout } = useBankroll()
  const audioContextRef = useRef(null)
  const timerRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const tickStopTimeoutRef = useRef(null)
  const reelLockTimeoutsRef = useRef([])
  const leverTimeoutRef = useRef(null)
  const leverButtonRef = useRef(null)

  const canSpin = useMemo(() => bet > 0 && bet <= balance && !isSpinning, [bet, balance, isSpinning])

  const normalizedBet = useMemo(() => {
    const parsed = Number(bet)

    if (!Number.isFinite(parsed)) {
      return 0
    }

    return Math.max(0, Math.round(parsed * 100) / 100)
  }, [bet])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
      }

      if (tickStopTimeoutRef.current) {
        clearTimeout(tickStopTimeoutRef.current)
      }

      reelLockTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      reelLockTimeoutsRef.current = []

      if (leverTimeoutRef.current) {
        clearTimeout(leverTimeoutRef.current)
      }
    }
  }, [])

  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext

      if (!AudioContextCtor) {
        return null
      }

      audioContextRef.current = new AudioContextCtor()
    }

    return audioContextRef.current
  }

  const playTone = ({ frequency, toFrequency, durationMs, type, gain }) => {
    const context = ensureAudioContext()

    if (!context) {
      return
    }

    const now = context.currentTime
    const oscillator = context.createOscillator()
    const envelope = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)

    if (toFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, toFrequency),
        now + durationMs / 1000,
      )
    }

    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)

    oscillator.connect(envelope)
    envelope.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + durationMs / 1000)
  }

  const playToneAt = ({ frequency, toFrequency, durationMs, type, gain, delayMs }) => {
    const context = ensureAudioContext()

    if (!context) {
      return
    }

    const startAt = context.currentTime + delayMs / 1000
    const oscillator = context.createOscillator()
    const envelope = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startAt)

    if (toFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, toFrequency),
        startAt + durationMs / 1000,
      )
    }

    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(gain, startAt + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000)

    oscillator.connect(envelope)
    envelope.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + durationMs / 1000)
  }

  const playLeverSound = () => {
    playTone({
      frequency: 230,
      toFrequency: 95,
      durationMs: 170,
      type: 'sawtooth',
      gain: 0.08,
    })
  }

  const playTickSound = () => {
    playTone({
      frequency: 980,
      toFrequency: 560,
      durationMs: 55,
      type: 'square',
      gain: 0.04,
    })
  }

  const startSpinSound = (totalDurationMs) => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current)
    }

    if (tickStopTimeoutRef.current) {
      clearTimeout(tickStopTimeoutRef.current)
    }

    tickIntervalRef.current = setInterval(() => {
      playTickSound()
    }, 105)

    tickStopTimeoutRef.current = setTimeout(() => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
    }, totalDurationMs + 120)
  }

  const playPairWinSound = () => {
    playToneAt({ frequency: 520, toFrequency: 700, durationMs: 120, type: 'square', gain: 0.08, delayMs: 0 })
    playToneAt({ frequency: 700, toFrequency: 880, durationMs: 130, type: 'square', gain: 0.09, delayMs: 135 })
    playToneAt({ frequency: 880, toFrequency: 1040, durationMs: 160, type: 'triangle', gain: 0.08, delayMs: 290 })
  }

  const playJackpotSound = () => {
    playToneAt({ frequency: 520, toFrequency: 660, durationMs: 140, type: 'triangle', gain: 0.1, delayMs: 0 })
    playToneAt({ frequency: 660, toFrequency: 880, durationMs: 170, type: 'triangle', gain: 0.1, delayMs: 130 })
    playToneAt({ frequency: 880, toFrequency: 1180, durationMs: 230, type: 'sine', gain: 0.11, delayMs: 290 })
    playToneAt({ frequency: 1180, toFrequency: 1420, durationMs: 300, type: 'sine', gain: 0.12, delayMs: 470 })
  }

  const playReelLockSound = () => {
    playTone({
      frequency: 205,
      toFrequency: 120,
      durationMs: 85,
      type: 'square',
      gain: 0.075,
    })
  }

  const spin = () => {
    if (!Number.isFinite(normalizedBet) || normalizedBet <= 0) {
      setResult('Choose a valid bet greater than 0.')
      return
    }

    if (normalizedBet > balance) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    placeBet(normalizedBet)

    setIsSpinning(true)
    setIsLeverPulled(true)
    setResult('Reels are spinning...')

    playLeverSound()

    const outcomes = Array.from({ length: REEL_COUNT }, () => randomSymbol())
    const reelDurations = REEL_DURATIONS_MS
    const reelSetup = outcomes.map((symbol, index) => ({
      strip: createStrip(symbol, 19 + index * 4),
      offset: 0,
      duration: 0,
      final: symbol,
    }))

    setReels(reelSetup)
    setSpinSequence((value) => value + 1)

    reelLockTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
    reelLockTimeoutsRef.current = reelDurations.map((durationMs) =>
      setTimeout(() => {
        playReelLockSound()
      }, durationMs),
    )

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReels(
          reelSetup.map((reel, index) => ({
            ...reel,
            offset: (reel.strip.length - 3) * ROW_HEIGHT,
            duration: reelDurations[index],
          })),
        )
      })
    })

    const totalDuration = reelDurations[reelDurations.length - 1]
    startSpinSound(totalDuration)

    if (leverTimeoutRef.current) {
      clearTimeout(leverTimeoutRef.current)
    }

    leverTimeoutRef.current = setTimeout(() => {
      setIsLeverPulled(false)
    }, totalDuration + 110)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      reelLockTimeoutsRef.current = []

      const streak = getLeadingStreak(outcomes)
      const topCount = streak.count
      const matchedSymbol = streak.symbol

      setIsSpinning(false)

      if (topCount >= 3 && matchedSymbol) {
        const multiplier = PAYOUTS[matchedSymbol.id]?.[topCount] || 0

        const earnings = normalizedBet * multiplier
        payout(earnings)
        if (topCount === 5) {
          playJackpotSound()
          setResult(`Jackpot! Left-to-right ${matchedSymbol.label} x5 won $${earnings.toFixed(2)}.`)
        } else {
          playPairWinSound()
          setResult(`Left-to-right ${matchedSymbol.label} x${topCount} won $${earnings.toFixed(2)}.`)
        }
        return
      }

      setResult('No line win this spin. Try again.')
    }, totalDuration + 110)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space') {
        return
      }

      const activeTag = document.activeElement?.tagName
      const isTypingField = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT'

      if (isTypingField) {
        return
      }

      event.preventDefault()

      if (canSpin) {
        leverButtonRef.current?.click()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [canSpin])

  return (
    <main className="game-page">
      <header className="game-topbar">
        <Link className="back-link" to="/">
          Back To Lobby
        </Link>
        <p className="bankroll">Bankroll: ${balance.toFixed(2)}</p>
      </header>

      <section className="game-card">
        <h1>Slots</h1>
        <p className="game-subtitle">5-reel MVP machine with quick payouts.</p>
        <p className="result-banner slots-result-banner">{result}</p>

        <div className="slots-stage" aria-live="polite">
          <div className="slots-machine">
            <div className="slots-payline" aria-hidden="true" />
            <div className="slots-reels">
              {reels.map((reel, index) => (
                <div key={`${spinSequence}-${index}`} className="reel-window">
                  <div
                    className="reel-strip"
                    style={{
                      transform: `translateY(-${reel.offset}px)`,
                      transitionDuration: `${reel.duration}ms`,
                    }}
                  >
                    {reel.strip.map((symbol, symbolIndex) => (
                      <div className="reel-symbol-row" key={`${symbol.id}-${symbolIndex}-${index}`}>
                        <span className="symbol-icon" aria-hidden="true">
                          {symbol.icon}
                        </span>
                        <span className="symbol-label">{symbol.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="slots-frame-glow" aria-hidden="true" />
          </div>

          <button
            ref={leverButtonRef}
            className={`lever-button slots-side-lever ${isLeverPulled ? 'pulled' : ''}`}
            type="button"
            disabled={!canSpin}
            onClick={spin}
            aria-label="Pull slot lever"
          >
            <span className="lever-shaft" aria-hidden="true" />
            <span className="lever-knob" aria-hidden="true" />
            <span className="lever-label">Pull</span>
          </button>
        </div>

        <div className="slots-payouts">
          <div className="payout-pill">
            <strong>5 Match</strong>
            <span>8x-22x</span>
          </div>
          <div className="payout-pill">
            <strong>4 Match</strong>
            <span>3.5x-10x</span>
          </div>
          <div className="payout-pill">
            <strong>3 Match</strong>
            <span>1.6x-5x</span>
          </div>
          <div className="payout-pill">
            <strong>Rule</strong>
            <span>Left to right</span>
          </div>
          <div className="payout-pill">
            <strong>Miss</strong>
            <span>0x</span>
          </div>
        </div>

        <div className="control-row slots-controls slots-bottom-controls">
          <label htmlFor="slots-bet">Bet</label>
          <input
            id="slots-bet"
            className="slots-bet-input"
            type="number"
            min="1"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value) || 0)}
            disabled={isSpinning}
          />
        </div>
      </section>
    </main>
  )
}

export default SlotsPage
