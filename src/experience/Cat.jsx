import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bikeState } from './bikeState.js'

export default function Cat({ colorType = 'black', side = 'left', index = 0 }) {
  const groupRef = useRef()
  const headRef = useRef()
  const legFLRef = useRef()
  const legFRRef = useRef()
  const legBLRef = useRef()
  const legBRRef = useRef()
  const velocityRef = useRef({ x: 0, z: 0 })
  const timeRef = useRef(0)

  // Determine cat colors
  const bodyColor = colorType === 'black' ? '#1a1a1a' : '#1a1a1a'
  const faceColor = colorType === 'black' ? '#1a1a1a' : '#ffffff'
  const eyeColor = '#ffffff'
  const noseMouthColor = colorType === 'black' ? '#ff99cc' : '#ff99cc'

  // Chase parameters - increased speed
  const maxChaseSpeed = 14
  const acceleration = 18
  const damping = 8
  const desiredDistance = 3.5
  // Stagger cats on the same side
  const depthOffset = index * 1.5

  useFrame((_, delta) => {
    if (!groupRef.current) return

    timeRef.current += delta

    const bikeX = bikeState.position.x
    const bikeZ = bikeState.position.z
    const bikeY = bikeState.position.y || 0
    const bikeAngle = bikeState.angle

    // Calculate offset to the side (left or right)
    const sideOffset = side === 'left' ? -2.5 : 2.5
    const targetX = bikeX + Math.cos(bikeAngle) * sideOffset - Math.sin(bikeAngle) * (desiredDistance + depthOffset)
    const targetZ = bikeZ + Math.sin(bikeAngle) * sideOffset - Math.cos(bikeAngle) * (desiredDistance + depthOffset)
    const targetY = bikeY

    // Current position
    const catX = groupRef.current.position.x
    const catZ = groupRef.current.position.z
    const catY = groupRef.current.position.y

    // Direction to bike
    const dx = targetX - catX
    const dz = targetZ - catZ
    const distance = Math.sqrt(dx * dx + dz * dz)

    // Chase towards bike with velocity-based movement
    if (distance > 0.1) {
      const dirX = dx / distance
      const dirZ = dz / distance

      // Accelerate toward target
      velocityRef.current.x += dirX * acceleration * delta
      velocityRef.current.z += dirZ * acceleration * delta

      // Limit speed
      const speed = Math.sqrt(velocityRef.current.x ** 2 + velocityRef.current.z ** 2)
      if (speed > maxChaseSpeed) {
        velocityRef.current.x = (velocityRef.current.x / speed) * maxChaseSpeed
        velocityRef.current.z = (velocityRef.current.z / speed) * maxChaseSpeed
      }

      // Apply damping
      velocityRef.current.x *= Math.exp(-damping * delta)
      velocityRef.current.z *= Math.exp(-damping * delta)
    } else {
      // Slow down when near target
      velocityRef.current.x *= Math.exp(-damping * delta * 2)
      velocityRef.current.z *= Math.exp(-damping * delta * 2)
    }

    // Update position
    groupRef.current.position.x += velocityRef.current.x * delta
    groupRef.current.position.z += velocityRef.current.z * delta
    groupRef.current.position.y += (targetY - catY) * 0.1

    // Face toward the bike
    const faceDx = bikeX - groupRef.current.position.x
    const faceDz = bikeZ - groupRef.current.position.z
    groupRef.current.rotation.y = Math.atan2(faceDx, faceDz)

    // Animate walking legs (quadruped gait)
    const speed = Math.sqrt(velocityRef.current.x ** 2 + velocityRef.current.z ** 2)
    const walkCycle = timeRef.current * speed * 3

    if (legFLRef.current) {
      legFLRef.current.position.y = Math.sin(walkCycle) * 0.15 - 0.1
    }
    if (legFRRef.current) {
      legFRRef.current.position.y = Math.sin(walkCycle + Math.PI) * 0.15 - 0.1
    }
    if (legBLRef.current) {
      legBLRef.current.position.y = Math.sin(walkCycle + Math.PI) * 0.15 - 0.1
    }
    if (legBRRef.current) {
      legBRRef.current.position.y = Math.sin(walkCycle) * 0.15 - 0.1
    }

    // Small head bob while moving
    if (headRef.current) {
      headRef.current.position.y = Math.sin(timeRef.current * speed * 2) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.28, 0]}>
      {/* Rounded Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0.35, 0.45]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={faceColor} />
      </mesh>

      {/* Ears */}
      <group position={[-0.25, 0.7, 0.45]}>
        <mesh>
          <coneGeometry args={[0.12, 0.3, 8]} />
          <meshStandardMaterial color={faceColor} />
        </mesh>
      </group>

      <group position={[0.25, 0.7, 0.45]}>
        <mesh>
          <coneGeometry args={[0.12, 0.3, 8]} />
          <meshStandardMaterial color={faceColor} />
        </mesh>
      </group>

      {/* Eyes */}
      <mesh position={[-0.15, 0.48, 0.75]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={eyeColor}
          emissive={eyeColor}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Left Pupil */}
      <mesh position={[-0.15, 0.48, 0.82]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      <mesh position={[0.15, 0.48, 0.75]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={eyeColor}
          emissive={eyeColor}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Right Pupil */}
      <mesh position={[0.15, 0.48, 0.82]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0.35, 0.8]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color={noseMouthColor} />
      </mesh>

      {/* Tail */}
      <mesh position={[0, 0.15, -0.65]}>
        <boxGeometry args={[0.1, 0.1, 0.6]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Front left leg */}
      <group ref={legFLRef} position={[-0.25, -0.1, 0.25]}>
        <mesh>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      </group>

      {/* Front right leg */}
      <group ref={legFRRef} position={[0.25, -0.1, 0.25]}>
        <mesh>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      </group>

      {/* Back left leg */}
      <group ref={legBLRef} position={[-0.25, -0.1, -0.25]}>
        <mesh>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      </group>

      {/* Back right leg */}
      <group ref={legBRRef} position={[0.25, -0.1, -0.25]}>
        <mesh>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      </group>
    </group>
  )
}

