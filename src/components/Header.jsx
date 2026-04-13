import { Link, useNavigate } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'

function Header() {
  const { currentUser, balance, logout } = useBankroll()
  const navigate = useNavigate()

  const handleLoginClick = () => {
    if (!currentUser) {
      navigate('/login')
      return
    }

    // Ask whether to logout or switch accounts
    const wantsLogout = window.confirm('Do you want to logout? Press Cancel to switch accounts instead.')

    if (wantsLogout) {
      logout()
      // navigate to lobby as a guest
      navigate('/')
    } else {
      navigate('/login')
    }
  }

  return (
    <header className="site-header">
      <div className="left">
        <div className="player">Player {currentUser?.name || 'Guest'}</div>
      </div>

      <div className="right">
        <div className="balance">${(balance ?? 0).toFixed(2)}</div>
        <button type="button" onClick={handleLoginClick} className="login-button">
          {currentUser ? 'Switch / Logout' : 'Login / Sign up'}
        </button>
  {/* leaderboard removed: top view is on lobby only */}
      </div>
    </header>
  )
}

export default Header
