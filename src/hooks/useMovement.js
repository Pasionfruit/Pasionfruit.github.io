import { useEffect, useRef, useCallback } from 'react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { MAP_GRID, MAP_COLS, MAP_ROWS, TERRAIN, TERRAIN_STATE } from '../data/mapData.js'

const MOVE_INTERVAL_MS = 140

const DIR_DELTA = {
  right: { dx: 1,  dy: 0  },
  left:  { dx: -1, dy: 0  },
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1  },
}

export function useMovement() {
  const { player, setPosition, setCharacterState, setDirection, setIsMoving } = usePlayer()
  const keysHeld = useRef(new Set())
  const intervalRef = useRef(null)
  const playerRef = useRef(player)

  // Keep ref in sync with latest player state
  useEffect(() => { playerRef.current = player }, [player])

  const move = useCallback((dir) => {
    const { position } = playerRef.current
    const delta = DIR_DELTA[dir]
    if (!delta) return

    const nx = position.x + delta.dx
    const ny = position.y + delta.dy

    // Boundary check
    if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) return

    // Wall check
    const terrain = MAP_GRID[ny][nx]
    if (terrain === TERRAIN.WALL) return

    setDirection(dir)
    setPosition({ x: nx, y: ny })
    setCharacterState(TERRAIN_STATE[terrain] ?? 'run')
  }, [setPosition, setCharacterState, setDirection])

  const getActiveDir = useCallback(() => {
    if (keysHeld.current.has('ArrowRight') || keysHeld.current.has('d') || keysHeld.current.has('D')) return 'right'
    if (keysHeld.current.has('ArrowLeft')  || keysHeld.current.has('a') || keysHeld.current.has('A')) return 'left'
    if (keysHeld.current.has('ArrowUp')    || keysHeld.current.has('w') || keysHeld.current.has('W')) return 'up'
    if (keysHeld.current.has('ArrowDown')  || keysHeld.current.has('s') || keysHeld.current.has('S')) return 'down'
    return null
  }, [])

  const startInterval = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      const dir = getActiveDir()
      if (dir) {
        move(dir)
        setIsMoving(true)
      } else {
        setIsMoving(false)
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, MOVE_INTERVAL_MS)
  }, [getActiveDir, move, setIsMoving])

  // Keyboard listeners
  useEffect(() => {
    function onKeyDown(e) {
      const relevant = ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S']
      if (!relevant.includes(e.key)) return
      e.preventDefault()
      keysHeld.current.add(e.key)
      startInterval()
    }
    function onKeyUp(e) {
      keysHeld.current.delete(e.key)
      if (getActiveDir() === null) {
        setIsMoving(false)
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [startInterval, getActiveDir, setIsMoving])

  // D-pad controls exposed for mobile
  const dpadStart = useCallback((dir) => {
    keysHeld.current.add('__dpad_' + dir)
    // Map dpad key → arrow key equivalent
    const equiv = { right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' }
    keysHeld.current.add(equiv[dir])
    startInterval()
  }, [startInterval])

  const dpadEnd = useCallback((dir) => {
    keysHeld.current.delete('__dpad_' + dir)
    const equiv = { right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' }
    keysHeld.current.delete(equiv[dir])
    if (getActiveDir() === null) {
      setIsMoving(false)
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [getActiveDir, setIsMoving])

  return { dpadStart, dpadEnd }
}
