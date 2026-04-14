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
  const { login, loginWithGoogle } = useBankroll()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    // password is currently informational — admin is identified by name only
    const user = login(name)
    if (user) {
      navigate('/')
    }
  }

  // Attempt to initialize Google Identity Services if a client id is provided
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

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

  // Initialize GSI with a callback that sends the id_token to our server
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const id_token = response.credential
            const resp = await apiJson('/auth/google', {
              method: 'POST',
              body: { id_token },
            })
            if (!resp.ok) throw new Error('Auth verification failed')
            const body = await resp.json()
            const { profile } = body
            const user = loginWithGoogle(profile)
            if (user) navigate('/')
          } catch {
            // fallback to local JWT decode for serverless deployments
            const fallbackProfile = decodeGoogleJwtPayload(response.credential)
            if (fallbackProfile) {
              const user = loginWithGoogle(fallbackProfile)
              if (user) navigate('/')
              return
            }

            // final manual fallback
            fallbackGooglePrompt()
          }
        },
      })

      // Render a GSI button into our placeholder node, if present
      if (gsiButtonRef.current) {
        window.google.accounts.id.renderButton(gsiButtonRef.current, { theme: 'outline', size: 'large' })
      }

      // Optionally show One Tap
      // window.google.accounts.id.prompt()

      return true
    }

    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      const ok = tryInit()
      if (ok || tries > 50) clearInterval(timer)
    }, 200)

    return () => clearInterval(timer)
  }, [gsiButtonRef, loginWithGoogle, navigate])

  const fallbackGooglePrompt = () => {
    const email = window.prompt('Google email (for test):', 'player@example.com')
    if (!email) return
    const nameFromPrompt = window.prompt('Display name (optional):', 'Google Player')
    const fakeProfile = { sub: `google-${Date.now()}`, email, name: nameFromPrompt || email }
    const user = loginWithGoogle(fakeProfile)
    if (user) navigate('/')
  }

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
            Password (optional)
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (not required)" type="password" />
          </label>

          <div className="actions">
            <button type="submit">Enter</button>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <>
                <div ref={gsiButtonRef} />
                <button type="button" onClick={fallbackGooglePrompt} style={{ marginLeft: '0.5rem' }}>
                  Test sign-in
                </button>
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
