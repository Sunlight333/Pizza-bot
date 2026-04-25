import { motion } from 'framer-motion'

const variants = {
  initial: { opacity: 0, y: 16 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -16 },
}

export default function AnimatedPage({ children, className = '' }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={variants}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
