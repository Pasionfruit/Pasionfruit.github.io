import { Canvas } from '@react-three/fiber'
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

function DayClouds() {
  const cloudClusters = [
    { base: [-28, 28, -35], scale: 1.0 },
    { base: [18, 30, -40], scale: 1.15 },
    { base: [35, 26, -18], scale: 0.9 },
    { base: [-12, 33, -48], scale: 1.25 },
    { base: [4, 27, -22], scale: 0.8 },
  ]

  return (
    <group>
      {cloudClusters.map((cluster, idx) => {
        const [bx, by, bz] = cluster.base
        const s = cluster.scale
        return (
          <group key={idx} position={[bx, by, bz]}>
            {[[-2.8, 0, 0, 2.8], [0, 0.5, 0.6, 3.4], [2.6, 0.1, -0.2, 2.6], [0.8, -0.6, 1.2, 2.2]].map((p, i) => (
              <mesh key={i} position={[p[0] * s, p[1] * s, p[2] * s]}>
                <sphereGeometry args={[p[3] * s, 20, 16]} />
                <meshStandardMaterial
                  color="#f6fbff"
                  transparent
                  opacity={0.78}
                  roughness={0.95}
                  metalness={0}
                  depthWrite={false}
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
