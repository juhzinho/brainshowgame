'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { TVStudio } from './TVStudio'
import { Host3D } from './Host3D'
import { Podiums3D } from './Podiums3D'
import type { Player, HostAnimation } from '@/lib/game-state'

interface GameScene3DProps {
  players: Player[]
  hostAnimation: HostAnimation
  currentPlayerId: string | null
}

export function GameScene3D({ players, hostAnimation, currentPlayerId }: GameScene3DProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        shadows
        camera={{ position: [0, 6, 14], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.5]}
        style={{ pointerEvents: 'none' }}
      >
        <color attach="background" args={['#0a0a1a']} />
        <fog attach="fog" args={['#0a0a1a', 20, 40]} />

        <TVStudio />
        <Host3D animation={hostAnimation} />
        <Podiums3D players={players} currentPlayerId={currentPlayerId} />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          maxAzimuthAngle={Math.PI / 4}
          minAzimuthAngle={-Math.PI / 4}
          target={[0, 2, 0]}
        />
      </Canvas>
    </div>
  )
}
