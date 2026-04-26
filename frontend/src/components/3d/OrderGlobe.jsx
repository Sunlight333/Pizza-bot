import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import SafeCanvas from './SafeCanvas'

function Wireframe() {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.4, 24, 16]} />
      <meshBasicMaterial color="#FF6B35" wireframe transparent opacity={0.35} />
    </mesh>
  )
}

function Dots({ count, intensity }) {
  const positions = useMemo(() => {
    const n = Math.max(count, 6)
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1.45
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#FFD700"
        transparent
        opacity={Math.min(0.35 + intensity * 0.4, 0.95)}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function OrderGlobeFallback({ orderCount }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: 'url(/images/backgrounds/order-globe-poster.png)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(15,15,35,0) 30%, rgba(15,15,35,0.85) 80%)',
        }}
      />
      <div className="text-center relative">
        <div className="font-display text-5xl text-accent drop-shadow">{orderCount || 0}</div>
        <div className="text-xs text-white/60 mt-1 uppercase tracking-wide">pedidos hoje</div>
      </div>
    </div>
  )
}

export default function OrderGlobe({ orderCount = 0, className = '' }) {
  const intensity = Math.min(orderCount / 50, 1)
  return (
    <div className={`relative w-full h-full ${className}`}>
      <SafeCanvas fallback={<OrderGlobeFallback orderCount={orderCount} />}>
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ failIfMajorPerformanceCaveat: false }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[3, 3, 3]} intensity={1.4} color="#FF6B35" />
          <pointLight position={[-3, -2, 1]} intensity={0.8} color="#FFD700" />
          <Wireframe />
          <Dots count={orderCount || 12} intensity={intensity} />
        </Canvas>
      </SafeCanvas>
    </div>
  )
}
