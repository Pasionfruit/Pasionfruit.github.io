import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { KeyboardControls, Stars } from '@react-three/drei'
import Bike from './Bike.jsx'
import World from './World.jsx'
import FollowCamera from './FollowCamera.jsx'
import { useGame } from '../context/GameContext.jsx'

const KEY_MAP = [
  { name: 'forward',  keys: ['ArrowUp',    'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown',  's', 'S'] },
  { name: 'left',     keys: ['ArrowLeft',  'a', 'A'] },
  { name: 'right',    keys: ['ArrowRight', 'd', 'D'] },
  { name: 'brake',    keys: ['Space'] },
]

const CLOUD_CLUSTERS = [
  { base: [-42, 12, -24], scale: 1.05, speed: 0.85 },
  { base: [-8,  13, -34], scale: 1.2,  speed: 0.65 },
  { base: [24,  11, -12], scale: 0.95, speed: 0.9 },
  { base: [46,  14, -26], scale: 1.1,  speed: 0.7 },
  { base: [12,  15, -44], scale: 1.35, speed: 0.6 },
]

function DayClouds() {
  const cloudRefs = useRef([])

  useFrame((_, delta) => {
    for (let i = 0; i < cloudRefs.current.length; i += 1) {
      const cloud = cloudRefs.current[i]
      if (!cloud) continue
      const speed = CLOUD_CLUSTERS[i].speed
      cloud.position.x += speed * delta
      if (cloud.position.x > 58) cloud.position.x = -58
    }
  })

  return (
    <group>
      {CLOUD_CLUSTERS.map((cluster, idx) => {
        const [bx, by, bz] = cluster.base
        const s = cluster.scale
        return (
          <group
            key={idx}
            ref={el => { cloudRefs.current[idx] = el }}
            position={[bx, by, bz]}
          >
            {[[-3.2, 0.1, 0, 3.2], [-0.2, 0.9, 0.5, 3.8], [3.0, 0.2, -0.2, 3.0], [1.0, -0.8, 1.0, 2.5]].map((p, i) => (
              <mesh key={i} position={[p[0] * s, p[1] * s, p[2] * s]}>
                <sphereGeometry args={[p[3] * s, 22, 16]} />
                <meshStandardMaterial
                  color="#f9fdff"
                  transparent
                  opacity={0.9}
                  roughness={0.9}
                  metalness={0}
                  emissive="#dbeeff"
                  emissiveIntensity={0.12}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

export default function Experience() {
  const { isNight } = useGame()

  const skyColor = isNight ? '#060b1a' : '#86b7d8'
  const fogColor = isNight ? '#0a1020' : '#7faecf'

  return (
    <KeyboardControls map={KEY_MAP}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 65, near: 0.1, far: 500, position: [0, 6, 8] }}
        gl={{ antialias: true }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <color attach="background" args={[skyColor]} />
        <fog attach="fog" args={[fogColor, 50, isNight ? 110 : 130]} />

        <ambientLight intensity={isNight ? 0.4 : 0.55} color={isNight ? '#8aa4ff' : '#dff2ff'} />
        <hemisphereLight
          intensity={isNight ? 0.5 : 0.45}
          color={isNight ? '#5b74c9' : '#bde7ff'}
          groundColor={isNight ? '#09130f' : '#476248'}
        />
        <directionalLight
          position={[25, 35, 20]}
          intensity={isNight ? 0.55 : 1.3}
          color={isNight ? '#a8bbff' : '#fff2c2'}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-camera-far={150}
          shadow-bias={-0.0005}
        />

        {isNight && <Stars radius={120} depth={60} count={3000} factor={4} fade speed={0.5} />}
        {!isNight && <DayClouds />}

        {/* Moon */}
        {isNight && (
          <>
            <spotLight
              position={[55, 50, -70]}
              target-position={[0, 0, 0]}
              color="#c8d6ff"
              intensity={130}
              distance={280}
              angle={Math.PI / 3.2}
              penumbra={0.55}
              decay={1.4}
              castShadow={false}
            />
            <mesh position={[55, 50, -70]}>
              <sphereGeometry args={[6, 20, 20]} />
              <meshStandardMaterial
                color="#d8dcc8"
                emissive="#b0ba90"
                emissiveIntensity={100.6}
                roughness={1}
              />
            </mesh>
          </>
        )}

        <World />
        <Bike />
        <FollowCamera />
      </Canvas>
    </KeyboardControls>
  )
}
