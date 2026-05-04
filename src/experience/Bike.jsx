import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { bikeState } from './bikeState.js'
import { touchInput } from './inputManager.js'
import { ZONES, ZONE_ENTER_RADIUS } from './worldData.js'
import { useGame } from '../context/GameContext.jsx'

const MAX_SPEED   = 14
const MAX_REV     = 5
const ACCEL       = 22
const DRAG        = 3.0
const BRAKE_FORCE = 45
const TURN_SPEED  = 2.5
const LEAN_MAX    = 0.36
const LEAN_SPEED  = 8
const WORLD_BOUND = 37
const GROUND_Y    = 0.28

export default function Bike() {
  const groupRef      = useRef()
  const frameRef      = useRef()
  const frontWheelRef = useRef()
  const backWheelRef  = useRef()

  const speed    = useRef(0)
  const angle    = useRef(0)
  const lean     = useRef(0)
  const bobTime  = useRef(0)
  const wheelRot = useRef(0)

  const [, getKeys]  = useKeyboardControls()
  const { setNearZone, panelMode, enterZone } = useGame()
  const nearZoneRef    = useRef(null)
  const prevNearZoneId = useRef(null)

  // Zone entry via E / Enter
  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && nearZoneRef.current && !panelMode) {
        enterZone(nearZoneRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelMode, enterZone])

  useFrame((_, delta) => {
    if (panelMode) return
    const dt = Math.min(delta, 0.05)

    const keys = getKeys()
    const fwd  = keys.forward  || touchInput.forward
    const bwd  = keys.backward || touchInput.backward
    const lft  = keys.left     || touchInput.left
    const rgt  = keys.right    || touchInput.right
    const brk  = keys.brake    || touchInput.brake

    // ── Speed ─────────────────────────────────────────
    if (fwd)      speed.current = Math.min(speed.current + ACCEL * dt, MAX_SPEED)
    else if (bwd) speed.current = Math.max(speed.current - ACCEL * dt, -MAX_REV)
    else {
      speed.current *= (1 - DRAG * dt)
      if (Math.abs(speed.current) < 0.02) speed.current = 0
    }
    if (brk) speed.current *= Math.max(0, 1 - BRAKE_FORCE * dt)

    // ── Steering (only when moving) ────────────────────
    if (Math.abs(speed.current) > 0.1) {
      const dir = speed.current > 0 ? 1 : -1
      if (lft) angle.current += TURN_SPEED * dir * dt
      if (rgt) angle.current -= TURN_SPEED * dir * dt
    }

    // ── Lean ──────────────────────────────────────────
    const targetLean = rgt ? -LEAN_MAX : lft ? LEAN_MAX : 0
    lean.current += (targetLean - lean.current) * LEAN_SPEED * dt

    // ── Bob ───────────────────────────────────────────
    let bob = 0
    if (Math.abs(speed.current) > 0.3) {
      bobTime.current += dt * Math.abs(speed.current) * 2.5
      bob = Math.sin(bobTime.current) * 0.05
    } else {
      bob *= 0.9
    }

    // ── Position ──────────────────────────────────────
    const dx = -Math.sin(angle.current) * speed.current * dt
    const dz = -Math.cos(angle.current) * speed.current * dt
    bikeState.position.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, bikeState.position.x + dx))
    bikeState.position.z = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, bikeState.position.z + dz))
    bikeState.angle = angle.current
    bikeState.speed = speed.current

    // ── Wheel spin ────────────────────────────────────
    wheelRot.current += speed.current * dt * 5

    // ── Apply to mesh ─────────────────────────────────
    if (groupRef.current) {
      groupRef.current.position.set(bikeState.position.x, GROUND_Y + bob, bikeState.position.z)
      groupRef.current.rotation.y = angle.current
    }
    if (frameRef.current)      frameRef.current.rotation.z      = lean.current
    if (frontWheelRef.current) frontWheelRef.current.rotation.x = wheelRot.current
    if (backWheelRef.current)  backWheelRef.current.rotation.x  = wheelRot.current

    // ── Zone proximity ────────────────────────────────
    const bx = bikeState.position.x, bz = bikeState.position.z
    let nearest = null, nearestDist = ZONE_ENTER_RADIUS
    for (const z of ZONES) {
      const dist = Math.hypot(bx - z.position[0], bz - z.position[2])
      if (dist < nearestDist) { nearest = z; nearestDist = dist }
    }
    nearZoneRef.current = nearest
    if (nearest?.id !== prevNearZoneId.current) {
      prevNearZoneId.current = nearest?.id ?? null
      setNearZone(nearest)
    }
  })

  const blue   = '#4287f5'
  const silver = '#aaaaaa'
  const dark   = '#111111'
  const navy   = '#1a3a6a'
  const skin   = '#f5d6a8'

  return (
    <group ref={groupRef} position={[0, GROUND_Y, 0]}>
      {/* Lean pivot — frame + rider lean together on turns */}
      <group ref={frameRef}>

        {/* ── Frame ── */}
        {/* Top tube */}
        <mesh castShadow position={[0, 0.20, 0]}>
          <boxGeometry args={[0.08, 0.07, 0.80]} />
          <meshStandardMaterial color={blue} metalness={0.5} roughness={0.25} />
        </mesh>
        {/* Down tube */}
        <mesh castShadow position={[0, 0.06, -0.22]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.36]} />
          <meshStandardMaterial color={blue} metalness={0.5} roughness={0.25} />
        </mesh>
        {/* Seat stay */}
        <mesh castShadow position={[0, 0.12, 0.30]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.30]} />
          <meshStandardMaterial color="#3070d0" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Seat post */}
        <mesh castShadow position={[0, 0.33, 0.24]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
          <meshStandardMaterial color={silver} metalness={0.8} roughness={0.1} />
        </mesh>
        {/* Saddle */}
        <mesh castShadow position={[0, 0.45, 0.22]}>
          <boxGeometry args={[0.14, 0.03, 0.24]} />
          <meshStandardMaterial color={dark} roughness={0.8} />
        </mesh>
        {/* Handlebar stem */}
        <mesh castShadow position={[0, 0.35, -0.36]}>
          <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
          <meshStandardMaterial color={silver} metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Handlebars */}
        <mesh castShadow position={[0, 0.44, -0.36]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
          <meshStandardMaterial color={silver} metalness={0.9} roughness={0.1} />
        </mesh>

        {/* ── Back wheel ── */}
        <group ref={backWheelRef} position={[0, 0, 0.37]}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.045, 8, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
            <meshStandardMaterial color={silver} metalness={0.8} />
          </mesh>
        </group>

        {/* ── Front wheel ── */}
        <group ref={frontWheelRef} position={[0, 0, -0.37]}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.045, 8, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
            <meshStandardMaterial color={silver} metalness={0.8} />
          </mesh>
        </group>

        {/* ── Rider ── */}
        {/* Legs */}
        <mesh castShadow position={[-0.06, 0.38, 0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.26, 0.09]} />
          <meshStandardMaterial color={navy} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.06, 0.38, 0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.26, 0.09]} />
          <meshStandardMaterial color={navy} roughness={0.7} />
        </mesh>
        {/* Torso */}
        <mesh castShadow position={[0, 0.70, 0.06]} rotation={[-0.28, 0, 0]}>
          <boxGeometry args={[0.22, 0.34, 0.18]} />
          <meshStandardMaterial color={navy} roughness={0.6} />
        </mesh>
        {/* Arms reaching to bars */}
        <mesh castShadow position={[0, 0.68, -0.20]} rotation={[0.44, 0, 0]}>
          <boxGeometry args={[0.22, 0.07, 0.28]} />
          <meshStandardMaterial color={navy} roughness={0.6} />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 0.97, -0.02]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {/* Helmet */}
        <mesh castShadow position={[0, 1.03, -0.01]}>
          <sphereGeometry args={[0.148, 12, 8]} />
          <meshStandardMaterial color={blue} roughness={0.4} metalness={0.3} />
        </mesh>

      </group>
    </group>
  )
}