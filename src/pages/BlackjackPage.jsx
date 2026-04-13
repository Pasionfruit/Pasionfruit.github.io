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

function normalizeBet(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.round(parsed * 100) / 100)
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
      <span className="corner top">{card.rank}{card.suit.symbol}</span>
      <span className="center-suit">{card.suit.symbol}</span>
      <span className="corner bottom">{card.rank}{card.suit.symbol}</span>
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
  const audioContextRef = useRef(null)

  const normalizedBet = useMemo(() => normalizeBet(bet), [bet])

  const canDeal = useMemo(
    () => phase === 'idle' && normalizedBet > 0 && normalizedBet <= balance,
    [phase, normalizedBet, balance],
  )

  const activeHand = playerHands[activeHandIndex]

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
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

  const playToneAt = ({ frequency, toFrequency, durationMs, type = 'sine', gain = 0.05, delayMs = 0 }) => {
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
    envelope.gain.exponentialRampToValueAtTime(gain, startAt + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000)

    oscillator.connect(envelope)
    envelope.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + durationMs / 1000)
  }

  const playCardDealSound = (delayMs = 0) => {
    playToneAt({ frequency: 310, toFrequency: 235, durationMs: 85, type: 'square', gain: 0.04, delayMs })
  }

  const playDealSequenceSound = (count) => {
    for (let index = 0; index < count; index += 1) {
      playCardDealSound(index * 75)
    }
  }

  const playStandSound = () => {
    playToneAt({ frequency: 420, toFrequency: 310, durationMs: 120, type: 'triangle', gain: 0.055, delayMs: 0 })
  }

  const playWinSound = () => {
    playToneAt({ frequency: 510, toFrequency: 660, durationMs: 110, type: 'triangle', gain: 0.08, delayMs: 0 })
    playToneAt({ frequency: 660, toFrequency: 900, durationMs: 170, type: 'sine', gain: 0.09, delayMs: 120 })
  }

  const playPushSound = () => {
    playToneAt({ frequency: 360, toFrequency: 360, durationMs: 120, type: 'triangle', gain: 0.055, delayMs: 0 })
  }

  const playLossSound = () => {
    playToneAt({ frequency: 290, toFrequency: 130, durationMs: 220, type: 'sawtooth', gain: 0.07, delayMs: 0 })
  }

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
      playLossSound()
      setResult('Dealer wins all hands.')
    } else {
      if (winCount > 0) {
        playWinSound()
      } else {
        playPushSound()
      }
      setResult(`Round complete: ${summary.join(', ')}.`)
    }

    resetRound()
  }

  const finishDealer = (handsForSettlement) => {
    let nextDealer = [...dealer]

    while (handValue(nextDealer) < 17) {
      playCardDealSound(0)
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
    playDealSequenceSound(4)

    setDealer(dealerStart)
    setPlayerHands([createHand(playerStart, normalizedBet)])
    setActiveHandIndex(0)
    setPhase('player')

    const playerTotal = handValue(playerStart)
    const dealerTotal = handValue(dealerStart)

    if (playerTotal === 21 && dealerTotal === 21) {
      payout(normalizedBet)
      playPushSound()
      setResult('Push. Both hands opened with blackjack.')
      resetRound()
      return
    }

    if (playerTotal === 21) {
      payout(normalizedBet * 2.5)
      playWinSound()
      setResult('Blackjack! Paid 3:2.')
      resetRound()
      return
    }

    if (dealerTotal === 21) {
      playLossSound()
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
    playDealSequenceSound(2)

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
      playCardDealSound(0)
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
      playLossSound()
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

    playStandSound()

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
                ? dealer.map((card, index) => renderCard(card, phase === 'player' && index === 1, index * 80))
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
                    {hand.cards.map((card, cardIndex) => renderCard(card, false, cardIndex * 80))}
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
