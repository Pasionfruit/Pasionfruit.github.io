import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ZONES, TREE_POSITIONS, BUILDING_LAYOUTS, LAMP_POSITIONS } from './worldData.js'
import { RACE_START_ANGLE, RACE_TRACK_WIDTH, isOnRaceTrackBand, raceTrackPointAt } from './raceTrack.js'
import { useGame } from '../context/GameContext.jsx'

const WORLD_SIZE = 100
const ROAD_WIDTH = 7
const BORDER_STRIP_WIDTH = 0.2
const RAIL_RADIUS = 0.11
const TRACK_STEPS = 360
const FINISH_LINE_WIDTH = RACE_TRACK_WIDTH
const FINISH_LINE_DEPTH = 0.9
const FINISH_CHECKER_COLS = 6
const FINISH_CHECKER_ROWS = 3

function formatLapTime(ms) {
  if (typeof ms !== 'number' || ms <= 0) return '--:--.---'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function buildTrackShape(centerOffset = 0, width = RACE_TRACK_WIDTH, steps = TRACK_STEPS) {
  const outerOffset = centerOffset + width / 2
  const innerOffset = centerOffset - width / 2

  const outerPoints = []
  const innerPoints = []
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    const [ox, , oz] = raceTrackPointAt(angle, outerOffset)
    const [ix, , iz] = raceTrackPointAt(angle, innerOffset)
    outerPoints.push(new THREE.Vector2(ox, oz))
    innerPoints.push(new THREE.Vector2(ix, iz))
  }

  const shape = new THREE.Shape(outerPoints)
  shape.holes.push(new THREE.Path(innerPoints.reverse()))
  return shape
}

function buildTrackRailGeometry(offset, tubeRadius = RAIL_RADIUS, steps = TRACK_STEPS) {
  const points = []
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    const [x, , z] = raceTrackPointAt(angle, offset)
    points.push(new THREE.Vector3(x, 0, z))
  }

  const path = new THREE.CurvePath()
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    path.add(new THREE.LineCurve3(p1, p2))
  }

  return new THREE.TubeGeometry(path, steps * 2, tubeRadius, 10, true)
}

function Tree({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.14, 0.20, 1.4, 7]} />
        <meshStandardMaterial color="#3d1f08" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.0, 0]}>
        <coneGeometry args={[1.0, 2.0, 7]} />
        <meshStandardMaterial color="#1a5220" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.85, 0]}>
        <coneGeometry args={[0.7, 1.6, 7]} />
        <meshStandardMaterial color="#206628" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Building({ position, size, color }) {
  const h = size[1]
  return (
    <group position={[position[0], h / 2, position[2]]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Roof edge */}
      <mesh position={[0, h / 2 + 0.06, 0]}>
        <boxGeometry args={[size[0] + 0.1, 0.12, size[2] + 0.1]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} emissive={color} emissiveIntensity={0.05} />
      </mesh>
    </group>
  )
}

function ZonePlatform({ zone }) {
  const ringRef = useRef()
  const [px, , pz] = zone.position

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.y += delta * 0.9
  })

  return (
    <group position={zone.position}>
      {/* Ground glow disc */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial
          color={zone.color}
          emissive={zone.color}
          emissiveIntensity={0.15}
          roughness={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Inner glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.8, 3.2, 48]} />
        <meshStandardMaterial color={zone.color} emissive={zone.color} emissiveIntensity={1.2} />
      </mesh>
      {/* Spinning outer ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[3.9, 4.1, 6]} />
        <meshStandardMaterial color={zone.color} emissive={zone.color} emissiveIntensity={0.8} wireframe />
      </mesh>
      {/* Vertical light pillars */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 3.5, 1.5, Math.sin(a) * 3.5]}>
            <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
            <meshStandardMaterial color={zone.color} emissive={zone.color} emissiveIntensity={0.6} transparent opacity={0.5} />
          </mesh>
        )
      })}
      {/* Zone label */}
      <Html center position={[0, 4.0, 0]} distanceFactor={14} zIndexRange={[10, 0]}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '10px',
          color: zone.color,
          textShadow: `0 0 10px ${zone.color}, 0 0 20px ${zone.color}`,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '0.05em',
        }}>
          {zone.label}
        </div>
      </Html>
    </group>
  )
}

function Lamp({ position, isNight }) {
  const lightRef = useRef()
  const targetRef = useRef()
  const [x, , z] = position
  const alongVerticalRoad = Math.abs(x) < Math.abs(z)
  const dirX = alongVerticalRoad ? -Math.sign(x || 1) : 0
  const dirZ = alongVerticalRoad ? 0 : -Math.sign(z || 1)
  const headYaw = Math.atan2(dirZ, dirX)

  useEffect(() => {
    if (!lightRef.current || !targetRef.current) return
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  }, [])

  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 4.0, 7]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.6} metalness={0.6} />
      </mesh>
      {/* Head rotated so every lamp faces inward to the road */}
      <group rotation={[0, headYaw, 0]}>
        {/* Arm */}
        <mesh position={[0.55, 4.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
          <meshStandardMaterial color="#2a2a3a" roughness={0.6} metalness={0.6} />
        </mesh>
        {/* Shade cap (inverted cone) */}
        <mesh position={[1.05, 4.34, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.3, 0.22, 8]} />
          <meshStandardMaterial color="#1e1e2e" roughness={0.5} metalness={0.7} />
        </mesh>
        {/* Globe */}
        <mesh position={[1.05, 4.05, 0]}>
          <sphereGeometry args={[0.18, 10, 10]} />
          <meshStandardMaterial
            color="#fffbe0"
            emissive="#ffe877"
            emissiveIntensity={isNight ? 3.0 : 0.2}
          />
        </mesh>
        {/* Spotlight aimed straight down from the globe */}
        <object3D ref={targetRef} position={[1.05, 0, 0]} />
        <spotLight
          ref={lightRef}
          position={[1.05, 4.05, 0]}
          color="#ffd97a"
          intensity={isNight ? 60 : 0}
          distance={34}
          angle={Math.PI / 3.3}
          penumbra={0.9}
          decay={2}
          castShadow={false}
        />
      </group>
    </group>
  )
}

export default function World() {
  const { isNight, raceStatus, raceLeaderboard } = useGame()
  const trackHalfWidth = RACE_TRACK_WIDTH / 2
  const edgeStripOffset = trackHalfWidth - BORDER_STRIP_WIDTH / 2
  const railOffset = trackHalfWidth + RAIL_RADIUS
  const outerRailRef = useRef()
  const innerRailRef = useRef()
  const raceLaneShape = useMemo(() => buildTrackShape(0, RACE_TRACK_WIDTH), [])
  const trackOuterBorderShape = useMemo(() => buildTrackShape(edgeStripOffset, BORDER_STRIP_WIDTH), [edgeStripOffset])
  const trackInnerBorderShape = useMemo(() => buildTrackShape(-edgeStripOffset, BORDER_STRIP_WIDTH), [edgeStripOffset])
  const outerRailGeometry = useMemo(() => buildTrackRailGeometry(railOffset, RAIL_RADIUS), [railOffset])
  const innerRailGeometry = useMemo(() => buildTrackRailGeometry(-railOffset, RAIL_RADIUS), [railOffset])
  const [startX, , startZ] = useMemo(() => raceTrackPointAt(RACE_START_ANGLE, 0), [])
  const startAcrossYaw = useMemo(() => {
    const eps = 0.015
    const [x1, , z1] = raceTrackPointAt(RACE_START_ANGLE - eps, 0)
    const [x2, , z2] = raceTrackPointAt(RACE_START_ANGLE + eps, 0)
    const tangentYaw = Math.atan2(z2 - z1, x2 - x1)
    return tangentYaw + Math.PI / 2
  }, [])
  const startRadialYaw = useMemo(() => Math.atan2(startZ, startX), [startX, startZ])
  const finishBoardPosition = useMemo(() => {
    const radialX = Math.cos(startRadialYaw)
    const radialZ = Math.sin(startRadialYaw)
    return [startX + radialX * 0.55, 2.65, startZ + radialZ * 0.55]
  }, [startRadialYaw, startX, startZ])
  const topThree = useMemo(() => raceLeaderboard.slice(0, 3), [raceLeaderboard])
  const personalBestMs = topThree.length > 0 ? topThree[0].ms : null

  const visibleTrees = useMemo(
    () => TREE_POSITIONS.filter(([x, , z]) => !isOnRaceTrackBand(x, z, 0.9)),
    []
  )
  const visibleBuildings = useMemo(
    () => BUILDING_LAYOUTS.filter(({ position }) => !isOnRaceTrackBand(position[0], position[2], 1.2)),
    []
  )
  const visibleLamps = useMemo(
    () => LAMP_POSITIONS.filter(([x, , z]) => !isOnRaceTrackBand(x, z, 0.9)),
    []
  )

  useFrame((_, delta) => {
    const shouldRaiseRails = raceStatus.countdownActive || raceStatus.lapActive
    const targetY = shouldRaiseRails ? 0.23 : -0.08
    const liftSpeed = 4.6

    if (outerRailRef.current) {
      outerRailRef.current.position.y += (targetY - outerRailRef.current.position.y) * Math.min(1, delta * liftSpeed)
    }
    if (innerRailRef.current) {
      innerRailRef.current.position.y += (targetY - innerRailRef.current.position.y) * Math.min(1, delta * liftSpeed)
    }
  })

  return (
    <group>
      {/* ── Ground ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#264e26" roughness={0.9} />
      </mesh>

      {/* ── Path underlight ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[WORLD_SIZE, ROAD_WIDTH + 2.8]} />
        <meshStandardMaterial
          color="#3e2f12"
          emissive="#ffbf4d"
          emissiveIntensity={isNight ? 0.22 : 0}
          transparent
          opacity={isNight ? 0.42 : 0}
          roughness={1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[ROAD_WIDTH + 2.8, WORLD_SIZE]} />
        <meshStandardMaterial
          color="#3e2f12"
          emissive="#ffbf4d"
          emissiveIntensity={isNight ? 0.22 : 0}
          transparent
          opacity={isNight ? 0.42 : 0}
          roughness={1}
        />
      </mesh>

      {/* ── Horizontal road ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[WORLD_SIZE, ROAD_WIDTH]} />
        <meshStandardMaterial
          color="#272727"
          roughness={0.85}
          emissive="#3a2a00"
          emissiveIntensity={isNight ? 0.08 : 0}
        />
      </mesh>
      {/* ── Vertical road ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[ROAD_WIDTH, WORLD_SIZE]} />
        <meshStandardMaterial
          color="#272727"
          roughness={0.85}
          emissive="#3a2a00"
          emissiveIntensity={isNight ? 0.08 : 0}
        />
      </mesh>
      {/* ── Road centre lines ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[WORLD_SIZE, 0.14]} />
        <meshStandardMaterial color="#555" roughness={0.8} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.14, WORLD_SIZE]} />
        <meshStandardMaterial color="#555" roughness={0.8} />
      </mesh>

      {/* ── Race lane (tan) ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <shapeGeometry args={[raceLaneShape]} />
        <meshStandardMaterial color="#c7aa76" roughness={0.84} emissive="#9f7f48" emissiveIntensity={isNight ? 0.11 : 0.02} />
      </mesh>

      {/* ── Track borders (anti-cut edges) ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <shapeGeometry args={[trackOuterBorderShape]} />
        <meshStandardMaterial color="#f4f1d0" roughness={0.66} emissive="#ebe2a5" emissiveIntensity={isNight ? 0.1 : 0.025} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <shapeGeometry args={[trackInnerBorderShape]} />
        <meshStandardMaterial color="#f4f1d0" roughness={0.66} emissive="#ebe2a5" emissiveIntensity={isNight ? 0.1 : 0.025} />
      </mesh>

      {/* ── Physical side walls (raise during countdown/lap) ── */}
      <group ref={outerRailRef} position={[0, -0.08, 0]}>
        <mesh castShadow receiveShadow geometry={outerRailGeometry}>
          <meshStandardMaterial color="#e6edf1" roughness={0.48} metalness={0.14} emissive="#d5e2ea" emissiveIntensity={isNight ? 0.05 : 0} />
        </mesh>
      </group>
      <group ref={innerRailRef} position={[0, -0.08, 0]}>
        <mesh castShadow receiveShadow geometry={innerRailGeometry}>
          <meshStandardMaterial color="#e6edf1" roughness={0.48} metalness={0.14} emissive="#d5e2ea" emissiveIntensity={isNight ? 0.05 : 0} />
        </mesh>
      </group>

      {/* ── Start / finish line ── */}
      <group position={[startX, 0.015, startZ]} rotation={[0, startAcrossYaw, 0]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[FINISH_LINE_WIDTH, FINISH_LINE_DEPTH]} />
          <meshStandardMaterial color="#f2f2f2" roughness={0.65} emissive="#f2f2f2" emissiveIntensity={isNight ? 0.15 : 0} />
        </mesh>
        {Array.from({ length: FINISH_CHECKER_COLS * FINISH_CHECKER_ROWS }).map((_, idx) => {
          const cols = FINISH_CHECKER_COLS
          const rows = FINISH_CHECKER_ROWS
          const col = idx % cols
          const row = Math.floor(idx / cols)
          const lineWidth = FINISH_LINE_WIDTH
          const lineDepth = FINISH_LINE_DEPTH
          const tileW = lineWidth / cols
          const tileD = lineDepth / rows
          const x = -lineWidth / 2 + tileW * (col + 0.5)
          const z = -lineDepth / 2 + tileD * (row + 0.5)
          const isDark = (row + col) % 2 === 0

          return (
            <mesh
              key={`finish-checker-${row}-${col}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[x, 0.006, z]}
            >
              <planeGeometry args={[tileW * 0.98, tileD * 0.98]} />
              <meshStandardMaterial color={isDark ? '#0c0c0c' : '#ececec'} roughness={0.72} />
            </mesh>
          )
        })}
      </group>

      {/* ── Floating leaderboard over finish line ── */}
      <group position={[finishBoardPosition[0], finishBoardPosition[1], finishBoardPosition[2]]}>
        <Html billboard center distanceFactor={12}>
          <div
            style={{
              width: '230px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(141, 220, 255, 0.35)',
              background: 'rgba(10, 16, 26, 0.86)',
              boxShadow: '0 0 14px rgba(64, 178, 255, 0.26)',
              fontFamily: "'Press Start 2P', monospace",
              color: '#d9efff',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: '10px', marginBottom: '8px', color: '#a6e7ff' }}>RACE BOARD</div>
            <div style={{ display: 'grid', gap: '6px', fontSize: '9px' }}>
              {topThree.length === 0 && <div>TOP 3: --</div>}
              {topThree.map((entry, i) => (
                <div key={entry.id}>
                  #{i + 1} {entry.name || 'Guest'} - {formatLapTime(entry.ms)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '9px', fontSize: '9px', color: '#fff8bf' }}>
              PB: {formatLapTime(personalBestMs)}
            </div>
          </div>
        </Html>
      </group>

      {/* ── Zone platforms ── */}
      {ZONES.map(z => <ZonePlatform key={z.id} zone={z} />)}

      {/* ── Trees ── */}
      {visibleTrees.map((pos, i) => <Tree key={i} position={pos} />)}

      {/* ── Buildings ── */}
      {visibleBuildings.map((b, i) => <Building key={i} {...b} />)}

      {/* ── Street lamps ── */}
      {visibleLamps.map((pos, i) => <Lamp key={i} position={pos} isNight={isNight} />)}
    </group>
  )
}