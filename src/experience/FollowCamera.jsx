import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bikeState } from './bikeState.js'

const _idealPos = new THREE.Vector3()
const _lookAt   = new THREE.Vector3()

const CAM_DIST   = 7
const CAM_HEIGHT = 4.5
const CAM_LERP   = 5

export default function FollowCamera() {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const { position: p, angle } = bikeState

    // Ideal camera position: directly behind the bike
    _idealPos.set(
      p.x + Math.sin(angle) * CAM_DIST,
      CAM_HEIGHT,
      p.z + Math.cos(angle) * CAM_DIST
    )

    state.camera.position.lerp(_idealPos, CAM_LERP * dt)

    // Look slightly ahead of the bike
    _lookAt.set(
      p.x - Math.sin(angle) * 2,
      0.6,
      p.z - Math.cos(angle) * 2
    )
    state.camera.lookAt(_lookAt)
  })

  return null
}