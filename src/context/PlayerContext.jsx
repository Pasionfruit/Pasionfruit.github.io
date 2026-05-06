import { createContext, useContext, useState } from 'react'
import { fetchCurrentUserRole } from '../services/sheetsSync.js'

const PlayerContext = createContext(null)

const PLAYER_STORAGE_KEY = 'pf.player.session'

function loadPlayerSession() {
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY)
    if (!raw) return { name: null, role: 'guest', isGuest: true, authType: null }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { name: null, role: 'guest', isGuest: true, authType: null }
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null
    if (!name) return { name: null, role: 'guest', isGuest: true, authType: null }
    const role = typeof parsed.role === 'string' && parsed.role.trim() ? parsed.role.trim() : 'user'
    const authType = typeof parsed.authType === 'string' ? parsed.authType : 'password'
    const isGuest = Boolean(parsed.isGuest)
    return { name, role, isGuest, authType }
  } catch {
    return { name: null, role: 'guest', isGuest: true, authType: null }
  }
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(loadPlayerSession)

  const persistPlayer = (next) => {
    setPlayer(next)
    try {
      if (!next?.name) {
        window.localStorage.removeItem(PLAYER_STORAGE_KEY)
      } else {
        window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(next))
      }
    } catch {
      // no-op
    }
  }

  const setName = (name) => {
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    if (!normalizedName) {
      persistPlayer({ name: null, role: 'guest', isGuest: true, authType: null })
      return
    }

    persistPlayer({
      name: normalizedName,
      role: normalizedName.toLowerCase() === 'guest' ? 'guest' : 'user',
      isGuest: normalizedName.toLowerCase() === 'guest',
      authType: normalizedName.toLowerCase() === 'guest' ? 'guest' : 'password',
    })
  }

  const loginWithCredentials = ({ name, role, authType }) => {
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    if (!normalizedName) return
    persistPlayer({
      name: normalizedName,
      role: typeof role === 'string' && role.trim() ? role.trim() : 'user',
      isGuest: false,
      authType: authType || 'password',
    })
  }

  const loginAsGuest = () => {
    persistPlayer({ name: 'Guest', role: 'guest', isGuest: true, authType: 'guest' })
  }

  const logout = () => {
    persistPlayer({ name: null, role: 'guest', isGuest: true, authType: null })
  }

  const refreshRole = async () => {
    if (!player?.name || player?.isGuest) {
      return { ok: false, reason: 'not-logged-in' }
    }
    
    try {
      const result = await fetchCurrentUserRole(player.name)
      if (result.ok) {
        persistPlayer({
          ...player,
          role: result.role,
        })
        return { ok: true, role: result.role }
      }
      return result
    } catch {
      return { ok: false, reason: 'refresh-failed' }
    }
  }

  return (
    <PlayerContext.Provider value={{ player, setName, loginWithCredentials, loginAsGuest, logout, refreshRole }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
