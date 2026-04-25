import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import SafeCanvas from './SafeCanvas'

const COUNT = 220

function Particles() {
  const ref = useRef()

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 0.04
    const arr = ref.current.geometry.attributes.position.array
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += Math.sin(clock.elapsedTime * 0.5 + i) * 0.0015
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#FF8855"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function ParticleBackground({ className = '' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <SafeCanvas>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          gl={{ alpha: true, antialias: true, failIfMajorPerformanceCaveat: false }}
          dpr={[1, 1.5]}
        >
          <Particles />
        </Canvas>
      </SafeCanvas>
    </div>
  )
}
