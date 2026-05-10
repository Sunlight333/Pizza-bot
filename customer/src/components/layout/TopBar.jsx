import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowLeft } from 'lucide-react'
import { useCart } from '@/stores/cart'

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCart(s => s.itemCount())

  // Show back button on detail / inner pages
  const showBack = ['/menu/', '/orders/', '/profile/', '/cart', '/login'].some(p =>
    location.pathname.startsWith(p) && location.pathname !== '/menu',
  )

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 bg-offwhite/85 backdrop-blur border-b border-slateLine/60">
      <div className="max-w-6xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2" aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}
          <Link to="/" className="font-display text-xl md:text-2xl text-ovenred italic">
            Pizzaria
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cart" className="relative btn-ghost p-2" aria-label="Sacola">
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-ovenred
                               text-offwhite text-[10px] font-bold flex items-center justify-center px-1">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
