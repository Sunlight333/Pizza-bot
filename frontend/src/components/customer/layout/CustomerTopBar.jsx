import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ShoppingBag } from 'lucide-react'

import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'
import NotificationsPanel from '@/components/customer/NotificationsPanel'
import UserMenu from '@/components/customer/UserMenu'

/**
 * Customer-portal header — floating pill design.
 *
 * Centered, contained pill (max-w ~1100px) with backdrop blur and a soft
 * shadow, floating above the page content. Inspired by modern marketing-
 * site headers; reads as a "navigation island" rather than a SaaS chrome
 * bar that runs edge-to-edge.
 *
 * Layout (desktop):
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  🍕 Forno do Bairro   [Cardápio] Pedidos Endereços   🔔 🛒² CT  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Layout (mobile):
 *   ┌──────────────────────────────────────────────┐
 *   │  ◂  🍕 Forno do Bairro            🔔 🛒² CT │
 *   └──────────────────────────────────────────────┘
 *
 * Search lives on the menu page itself (keeps the header clean and
 * matches the reference design which doesn't have inline search).
 */

const NAV = [
  { to: '/cardapio', label: 'Cardápio', end: true },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/conta/enderecos', label: 'Endereços' },
]

export default function CustomerTopBar() {
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

  return (
    // The wrapper holds the pill in place; sticky-top so it stays
    // visible while scrolling. `top-3` gives the pill room to breathe
    // from the top of the viewport.
    <div className="sticky top-3 md:top-4 z-30 px-3 md:px-6">
      <header
        className="mx-auto flex items-center gap-2 h-16 md:h-20 px-3 md:px-5 max-w-5xl"
        style={{
          background: 'rgba(255, 252, 247, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(31, 24, 21, 0.06)',
          borderRadius: '999px',
          boxShadow:
            '0 1px 2px rgba(31,24,21,0.04), 0 12px 32px -12px rgba(31,24,21,0.18)',
        }}
      >
        {/* Logo / back */}
        <div className="flex items-center gap-1 shrink-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full transition-colors hover:bg-[rgba(31,24,21,0.05)]"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
            </button>
          )}
          <Link
            to="/cardapio"
            className="flex items-center gap-2.5 px-2 group"
            style={{ color: 'var(--c-ovenred)' }}
          >
            <span className="text-2xl md:text-3xl">🍕</span>
            <span className="font-display text-lg md:text-xl whitespace-nowrap leading-none group-hover:opacity-80 transition-opacity">
              Forno do Bairro
            </span>
          </Link>
        </div>

        {/* Nav (desktop only). Active route gets the pill background.
            Hidden on mobile — the avatar dropdown carries the same links. */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={!!end}
              className="px-4 h-10 rounded-full text-sm font-medium transition-all flex items-center"
              style={({ isActive }) =>
                isActive
                  ? {
                      background: 'rgba(139,26,26,0.08)',
                      color: 'var(--c-ovenred)',
                      fontWeight: 600,
                    }
                  : {
                      color: 'var(--c-charcoal)',
                      opacity: 0.7,
                    }
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Spacer pushes the right cluster to the edge */}
        <div className="flex-1" />

        {/* Right cluster — notifications + cart + avatar */}
        <div className="flex items-center gap-1 shrink-0">
          {isAuthed && <NotificationsPanel />}

          <Link
            to="/sacola"
            className="relative p-2 rounded-full transition-colors hover:bg-[rgba(31,24,21,0.05)]"
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
      </header>
    </div>
  )
}
