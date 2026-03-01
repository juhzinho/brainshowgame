'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

export function TVStudio() {
  return (
    <group>
      {/* Stage Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Floor accent ring - outer */}
      <NeonRing position={[0, 0.02, 0]} innerRadius={16} outerRadius={18} color="#e94560" />

      {/* Floor accent ring - middle */}
      <NeonRing position={[0, 0.02, 0]} innerRadius={10} outerRadius={10.3} color="#4da8da" />

      {/* Floor accent ring - inner */}
      <NeonRing position={[0, 0.03, 0]} innerRadius={5} outerRadius={5.3} color="#0f3460" />

      {/* Back Wall */}
      <mesh position={[0, 5, -10]} receiveShadow>
        <boxGeometry args={[40, 12, 0.5]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      {/* LED strips on back wall */}
      <NeonStrip position={[0, 10.5, -9.7]} width={38} color="#e94560" />
      <NeonStrip position={[0, 1, -9.7]} width={38} color="#4da8da" />
      <NeonStrip position={[-19.5, 5, -9.7]} width={0.2} height={9} color="#e94560" />
      <NeonStrip position={[19.5, 5, -9.7]} width={0.2} height={9} color="#e94560" />

      {/* Side walls */}
      <mesh position={[-20, 5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[22, 12, 0.3]} />
        <meshStandardMaterial color="#0f3460" />
      </mesh>
      <mesh position={[20, 5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[22, 12, 0.3]} />
        <meshStandardMaterial color="#0f3460" />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 10.5, 0]}>
        <boxGeometry args={[40, 0.5, 22]} />
        <meshStandardMaterial color="#0a0a1a" />
      </mesh>

      {/* Logo */}
      <BrainShowLogo />

      {/* Studio Lights */}
      <StudioLights />

      {/* Decorative pillars */}
      <Pillar position={[-18, 0, -8]} />
      <Pillar position={[18, 0, -8]} />
      <Pillar position={[-18, 0, 5]} />
      <Pillar position={[18, 0, 5]} />

      {/* Stage edge glow strips */}
      <GlowStrip position={[-12, 0.05, -9]} width={24} />
      <GlowStrip position={[-12, 0.05, 8]} width={24} />
    </group>
  )
}

function NeonRing({ position, innerRadius, outerRadius, color }: {
  position: [number, number, number]
  innerRadius: number
  outerRadius: number
  color: string
}) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2
    }
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <ringGeometry args={[innerRadius, outerRadius, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  )
}

function NeonStrip({ position, width, height = 0.08, color }: {
  position: [number, number, number]
  width: number
  height?: number
  color: string
}) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3
    }
  })

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[width, height, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  )
}

function BrainShowLogo() {
  const groupRef = useRef<THREE.Group>(null)
  const backdropRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = 8.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
    if (backdropRef.current) {
      const mat = backdropRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 1.2) * 0.15
    }
  })

  return (
    <group ref={groupRef} position={[0, 8.5, -9.5]}>
      <mesh ref={backdropRef}>
        <boxGeometry args={[12, 2.5, 0.3]} />
        <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.4} />
      </mesh>
      <Text
        position={[0, 0, 0.2]}
        fontSize={1.4}
        font="/fonts/Geist-Bold.ttf"
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        BRAIN SHOW
      </Text>
    </group>
  )
}

function StudioLights() {
  const light1Ref = useRef<THREE.SpotLight>(null)
  const light2Ref = useRef<THREE.SpotLight>(null)
  const light3Ref = useRef<THREE.SpotLight>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (light1Ref.current) {
      light1Ref.current.intensity = 15 + Math.sin(t * 1.2) * 3
    }
    if (light2Ref.current) {
      light2Ref.current.intensity = 15 + Math.sin(t * 0.8 + 1) * 3
    }
    if (light3Ref.current) {
      light3Ref.current.intensity = 12 + Math.sin(t * 1.5 + 2) * 2
    }
  })

  return (
    <>
      <spotLight
        ref={light1Ref}
        position={[0, 10, 2]}
        angle={0.4}
        penumbra={0.5}
        intensity={15}
        color="#ffffff"
        castShadow
        target-position={[0, 0, 0]}
      />
      <spotLight
        ref={light2Ref}
        position={[-10, 10, -3]}
        angle={0.5}
        penumbra={0.6}
        intensity={15}
        color="#4da8da"
        target-position={[0, 0, 2]}
      />
      <spotLight
        ref={light3Ref}
        position={[10, 10, -3]}
        angle={0.5}
        penumbra={0.6}
        intensity={12}
        color="#e94560"
        target-position={[0, 0, 2]}
      />
      <pointLight position={[0, 6, 10]} intensity={3} color="#ffd700" />
      <ambientLight intensity={0.3} color="#16213e" />
      <LightFixture position={[0, 10.2, 2]} />
      <LightFixture position={[-10, 10.2, -3]} />
      <LightFixture position={[10, 10.2, -3]} />
    </>
  )
}

function LightFixture({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.5, 0.4, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

function Pillar({ position }: { position: [number, number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.3
    }
  })

  return (
    <group position={position}>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 10, 8]} />
        <meshStandardMaterial color="#0f3460" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={ringRef} position={[0, 2, 0]}>
        <torusGeometry args={[0.5, 0.05, 8, 16]} />
        <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <torusGeometry args={[0.5, 0.05, 8, 16]} />
        <meshStandardMaterial color="#4da8da" emissive="#4da8da" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

function GlowStrip({ position, width }: { position: [number, number, number]; width: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 1.8) * 0.3
    }
  })

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[width, 0.05, 0.15]} />
      <meshStandardMaterial color="#4da8da" emissive="#4da8da" emissiveIntensity={0.8} />
    </mesh>
  )
}
