'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Player } from '@/lib/game-state'

interface Podiums3DProps {
  players: Player[]
  currentPlayerId: string | null
}

export function Podiums3D({ players, currentPlayerId }: Podiums3DProps) {
  const positions = useMemo(() => {
    const pos: { x: number; y: number; z: number }[] = []
    const count = players.length
    const frontCount = Math.min(count, 10)
    const backCount = Math.max(0, count - 10)

    for (let i = 0; i < frontCount; i++) {
      const angle = Math.PI * 0.15 + (Math.PI * 0.7 * i) / Math.max(frontCount - 1, 1)
      const radius = 8
      pos.push({
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * 3 + 2,
      })
    }

    for (let i = 0; i < backCount; i++) {
      const angle = Math.PI * 0.2 + (Math.PI * 0.6 * i) / Math.max(backCount - 1, 1)
      const radius = 12
      pos.push({
        x: Math.cos(angle) * radius,
        y: 0.8,
        z: Math.sin(angle) * 2 + 4,
      })
    }

    return pos
  }, [players.length])

  return (
    <group>
      {players.map((player, index) => {
        const pos = positions[index]
        if (!pos) return null
        return (
          <Podium
            key={player.id}
            player={player}
            position={[pos.x, pos.y, pos.z]}
            isCurrentPlayer={player.id === currentPlayerId}
            playerIndex={index}
          />
        )
      })}
    </group>
  )
}

interface PodiumProps {
  player: Player
  position: [number, number, number]
  isCurrentPlayer: boolean
  playerIndex: number
}

function Podium({ player, position, isCurrentPlayer, playerIndex }: PodiumProps) {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const characterRef = useRef<THREE.Group>(null)
  const antennaRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime + playerIndex * 0.5

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15
    }

    if (antennaRef.current) {
      const mat = antennaRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.3
    }

    // Bounce character when correct answer
    if (characterRef.current && player.lastAnswerCorrect) {
      characterRef.current.position.y = 1.1 + Math.abs(Math.sin(t * 5)) * 0.2
      characterRef.current.rotation.y = Math.sin(t * 3) * 0.2
    } else if (characterRef.current) {
      characterRef.current.position.y = 1.1 + Math.sin(t * 1.5) * 0.03
      characterRef.current.rotation.y = 0
    }

    // Shake when eliminated
    if (groupRef.current && player.isEliminated) {
      groupRef.current.rotation.z = Math.sin(t * 10) * 0.02
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Podium base - hexagonal style */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.5, 6]} />
        <meshStandardMaterial
          color={player.isEliminated ? '#222222' : '#0d1117'}
          metalness={0.7}
          roughness={0.15}
          transparent={player.isEliminated}
          opacity={player.isEliminated ? 0.5 : 1}
        />
      </mesh>

      {/* Podium top ring */}
      <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.52, 6]} />
        <meshStandardMaterial
          color={player.isEliminated ? '#333333' : player.color}
          emissive={player.isEliminated ? '#000000' : player.color}
          emissiveIntensity={isCurrentPlayer ? 0.8 : 0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Glow ring */}
      <mesh ref={glowRef} position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.58, 6]} />
        <meshStandardMaterial
          color={player.color}
          emissive={player.color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Mini Robot Character */}
      <group ref={characterRef} position={[0, 1.1, 0]}>
        {/* Robot body */}
        <mesh castShadow>
          <capsuleGeometry args={[0.18, 0.25, 4, 8]} />
          <meshStandardMaterial
            color={player.isEliminated ? '#444444' : player.color}
            metalness={0.5}
            roughness={0.2}
            transparent={player.isEliminated}
            opacity={player.isEliminated ? 0.4 : 1}
          />
        </mesh>

        {/* Chest plate */}
        <mesh position={[0, 0.05, 0.12]}>
          <boxGeometry args={[0.2, 0.15, 0.04]} />
          <meshStandardMaterial color="#0d1117" metalness={0.8} roughness={0.1} />
        </mesh>

        {/* Chest light */}
        <mesh position={[0, 0.05, 0.15]}>
          <circleGeometry args={[0.03, 6]} />
          <meshStandardMaterial
            color={player.isEliminated ? '#333333' : '#ffffff'}
            emissive={player.isEliminated ? '#000000' : player.color}
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Robot Head */}
        <group position={[0, 0.42, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.28, 0.26]} />
            <meshStandardMaterial
              color={player.isEliminated ? '#333333' : '#1a1a2e'}
              metalness={0.6}
              roughness={0.15}
            />
          </mesh>

          {/* Visor */}
          <mesh position={[0, 0.02, 0.135]}>
            <planeGeometry args={[0.24, 0.1]} />
            <meshStandardMaterial
              color={player.isEliminated ? '#222222' : player.color}
              emissive={player.isEliminated ? '#000000' : player.color}
              emissiveIntensity={0.4}
              transparent
              opacity={0.9}
            />
          </mesh>

          {/* Eyes */}
          <mesh position={[-0.05, 0.02, 0.14]}>
            <circleGeometry args={[0.025, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={player.isEliminated ? 0 : 0.8} />
          </mesh>
          <mesh position={[0.05, 0.02, 0.14]}>
            <circleGeometry args={[0.025, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={player.isEliminated ? 0 : 0.8} />
          </mesh>

          {/* Antenna */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
            <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh ref={antennaRef} position={[0, 0.28, 0]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial
              color={player.isEliminated ? '#333333' : player.color}
              emissive={player.isEliminated ? '#000000' : player.color}
              emissiveIntensity={0.4}
            />
          </mesh>

          {/* Ear panels */}
          <mesh position={[-0.18, 0, 0]}>
            <boxGeometry args={[0.04, 0.12, 0.12]} />
            <meshStandardMaterial
              color={player.isEliminated ? '#333333' : player.color}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0.18, 0, 0]}>
            <boxGeometry args={[0.04, 0.12, 0.12]} />
            <meshStandardMaterial
              color={player.isEliminated ? '#333333' : player.color}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* Arms */}
        <mesh position={[-0.25, 0, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.2, 4, 6]} />
          <meshStandardMaterial
            color={player.isEliminated ? '#333333' : player.color}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.25, 0, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.2, 4, 6]} />
          <meshStandardMaterial
            color={player.isEliminated ? '#333333' : player.color}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>

        {/* Hands */}
        <mesh position={[-0.25, -0.18, 0]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.15} />
        </mesh>
        <mesh position={[0.25, -0.18, 0]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.15} />
        </mesh>

        {/* Feet */}
        <mesh position={[-0.08, -0.32, 0.02]}>
          <boxGeometry args={[0.1, 0.06, 0.16]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.08, -0.32, 0.02]}>
          <boxGeometry args={[0.1, 0.06, 0.16]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Current player crown */}
        {isCurrentPlayer && !player.isEliminated && (
          <group position={[0, 0.72, 0]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.14, 0.08, 5]} />
              <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.5} metalness={0.8} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <coneGeometry args={[0.06, 0.08, 5]} />
              <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.6} metalness={0.8} roughness={0.1} />
            </mesh>
          </group>
        )}
      </group>

      {/* Player name */}
      <Text
        position={[0, -0.1, 0.7]}
        fontSize={0.18}
        font="/fonts/Geist-Bold.ttf"
        color={isCurrentPlayer ? '#ffd700' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.2}
      >
        {player.name}
      </Text>

      {/* Score */}
      <Text
        position={[0, -0.3, 0.7]}
        fontSize={0.15}
        font="/fonts/Geist-Regular.ttf"
        color="#4da8da"
        anchorX="center"
        anchorY="middle"
      >
        {`${player.score} pts`}
      </Text>

      {/* Streak indicator */}
      {player.streak >= 2 && !player.isEliminated && (
        <Text
          position={[0.55, 1.3, 0]}
          fontSize={0.16}
          font="/fonts/Geist-Bold.ttf"
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
        >
          {`x${player.streak}`}
        </Text>
      )}

      {/* Point light on podium */}
      {!player.isEliminated && (
        <pointLight
          position={[0, 1.8, 0.5]}
          intensity={isCurrentPlayer ? 1 : 0.3}
          distance={3}
          color={player.color}
        />
      )}
    </group>
  )
}
