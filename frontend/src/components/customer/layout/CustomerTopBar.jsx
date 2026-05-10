import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu as MenuIcon, ChevronLeft, ShoppingBag } from 'lucide-react'

import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'
import NotificationsPanel from '@/components/customer/NotificationsPanel'
import UserMenu from '@/components/customer/UserMenu'

const PAGE_TITLES = {
  '/cardapio': 'Cardápio',
  '/sacola': 'Sua sacola',
  '/checkout': 'Finalizar pedido',
  '/pedidos': 'Meus pedidos',
  '/conta': 'Minha conta',
  '/conta/enderecos': 'Endereços',
  '/login': 'Entrar',
  '/register': 'Criar cadastro',
  '/login/verify': 'Confirmar código',
}

function pageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/produto/')) return 'Detalhes do produto'
  if (pathname.startsWith('/pedidos/')) return 'Pedido'
  return ''
}

/**
 * Customer-portal header.
 *
 * Layout:
 *   [hamburger (mobile only)] [page title]              [bell] [cart] [avatar]
 *
 * Notifications + UserMenu only render for authenticated users —
 * unauthed users see an "Entrar" link in the avatar slot (provided by
 * UserMenu's branch).
 */
export default function CustomerTopBar({ onToggleSidebar }) {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCustomerCart((s) => s.itemCount())
  const status = useCustomerAuth((s) => s.status)
  const isAuthed = status === 'authenticated'

  const showBack =
    location.pathname.startsWith('/produto/') ||
    location.pathname.startsWith('/pedidos/') ||
    location.pathname === '/checkout' ||
    location.pathname === '/conta/enderecos' ||
    location.pathname === '/login/verify'

  const title = pageTitle(location.pathname)

  return (
    <header
      className="sticky top-0 z-20 h-14 md:h-16 backdrop-blur"
      style={{
        background: 'rgba(248,241,228,0.85)',
        borderBottom: '1px solid rgba(31,24,21,0.08)',
      }}
    >
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile hamburger */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
            aria-label="Abrir menu"
          >
            <MenuIcon className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
          </button>

          {/* Back button on inner pages (replaces title slot) */}
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
            </button>
          )}

          {/* Page title (or brand on /cardapio) */}
          <Link
            to="/cardapio"
            className="font-display text-lg md:text-xl truncate"
            style={{ color: 'var(--c-charcoal)' }}
          >
            {title || 'Forno do Bairro'}
          </Link>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isAuthed && <NotificationsPanel />}
          {/* Cart icon — always visible for quick access */}
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
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
