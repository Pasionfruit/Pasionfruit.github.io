import { useRef, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ZONES } from './worldData.js'
import { useGame } from '../context/GameContext.jsx'

const WORLD_SIZE = 80
const ROAD_WIDTH = 7

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

const TREES = [
  [-10, 0, -10], [-8, 0, -15], [-15, 0, -8], [-17, 0, -17], [-6, 0, -19],
  [ 10, 0, -10], [ 8, 0, -15], [ 15, 0, -8], [ 17, 0, -17], [ 6, 0, -19],
  [-10, 0,  10], [-8, 0,  15], [-15, 0,  8], [-17, 0,  17], [-6, 0,  19],
  [ 10, 0,  10], [ 8, 0,  15], [ 15, 0,  8], [ 17, 0,  17], [ 6, 0,  19],
  [-31, 0, -31], [ 31, 0, -31], [-31, 0,  31], [ 31, 0,  31],
  [-31, 0,   0], [ 31, 0,   0], [  0, 0, -31], [  0, 0,  31],
  [-26, 0, -10], [ 26, 0, -10], [-26, 0,  10], [ 26, 0,  10],
]

const BUILDINGS = [
  { position: [-10, 0, -10], size: [3.0, 4.0, 3.0], color: '#1e2e3e' },
  { position: [ 11, 0, -11], size: [2.5, 6.5, 2.5], color: '#2a1e3a' },
  { position: [-10, 0,  10], size: [4.0, 3.0, 3.5], color: '#1e3a2a' },
  { position: [ 10, 0,  11], size: [3.0, 5.0, 3.0], color: '#3a2e1e' },
  { position: [-20, 0,  -1], size: [2.0, 4.5, 2.0], color: '#1e2e3e' },
  { position: [ 20, 0,   1], size: [2.5, 3.5, 2.5], color: '#2a2e3e' },
  { position: [  1, 0, -20], size: [2.0, 5.0, 2.0], color: '#1e2a3e' },
  { position: [ -1, 0,  20], size: [3.0, 3.0, 2.0], color: '#2e3a1e' },
]

function Lamp({ position, isNight }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 4.0, 7]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.6} metalness={0.6} />
      </mesh>
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
      <spotLight
        position={[1.05, 4.05, 0]}
        target-position={[1.05, 0, 0]}
        color="#ffd97a"
        intensity={isNight ? 28 : 0}
        distance={12}
        angle={Math.PI / 5}
        penumbra={0.45}
        decay={2}
        castShadow={false}
      />
    </group>
  )
}

// Lamp positions – pairs on each side of both roads
const LAMPS = [
  // Horizontal road (Z=0) – north side z=-4.5
  [-30, 0, -4.5], [-15, 0, -4.5], [15, 0, -4.5], [30, 0, -4.5],
  // Horizontal road (Z=0) – south side z=+4.5
  [-30, 0,  4.5], [-15, 0,  4.5], [15, 0,  4.5], [30, 0,  4.5],
  // Vertical road (X=0) – west side x=-4.5
  [-4.5, 0, -30], [-4.5, 0, -15], [-4.5, 0, 15], [-4.5, 0, 30],
  // Vertical road (X=0) – east side x=+4.5
  [ 4.5, 0, -30], [ 4.5, 0, -15], [ 4.5, 0, 15], [ 4.5, 0, 30],
]

export default function World() {
  const { isNight } = useGame()
  return (
    <group>
      {/* ── Ground ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#193319" roughness={0.9} />
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

      {/* ── World edge (darker outer ring) ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[37, 42, 4, 1]} />
        <meshStandardMaterial color="#0d1a0d" roughness={1} />
      </mesh>

      {/* ── Zone platforms ── */}
      {ZONES.map(z => <ZonePlatform key={z.id} zone={z} />)}

      {/* ── Trees ── */}
      {TREES.map((pos, i) => <Tree key={i} position={pos} />)}

      {/* ── Buildings ── */}
      {BUILDINGS.map((b, i) => <Building key={i} {...b} />)}

      {/* ── Street lamps ── */}
      {LAMPS.map((pos, i) => <Lamp key={i} position={pos} isNight={isNight} />)}
    </group>
  )
}