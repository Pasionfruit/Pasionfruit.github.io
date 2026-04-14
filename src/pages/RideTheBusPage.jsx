import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'
import { playCustomFx } from '../lib/soundFx'

const SUITS = [
  { id: 'spades', symbol: '♠', color: 'black' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'black' },
  { id: 'diamonds', symbol: '♦', color: 'red' },
]

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_VALUE = {
  A: 14,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
}

const PHASE_RED_BLACK = 'red-black'
const PHASE_ABOVE_EQUAL_BELOW = 'above-equal-below'
const PHASE_IN_OUT = 'in-out'
const PHASE_SUIT = 'suit'
const PHASE_WON = 'won'
const PHASE_LOST = 'lost'
const WIN_MULTIPLIER = 10

const PIP_LAYOUTS = {
  A: ['center'],
  2: ['top-center', 'bottom-center'],
  3: ['top-center', 'center', 'bottom-center'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
  7: ['top-left', 'top-right', 'mid-left', 'mid-right', 'center', 'bottom-left', 'bottom-right'],
  8: ['top-left', 'top-center', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  9: ['top-left', 'top-center', 'top-right', 'mid-left', 'center', 'mid-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  10: ['top-left', 'top-center', 'top-right', 'mid-left', 'inner-left', 'inner-right', 'mid-right', 'bottom-left', 'bottom-center', 'bottom-right'],
}

let cardIdCounter = 0

function normalizeBet(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.round(parsed * 100) / 100)
}

function drawCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)]
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]

  cardIdCounter += 1

  return {
    id: cardIdCounter,
    rank,
    suit,
    value: RANK_VALUE[rank],
  }
}

function getCardCenter(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) {
    return (
      <div className="card-face-figure" aria-hidden="true">
        <span className="figure-rank">{card.rank}</span>
        <span className="figure-suit">{card.suit.symbol}</span>
      </div>
    )
  }

  const positions = PIP_LAYOUTS[card.rank] || ['center']

  return (
    <div className="card-pips" aria-hidden="true">
      {positions.map((position, index) => (
        <span key={`${card.id}-${position}-${index}`} className={`pip ${position}`}>
          {card.suit.symbol}
        </span>
      ))}
    </div>
  )
}

function renderCard(card) {
  return (
    <div className={`playing-card ${card.suit.color}`} aria-label={`${card.rank} of ${card.suit.id}`}>
      <span className="corner top">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit.symbol}</span>
      </span>
      {getCardCenter(card)}
      <span className="corner bottom">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit.symbol}</span>
      </span>
    </div>
  )
}

function getPromptForPhase(phase, cards) {
  if (phase === PHASE_RED_BLACK) {
    return 'Round 1: Pick whether the first card is red or black.'
  }

  if (phase === PHASE_ABOVE_EQUAL_BELOW) {
    return `Round 2: Card one is ${cards[0]?.rank}. Guess above, equal, or below.`
  }

  if (phase === PHASE_IN_OUT) {
    return `Round 3: Use ${cards[0]?.rank} and ${cards[1]?.rank}. Guess whether the next card is in or out.`
  }

  if (phase === PHASE_SUIT) {
    return 'Final round: Guess the exact suit of the last card.'
  }

  return ''
}

function RideTheBusPage() {
  const [bet, setBet] = useState(0)
  const [phase, setPhase] = useState(PHASE_RED_BLACK)
  const [cards, setCards] = useState([])
  const [result, setResult] = useState('Pick red or black to start the bus ride.')
  const { balance, placeBet, payout } = useBankroll()

  const normalizedBet = useMemo(() => normalizeBet(bet), [bet])
  const isRoundActive = ![PHASE_WON, PHASE_LOST].includes(phase)
  const canStart = normalizedBet >= 0 && normalizedBet <= balance

  const resetRide = () => {
    setBet(0)
    setPhase(PHASE_RED_BLACK)
    setCards([])
    setResult('Pick red or black to start the bus ride.')
  }

  const loseRide = (message, nextCards) => {
    setCards(nextCards)
    setPhase(PHASE_LOST)
    setResult(message)
  }

  const winRide = (finalCards) => {
    const winnings = normalizedBet * WIN_MULTIPLIER
    if (winnings > 0) {
      payout(winnings)
      playCustomFx('win', { volume: 0.8 })
    }
    setCards(finalCards)
    setPhase(PHASE_WON)
    if (winnings > 0) {
      setResult(`Bus cleared! You won $${winnings.toFixed(2)} on a ${WIN_MULTIPLIER}x payout.`)
      return
    }

    setResult('Bus cleared! Perfect run with no ante placed.')
  }

  const handleRedBlack = (guess) => {
    if (!canStart) {
      setResult('Set an optional ante within your bankroll before starting.')
      return
    }

    if (normalizedBet > 0 && !placeBet(normalizedBet)) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    const firstCard = drawCard()
    const isCorrect = firstCard.suit.color === guess

    if (!isCorrect) {
      loseRide(`Round 1 missed. The card was ${firstCard.rank}${firstCard.suit.symbol}.`, [firstCard])
      return
    }

    setCards([firstCard])
    setPhase(PHASE_ABOVE_EQUAL_BELOW)
    setResult(`Safe start. ${firstCard.rank}${firstCard.suit.symbol} was ${guess}.`)
  }

  const handleAboveEqualBelow = (guess) => {
    const previous = cards[0]
    if (!previous) return

    const nextCard = drawCard()
    const isAbove = nextCard.value > previous.value
    const isEqual = nextCard.value === previous.value
    const isBelow = nextCard.value < previous.value
    const isCorrect = (guess === 'above' && isAbove) || (guess === 'equal' && isEqual) || (guess === 'below' && isBelow)
    const nextCards = [...cards, nextCard]

    if (!isCorrect) {
      loseRide(`Round 2 missed. ${nextCard.rank}${nextCard.suit.symbol} was not ${guess}.`, nextCards)
      return
    }

    setCards(nextCards)
    setPhase(PHASE_IN_OUT)
    setResult(`Round 2 clear. ${nextCard.rank}${nextCard.suit.symbol} was ${guess}.`)
  }

  const handleInOut = (guess) => {
    const first = cards[0]
    const second = cards[1]
    if (!first || !second) return

    const nextCard = drawCard()
    const low = Math.min(first.value, second.value)
    const high = Math.max(first.value, second.value)
    const isIn = nextCard.value >= low && nextCard.value <= high
    const isCorrect = (guess === 'in' && isIn) || (guess === 'out' && !isIn)
    const nextCards = [...cards, nextCard]

    if (!isCorrect) {
      loseRide(`Round 3 missed. ${nextCard.rank}${nextCard.suit.symbol} was ${isIn ? 'in' : 'out'}.`, nextCards)
      return
    }

    setCards(nextCards)
    setPhase(PHASE_SUIT)
    setResult(`Round 3 clear. ${nextCard.rank}${nextCard.suit.symbol} was ${guess}.`)
  }

  const handleSuit = (guess) => {
    playCustomFx('finalCard', { volume: 0.85 })

    const nextCard = drawCard()
    const nextCards = [...cards, nextCard]

    if (nextCard.suit.id !== guess) {
      loseRide(`Final round missed. The suit was ${nextCard.suit.symbol}.`, nextCards)
      return
    }

    winRide(nextCards)
  }

  const choiceButtons = (() => {
    if (phase === PHASE_RED_BLACK) {
      return [
        { id: 'red', label: 'Red', onClick: () => handleRedBlack('red') },
        { id: 'black', label: 'Black', onClick: () => handleRedBlack('black') },
      ]
    }

    if (phase === PHASE_ABOVE_EQUAL_BELOW) {
      return [
        { id: 'above', label: 'Above', onClick: () => handleAboveEqualBelow('above') },
        { id: 'equal', label: 'Equal', onClick: () => handleAboveEqualBelow('equal') },
        { id: 'below', label: 'Below', onClick: () => handleAboveEqualBelow('below') },
      ]
    }

    if (phase === PHASE_IN_OUT) {
      return [
        { id: 'in', label: 'In', onClick: () => handleInOut('in') },
        { id: 'out', label: 'Out', onClick: () => handleInOut('out') },
      ]
    }

    if (phase === PHASE_SUIT) {
      return SUITS.map((suit) => ({
        id: suit.id,
        label: `${suit.symbol} ${suit.id[0].toUpperCase()}${suit.id.slice(1)}`,
        onClick: () => handleSuit(suit.id),
      }))
    }

    return []
  })()

  return (
    <main className="game-page ride-bus-page">
      <header className="game-topbar">
        <Link className="back-link" to="/">
          Back To Lobby
        </Link>
        <p className="bankroll">Bankroll: ${balance.toFixed(2)}</p>
      </header>

      <section className="game-card">
        <h1>Ride The Bus</h1>
        <p className="game-subtitle">Four card guesses in a row: color, height, range, then exact suit.</p>
        <p className="result-banner">{result}</p>

        <section className="ride-bus-board blackjack-table">
          <div className="ride-bus-info">
            <p className="ride-bus-round">{getPromptForPhase(phase, cards) || 'Round over. Start a new ride.'}</p>
            <p className="ride-bus-note">Ace is high. “In” is inclusive of the two prior cards.</p>
          </div>

          <div className="ride-bus-card-row cards-row" aria-live="polite">
            {cards.length ? cards.map((card) => (
              <div key={card.id} className="card-host">
                {renderCard(card)}
              </div>
            )) : <p className="cards-empty">No cards revealed yet.</p>}
          </div>

          <div
            className={`ride-bus-choice-grid ${
              choiceButtons.length === 3
                ? 'three-options'
                : choiceButtons.length === 4
                  ? 'four-options'
                  : ''
            }`}
          >
            {choiceButtons.map((choice) => (
              <button key={choice.id} type="button" onClick={choice.onClick}>
                {choice.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ride-bus-controls">
          <div className="ride-bus-ante-row">
            <label htmlFor="ride-bus-bet">Ante</label>
            <input
              id="ride-bus-bet"
              type="number"
              min="0"
              value={bet}
              disabled={cards.length > 0 && isRoundActive}
              onChange={(event) => setBet(Number(event.target.value) || 0)}
            />
            <div className="ride-bus-payout">Optional ante. Clear all 4 rounds: {WIN_MULTIPLIER}x your bet.</div>
          </div>

          {!isRoundActive ? (
            <button type="button" className="ride-bus-reset" onClick={resetRide}>
              Start New Ride
            </button>
          ) : null}
        </section>
      </section>
    </main>
  )
}

export default RideTheBusPage