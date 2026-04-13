import { Link } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

function LeaderboardPage() {
  const { getLeaderboard } = useBankroll()
  const leaderboard = getLeaderboard()

  return (
    <main className="leaderboard-page">
      <header>
        <h1>Leaderboard</h1>
        <p>Top players by bankroll</p>
      </header>

      <ol className="leaderboard-list">
        {leaderboard.map((u) => (
          <li key={u.id} className="leaderboard-row">
            <div className="name">{u.name}{u.isAdmin ? ' (admin)' : ''}</div>
            <div className="balance">${u.balance.toFixed(2)}</div>
          </li>
        ))}
      </ol>

      <Link to="/">Back to lobby</Link>
    </main>
  )
}

export default LeaderboardPage
