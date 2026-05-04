import { Canvas } from '@react-three/fiber'
import { KeyboardControls, Stars } from '@react-three/drei'
import Bike from './Bike.jsx'
import World from './World.jsx'
import FollowCamera from './FollowCamera.jsx'

const KEY_MAP = [
  { name: 'forward',  keys: ['ArrowUp',    'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown',  's', 'S'] },
  { name: 'left',     keys: ['ArrowLeft',  'a', 'A'] },
  { name: 'right',    keys: ['ArrowRight', 'd', 'D'] },
  { name: 'brake',    keys: ['Space'] },
]

export default function Experience() {
  return (
    <KeyboardControls map={KEY_MAP}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 65, near: 0.1, far: 500, position: [0, 6, 8] }}
        gl={{ antialias: true }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <color attach="background" args={['#0d1a0d']} />
        <fog attach="fog" args={['#0d1a0d', 50, 130]} />

        <ambientLight intensity={0.5} color="#b8d4ff" />
        <directionalLight
          position={[25, 35, 20]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-camera-far={150}
          shadow-bias={-0.0005}
        />

        <Stars radius={120} depth={60} count={3000} factor={4} fade speed={0.5} />

        <World />
        <Bike />
        <FollowCamera />
      </Canvas>
    </KeyboardControls>
  )
}
