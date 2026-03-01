'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { HostAnimation } from '@/lib/game-state'

interface Host3DProps {
  animation: HostAnimation
}

export function Host3D({ animation }: Host3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const mouthRef = useRef<THREE.Mesh>(null)
  const antennaRef = useRef<THREE.Mesh>(null)
  const visorRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (!groupRef.current) return

    // Base idle animation
    groupRef.current.position.y = Math.sin(t * 1.5) * 0.05

    // Antenna glow pulse
    if (antennaRef.current) {
      const mat = antennaRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.3
    }

    // Visor glow
    if (visorRef.current) {
      const mat = visorRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15
    }

    // Head bob
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 2) * 0.05
    }

    // Animation-specific behavior
    switch (animation) {
      case 'idle':
        if (leftArmRef.current) leftArmRef.current.rotation.z = Math.sin(t * 1.2) * 0.1
        if (rightArmRef.current) rightArmRef.current.rotation.z = -Math.sin(t * 1.2) * 0.1
        if (mouthRef.current) mouthRef.current.scale.y = 1
        break

      case 'talk':
        if (leftArmRef.current) leftArmRef.current.rotation.z = Math.sin(t * 3) * 0.15
        if (rightArmRef.current) rightArmRef.current.rotation.z = -Math.sin(t * 2.5) * 0.2
        if (mouthRef.current) mouthRef.current.scale.y = 0.5 + Math.abs(Math.sin(t * 8)) * 1.5
        break

      case 'point':
        if (leftArmRef.current) leftArmRef.current.rotation.z = 0.1
        if (rightArmRef.current) {
          rightArmRef.current.rotation.z = -1.2 + Math.sin(t * 3) * 0.05
          rightArmRef.current.rotation.x = -0.3
        }
        if (mouthRef.current) mouthRef.current.scale.y = 1.2
        break

      case 'celebrate':
        if (leftArmRef.current) {
          leftArmRef.current.rotation.z = 1.5 + Math.sin(t * 6) * 0.3
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.z = -1.5 + Math.sin(t * 6 + 1) * 0.3
        }
        if (headRef.current) {
          headRef.current.rotation.z = Math.sin(t * 4) * 0.15
        }
        if (mouthRef.current) mouthRef.current.scale.y = 1.8
        groupRef.current.position.y = Math.abs(Math.sin(t * 4)) * 0.2
        break

      case 'sad':
        if (leftArmRef.current) leftArmRef.current.rotation.z = -0.2
        if (rightArmRef.current) rightArmRef.current.rotation.z = 0.2
        if (headRef.current) headRef.current.rotation.x = 0.2
        if (mouthRef.current) mouthRef.current.scale.y = 0.5
        groupRef.current.position.y = -0.05
        break
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      {/* Robot Body - torso */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.48, 1.2, 8]} />
        <meshStandardMaterial color="#e94560" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Chest plate */}
      <mesh position={[0, 1.4, 0.2]}>
        <boxGeometry args={[0.5, 0.5, 0.08]} />
        <meshStandardMaterial color="#0d1117" metalness={0.8} roughness={0.1} />
      </mesh>

      {/* Chest light */}
      <mesh position={[0, 1.4, 0.25]}>
        <circleGeometry args={[0.08, 8]} />
        <meshStandardMaterial color="#4da8da" emissive="#4da8da" emissiveIntensity={0.8} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.08, 8]} />
        <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.1} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 2.2, 0]}>
        {/* Robot head - more boxy */}
        <mesh castShadow>
          <boxGeometry args={[0.7, 0.65, 0.6]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.15} />
        </mesh>

        {/* Face plate */}
        <mesh position={[0, -0.02, 0.31]}>
          <planeGeometry args={[0.55, 0.45]} />
          <meshStandardMaterial color="#0d1117" metalness={0.5} roughness={0.2} />
        </mesh>

        {/* Visor */}
        <mesh ref={visorRef} position={[0, 0.05, 0.32]}>
          <planeGeometry args={[0.45, 0.15]} />
          <meshStandardMaterial color="#4da8da" emissive="#4da8da" emissiveIntensity={0.4} transparent opacity={0.9} />
        </mesh>

        {/* Eyes on visor */}
        <mesh position={[-0.1, 0.05, 0.33]}>
          <circleGeometry args={[0.04, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
        </mesh>
        <mesh position={[0.1, 0.05, 0.33]}>
          <circleGeometry args={[0.04, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
        </mesh>

        {/* Mouth LED strip */}
        <mesh ref={mouthRef} position={[0, -0.12, 0.33]}>
          <planeGeometry args={[0.2, 0.04]} />
          <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.6} />
        </mesh>

        {/* Antenna */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.25, 6]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh ref={antennaRef} position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.5} />
        </mesh>

        {/* Ear panels */}
        <mesh position={[-0.37, 0, 0]}>
          <boxGeometry args={[0.06, 0.25, 0.25]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.37, 0, 0]}>
          <boxGeometry args={[0.06, 0.25, 0.25]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Bow tie */}
        <mesh position={[0, -0.4, 0.2]}>
          <boxGeometry args={[0.25, 0.12, 0.08]} />
          <meshStandardMaterial color="#ffd700" metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.6, 1.5, 0]}>
        {/* Upper arm */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.2} />
        </mesh>
        {/* Joint */}
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.8} roughness={0.1} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.6, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.2} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.8, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.15} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.6, 1.5, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.8} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.6, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
          <meshStandardMaterial color="#e94560" metalness={0.5} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.8, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.15} />
        </mesh>
      </group>

      {/* Legs */}
      <mesh position={[-0.18, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0.18, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Robot feet */}
      <mesh position={[-0.18, 0.04, 0.05]}>
        <boxGeometry args={[0.18, 0.08, 0.28]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0.18, 0.04, 0.05]}>
        <boxGeometry args={[0.18, 0.08, 0.28]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Spotlight on host */}
      <pointLight position={[0, 3.5, 1]} intensity={2} distance={6} color="#ffffff" />
    </group>
  )
}
