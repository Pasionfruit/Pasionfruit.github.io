import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
])

const CHIP_VALUES = [1, 5, 25, 100]

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26,
]

const EVEN_MONEY_BETS = [
  { type: 'red', label: 'Red', multiplier: 2 },
  { type: 'black', label: 'Black', multiplier: 2 },
  { type: 'odd', label: 'Odd', multiplier: 2 },
  { type: 'even', label: 'Even', multiplier: 2 },
  { type: 'low', label: '1-18', multiplier: 2 },
  { type: 'high', label: '19-36', multiplier: 2 },
]

const DOZEN_BETS = [
  { type: 'dozen1', label: '1st 12', multiplier: 3 },
  { type: 'dozen2', label: '2nd 12', multiplier: 3 },
  { type: 'dozen3', label: '3rd 12', multiplier: 3 },
]

const COLUMN_BETS = [
  { type: 'col3', label: '2 to 1', multiplier: 3 },
  { type: 'col2', label: '2 to 1', multiplier: 3 },
  { type: 'col1', label: '2 to 1', multiplier: 3 },
]

const OUTSIDE_BETS = [...EVEN_MONEY_BETS, ...DOZEN_BETS, ...COLUMN_BETS]

const NUMBER_ROWS = [
  Array.from({ length: 12 }, (_, index) => index * 3 + 3),
  Array.from({ length: 12 }, (_, index) => index * 3 + 2),
  Array.from({ length: 12 }, (_, index) => index * 3 + 1),
]

function getColor(number) {
  if (number === 0) {
    return 'green'
  }

  return RED_NUMBERS.has(number) ? 'red' : 'black'
}

function getOutsideMultiplier(type) {
  return OUTSIDE_BETS.find((outside) => outside.type === type)?.multiplier ?? 2
}

function getBetKey(bet) {
  if (bet.type === 'number') {
    return `number-${bet.value}`
  }

  if (bet.type === 'split' || bet.type === 'corner') {
    return `${bet.type}-${[...bet.numbers].sort((a, b) => a - b).join('-')}`
  }

  return `outside-${bet.type}`
}

function isOutsideWin(type, landed, color) {
  if (type === 'red') {
    return landed !== 0 && color === 'red'
  }

  if (type === 'black') {
    return landed !== 0 && color === 'black'
  }

  if (type === 'odd') {
    return landed !== 0 && landed % 2 === 1
  }

  if (type === 'even') {
    return landed !== 0 && landed % 2 === 0
  }

  if (type === 'low') {
    return landed >= 1 && landed <= 18
  }

  if (type === 'high') {
    return landed >= 19 && landed <= 36
  }

  if (type === 'dozen1') {
    return landed >= 1 && landed <= 12
  }

  if (type === 'dozen2') {
    return landed >= 13 && landed <= 24
  }

  if (type === 'dozen3') {
    return landed >= 25 && landed <= 36
  }

  if (type === 'col1') {
    return landed !== 0 && landed % 3 === 1
  }

  if (type === 'col2') {
    return landed !== 0 && landed % 3 === 2
  }

  return landed !== 0 && landed % 3 === 0
}

function isBetWin(bet, landed, color) {
  if (bet.type === 'number') {
    return landed === bet.value
  }

  if (bet.type === 'split' || bet.type === 'corner') {
    return bet.numbers.includes(landed)
  }

  return isOutsideWin(bet.type, landed, color)
}

function formatChipLabel(amount) {
  if (amount >= 1000) {
    const compact = amount / 1000
    return `${Number.isInteger(compact) ? compact : compact.toFixed(1)}k`
  }

  return `${amount}`
}

function getBetMultiplier(bet) {
  if (bet.type === 'number') {
    return 36
  }

  if (bet.type === 'split') {
    return 18
  }

  if (bet.type === 'corner') {
    return 9
  }

  return getOutsideMultiplier(bet.type)
}

function createSplitBet(first, second) {
  return {
    type: 'split',
    numbers: [first, second].sort((a, b) => a - b),
  }
}

function createCornerBet(a, b, c, d) {
  return {
    type: 'corner',
    numbers: [a, b, c, d].sort((x, y) => x - y),
  }
}

function RoulettePage() {
  const [activeChip, setActiveChip] = useState(25)
  const [chipBets, setChipBets] = useState({})
  const [result, setResult] = useState('Choose a chip, then place it directly on the table.')
  const [lastSpin, setLastSpin] = useState(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [isBallSpinning, setIsBallSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [ballAngle, setBallAngle] = useState(0)
  const [ballDropped, setBallDropped] = useState(false)
  const { balance, placeBet, payout } = useBankroll()
  const spinTimerRef = useRef(null)
  const landingTimerRef = useRef(null)
  const audioContextRef = useRef(null)
  const spinSoundIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current)
      }

      if (landingTimerRef.current) {
        clearTimeout(landingTimerRef.current)
      }

      if (spinSoundIntervalRef.current) {
        clearInterval(spinSoundIntervalRef.current)
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

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  const playTone = ({ frequency, toFrequency, durationMs, type = 'sine', gain = 0.04 }) => {
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
        Math.max(35, toFrequency),
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

  const stopSpinSound = () => {
    if (spinSoundIntervalRef.current) {
      clearInterval(spinSoundIntervalRef.current)
      spinSoundIntervalRef.current = null
    }
  }

  const startSpinSound = () => {
    stopSpinSound()

    spinSoundIntervalRef.current = setInterval(() => {
      playTone({
        frequency: 940 + Math.random() * 130,
        toFrequency: 590,
        durationMs: 65,
        type: 'square',
        gain: 0.03,
      })
    }, 92)
  }

  const playBallDropSound = () => {
    playTone({ frequency: 270, toFrequency: 90, durationMs: 170, type: 'triangle', gain: 0.065 })
  }

  const totalStake = useMemo(
    () => Object.values(chipBets).reduce((sum, item) => sum + item.amount, 0),
    [chipBets],
  )

  const canSpin = useMemo(() => !isSpinning && totalStake > 0, [isSpinning, totalStake])

  const placeChipOnBet = (bet) => {
    if (isSpinning) {
      return
    }

    if (totalStake + activeChip > balance) {
      setResult('Not enough bankroll for that chip. Lower stake or clear bets.')
      return
    }

    const key = getBetKey(bet)

    setChipBets((previous) => {
      const existing = previous[key]

      if (!existing) {
        return {
          ...previous,
          [key]: { ...bet, amount: activeChip },
        }
      }

      return {
        ...previous,
        [key]: {
          ...existing,
          amount: existing.amount + activeChip,
        },
      }
    })
  }

  const clearBets = () => {
    if (isSpinning) {
      return
    }

    setChipBets({})
    setResult('All chips cleared. Place new bets.')
  }

  const spin = () => {
    if (!canSpin) {
      return
    }

    if (!placeBet(totalStake)) {
      setResult('Unable to place bets. Check bankroll and try again.')
      return
    }

    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current)
    }

    if (landingTimerRef.current) {
      clearTimeout(landingTimerRef.current)
    }

    const betsForRound = Object.values(chipBets)

    setIsSpinning(true)
    setIsBallSpinning(true)
    setBallDropped(false)
    setResult('No more bets. Ball is spinning...')
    startSpinSound()

    const landed = Math.floor(Math.random() * 37)
    const color = getColor(landed)
    const landedIndex = WHEEL_ORDER.indexOf(landed)
    const landedAngle = (360 / WHEEL_ORDER.length) * landedIndex
    const nextWheelRotation = wheelRotation + 1620 + Math.floor(Math.random() * 540)
    const finalBallAngle = (nextWheelRotation + landedAngle) % 360

    setWheelRotation(nextWheelRotation)

    spinTimerRef.current = setTimeout(() => {
      stopSpinSound()
      setIsBallSpinning(false)
      setBallAngle(finalBallAngle)
      setResult('Ball is dropping into the pocket...')

      landingTimerRef.current = setTimeout(() => {
        playBallDropSound()
        setBallDropped(true)
        setLastSpin({ landed, color })

        let totalPayout = 0
        let winningBets = 0

        for (const bet of betsForRound) {
          if (isBetWin(bet, landed, color)) {
            const multiplier = getBetMultiplier(bet)
            totalPayout += bet.amount * multiplier
            winningBets += 1
          }
        }

        if (totalPayout > 0) {
          payout(totalPayout)
          const profit = totalPayout - totalStake
          setResult(
            `Ball stopped on ${landed} (${color.toUpperCase()}). ${winningBets} bet(s) hit. Net ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}.`,
          )
        } else {
          setResult(`Ball stopped on ${landed} (${color.toUpperCase()}). All chips lost.`)
        }

        setChipBets({})
        setIsSpinning(false)
      }, 560)
    }, 3200)
  }

  const getChipAmount = (bet) => {
    const key = getBetKey(bet)
    return chipBets[key]?.amount ?? 0
  }

  return (
    <main className="game-page roulette-page">
      <header className="game-topbar">
        <Link className="back-link" to="/">
          Back To Lobby
        </Link>
        <p className="bankroll">Bankroll: ${balance.toFixed(2)}</p>
      </header>

      <section className="game-card">
        <h1>Roulette</h1>
        <p className="game-subtitle">Select a chip and place it directly on table spots.</p>

        <div className="roulette-chip-rack" aria-label="Chip rack">
          {CHIP_VALUES.map((value) => (
            <button
              key={value}
              className={`chip-button ${activeChip === value ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveChip(value)}
              disabled={isSpinning}
            >
              ${value}
            </button>
          ))}

          <button
            type="button"
            className="roulette-rack-btn roulette-clear-btn"
            onClick={clearBets}
            disabled={isSpinning || totalStake === 0}
          >
            Clear Bets
          </button>

          <button type="button" className="roulette-rack-btn roulette-spin-btn" disabled={!canSpin} onClick={spin}>
            Spin (${totalStake.toFixed(2)})
          </button>
        </div>

        <p className="roulette-selection">Active chip: ${activeChip} | Total on table: ${totalStake.toFixed(2)}</p>

        <div className="roulette-layout">
          <section className="roulette-table" aria-label="Roulette betting table">
            <div className="roulette-main-grid">
              <button
                className="roulette-cell roulette-zero"
                type="button"
                onClick={() => placeChipOnBet({ type: 'number', value: 0 })}
                disabled={isSpinning}
              >
                0
                {getChipAmount({ type: 'number', value: 0 }) > 0 ? (
                  <span className="roulette-chip">{formatChipLabel(getChipAmount({ type: 'number', value: 0 }))}</span>
                ) : null}
              </button>

              <div className="roulette-number-grid">
                {NUMBER_ROWS.flatMap((row, rowIndex) =>
                  row.map((number, colIndex) => {
                    const colorName = getColor(number)
                    const chipAmount = getChipAmount({ type: 'number', value: number })
                    const rightNumber = colIndex < row.length - 1 ? row[colIndex + 1] : null
                    const belowNumber = rowIndex < NUMBER_ROWS.length - 1 ? NUMBER_ROWS[rowIndex + 1][colIndex] : null
                    const belowRightNumber =
                      rowIndex < NUMBER_ROWS.length - 1 && colIndex < row.length - 1
                        ? NUMBER_ROWS[rowIndex + 1][colIndex + 1]
                        : null

                    const rightSplit = rightNumber !== null ? createSplitBet(number, rightNumber) : null
                    const downSplit = belowNumber !== null ? createSplitBet(number, belowNumber) : null
                    const cornerBet =
                      belowNumber !== null && belowRightNumber !== null && rightNumber !== null
                        ? createCornerBet(number, rightNumber, belowNumber, belowRightNumber)
                        : null

                    const rightSplitAmount = rightSplit ? getChipAmount(rightSplit) : 0
                    const downSplitAmount = downSplit ? getChipAmount(downSplit) : 0
                    const cornerAmount = cornerBet ? getChipAmount(cornerBet) : 0

                    return (
                      <button
                        key={number}
                        className={`roulette-cell ${colorName}`}
                        type="button"
                        onClick={() => placeChipOnBet({ type: 'number', value: number })}
                        disabled={isSpinning}
                      >
                        {number}
                        {chipAmount > 0 ? <span className="roulette-chip">{formatChipLabel(chipAmount)}</span> : null}

                        {rightSplit ? (
                          <span
                            className={`roulette-marker split-right ${rightSplitAmount > 0 ? 'has-amount' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              placeChipOnBet(rightSplit)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                placeChipOnBet(rightSplit)
                              }
                            }}
                          >
                            {rightSplitAmount > 0 ? formatChipLabel(rightSplitAmount) : ''}
                          </span>
                        ) : null}

                        {downSplit ? (
                          <span
                            className={`roulette-marker split-down ${downSplitAmount > 0 ? 'has-amount' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              placeChipOnBet(downSplit)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                placeChipOnBet(downSplit)
                              }
                            }}
                          >
                            {downSplitAmount > 0 ? formatChipLabel(downSplitAmount) : ''}
                          </span>
                        ) : null}

                        {cornerBet ? (
                          <span
                            className={`roulette-marker corner ${cornerAmount > 0 ? 'has-amount' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              placeChipOnBet(cornerBet)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                placeChipOnBet(cornerBet)
                              }
                            }}
                          >
                            {cornerAmount > 0 ? formatChipLabel(cornerAmount) : ''}
                          </span>
                        ) : null}
                      </button>
                    )
                  }),
                )}
              </div>

              <div className="roulette-column-bets">
                {COLUMN_BETS.map((columnBet) => {
                  const chipAmount = getChipAmount({ type: columnBet.type })

                  return (
                    <button
                      key={columnBet.type}
                      className="roulette-cell outside roulette-column-bet"
                      type="button"
                      onClick={() => placeChipOnBet({ type: columnBet.type })}
                      disabled={isSpinning}
                    >
                      {columnBet.label}
                      {chipAmount > 0 ? <span className="roulette-chip">{formatChipLabel(chipAmount)}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="roulette-dozens-row">
              {DOZEN_BETS.map((dozenBet) => {
                const chipAmount = getChipAmount({ type: dozenBet.type })

                return (
                  <button
                    key={dozenBet.type}
                    className="roulette-cell outside roulette-dozen-bet"
                    type="button"
                    onClick={() => placeChipOnBet({ type: dozenBet.type })}
                    disabled={isSpinning}
                  >
                    {dozenBet.label}
                    {chipAmount > 0 ? <span className="roulette-chip">{formatChipLabel(chipAmount)}</span> : null}
                  </button>
                )
              })}
            </div>

            <div className="roulette-outside-grid">
              {EVEN_MONEY_BETS.map((outside) => {
                const chipAmount = getChipAmount({ type: outside.type })

                return (
                  <button
                    key={outside.type}
                    className="roulette-cell outside"
                    type="button"
                    onClick={() => placeChipOnBet({ type: outside.type })}
                    disabled={isSpinning}
                  >
                    {outside.label}
                    {chipAmount > 0 ? <span className="roulette-chip">{formatChipLabel(chipAmount)}</span> : null}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="roulette-wheel-panel" aria-label="Roulette wheel animation">
            <div className="wheel-shell">
              <div className="wheel-pointer" aria-hidden="true" />
              <div
                className="roulette-wheel"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                {WHEEL_ORDER.map((number, index) => {
                  const segmentAngle = (360 / WHEEL_ORDER.length) * index

                  return (
                    <span
                      key={number}
                      className={`wheel-segment ${getColor(number)}`}
                      style={{ '--segment-angle': `${segmentAngle}deg` }}
                    >
                      {number}
                    </span>
                  )
                })}
              </div>

              <div
                className={`wheel-ball-orbit ${isBallSpinning ? 'spinning' : ''}`}
                style={isBallSpinning ? undefined : { transform: `translate(-50%, -50%) rotate(${ballAngle}deg)` }}
              >
                <div className={`wheel-ball ${ballDropped ? 'dropped' : ''}`} />
              </div>
            </div>

            <p className="wheel-readout">
              {lastSpin ? `Last drop: ${lastSpin.landed} (${lastSpin.color.toUpperCase()})` : 'Waiting for drop...'}
            </p>
          </section>
        </div>

        <p className="result-banner">{result}</p>
      </section>
    </main>
  )
}

export default RoulettePage
