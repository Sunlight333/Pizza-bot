import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import SafeCanvas from '@/components/3d/SafeCanvas'

function Pizza() {
  const group = useRef()
  const wobble = useRef(0)

  useFrame((_, delta) => {
    wobble.current += delta
    if (group.current) {
      group.current.rotation.y += delta * 0.18
      group.current.rotation.x = Math.sin(wobble.current * 0.6) * 0.18 - 0.25
      group.current.position.y = Math.sin(wobble.current * 1.1) * 0.05
    }
  })

  // Distribute toppings so they don't overlap and don't all sit at the same radius
  const toppings = useMemo(() => {
    const out = []
    let seed = 1
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < 11; i++) {
      const r = 0.45 + rnd() * 0.85
      const a = rnd() * Math.PI * 2
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: 0.18 + rnd() * 0.06,
        rot: rnd() * Math.PI,
      })
    }
    return out
  }, [])

  const basil = useMemo(() => {
    const out = []
    let seed = 7
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < 9; i++) {
      const r = 0.3 + rnd() * 1.0
      const a = rnd() * Math.PI * 2
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        rot: rnd() * Math.PI,
      })
    }
    return out
  }, [])

  return (
    <group ref={group} position={[0, -0.1, 0]} rotation={[-0.25, 0, 0]}>
      {/* outer crust */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[1.62, 0.22, 28, 80]} />
        <meshStandardMaterial color="#C78A3E" roughness={0.85} metalness={0.04} />
      </mesh>

      {/* charred bubbles on the crust */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2
        return (
          <mesh
            key={`char-${i}`}
            position={[Math.cos(a) * 1.62, 0.02, Math.sin(a) * 1.62]}
          >
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#3A1F12" roughness={0.95} />
          </mesh>
        )
      })}

      {/* sauce + cheese base, faintly bumpy via two stacked discs */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[1.55, 1.55, 0.08, 80]} />
        <meshStandardMaterial color="#B83422" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.08, 80]} />
        <meshStandardMaterial color="#F0C36A" roughness={0.55} metalness={0.04} />
      </mesh>

      {/* pepperoni-ish toppings */}
      {toppings.map((t, i) => (
        <mesh
          key={`top-${i}`}
          position={[t.x, 0.11, t.z]}
          rotation={[-Math.PI / 2, 0, t.rot]}
          castShadow
        >
          <cylinderGeometry args={[t.s, t.s, 0.06, 24]} />
          <meshStandardMaterial color="#B92424" roughness={0.6} />
        </mesh>
      ))}

      {/* basil leaves (small flattened cones) */}
      {basil.map((b, i) => (
        <mesh
          key={`basil-${i}`}
          position={[b.x, 0.14, b.z]}
          rotation={[Math.PI / 2, 0, b.rot]}
        >
          <coneGeometry args={[0.07, 0.16, 8]} />
          <meshStandardMaterial color="#2E6B2C" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function FallbackImage() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-center bg-contain bg-no-repeat"
      style={{ backgroundImage: 'url(/images/landing/hero/closeup-desktop.png)' }}
    />
  )
}

export default function HeroPizza3D() {
  return (
    <SafeCanvas fallback={<FallbackImage />}>
      <Canvas
        camera={{ position: [0, 1.6, 4.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        shadows
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#FFE6B5" castShadow />
        <pointLight position={[-3, 2, -2]} intensity={1.4} color="#FF6B35" />
        <pointLight position={[2, 1, 3]} intensity={0.8} color="#FFD700" />
        <Pizza />
      </Canvas>
    </SafeCanvas>
  )
}
