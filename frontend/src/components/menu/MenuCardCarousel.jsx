import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { resolveMediaUrl } from '@/utils/apiUrl'
import { ASSETS } from '@/utils/assets'

/**
 * Auto-rotating image strip used by the menu card. Cycles through every
 * registered photo of a product so the operator (and any future customer-
 * facing surface) sees the full set, not just the primary.
 *
 * - intervalMs is the dwell time per photo.
 * - The first transition is randomly delayed inside [0, intervalMs] so a
 *   page full of cards doesn't fade in lockstep, which would feel mechanical.
 * - mode="wait" on AnimatePresence ensures the outgoing image is fully gone
 *   before the next one fades in — this avoids two layers of object-cover
 *   fighting for the same box during the crossfade.
 * - urls of length 0 or 1 short-circuits the timer and renders a static
 *   image, so we don't burn intervals on cards that don't need them.
 */
export default function MenuCardCarousel({
  urls,
  fallbackSrc,
  alt = '',
  intervalMs = 3500,
}) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!urls || urls.length <= 1) return
    let intervalId
    // Random head-start so neighbouring cards never tick on the same frame.
    const initialDelay = Math.floor(Math.random() * intervalMs)
    const startTimer = setTimeout(() => {
      setIdx((i) => (i + 1) % urls.length)
      intervalId = setInterval(() => {
        setIdx((i) => (i + 1) % urls.length)
      }, intervalMs)
    }, initialDelay)
    return () => {
      clearTimeout(startTimer)
      if (intervalId) clearInterval(intervalId)
    }
  }, [urls, intervalMs])

  // Reset to first frame whenever the gallery itself changes (e.g. operator
  // edited photos in another tab and React Query invalidated the cache).
  useEffect(() => {
    setIdx(0)
  }, [urls?.length, urls?.[0]])

  const list = urls || []
  if (list.length === 0) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.dataset.fallback === '1') return
          e.currentTarget.dataset.fallback = '1'
          e.currentTarget.src = ASSETS.menu.productPlaceholder
        }}
        className="w-full h-full object-cover"
      />
    )
  }

  const current = list[Math.min(idx, list.length - 1)] || fallbackSrc
  const src = resolveMediaUrl(current) || fallbackSrc

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.img
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.dataset.fallback === '1') return
          e.currentTarget.dataset.fallback = '1'
          e.currentTarget.src = ASSETS.menu.productPlaceholder
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </AnimatePresence>
  )
}
