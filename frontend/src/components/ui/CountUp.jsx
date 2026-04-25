import { useEffect } from 'react'
import { useMotionValue, useTransform, animate } from 'framer-motion'
import { motion } from 'framer-motion'

export default function CountUp({ value, format = (n) => n.toFixed(0), duration = 0.9 }) {
  const motionValue = useMotionValue(0)
  const display = useTransform(motionValue, (n) => format(n))

  useEffect(() => {
    const controls = animate(motionValue, Number(value || 0), {
      duration,
      ease: [0.22, 1, 0.36, 1],
    })
    return controls.stop
  }, [value, duration, motionValue])

  return <motion.span>{display}</motion.span>
}
