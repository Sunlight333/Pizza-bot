import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, ChevronLeft, X } from 'lucide-react'

import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'
import NotificationsPanel from '@/components/customer/NotificationsPanel'
import UserMenu from '@/components/customer/UserMenu'

/**
 * Customer-portal header — modern e-commerce style (think iFood / Uber
 * Eats). No sidebar; everything sits in this top bar.
 *
 * Layout (desktop):
 *   [logo] [search field — wide]                [bell] [cart] [avatar]
 *
 * Layout (mobile):
 *   [back/logo] [search icon]                   [bell] [cart] [avatar]
 *   ─ search opens an inline expanded field on mobile when tapped
 *
 * Sub-row (desktop only): horizontal category nav driven by route — for
 * now just renders breadcrumb-style page titles, but it's the place to
 * grow into category links once the operator wants them.
 */
export default function CustomerTopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCustomerCart((s) => s.itemCount())
  const status = useCustomerAuth((s) => s.status)
  const isAuthed = status === 'authenticated'
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')

  const showBack =
    location.pathname.startsWith('/produto/') ||
    location.pathname.startsWith('/pedidos/') ||
    location.pathname === '/checkout' ||
    location.pathname === '/conta/enderecos' ||
    location.pathname === '/login/verify'

  function submitSearch(e) {
    e?.preventDefault()
    const q = search.trim()
    if (!q) return
    navigate(`/cardapio?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
  }

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        background: 'rgba(248,241,228,0.92)',
        borderBottom: '1px solid rgba(31,24,21,0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto h-14 md:h-16 px-3 md:px-6 flex items-center gap-3">
        {/* Logo / back */}
        <div className="flex items-center gap-1 shrink-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
            </button>
          )}
          <Link
            to="/cardapio"
            className="flex items-center gap-2 px-1"
            style={{ color: 'var(--c-ovenred)' }}
          >
            <span className="text-xl md:text-2xl">🍕</span>
            <span className="font-display text-base md:text-xl whitespace-nowrap">
              Forno do Bairro
            </span>
          </Link>
        </div>

        {/* Search — desktop inline, mobile icon-only */}
        <form
          onSubmit={submitSearch}
          className="hidden md:flex flex-1 max-w-xl mx-4 relative"
        >
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--c-slate-muted)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pizza, bebida, sobremesa…"
            className="w-full h-10 pl-10 pr-4 rounded-full text-sm focus:outline-none focus:border-2 focus:border-[color:var(--c-charcoal)] transition-colors"
            style={{
              background: 'var(--c-offwhite)',
              border: '1px solid var(--c-slate-line)',
              color: 'var(--c-charcoal)',
            }}
          />
        </form>

        <div className="flex-1 md:hidden" />

        {/* Right cluster */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
          </button>

          {isAuthed && <NotificationsPanel />}

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

      {/* Mobile expanded search */}
      {searchOpen && (
        <div className="md:hidden px-3 pb-3 border-t" style={{ borderColor: 'rgba(31,24,21,0.05)' }}>
          <form onSubmit={submitSearch} className="relative pt-3">
            <Search
              className="absolute left-4 top-1/2 mt-1.5 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--c-slate-muted)' }}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pizza, bebida, sobremesa…"
              className="w-full h-10 pl-10 pr-10 rounded-full text-sm focus:outline-none focus:border-2 focus:border-[color:var(--c-charcoal)] transition-colors"
              style={{
                background: 'var(--c-offwhite)',
                border: '1px solid var(--c-slate-line)',
                color: 'var(--c-charcoal)',
              }}
            />
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchOpen(false) }}
              className="absolute right-2 top-1/2 mt-1.5 -translate-y-1/2 p-1.5 rounded-full"
              style={{ color: 'var(--c-slate-muted)' }}
              aria-label="Fechar busca"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </header>
  )
}
