import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

function drawRank() {
  return Math.floor(Math.random() * 13) + 1
}

function cardValue(rank) {
  if (rank >= 10) {
    return 0
  }

  return rank
}

function handTotal(hand) {
  return hand.reduce((sum, rank) => sum + cardValue(rank), 0) % 10
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

    const player = [drawRank(), drawRank()]
    const banker = [drawRank(), drawRank()]

    let playerTotal = handTotal(player)
    let bankerTotal = handTotal(banker)

    const natural = playerTotal >= 8 || bankerTotal >= 8

    let playerThird = null
    let bankerThird = null

    if (!natural) {
      if (playerTotal <= 5) {
        playerThird = drawRank()
        player.push(playerThird)
        playerTotal = handTotal(player)
      }

      if (playerThird === null) {
        if (bankerTotal <= 5) {
          bankerThird = drawRank()
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
          bankerThird = drawRank()
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
        payout(bet * 2)
        setResult('Player wins. Paid 1:1.')
      } else if (winner === 'banker') {
        payout(bet * 1.95)
        setResult('Banker wins. Paid 0.95:1 after commission.')
      } else {
        payout(bet * 9)
        setResult('Tie wins. Paid 8:1.')
      }
    } else {
      setResult(`${winner.toUpperCase()} won this hand.`)
    }

    setLastRound({
      player,
      banker,
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
        <p className="game-subtitle">MVP round with real third-card drawing rules.</p>

        <div className="control-row baccarat-controls">
          <label htmlFor="baccarat-bet">Bet</label>
          <input
            id="baccarat-bet"
            type="number"
            min="1"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value) || 0)}
          />

          <label htmlFor="baccarat-side">Side</label>
          <select id="baccarat-side" value={side} onChange={(event) => setSide(event.target.value)}>
            <option value="player">Player</option>
            <option value="banker">Banker</option>
            <option value="tie">Tie</option>
          </select>

          <button type="button" disabled={!canDeal} onClick={deal}>
            Deal
          </button>
        </div>

        <div className="hand-grid" aria-live="polite">
          <div>
            <h3>Player</h3>
            <p>{lastRound ? `${lastRound.player.join(' ')} | Total ${lastRound.playerTotal}` : '-'}</p>
          </div>
          <div>
            <h3>Banker</h3>
            <p>{lastRound ? `${lastRound.banker.join(' ')} | Total ${lastRound.bankerTotal}` : '-'}</p>
          </div>
        </div>

        <p className="result-banner">{result}</p>
      </section>
    </main>
  )
}

export default BaccaratPage
