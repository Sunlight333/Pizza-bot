import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useCart } from '@/stores/cart'
import { brl } from '@/utils/format'

export default function StickyCartBar() {
  const itemCount = useCart(s => s.itemCount())
  const subtotal = useCart(s => s.subtotal())
  if (itemCount === 0) return null
  return (
    <Link
      to="/cart"
      className="fixed left-0 right-0 z-30 md:hidden h-14 bg-ovenred text-offwhite flex items-center justify-between px-5
                 shadow-[0_-8px_24px_-12px_rgba(31,24,21,0.25)] transition-transform"
      style={{ bottom: 'calc(64px + var(--safe-bottom, 0px))' }}
    >
      <span className="text-body-sm font-semibold">
        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        {subtotal > 0 && <span className="opacity-90"> · {brl(subtotal)}</span>}
      </span>
      <span className="flex items-center gap-1 text-body-sm font-semibold">
        Ver sacola <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  )
}
