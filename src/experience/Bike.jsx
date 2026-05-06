import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { bikeState } from './bikeState.js'
import { touchInput } from './inputManager.js'
import { ZONES, ZONE_ENTER_RADIUS, COLLISION_OBSTACLES } from './worldData.js'
import { RACE_START_ANGLE, RACE_TRACK_WIDTH, angularDistance, isOnRaceTrackBand, raceTrackDistanceToCenterline, raceTrackRadiusAt, raceTrackPointAt } from './raceTrack.js'
import { useGame } from '../context/GameContext.jsx'

const MAX_SPEED   = 8.6
const MAX_REV     = 5
const ACCEL       = 14
const DRAG        = 3.0
const BRAKE_FORCE = 45
const TURN_SPEED  = 2
const LEAN_MAX    = 0.36
const LEAN_SPEED  = 6
const WORLD_BOUND = 48
const GROUND_Y    = 0.28
const BIKE_RADIUS = 0.5
const COLLISION_EPSILON = 0.001
const COLLISION_PASSES = 4
const ROAD_HALF_WIDTH = 3.8
const BOB_AMPLITUDE_ROAD = 0.012
const BOB_AMPLITUDE_GRASS = 0.05
const BOB_FREQ_ROAD = 1.3
const BOB_FREQ_GRASS = 2.8
const BOB_RESPONSE = 10
const IS_TOUCH_PRIMARY = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const MOBILE_SPEED_MULT = 0.72
const MOBILE_ACCEL_MULT = 0.78
const LAP_MIN_MS = 9000
const LAP_UI_UPDATE_MS = 220
const RACE_GATE_ANGLE_WINDOW = 0.14
const RACE_CHECKPOINT_ANGLE_WINDOW = 0.24
const TRACK_BORDER_PAD = 0.05
const START_TELEPORT_BEHIND = 2.1
const DRIFT_MIN_SPEED = 3.8
const DRIFT_TURN_MULT = 1.8
const DRIFT_LEAN_MULT = 1.4
const DRIFT_RED_CHARGE_MS = 550
const DRIFT_BLUE_CHARGE_MS = 1300
const DRIFT_RED_BOOST = 11
const DRIFT_BLUE_BOOST = 44
const DRIFT_BOOST_TIME = 1.15
const DRIFT_ACTIVE_BOOST = 18
const RACE_CHECKPOINTS = [
  RACE_START_ANGLE,
  0,
  Math.PI / 2,
  Math.PI,
]

function intersectsObstacle(x, z, obstacle) {
  if (obstacle.type === 'circle') {
    return Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + BIKE_RADIUS
  }

  return (
    Math.abs(x - obstacle.x) < obstacle.halfX + BIKE_RADIUS &&
    Math.abs(z - obstacle.z) < obstacle.halfZ + BIKE_RADIUS
  )
}

function hitsObstacle(x, z) {
  return COLLISION_OBSTACLES.some(obstacle => intersectsObstacle(x, z, obstacle))
}

function separationFromObstacle(x, z, obstacle) {
  if (obstacle.type === 'circle') {
    const dx = x - obstacle.x
    const dz = z - obstacle.z
    const dist = Math.hypot(dx, dz)
    const minDist = obstacle.radius + BIKE_RADIUS
    if (dist >= minDist) return null

    if (dist < COLLISION_EPSILON) {
      return { x: minDist + COLLISION_EPSILON, z: 0 }
    }

    const push = minDist - dist + COLLISION_EPSILON
    return { x: (dx / dist) * push, z: (dz / dist) * push }
  }

  const dx = x - obstacle.x
  const dz = z - obstacle.z
  const limitX = obstacle.halfX + BIKE_RADIUS
  const limitZ = obstacle.halfZ + BIKE_RADIUS
  const overlapX = limitX - Math.abs(dx)
  const overlapZ = limitZ - Math.abs(dz)
  if (overlapX <= 0 || overlapZ <= 0) return null

  if (overlapX < overlapZ) {
    return { x: Math.sign(dx || 1) * (overlapX + COLLISION_EPSILON), z: 0 }
  }

  return { x: 0, z: Math.sign(dz || 1) * (overlapZ + COLLISION_EPSILON) }
}

function resolveCollisions(x, z) {
  let rx = x
  let rz = z
  let hit = false

  for (let i = 0; i < COLLISION_PASSES; i += 1) {
    let hadOverlap = false
    for (const obstacle of COLLISION_OBSTACLES) {
      if (isOnRaceTrackBand(obstacle.x, obstacle.z, 1.1)) continue
      const separation = separationFromObstacle(rx, rz, obstacle)
      if (!separation) continue
      hadOverlap = true
      hit = true
      rx += separation.x
      rz += separation.z
      rx = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, rx))
      rz = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, rz))
    }
    if (!hadOverlap) break
  }

  return { x: rx, z: rz, hit }
}

function clampToTrackBorders(x, z) {
  const angle = Math.atan2(z, x)
  const radius = Math.hypot(x, z)
  const centerRadius = raceTrackRadiusAt(angle)
  const minRadius = centerRadius - RACE_TRACK_WIDTH / 2 + TRACK_BORDER_PAD
  const maxRadius = centerRadius + RACE_TRACK_WIDTH / 2 - TRACK_BORDER_PAD
  let nextRadius = radius
  let hit = false

  if (radius < minRadius) {
    nextRadius = minRadius
    hit = true
  } else if (radius > maxRadius) {
    nextRadius = maxRadius
    hit = true
  }

  if (!hit) return { x, z, hit: false }
  return {
    x: Math.cos(angle) * nextRadius,
    z: Math.sin(angle) * nextRadius,
    hit: true,
  }
}

export default function Bike() {
  const groupRef      = useRef()
  const frameRef      = useRef()
  const frontWheelRef = useRef()
  const backWheelRef  = useRef()
  const headlightRef = useRef()
  const headlightTargetRef = useRef()

  const speed    = useRef(0)
  const angle    = useRef(0)
  const lean     = useRef(0)
  const bobTime  = useRef(0)
  const bobOffset = useRef(0)
  const wheelRot = useRef(0)
  const lapActiveRef = useRef(false)
  const lapStartTsRef = useRef(0)
  const checkpointMaskRef = useRef(0)
  const wasInStartGateRef = useRef(false)
  const lastLapUiUpdateRef = useRef(0)
  const prevCountdownActiveRef = useRef(false)
  const driftActiveRef = useRef(false)
  const driftChargeMsRef = useRef(0)
  const driftLevelRef = useRef(0)
  const driftSideRef = useRef(0)
  const driftBoostTimerRef = useRef(0)
  const driftBoostAccelRef = useRef(0)
  const sparkPulseRef = useRef(0)
  const leftSparkRef = useRef()
  const leftSparkTrailRef = useRef()
  const rightSparkRef = useRef()
  const rightSparkTrailRef = useRef()

  const [, getKeys]  = useKeyboardControls()
  const {
    setNearZone,
    panelMode,
    enterZone,
    isNight,
    raceStatus,
    setRaceStartReady,
    requestRaceStart,
    cancelRace,
    updateRaceLap,
    completeRaceLap,
  } = useGame()
  const nearZoneRef    = useRef(null)
  const prevNearZoneId = useRef(null)

  // Zone entry via E / Enter
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !panelMode && (raceStatus.lapActive || raceStatus.countdownActive)) {
        cancelRace()
        return
      }
      if ((e.key === 'Enter') && !panelMode && raceStatus.canStart && !raceStatus.lapActive && !raceStatus.countdownActive) {
        requestRaceStart()
        return
      }
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && nearZoneRef.current && !panelMode) {
        enterZone(nearZoneRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelMode, enterZone, raceStatus.canStart, raceStatus.lapActive, raceStatus.countdownActive, requestRaceStart, cancelRace])

  useEffect(() => {
    if (!headlightRef.current || !headlightTargetRef.current) return
    headlightRef.current.target = headlightTargetRef.current
    headlightRef.current.target.updateMatrixWorld()
  }, [isNight])

  useFrame(() => {
    if (lapActiveRef.current !== raceStatus.lapActive) {
      lapActiveRef.current = raceStatus.lapActive
      if (!raceStatus.lapActive) {
        lapStartTsRef.current = 0
        checkpointMaskRef.current = 0
      }
    }

    const countdownJustStarted = raceStatus.countdownActive && !prevCountdownActiveRef.current
    prevCountdownActiveRef.current = raceStatus.countdownActive

    if (countdownJustStarted) {
      const eps = 0.02
      const [sx, , sz] = raceTrackPointAt(RACE_START_ANGLE, 0)
      const [x1, , z1] = raceTrackPointAt(RACE_START_ANGLE - eps, 0)
      const [x2, , z2] = raceTrackPointAt(RACE_START_ANGLE + eps, 0)
      const txRaw = x2 - x1
      const tzRaw = z2 - z1
      const tLen = Math.hypot(txRaw, tzRaw) || 1
      const tx = txRaw / tLen
      const tz = tzRaw / tLen

      const px = sx - tx * START_TELEPORT_BEHIND
      const pz = sz - tz * START_TELEPORT_BEHIND

      bikeState.position.x = px
      bikeState.position.z = pz
      speed.current = 0
      bikeState.speed = 0
      lean.current = 0
      bobOffset.current = 0
      bobTime.current = 0

      // Face the bike forward along the race direction.
      angle.current = Math.atan2(-tx, -tz)
      bikeState.angle = angle.current

      if (groupRef.current) {
        groupRef.current.position.set(px, GROUND_Y, pz)
        groupRef.current.rotation.y = angle.current
      }
    }
  })

  useFrame((_, delta) => {
    if (panelMode) return
    const dt = Math.min(delta, 0.05)

    if (raceStatus.countdownActive) {
      speed.current = 0
      bikeState.speed = 0
      driftActiveRef.current = false
      driftChargeMsRef.current = 0
      driftLevelRef.current = 0
      driftBoostTimerRef.current = 0
      driftBoostAccelRef.current = 0
      if (groupRef.current) {
        groupRef.current.position.set(bikeState.position.x, GROUND_Y + bobOffset.current, bikeState.position.z)
        groupRef.current.rotation.y = angle.current
      }
      return
    }

    const keys = getKeys()
    const fwd  = keys.forward  || touchInput.forward
    const bwd  = keys.backward || touchInput.backward
    const lft  = keys.left     || touchInput.left
    const rgt  = keys.right    || touchInput.right
    const brk  = keys.brake    || touchInput.brake
    const boostHeld = !IS_TOUCH_PRIMARY && Boolean(keys.boost)
    const speedCap = IS_TOUCH_PRIMARY ? MAX_SPEED * MOBILE_SPEED_MULT : MAX_SPEED
    const revCap = IS_TOUCH_PRIMARY ? MAX_REV * MOBILE_SPEED_MULT : MAX_REV
    const accelRate = IS_TOUCH_PRIMARY ? ACCEL * MOBILE_ACCEL_MULT : ACCEL

    // ── Speed ─────────────────────────────────────────
    if (fwd)      speed.current = Math.min(speed.current + accelRate * dt, speedCap)
    else if (bwd) speed.current = Math.max(speed.current - accelRate * dt, -revCap)
    else {
      speed.current *= (1 - DRAG * dt)
      if (Math.abs(speed.current) < 0.02) speed.current = 0
    }
    if (brk) speed.current *= Math.max(0, 1 - BRAKE_FORCE * dt)
    const steerInput = lft ? 1 : rgt ? -1 : 0
    const speedAbs = Math.abs(speed.current)

    if (driftBoostTimerRef.current > 0 && speed.current > 0) {
      driftBoostTimerRef.current = Math.max(0, driftBoostTimerRef.current - dt)
      speed.current = Math.min(speedCap + 18, speed.current + driftBoostAccelRef.current * dt)
      if (driftBoostTimerRef.current <= 0) driftBoostAccelRef.current = 0
    }

    if (boostHeld && !driftActiveRef.current && speed.current > 0) {
      speed.current = Math.min(speedCap + 15, speed.current + DRIFT_ACTIVE_BOOST * 1.25 * dt)
    }

    if (driftActiveRef.current) {
      const stopDrift = !boostHeld || steerInput === 0 || speedAbs < DRIFT_MIN_SPEED
      if (stopDrift) {
        if (speed.current > 0 && driftLevelRef.current > 0) {
          driftBoostAccelRef.current = driftLevelRef.current >= 2 ? DRIFT_BLUE_BOOST : DRIFT_RED_BOOST
          driftBoostTimerRef.current = DRIFT_BOOST_TIME
        }
        driftActiveRef.current = false
        driftChargeMsRef.current = 0
        driftLevelRef.current = 0
      }
    } else if (boostHeld && steerInput !== 0 && speed.current > DRIFT_MIN_SPEED) {
      driftActiveRef.current = true
      driftChargeMsRef.current = 0
      driftLevelRef.current = 0
      driftSideRef.current = steerInput
    }

    if (driftActiveRef.current) {
      driftChargeMsRef.current += dt * 1000
      if (driftChargeMsRef.current >= DRIFT_BLUE_CHARGE_MS) driftLevelRef.current = 2
      else if (driftChargeMsRef.current >= DRIFT_RED_CHARGE_MS) driftLevelRef.current = 1

      if (speed.current > 0) {
        const chargeFactor = driftLevelRef.current >= 2 ? 1.35 : driftLevelRef.current >= 1 ? 1.15 : 1
        speed.current = Math.min(speedCap + 15.5, speed.current + DRIFT_ACTIVE_BOOST * chargeFactor * dt)
      }
    }

    // ── Steering (only when moving) ────────────────────
    if (Math.abs(speed.current) > 0.1) {
      const dir = speed.current > 0 ? 1 : -1
      const turnRate = TURN_SPEED * (driftActiveRef.current ? DRIFT_TURN_MULT : 1)
      if (lft) angle.current += turnRate * dir * dt
      if (rgt) angle.current -= turnRate * dir * dt
    }

    // ── Lean ──────────────────────────────────────────
    const leanMax = driftActiveRef.current ? LEAN_MAX * DRIFT_LEAN_MULT : LEAN_MAX
    const targetLean = rgt ? -leanMax : lft ? leanMax : 0
    lean.current += (targetLean - lean.current) * LEAN_SPEED * dt

    // ── Position ──────────────────────────────────────
    const dx = -Math.sin(angle.current) * speed.current * dt
    const dz = -Math.cos(angle.current) * speed.current * dt
    const nextX = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, bikeState.position.x + dx))
    const nextZ = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, bikeState.position.z + dz))
    const resolved = resolveCollisions(nextX, nextZ)

    let finalX = resolved.x
    let finalZ = resolved.z
    let borderHit = false
    if (lapActiveRef.current) {
      const clamped = clampToTrackBorders(finalX, finalZ)
      finalX = clamped.x
      finalZ = clamped.z
      borderHit = clamped.hit
    }

    bikeState.position.x = finalX
    bikeState.position.z = finalZ
    if (resolved.hit || borderHit) speed.current *= 0.35

    // ── Perimeter race lap logic ──────────────────────
    const bx = bikeState.position.x
    const bz = bikeState.position.z
    const speedAbsNow = Math.abs(speed.current)
    const nowTs = Date.now()

    const trackAngle = Math.atan2(bz, bx)
    const trackDist = Math.abs(raceTrackDistanceToCenterline(bx, bz))
    const inTrackBand = trackDist <= RACE_TRACK_WIDTH * 0.72

    if (lapActiveRef.current) {
      for (let i = 0; i < RACE_CHECKPOINTS.length; i += 1) {
        if (inTrackBand && angularDistance(trackAngle, RACE_CHECKPOINTS[i]) <= RACE_CHECKPOINT_ANGLE_WINDOW) {
          checkpointMaskRef.current |= (1 << i)
        }
      }
    }

    const inStartGate =
      inTrackBand &&
      angularDistance(trackAngle, RACE_START_ANGLE) <= RACE_GATE_ANGLE_WINDOW

    const canStartRace = inStartGate && !lapActiveRef.current && !raceStatus.countdownActive
    setRaceStartReady(canStartRace)

    if (inStartGate && !wasInStartGateRef.current && speedAbsNow > 2) {
      if (lapActiveRef.current) {
        const lapMs = nowTs - lapStartTsRef.current
        const completedPerimeter = checkpointMaskRef.current === 15
        if (completedPerimeter && lapMs >= LAP_MIN_MS) {
          completeRaceLap(lapMs, nowTs)
          lapActiveRef.current = false
          lapStartTsRef.current = 0
          checkpointMaskRef.current = 0
        }
      }
    }
    wasInStartGateRef.current = inStartGate

    if (lapActiveRef.current) {
      if (!lapStartTsRef.current && raceStatus.lapStartTs) {
        lapStartTsRef.current = raceStatus.lapStartTs
        checkpointMaskRef.current = 1
      }
    }

    if (lapActiveRef.current && lapStartTsRef.current && nowTs - lastLapUiUpdateRef.current >= LAP_UI_UPDATE_MS) {
      lastLapUiUpdateRef.current = nowTs
      updateRaceLap(nowTs - lapStartTsRef.current, checkpointMaskRef.current)
    }

    // ── Terrain-aware bob (smooth on road, bumpier on grass) ─────────────
    const onRoad =
      Math.abs(bikeState.position.x) <= ROAD_HALF_WIDTH ||
      Math.abs(bikeState.position.z) <= ROAD_HALF_WIDTH
    let targetBob = 0
    if (speedAbsNow > 0.2) {
      const freq = onRoad ? BOB_FREQ_ROAD : BOB_FREQ_GRASS
      const amp = onRoad ? BOB_AMPLITUDE_ROAD : BOB_AMPLITUDE_GRASS
      bobTime.current += dt * speedAbsNow * freq
      targetBob = Math.sin(bobTime.current) * amp
    }
    bobOffset.current += (targetBob - bobOffset.current) * Math.min(1, dt * BOB_RESPONSE)

    bikeState.angle = angle.current
    bikeState.speed = speed.current

    // ── Wheel spin ────────────────────────────────────
    wheelRot.current += speed.current * dt * 5

    // ── Apply to mesh ─────────────────────────────────
    if (groupRef.current) {
      groupRef.current.position.set(bikeState.position.x, GROUND_Y + bobOffset.current, bikeState.position.z)
      groupRef.current.rotation.y = angle.current
    }
    if (frameRef.current)      frameRef.current.rotation.z      = lean.current
    if (frontWheelRef.current) frontWheelRef.current.rotation.x = wheelRot.current
    if (backWheelRef.current)  backWheelRef.current.rotation.x  = wheelRot.current
    if (headlightRef.current?.target) headlightRef.current.target.updateMatrixWorld()

    // ── Drift sparks (desktop only) ───────────────────
    const boostSparkActive = boostHeld && speed.current > 1.6 && !IS_TOUCH_PRIMARY
    const sparkActive = (driftActiveRef.current && driftLevelRef.current > 0 && !IS_TOUCH_PRIMARY) || boostSparkActive
    const sparkColor = driftLevelRef.current >= 2 ? '#4ab7ff' : '#ff4a2a'
    const sparkIntensity = driftLevelRef.current >= 2 ? 4.8 : 3.2
    sparkPulseRef.current += dt * 24
    const sparkPulse = 0.85 + Math.sin(sparkPulseRef.current) * 0.2
    const trailPulse = 0.75 + Math.cos(sparkPulseRef.current * 0.7) * 0.15
    const sparkRefs = [leftSparkRef.current, rightSparkRef.current]
    const trailRefs = [leftSparkTrailRef.current, rightSparkTrailRef.current]
    for (const spark of sparkRefs) {
      if (!spark) continue
      spark.visible = sparkActive
      if (!sparkActive) continue
      spark.material.color.set(sparkColor)
      spark.material.emissive.set(sparkColor)
      spark.material.emissiveIntensity = sparkIntensity
      spark.scale.setScalar(sparkPulse)
    }
    for (const trail of trailRefs) {
      if (!trail) continue
      trail.visible = sparkActive
      if (!sparkActive) continue
      trail.material.color.set(sparkColor)
      trail.material.emissive.set(sparkColor)
      trail.material.emissiveIntensity = sparkIntensity * 0.7
      trail.scale.setScalar(trailPulse)
    }

    // ── Zone proximity ────────────────────────────────
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
  const black  = '#111111'
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
        {/* Headlight */}
        <mesh position={[0, 0.32, -0.49]}>
          <cylinderGeometry args={[0.04, 0.05, 0.08, 10]} />
          <meshStandardMaterial
            color="#c8d1dd"
            metalness={0.75}
            roughness={0.2}
            emissive="#fff4c2"
            emissiveIntensity={isNight ? 5.8 : 0}
          />
        </mesh>
        {isNight && (
          <>
            <object3D ref={headlightTargetRef} position={[0, 0.02, -9]} />
            <spotLight
              ref={headlightRef}
              position={[0, 0.32, -0.5]}
              color="#f7f0c8"
              intensity={60}
              distance={45}
              angle={Math.PI / 6}
              penumbra={0.45}
              decay={1.6}
              castShadow={false}
            />
          </>
        )}

        {/* ── Back wheel ── */}
        <group ref={backWheelRef} position={[0, 0, 0.37]}>
          <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.22, 0.045, 8, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
            <meshStandardMaterial color={silver} metalness={0.8} />
          </mesh>
          <mesh ref={leftSparkRef} visible={false} position={[-0.16, 0.02, 0.08]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#ff4a2a" emissive="#ff4a2a" emissiveIntensity={2.5} transparent opacity={0.95} />
          </mesh>
          <mesh ref={rightSparkRef} visible={false} position={[0.16, 0.02, 0.08]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#ff4a2a" emissive="#ff4a2a" emissiveIntensity={2.5} transparent opacity={0.95} />
          </mesh>
          <mesh ref={leftSparkTrailRef} visible={false} position={[-0.19, 0.02, 0.23]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#ff4a2a" emissive="#ff4a2a" emissiveIntensity={2.0} transparent opacity={0.8} />
          </mesh>
          <mesh ref={rightSparkTrailRef} visible={false} position={[0.19, 0.02, 0.23]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#ff4a2a" emissive="#ff4a2a" emissiveIntensity={2.0} transparent opacity={0.8} />
          </mesh>
        </group>

        {/* ── Front wheel ── */}
        <group ref={frontWheelRef} position={[0, 0, -0.37]}>
          <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
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
          <meshStandardMaterial color={black} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.06, 0.38, 0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.26, 0.09]} />
          <meshStandardMaterial color={black} roughness={0.7} />
        </mesh>
        {/* Torso */}
        <mesh castShadow position={[0, 0.70, 0.06]} rotation={[-0.28, 0, 0]}>
          <boxGeometry args={[0.22, 0.34, 0.18]} />
          <meshStandardMaterial color={black} roughness={0.6} />
        </mesh>
        {/* Arms reaching to bars */}
        <mesh castShadow position={[0, 0.68, -0.20]} rotation={[0.44, 0, 0]}>
          <boxGeometry args={[0.22, 0.07, 0.28]} />
          <meshStandardMaterial color={black} roughness={0.6} />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 0.97, -0.02]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {/* Helmet */}
        <mesh castShadow position={[0, 1.03, -0.01]}>
          <sphereGeometry args={[0.148, 12, 8]} />
          <meshStandardMaterial color={black} roughness={0.4} metalness={0.3} />
        </mesh>

      </group>
    </group>
  )
}