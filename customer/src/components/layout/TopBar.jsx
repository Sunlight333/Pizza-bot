import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, ChevronLeft } from 'lucide-react'
import { useCart } from '@/stores/cart'

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCart(s => s.itemCount())

  // Inner pages get a back button (we use history.back so the natural
  // navigation stack — including category jumps — is preserved).
  const showBack =
    location.pathname.startsWith('/menu/') ||
    location.pathname.startsWith('/orders/') ||
    location.pathname.startsWith('/profile/') ||
    location.pathname === '/cart' ||
    location.pathname === '/checkout' ||
    location.pathname.startsWith('/login') ||
    location.pathname === '/register'

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 bg-cream/85 backdrop-blur border-b border-charcoal/8">
      <div className="max-w-6xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 min-w-0">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="-ml-2 p-2 rounded-lg hover:bg-charcoal/5 transition-colors shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5 text-charcoal" />
            </button>
          ) : (
            // Back to the main marketing site (mounted at /, customer at /pedir/)
            <a
              href="/"
              className="-ml-2 p-2 rounded-lg hover:bg-charcoal/5 transition-colors shrink-0"
              aria-label="Voltar ao site"
              title="Voltar ao site"
            >
              <ArrowLeft className="w-5 h-5 text-charcoal/60" />
            </a>
          )}
          <Link to="/menu" className="font-display text-lg md:text-xl text-ovenred truncate">
            Forno do Bairro
          </Link>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/cart"
            className="relative p-2 rounded-lg hover:bg-charcoal/5 transition-colors"
            aria-label="Sacola"
          >
            <ShoppingBag className="w-5 h-5 text-charcoal" />
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
