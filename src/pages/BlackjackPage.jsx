import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = [
  { id: 'spades', symbol: '♠', color: 'black' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'black' },
  { id: 'diamonds', symbol: '♦', color: 'red' },
]
const BLACKJACK_PAYOUT = 2.5

let cardIdCounter = 0

function drawCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)]
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank)

  cardIdCounter += 1

  return {
    id: cardIdCounter,
    rank,
    value,
    suit,
  }
}

function handValue(hand) {
  let total = hand.reduce((sum, card) => sum + card.value, 0)
  let aces = hand.filter((card) => card.rank === 'A').length

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

function isNaturalBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21
}

function normalizeBet(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.round(parsed * 100) / 100)
}

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

function renderCardCenter(card) {
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

function renderCard(card, hidden = false, delayMs = 0) {
  if (hidden) {
    return (
      <div className="playing-card card-back dealt" style={{ animationDelay: `${delayMs}ms` }} aria-label="Hidden card" />
    )
  }

  return (
    <div
      className={`playing-card ${card.suit.color} dealt`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-label={`${card.rank} of ${card.suit.id}`}
    >
      <span className="corner top">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit.symbol}</span>
      </span>
      {renderCardCenter(card)}
      <span className="corner bottom">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit.symbol}</span>
      </span>
    </div>
  )
}

function createHand(cards, betAmount) {
  return {
    cards,
    bet: betAmount,
    status: 'playing',
  }
}

function BlackjackPage() {
  const [bet, setBet] = useState(25)
  const [dealer, setDealer] = useState([])
  const [playerHands, setPlayerHands] = useState([])
  const [activeHandIndex, setActiveHandIndex] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState('Place your bet to deal a hand.')
  const { balance, placeBet, payout } = useBankroll()
  const normalizedBet = useMemo(() => normalizeBet(bet), [bet])

  const canDeal = useMemo(
    () => phase === 'idle' && normalizedBet > 0 && normalizedBet <= balance,
    [phase, normalizedBet, balance],
  )

  const activeHand = playerHands[activeHandIndex]

  useEffect(() => {
    return () => {}
  }, [])



  const canSplit = useMemo(() => {
    if (phase !== 'player' || !activeHand || playerHands.length !== 1) {
      return false
    }

    if (activeHand.cards.length !== 2) {
      return false
    }

    if (activeHand.cards[0].value !== activeHand.cards[1].value) {
      return false
    }

    const normalizedHandBet = normalizeBet(activeHand.bet)
    return balance >= normalizedHandBet
  }, [phase, activeHand, playerHands.length, balance])

  const resetRound = () => {
    setPhase('idle')
    setActiveHandIndex(0)
  }

  const settleRound = (dealerCards, hands) => {
    const dealerTotal = handValue(dealerCards)
    let payoutTotal = 0
    let winCount = 0
    let pushCount = 0

    for (const hand of hands) {
      const playerTotal = handValue(hand.cards)

      if (hand.status === 'bust') {
        continue
      }

      if (dealerTotal > 21 || playerTotal > dealerTotal) {
        payoutTotal += hand.bet * 2
        winCount += 1
      } else if (playerTotal === dealerTotal) {
        payoutTotal += hand.bet
        pushCount += 1
      }
    }

    if (payoutTotal > 0) {
      payout(payoutTotal)
    }

    const summary = []

    if (winCount > 0) {
      summary.push(`${winCount} win`)
    }

    if (pushCount > 0) {
      summary.push(`${pushCount} push`)
    }

    if (winCount === 0 && pushCount === 0) {
      setResult('Dealer wins all hands.')
    } else {
      if (winCount > 0) {
        setResult(`Round complete: won $${payoutTotal.toFixed(2)} (${summary.join(', ')}).`)
      } else {
        setResult(`Round complete: push returned $${payoutTotal.toFixed(2)}.`)
      }
    }

    resetRound()
  }

  const finishDealer = (handsForSettlement) => {
    let nextDealer = [...dealer]

    while (handValue(nextDealer) < 17) {
      nextDealer = [...nextDealer, drawCard()]
    }

    setDealer(nextDealer)
    settleRound(nextDealer, handsForSettlement)
  }

  const moveToNextHandOrDealer = (updatedHands, fromIndex) => {
    const nextIndex = updatedHands.findIndex((hand, index) => index > fromIndex && hand.status === 'playing')

    if (nextIndex !== -1) {
      setActiveHandIndex(nextIndex)
      setResult(`Playing hand ${nextIndex + 1}.`)
      return
    }

    const allBusted = updatedHands.every((hand) => hand.status === 'bust')
    if (allBusted) {
      setResult('All hands busted. Round over.')
      resetRound()
      return
    }

    setPhase('dealer')
    finishDealer(updatedHands)
  }

  const deal = () => {
    if (!Number.isFinite(normalizedBet) || normalizedBet <= 0) {
      setResult('Choose a valid bet greater than 0.')
      return
    }

    if (normalizedBet > balance) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    if (!placeBet(normalizedBet)) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    const playerStart = [drawCard(), drawCard()]
    const dealerStart = [drawCard(), drawCard()]

    setDealer(dealerStart)
    setPlayerHands([createHand(playerStart, normalizedBet)])
    setActiveHandIndex(0)
    setPhase('player')

    const playerTotal = handValue(playerStart)
    const dealerTotal = handValue(dealerStart)
    const playerNatural = isNaturalBlackjack(playerStart)
    const dealerNatural = isNaturalBlackjack(dealerStart)

    if (playerNatural && dealerNatural) {
      payout(normalizedBet)
      setResult('Push. Both hands opened with blackjack.')
      resetRound()
      return
    }

    if (playerNatural) {
      const wonAmount = normalizedBet * BLACKJACK_PAYOUT
      payout(wonAmount)
      setResult(`Blackjack! You won $${wonAmount.toFixed(2)}.`)
      resetRound()
      return
    }

    if (dealerNatural) {
      setResult('Dealer blackjack. Hand lost.')
      resetRound()
      return
    }

    setPhase('player')
    setResult('Your move: hit, stand, or split.')
  }

  const splitHand = () => {
    if (!canSplit || !activeHand) {
      return
    }

    const normalizedHandBet = normalizeBet(activeHand.bet)
    if (!placeBet(normalizedHandBet)) {
      setResult('Split rejected. You need enough bankroll for the extra hand.')
      return
    }

    const [firstCard, secondCard] = activeHand.cards
    const firstHand = createHand([firstCard, drawCard()], normalizedHandBet)
    const secondHand = createHand([secondCard, drawCard()], normalizedHandBet)

    const nextHands = [firstHand, secondHand]

    setPlayerHands(nextHands)
    setActiveHandIndex(0)
    setResult('Hand split. Play Hand 1 first.')
  }

  const hit = () => {
    if (phase !== 'player' || !activeHand) {
      return
    }

    const updatedHands = playerHands.map((hand, index) => {
      if (index !== activeHandIndex) {
        return hand
      }

      const nextCards = [...hand.cards, drawCard()]
      const nextTotal = handValue(nextCards)
      const nextStatus = nextTotal > 21 ? 'bust' : 'playing'

      return {
        ...hand,
        cards: nextCards,
        status: nextStatus,
      }
    })

    setPlayerHands(updatedHands)

    const current = updatedHands[activeHandIndex]

    if (current.status === 'bust') {
      moveToNextHandOrDealer(updatedHands, activeHandIndex)
    }
  }

  const stand = () => {
    if (phase !== 'player' || !activeHand) {
      return
    }

    const updatedHands = playerHands.map((hand, index) => {
      if (index !== activeHandIndex) {
        return hand
      }

      return {
        ...hand,
        status: 'stood',
      }
    })

    setPlayerHands(updatedHands)
    moveToNextHandOrDealer(updatedHands, activeHandIndex)
  }

  const dealerTotal = phase === 'player' ? '?' : handValue(dealer)

  return (
    <main className="game-page">
      <header className="game-topbar">
        <Link className="back-link" to="/">
          Back To Lobby
        </Link>
        <p className="bankroll">Bankroll: ${balance.toFixed(2)}</p>
      </header>

      <section className="game-card">
        <h1>Blackjack</h1>
        <p className="game-subtitle">Classic table with animated deal, split hands, and quick controls.</p>

        <div className="blackjack-table" aria-live="polite">
          <div className="blackjack-seat dealer-seat">
            <h3>Dealer</h3>
            <div className="cards-row">
              {dealer.length
                ? dealer.map((card, index) => (
                  <div key={card.id} className="card-host">
                    {renderCard(card, phase === 'player' && index === 1, index * 80)}
                  </div>
                ))
                : <p className="cards-empty">No cards dealt</p>}
            </div>
            <p>Total: {dealerTotal}</p>
          </div>

          <div className="blackjack-player-area">
            {playerHands.length ? playerHands.map((hand, handIndex) => {
              const isActive = phase === 'player' && handIndex === activeHandIndex
              const total = handValue(hand.cards)

              return (
                <div
                  key={`hand-${handIndex}`}
                  className={`blackjack-seat player-seat ${isActive ? 'active-hand' : ''}`}
                  onDoubleClick={() => {
                    if (isActive) {
                      hit()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (isActive && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      hit()
                    }
                  }}
                >
                  <h3>Player Hand {handIndex + 1}</h3>
                  <div className="cards-row">
                    {hand.cards.map((card, cardIndex) => (
                      <div key={card.id} className="card-host">
                        {renderCard(card, false, cardIndex * 80)}
                      </div>
                    ))}
                  </div>
                  <p>
                    Total: {total}
                    {' | '}
                    Bet: ${hand.bet.toFixed(2)}
                    {hand.status === 'bust' ? ' | Bust' : ''}
                  </p>
                </div>
              )
            }) : (
              <div className="blackjack-seat player-seat">
                <h3>Player</h3>
                <p className="cards-empty">No cards dealt</p>
              </div>
            )}
          </div>
        </div>

        <div className="control-row blackjack-controls blackjack-bottom-controls">
          <label htmlFor="blackjack-bet">Bet</label>
          <input
            id="blackjack-bet"
            type="number"
            min="1"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value) || 0)}
            disabled={phase !== 'idle'}
          />
          <button type="button" disabled={!canDeal} onClick={deal}>
            Deal
          </button>
          <button type="button" disabled={phase !== 'player'} onClick={hit}>
            Hit
          </button>
          <button type="button" disabled={phase !== 'player'} onClick={stand}>
            Stand
          </button>
          <button type="button" disabled={!canSplit} onClick={splitHand}>
            Split
          </button>
        </div>

        <p className="result-banner">{result}</p>
      </section>
    </main>
  )
}

export default BlackjackPage
