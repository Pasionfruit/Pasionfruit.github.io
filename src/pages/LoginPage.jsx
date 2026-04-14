import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBankroll } from '../context/BankrollContext'
import { apiJson } from '../lib/apiClient'

function decodeGoogleJwtPayload(idToken) {
  try {
    const parts = String(idToken || '').split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(normalized)
    const payload = JSON.parse(json)

    if (!payload?.sub) return null

    return {
      sub: payload.sub,
      email: payload.email || null,
      name: payload.name || payload.email || 'Google Player',
    }
  } catch {
    return null
  }
}

function LoginPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [googleStatus, setGoogleStatus] = useState('idle')
  const { login, loginWithGoogle } = useBankroll()
  const navigate = useNavigate()
  const isAppsScriptDeployment =
    (import.meta.env.VITE_API_MODE || '').trim().toLowerCase() === 'apps-script'
    || /script\.google\.com\/macros\/s\/.+\/exec/i.test((import.meta.env.VITE_API_BASE_URL || '').trim())

  const fallbackGooglePrompt = () => {
    const email = window.prompt('Google email (for test):', 'player@example.com')
    if (!email) return
    const nameFromPrompt = window.prompt('Display name (optional):', 'Google Player')
    const fakeProfile = { sub: `google-${Date.now()}`, email, name: nameFromPrompt || email }
    const user = loginWithGoogle(fakeProfile)
    if (user) {
      setError('')
      navigate('/')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Password is required for player login/create.')
      return
    }

    const user = await login(name, password)
    if (user) {
      setError('')
      navigate('/')
      return
    }

    setError('Unable to log in. Check your name/password, or use Google sign-in for linked accounts.')
  }

  // Attempt to initialize Google Identity Services if a client id is provided
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setGoogleStatus('unconfigured')
      return
    }

    setGoogleStatus('loading')

    // dynamically insert the GSI script
    const id = 'gsi-script'
    if (document.getElementById(id)) return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.id = id
    s.async = true
    s.defer = true
    document.head.appendChild(s)
  }, [])
  const gsiButtonRef = useRef(null)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    // Wait for GSI script to load
    const tryInit = () => {
      // global provided by the GSI script
      if (typeof window.google === 'undefined' || !window.google?.accounts?.id) {
        return false
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          const token = response?.credential
          const fallbackProfile = decodeGoogleJwtPayload(token)

          if (isAppsScriptDeployment && fallbackProfile) {
            const user = loginWithGoogle(fallbackProfile)
            if (user) {
              setError('')
              navigate('/')
            }
            return
          }

          try {
            const id_token = token
            const resp = await apiJson('/auth/google', {
              method: 'POST',
              body: { id_token },
            })
            if (!resp.ok) throw new Error('Auth verification failed')
            const body = await resp.json()
            const { profile } = body
            const user = loginWithGoogle(profile)
            if (user) {
              setError('')
              navigate('/')
            }
          } catch {
            // fallback to local JWT decode for serverless deployments
            if (fallbackProfile) {
              const user = loginWithGoogle(fallbackProfile)
              if (user) {
                setError('')
                navigate('/')
              }
              return
            }

            // final manual fallback
            fallbackGooglePrompt()
          }
        },
      })

      if (gsiButtonRef.current) {
        window.google.accounts.id.renderButton(gsiButtonRef.current, { theme: 'outline', size: 'large' })
      }

      return true
    }

    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      const ok = tryInit()
      if (ok) {
        setGoogleStatus('ready')
        clearInterval(timer)
      }

      if (tries > 50) {
        setGoogleStatus('unavailable')
        clearInterval(timer)
      }
    }, 200)

    return () => clearInterval(timer)
  }, [gsiButtonRef, isAppsScriptDeployment, loginWithGoogle, navigate])

  return (
    <main className="auth-page">
      <div className="auth-card">
        <header>
          <h1>Login / Create Player</h1>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" />
          </label>

          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          </label>

          {error ? <p role="alert">{error}</p> : null}

          <div className="actions">
            <button type="submit">Login / Create</button>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <>
                <div ref={gsiButtonRef} />
                {googleStatus !== 'ready' ? (
                  <button type="button" className="google-btn" onClick={fallbackGooglePrompt}>
                    Continue with Google
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="google-btn" onClick={fallbackGooglePrompt}>
                Sign in with Google (test)
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
