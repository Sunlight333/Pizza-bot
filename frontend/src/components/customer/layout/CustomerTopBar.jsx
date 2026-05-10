import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, ChevronLeft, ArrowLeft } from 'lucide-react'
import { useCustomerCart } from '@/stores/customerCart'

const ROOT = '/cardapio'

export default function CustomerTopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCustomerCart((s) => s.itemCount())

  const showBack =
    location.pathname.startsWith('/produto/') ||
    location.pathname.startsWith('/pedidos/') ||
    location.pathname === '/sacola' ||
    location.pathname === '/checkout' ||
    location.pathname.startsWith('/conta') ||
    location.pathname.startsWith('/login') ||
    location.pathname === '/register'

  return (
    <header
      className="sticky top-0 z-30 h-14 md:h-16 backdrop-blur"
      style={{
        background: 'rgba(248,241,228,0.85)',
        borderBottom: '1px solid rgba(31,24,21,0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 min-w-0">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="-ml-2 p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)] shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
            </button>
          ) : (
            <Link
              to="/"
              className="-ml-2 p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)] shrink-0"
              aria-label="Voltar ao site"
              title="Voltar ao site"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'rgba(31,24,21,0.55)' }} />
            </Link>
          )}
          <Link
            to={ROOT}
            className="font-display text-lg md:text-xl truncate"
            style={{ color: 'var(--c-ovenred)' }}
          >
            Forno do Bairro
          </Link>
        </div>
        <Link
          to="/sacola"
          className="relative p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
          aria-label="Sacola"
        >
          <ShoppingBag className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
          {itemCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              style={{ background: 'var(--c-ovenred)', color: 'var(--c-offwhite)' }}
            >
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
