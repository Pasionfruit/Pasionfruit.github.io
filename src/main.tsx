import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // The worker calls skipWaiting(), so a new deploy takes over as soon as it
  // installs, but the page on screen was already served from the old precache.
  // Reload once when that happens, or a deploy only shows up on the second
  // launch. Skipped on first install, when there is no old build to replace.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      // An installed PWA resumed from the background never navigates, so the
      // browser never re-checks sw.js on its own. Check whenever it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter basename="/">
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    ) : (
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
