import { useNavigate } from 'react-router-dom'
import GamePanel from '../components/GamePanel'
import { games } from '../data/games'
import { useBankroll } from '../context/BankrollContext'

const featuredPartyGame = {
  id: 'ride-the-bus',
  name: 'Ride The Bus',
  tagline: 'Layered card callouts that get tighter every round.',
  ctaLabel: 'Ride Now',
  rules: [
    'Round 1: Guess whether the first card will be red or black.',
    'Round 2: Using that card, guess whether the next card is above, equal, or below it.',
    'Round 3: Using the prior two cards, guess whether the next card is in or out of that range.',
    'Between is inclusive, so matching either boundary card still counts as in.',
    'Final round: Guess the exact suit of the last card to clear the bus and win the payout.',
  ],
}

const partyGames = [
  {
    id: 'kings-cup',
    name: "King's Cup",
    tagline: 'Draw-driven party classic with rotating rule moments.',
  },
  {
    id: 'ship-captain-crew',
    name: 'Ship Captain Crew',
    tagline: 'Dice chase game where sequences decide your score.',
  },
  {
    id: 'three-man',
    name: 'Three Man',
    tagline: 'Fast dice rounds with one player under pressure each turn.',
  },
  {
    id: 'straight-face',
    name: 'Straight Face',
    tagline: 'Keep composure while reading prompts and bluffing reactions.',
  },
]

function LobbyPage() {
  const navigate = useNavigate()
  const { getLeaderboard } = useBankroll()
  const fullLeaderboard = getLeaderboard()
  const leaderboard = fullLeaderboard.slice(0, 3)
  const { currentUser } = useBankroll()
  const currentPlace = currentUser
    ? fullLeaderboard.findIndex((u) => u.id === currentUser.id) + 1
    : null

  return (
    <main className="lobby-page">
      <section className="lobby-leaderboard">
        <h2>Leaderboard</h2>
        <ol>
          {leaderboard.map((u, idx) => (
            <li key={u.id} className="leader-row">
              <div className="place">{idx + 1}</div>
              <div className="name">{u.name}</div>
              <div className="balance">${u.balance.toFixed(2)}</div>
            </li>
          ))}
          {currentUser && currentPlace > 3 ? (
            <li key={currentUser.id} className="current-user-row">
              <div className="place">{currentPlace}</div>
              <div className="name">{currentUser.name}</div>
              <div className="balance">${currentUser.balance.toFixed(2)}</div>
            </li>
          ) : null}
        </ol>
      </section>

      {!currentUser ? (
        <section className="only-leaderboard-guest">
          <p className="guest-note">You must be logged in to access the casino. <button className="login-link" onClick={() => navigate('/login')}>Login / Create Player</button></p>
        </section>
      ) : (
        <>
          <header className="lobby-header">
            <p className="eyebrow">High Stakes Lounge</p>
            <h1>Casino Lobby</h1>
            <p className="intro">
              Choose your table, check the rules with the question icon, and step into
              the action.
            </p>
          </header>

          <section className="panel-grid" aria-label="Casino game selection">
            {games.map((game) => (
              <GamePanel key={game.id} game={game} onPlay={() => navigate(`/game/${game.id}`)} />
            ))}
          </section>

          <section className="party-lobby" aria-label="Party lobby game selection">
            <header className="party-header centered">
              <h2>Party Lobby</h2>
              <p>Social party tables with one live game and more on deck.</p>
            </header>

            <div className="panel-grid party-grid">
              <GamePanel key={featuredPartyGame.id} game={featuredPartyGame} onPlay={() => navigate('/game/ride-the-bus')} />

              {partyGames.map((game) => (
                <article key={game.id} className="game-panel party-panel">
                  <header className="panel-header">
                    <h2>{game.name}</h2>
                    <p>{game.tagline}</p>
                  </header>
                  <span className="party-badge">Coming Soon</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default LobbyPage
