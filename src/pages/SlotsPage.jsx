import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'
import { playCustomFx, stopCustomFx } from '../lib/soundFx'

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
  cherry: { 3: 0.8, 4: 1.5, 5: 3.5 },
  bell: { 3: 1.0, 4: 2.0, 5: 5.0 },
  clover: { 3: 0.9, 4: 1.8, 5: 4.5 },
  diamond: { 3: 1.5, 4: 3.0, 5: 7.0 },
  seven: { 3: 2.5, 4: 5.0, 5: 11.0 },
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

function getBestSymbolMatch(outcomes) {
  const countsBySymbol = outcomes.reduce((acc, symbol) => {
    acc[symbol.id] = (acc[symbol.id] || 0) + 1
    return acc
  }, {})

  return SYMBOLS.reduce((best, symbol) => {
    const count = countsBySymbol[symbol.id] || 0

    if (!best || count > best.count) {
      return { symbol, count }
    }

    return best
  }, null)
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
  const timerRef = useRef(null)
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

      reelLockTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      reelLockTimeoutsRef.current = []

      if (leverTimeoutRef.current) {
        clearTimeout(leverTimeoutRef.current)
      }

      stopCustomFx('slotSpin')
    }
  }, [])



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

    playCustomFx('slotSpin', { loop: true, volume: 0.55 })

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
    reelLockTimeoutsRef.current = reelDurations.map((durationMs, index) =>
      setTimeout(() => {
        const revealed = outcomes.slice(0, index + 1)
        const revealedBest = getBestSymbolMatch(revealed)
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
      stopCustomFx('slotSpin')

      const bestMatch = getBestSymbolMatch(outcomes)
      const topCount = bestMatch?.count || 0
      const matchedSymbol = bestMatch?.symbol

      setIsSpinning(false)

      if (topCount >= 3 && matchedSymbol) {
        const multiplier = PAYOUTS[matchedSymbol.id]?.[topCount] || 0

        const earnings = normalizedBet * multiplier
        payout(earnings)
        playCustomFx('win', { volume: 0.8 })
        if (topCount === 5) {
          playCustomFx('jackpot', { volume: 0.9 })
        }
        setResult(`${matchedSymbol.label} x${topCount} won $${earnings.toFixed(2)}.`)
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
            <span>Any 3+</span>
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
