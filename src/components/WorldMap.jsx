import { useMemo } from 'react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { MAP_GRID, MAP_COLS, MAP_ROWS, TILE_SIZE, PORTALS } from '../data/mapData.js'
import Character from './Character.jsx'
import ZonePortal from './ZonePortal.jsx'
import './WorldMap.css'

const TILE_COLORS = {
  grass:  '#2d5a1b',
  path:   '#b8976a',
  water:  '#1a4a7a',
  sand:   '#c8b870',
  wall:   '#0d0d0d',
  portal: '#2d5a1b', // same as grass, portal overlay handles visuals
}

const TILE_BORDER = {
  grass:  '#1e3d12',
  path:   '#9a7a52',
  water:  '#12356a',
  sand:   '#a89a52',
  wall:   '#000',
  portal: '#1e3d12',
}

const MAP_PX_W = MAP_COLS * TILE_SIZE
const MAP_PX_H = MAP_ROWS * TILE_SIZE

export default function WorldMap() {
  const { player } = usePlayer()
  const { position, characterState, direction, isMoving } = player

  // Camera: centre on player, clamped to map edges
  const camX = useMemo(() => {
    const half = window.innerWidth / 2
    const raw = position.x * TILE_SIZE + TILE_SIZE / 2 - half
    return Math.max(0, Math.min(raw, MAP_PX_W - window.innerWidth))
  }, [position.x])

  const camY = useMemo(() => {
    const half = window.innerHeight / 2
    const raw = position.y * TILE_SIZE + TILE_SIZE / 2 - half
    return Math.max(0, Math.min(raw, MAP_PX_H - window.innerHeight))
  }, [position.y])

  return (
    <div className="map-viewport">
      <div
        className="map-world"
        style={{
          transform: `translate(${-camX}px, ${-camY}px)`,
          width:  MAP_PX_W,
          height: MAP_PX_H,
        }}
      >
        {/* Tile grid */}
        <div
          className="tile-grid"
          style={{
            gridTemplateColumns: `repeat(${MAP_COLS}, ${TILE_SIZE}px)`,
            gridTemplateRows:    `repeat(${MAP_ROWS}, ${TILE_SIZE}px)`,
          }}
        >
          {MAP_GRID.flat().map((terrain, i) => (
            <div
              key={i}
              className={`tile tile-${terrain}`}
              style={{
                background:   TILE_COLORS[terrain],
                outlineColor: TILE_BORDER[terrain],
              }}
            />
          ))}
        </div>

        {/* Zone portals */}
        {PORTALS.map(portal => (
          <ZonePortal key={portal.label} portal={portal} tileSize={TILE_SIZE} />
        ))}

        {/* Character */}
        <div
          className="character-wrapper"
          style={{
            left: position.x * TILE_SIZE + TILE_SIZE / 2,
            top:  position.y * TILE_SIZE + TILE_SIZE / 2,
          }}
        >
          <Character state={characterState} direction={direction} isMoving={isMoving} />
        </div>
      </div>
    </div>
  )
}
