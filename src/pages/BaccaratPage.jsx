import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'
import { playCustomFx } from '../lib/soundFx'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = [
  { id: 'spades', symbol: '♠', color: 'black' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'black' },
  { id: 'diamonds', symbol: '♦', color: 'red' },
]

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

function drawCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)]
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
  cardIdCounter += 1

  return {
    id: cardIdCounter,
    rank,
    suit,
  }
}

function cardValue(card) {
  if (!card) return 0

  if (card.rank === 'A') {
    return 1
  }

  if (['10', 'J', 'Q', 'K'].includes(card.rank)) {
    return 0
  }

  return Number(card.rank)
}

function handTotal(hand) {
  return hand.reduce((sum, card) => sum + cardValue(card), 0) % 10
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

function BaccaratPage() {
  const [bet, setBet] = useState(25)
  const [side, setSide] = useState('player')
  const [result, setResult] = useState('Choose Player, Banker, or Tie then deal.')
  const [lastRound, setLastRound] = useState(null)
  const { balance, placeBet, payout } = useBankroll()

  const canDeal = useMemo(() => bet > 0 && bet <= balance, [bet, balance])

  const deal = () => {
    if (!placeBet(bet)) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    const player = [drawCard(), drawCard()]
    const banker = [drawCard(), drawCard()]

    let playerTotal = handTotal(player)
    let bankerTotal = handTotal(banker)

    const natural = playerTotal >= 8 || bankerTotal >= 8

    let playerThird = null
    let bankerThird = null

    if (!natural) {
      if (playerTotal <= 5) {
        playerThird = drawCard()
        player.push(playerThird)
        playerTotal = handTotal(player)
      }

      if (playerThird === null) {
        if (bankerTotal <= 5) {
          bankerThird = drawCard()
          banker.push(bankerThird)
          bankerTotal = handTotal(banker)
        }
      } else {
        const p = cardValue(playerThird)
        const shouldDraw =
          bankerTotal <= 2 ||
          (bankerTotal === 3 && p !== 8) ||
          (bankerTotal === 4 && p >= 2 && p <= 7) ||
          (bankerTotal === 5 && p >= 4 && p <= 7) ||
          (bankerTotal === 6 && p === 6) ||
          (bankerTotal === 6 && p === 7)

        if (shouldDraw) {
          bankerThird = drawCard()
          banker.push(bankerThird)
          bankerTotal = handTotal(banker)
        }
      }
    }

    let winner = 'tie'

    if (playerTotal > bankerTotal) {
      winner = 'player'
    } else if (bankerTotal > playerTotal) {
      winner = 'banker'
    }

    if (winner === side) {
      if (winner === 'player') {
        const wonAmount = bet * 2
        payout(wonAmount)
        playCustomFx('win', { volume: 0.8 })
        setResult(`Player won $${wonAmount.toFixed(2)}.`)
      } else if (winner === 'banker') {
        const wonAmount = bet * 1.95
        payout(wonAmount)
        playCustomFx('win', { volume: 0.8 })
        setResult(`Banker won $${wonAmount.toFixed(2)} after commission.`)
      } else {
        const wonAmount = bet * 9
        payout(wonAmount)
        playCustomFx('win', { volume: 0.8 })
        setResult(`Tie won $${wonAmount.toFixed(2)}.`)
      }
    } else {
      setResult(`${winner.toUpperCase()} won this hand.`)
    }

    setLastRound({
      player,
      banker,
      playerThird,
      bankerThird,
      playerTotal,
      bankerTotal,
      winner,
    })
  }

  return (
    <main className="game-page">
      <header className="game-topbar">
        <Link className="back-link" to="/">
          Back To Lobby
        </Link>
        <p className="bankroll">Bankroll: ${balance.toFixed(2)}</p>
      </header>

      <section className="game-card">
        <h1>Baccarat</h1>
        <p className="game-subtitle">Classic Punto Banco table with Player, Banker, and Tie betting spots.</p>

        <div className="baccarat-payout-strip" aria-label="Baccarat payout guide">
          <span className="baccarat-payout-pill player">Player pays 1:1</span>
          <span className="baccarat-payout-pill banker">Banker pays 0.95:1</span>
          <span className="baccarat-payout-pill tie">Tie pays 8:1</span>
        </div>

        <div className="baccarat-bet-board" role="group" aria-label="Choose betting side">
          <button
            type="button"
            className={`baccarat-spot player ${side === 'player' ? 'selected' : ''}`}
            onClick={() => setSide('player')}
          >
            Player
            <span>1:1</span>
          </button>
          <button
            type="button"
            className={`baccarat-spot tie ${side === 'tie' ? 'selected' : ''}`}
            onClick={() => setSide('tie')}
          >
            Tie
            <span>8:1</span>
          </button>
          <button
            type="button"
            className={`baccarat-spot banker ${side === 'banker' ? 'selected' : ''}`}
            onClick={() => setSide('banker')}
          >
            Banker
            <span>0.95:1</span>
          </button>
        </div>

        <div className="blackjack-table baccarat-table" aria-live="polite">
          <div className="blackjack-seat dealer-seat baccarat-lane player">
            <h3>Player</h3>
            {lastRound ? (
              <>
                <div className="cards-row">
                  {lastRound.player.map((card) => (
                    <div key={card.id} className="card-host">
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
                <p>
                  Total {lastRound.playerTotal}
                  {lastRound.playerThird ? ` | Drew ${lastRound.playerThird.rank}${lastRound.playerThird.suit.symbol}` : ' | Stood'}
                </p>
              </>
            ) : <p>-</p>}
          </div>

          <div className="blackjack-seat dealer-seat baccarat-lane banker">
            <h3>Banker</h3>
            {lastRound ? (
              <>
                <div className="cards-row">
                  {lastRound.banker.map((card) => (
                    <div key={card.id} className="card-host">
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
                <p>
                  Total {lastRound.bankerTotal}
                  {lastRound.bankerThird ? ` | Drew ${lastRound.bankerThird.rank}${lastRound.bankerThird.suit.symbol}` : ' | Stood'}
                </p>
              </>
            ) : <p>-</p>}
          </div>

          <div className="baccarat-center-mark" aria-hidden="true">Commission 5% on Banker wins</div>
        </div>

        <div className="control-row blackjack-controls blackjack-bottom-controls baccarat-bottom-controls">
          <label htmlFor="baccarat-bet">Bet</label>
          <input
            id="baccarat-bet"
            type="number"
            min="1"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value) || 0)}
          />

          <p className="baccarat-selected-side">Selected: {side[0].toUpperCase() + side.slice(1)}</p>

          <button type="button" disabled={!canDeal} onClick={deal}>
            Deal
          </button>
        </div>

        <p className="result-banner">{result}</p>
      </section>
    </main>
  )
}

export default BaccaratPage
