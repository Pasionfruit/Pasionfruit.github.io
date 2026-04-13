import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

function rollDie() {
  return Math.floor(Math.random() * 6) + 1
}

function CrapsPage() {
  const [bet, setBet] = useState(25)
  const [phase, setPhase] = useState('idle')
  const [roundBet, setRoundBet] = useState(0)
  const [point, setPoint] = useState(null)
  const [lastRoll, setLastRoll] = useState(null)
  const [result, setResult] = useState('Place a Pass Line bet to begin a round.')
  const { balance, placeBet, payout } = useBankroll()

  const canStart = useMemo(() => phase === 'idle' && bet > 0 && bet <= balance, [phase, bet, balance])

  const startRound = () => {
    if (!placeBet(bet)) {
      setResult('Bet rejected. Choose a valid amount within your bankroll.')
      return
    }

    setRoundBet(bet)
    setPhase('comeout')
    setPoint(null)
    setLastRoll(null)
    setResult('Round started. Roll for the come-out.')
  }

  const settleWin = (message) => {
    payout(roundBet * 2)
    setRoundBet(0)
    setPhase('idle')
    setPoint(null)
    setResult(message)
  }

  const settleLoss = (message) => {
    setRoundBet(0)
    setPhase('idle')
    setPoint(null)
    setResult(message)
  }

  const roll = () => {
    if (phase === 'idle') {
      return
    }

    const dieOne = rollDie()
    const dieTwo = rollDie()
    const total = dieOne + dieTwo
    setLastRoll({ dieOne, dieTwo, total })

    if (phase === 'comeout') {
      if (total === 7 || total === 11) {
        settleWin(`Natural ${total}. Pass Line wins.`)
        return
      }

      if (total === 2 || total === 3 || total === 12) {
        settleLoss(`Craps ${total}. Pass Line loses.`)
        return
      }

      setPoint(total)
      setPhase('point')
      setResult(`Point is ${total}. Roll it again before a 7.`)
      return
    }

    if (total === point) {
      settleWin(`Point ${point} hit. Pass Line wins.`)
      return
    }

    if (total === 7) {
      settleLoss('Seven-out. Pass Line loses.')
      return
    }

    setResult(`Rolled ${total}. Point is still ${point}.`)
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
        <h1>Craps</h1>
        <p className="game-subtitle">Pass Line MVP: come-out roll and point phase.</p>

        <div className="control-row craps-controls">
          <label htmlFor="craps-bet">Bet</label>
          <input
            id="craps-bet"
            type="number"
            min="1"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value) || 0)}
            disabled={phase !== 'idle'}
          />
          <button type="button" disabled={!canStart} onClick={startRound}>
            Start Round
          </button>
          <button type="button" disabled={phase === 'idle'} onClick={roll}>
            Roll Dice
          </button>
        </div>

        <div className="dice-readout" aria-live="polite">
          {lastRoll ? `${lastRoll.dieOne} + ${lastRoll.dieTwo} = ${lastRoll.total}` : 'No rolls yet.'}
        </div>

        <p className="point-readout">Point: {point ?? '-'}</p>
        <p className="result-banner">{result}</p>
      </section>
    </main>
  )
}

export default CrapsPage
