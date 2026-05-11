import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useCustomerCart } from '@/stores/customerCart'
import { brl } from '@/utils/customer/format'

export default function CustomerStickyCartBar() {
  const itemCount = useCustomerCart((s) => s.itemCount())
  const subtotal = useCustomerCart((s) => s.subtotal())
  if (itemCount === 0) return null
  return (
    <Link
      to="/sacola"
      className="fixed left-0 right-0 z-30 h-14 flex items-center justify-between px-5 transition-transform"
      style={{
        bottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--c-ovenred)',
        color: 'var(--c-offwhite)',
        boxShadow: '0 -8px 24px -12px rgba(31,24,21,0.25)',
      }}
    >
      <span className="text-[13px] font-semibold">
        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        {subtotal > 0 && <span className="opacity-90"> · {brl(subtotal)}</span>}
      </span>
      <span className="flex items-center gap-1 text-[13px] font-semibold">
        Ver sacola <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  )
}
