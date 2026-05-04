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
        <fog attach="fog" args={[fogColor, 50, 130]} />

        <ambientLight intensity={isNight ? 0.2 : 0.55} color={isNight ? '#8aa4ff' : '#dff2ff'} />
        <hemisphereLight
          intensity={isNight ? 0.1 : 0.45}
          color={isNight ? '#5b74c9' : '#bde7ff'}
          groundColor={isNight ? '#09130f' : '#476248'}
        />
        <directionalLight
          position={[25, 35, 20]}
          intensity={isNight ? 0.35 : 1.3}
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

        <World />
        <Bike />
        <FollowCamera />
      </Canvas>
    </KeyboardControls>
  )
}
