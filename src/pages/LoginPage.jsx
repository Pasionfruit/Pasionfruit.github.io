import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext.jsx'
import { createProfileWithSheets, fetchPlayersDirectory, loginWithSheets } from '../services/sheetsSync.js'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { player, loginAsGuest, loginWithCredentials } = usePlayer()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [players, setPlayers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (player?.name) {
      navigate('/world', { replace: true })
    }
  }, [navigate, player?.name])

  useEffect(() => {
    let cancelled = false
    async function loadPlayers() {
      const directory = await fetchPlayersDirectory()
      if (!cancelled) setPlayers(directory)
    }
    loadPlayers()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await loginWithSheets(username, password)
    setIsLoading(false)

    if (!result.ok) {
      setError('Invalid login or profile not configured in Google Sheet.')
      return
    }

    loginWithCredentials({
      name: result.user.name,
      role: result.user.role,
      authType: 'password',
    })
    navigate('/world')
  }

  async function handleCreateProfile() {
    setError('')
    if (!username.trim() || !password) {
      setError('Enter a username and password first.')
      return
    }

    setIsLoading(true)
    const result = await createProfileWithSheets(username, password)
    setIsLoading(false)

    if (!result.ok) {
      if (result.reason === 'user-exists') {
        setError('That username already exists. Choose another or login.')
        return
      }
      setError('Could not create profile. Verify Apps Script auth_create is deployed.')
      return
    }

    loginWithCredentials({
      name: result.user.name,
      role: result.user.role,
      authType: 'password',
    })
    navigate('/world')
  }

  function handleGuest() {
    loginAsGuest()
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
        <form className="login-form" onSubmit={handleLogin}>
          <input
            className="login-input"
            type="text"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="login-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="login-password-toggle">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </label>
          <button className="btn-login" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Login'}
          </button>
          <button className="btn-create" type="button" onClick={handleCreateProfile} disabled={isLoading}>
            {isLoading ? 'Working...' : 'Create Profile'}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
        <button className="btn-guest" onClick={handleGuest}>
          ▶ Enter as Guest
        </button>
        <div className="login-players">
          <p className="login-players-title">Players</p>
          {players.length === 0 && <p className="login-players-empty">No profiles loaded</p>}
          {players.slice(0, 12).map((entry, index) => (
            <p key={`${entry.name}-${index}`} className="login-player-row">{entry.name} · {entry.role}</p>
          ))}
        </div>
        <p className="login-hint">Ride around to explore · WASD or D-pad</p>
      </div>
    </div>
  )
}