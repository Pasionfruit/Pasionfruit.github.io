import { createContext, useContext, useState } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState({ name: null })
  const setName = (name) => setPlayer({ name })

  return (
    <PlayerContext.Provider value={{ player, setName }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
