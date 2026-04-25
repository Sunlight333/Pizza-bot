import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import SafeCanvas from './SafeCanvas'

function PizzaMesh() {
  const group = useRef()

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.25
      group.current.rotation.x = Math.sin(Date.now() * 0.0005) * 0.15
    }
  })

  // Base pizza (torus for crust + cylinder for cheese) + some topping spheres
  return (
    <group ref={group}>
      {/* crust */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.18, 24, 64]} />
        <meshStandardMaterial color="#C78A3E" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* cheese base */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.1, 64]} />
        <meshStandardMaterial color="#F5C76A" roughness={0.6} metalness={0} />
      </mesh>

      {/* topping: pepperonis */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const r = 0.9
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r, 0.07, Math.sin(angle) * r]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
            <meshStandardMaterial color="#C0392B" roughness={0.5} />
          </mesh>
        )
      })}

      {/* center topping */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 24]} />
        <meshStandardMaterial color="#C0392B" roughness={0.5} />
      </mesh>
    </group>
  )
}

function FallbackBg() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, rgba(255,107,53,0.35), transparent 60%), radial-gradient(circle at 50% 60%, rgba(255,215,0,0.18), transparent 65%)',
      }}
    />
  )
}

export default function LoginPizza() {
  return (
    <SafeCanvas fallback={<FallbackBg />}>
      <Canvas
        camera={{ position: [0, 1.6, 4], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 4, 3]} intensity={2.2} color="#FF6B35" />
        <pointLight position={[-3, 2, -2]} intensity={1.2} color="#FFD700" />
        <PizzaMesh />
      </Canvas>
    </SafeCanvas>
  )
}
