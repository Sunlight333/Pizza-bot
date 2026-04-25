import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import SafeCanvas from './SafeCanvas'

const TOPPING_COLORS = {
  Calabresa: '#C0392B',
  Portuguesa: '#E67E22',
  Mussarela: '#F5C76A',
  'Frango com Catupiry': '#D8B383',
  'Quatro Queijos': '#F2D27A',
  Margherita: '#27AE60',
  Bacon: '#7C2820',
  Pepperoni: '#A8261B',
  default: '#D8B383',
}

function colorFor(name) {
  return TOPPING_COLORS[name] || TOPPING_COLORS.default
}

function PizzaShape({ flavorA, flavorB }) {
  const group = useRef()
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.3
  })

  const half = !!flavorB
  const colorA = colorFor(flavorA)
  const colorB = colorFor(flavorB)

  return (
    <group ref={group}>
      {/* crust */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.18, 24, 64]} />
        <meshStandardMaterial color="#C78A3E" roughness={0.85} />
      </mesh>

      {/* base — split half if meio-a-meio */}
      {half ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <cylinderGeometry args={[1.55, 1.55, 0.1, 64, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={colorA} roughness={0.6} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <cylinderGeometry args={[1.55, 1.55, 0.1, 64, 1, false, Math.PI, Math.PI]} />
            <meshStandardMaterial color={colorB} roughness={0.6} />
          </mesh>
        </>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.55, 1.55, 0.1, 64]} />
          <meshStandardMaterial color={colorA} roughness={0.6} />
        </mesh>
      )}

      {/* topping dots */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const r = 0.9
        const isLeft = Math.sin(angle) > 0
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r, 0.07, Math.sin(angle) * r]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
            <meshStandardMaterial color={half ? (isLeft ? colorB : colorA) : '#7C2820'} roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

function PizzaFallback({ flavorA, flavorB, height }) {
  return (
    <div className="w-full flex items-center justify-center" style={{ height }}>
      <div className="text-center">
        <div className="text-4xl mb-1">🍕</div>
        <div className="text-sm text-white/60">{flavorA}{flavorB ? ` + ${flavorB}` : ''}</div>
      </div>
    </div>
  )
}

export default function PizzaBuilder({ flavorA, flavorB, className = '', height = 200 }) {
  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <SafeCanvas fallback={<PizzaFallback flavorA={flavorA} flavorB={flavorB} height={height} />}>
        <Canvas
          camera={{ position: [0, 1.6, 4], fov: 42 }}
          dpr={[1, 1.5]}
          gl={{ failIfMajorPerformanceCaveat: false }}
        >
          <ambientLight intensity={0.45} />
          <pointLight position={[3, 4, 3]} intensity={1.8} color="#FF8B55" />
          <pointLight position={[-2, 2, -2]} intensity={0.9} color="#FFD27A" />
          <PizzaShape flavorA={flavorA} flavorB={flavorB} />
        </Canvas>
      </SafeCanvas>
    </div>
  )
}
