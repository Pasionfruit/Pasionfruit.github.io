import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext.jsx'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setName } = usePlayer()

  function handleGuest() {
    setName('Guest')
    navigate('/world')
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />
      <div className="login-card">
        <div className="login-logo">🍈</div>
        <h1 className="login-title">PASIONFRUIT</h1>
        <p className="login-subtitle">A Personal World</p>
        <div className="login-divider" />
        <button className="btn-guest" onClick={handleGuest}>
          ▶ Enter as Guest
        </button>
        <p className="login-hint">Ride around to explore · WASD or D-pad</p>
      </div>
    </div>
  )
}