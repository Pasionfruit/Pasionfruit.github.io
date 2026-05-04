import { createContext, useContext, useState } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState({
    name: null,
    // position in tile coordinates
    position: { x: 14, y: 10 },
    // 'run' | 'bike' | 'swim'
    characterState: 'run',
    // 'right' | 'left' | 'up' | 'down'
    direction: 'right',
    isMoving: false,
  })

  function setName(name) {
    setPlayer(p => ({ ...p, name }))
  }

  function setPosition(pos) {
    setPlayer(p => ({ ...p, position: pos }))
  }

  function setCharacterState(state) {
    setPlayer(p => ({ ...p, characterState: state }))
  }

  function setDirection(dir) {
    setPlayer(p => ({ ...p, direction: dir }))
  }

  function setIsMoving(moving) {
    setPlayer(p => ({ ...p, isMoving: moving }))
  }

  return (
    <PlayerContext.Provider value={{ player, setName, setPosition, setCharacterState, setDirection, setIsMoving }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
