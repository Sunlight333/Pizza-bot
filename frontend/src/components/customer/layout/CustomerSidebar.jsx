import { NavLink, Link } from 'react-router-dom'
import { Pizza, ShoppingBag, ClipboardList, MapPin, User, X } from 'lucide-react'
import { useCustomerCart } from '@/stores/customerCart'

const NAV = [
  { to: '/cardapio', label: 'Cardápio', icon: Pizza, end: true },
  { to: '/sacola', label: 'Sacola', icon: ShoppingBag, showCount: true },
  { to: '/pedidos', label: 'Meus pedidos', icon: ClipboardList },
  { to: '/conta/enderecos', label: 'Endereços', icon: MapPin },
  { to: '/conta', label: 'Minha conta', icon: User },
]

/**
 * Customer-portal sidebar.
 *
 * Two presentations:
 *   - Desktop (md+): always visible, fixed left, 240px wide.
 *   - Mobile/tablet: hidden by default; slides in from the left as a
 *     drawer when the hamburger in CustomerTopBar toggles `open`.
 *
 * Same nav items in both. Cart shows a live badge so the user always
 * sees their basket size from any page.
 */
export default function CustomerSidebar({ open = false, onClose }) {
  const itemCount = useCustomerCart((s) => s.itemCount())

  const navMarkup = (
    <nav className="flex-1 px-2 space-y-1">
      {NAV.map(({ to, label, icon: Icon, end, showCount }) => (
        <NavLink
          key={to}
          to={to}
          end={!!end}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-[14px] font-medium
             ${isActive ? 'font-semibold' : ''}`
          }
          style={({ isActive }) => ({
            background: isActive ? 'rgba(139,26,26,0.08)' : 'transparent',
            color: isActive ? 'var(--c-ovenred)' : 'var(--c-charcoal)',
          })}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="flex-1">{label}</span>
          {showCount && itemCount > 0 && (
            <span
              className="min-w-[20px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5"
              style={{ background: 'var(--c-ovenred)', color: 'var(--c-offwhite)' }}
            >
              {itemCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )

  // Desktop fixed sidebar
  const desktop = (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col z-30"
      style={{
        background: 'var(--c-offwhite)',
        borderRight: '1px solid var(--c-slate-line)',
      }}
    >
      <Link
        to="/cardapio"
        className="flex items-center gap-3 px-5 py-5"
        style={{ color: 'var(--c-ovenred)' }}
      >
        <span className="text-2xl">🍕</span>
        <span className="font-display text-xl">Forno do Bairro</span>
      </Link>
      {navMarkup}
      <div className="p-4 text-[11px]" style={{ color: 'var(--c-slate-muted)' }}>
        © Forno do Bairro
      </div>
    </aside>
  )

  // Mobile drawer + backdrop
  const mobile = (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(31,24,21,0.55)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className="fixed left-0 top-0 h-screen w-72 flex-col z-50 md:hidden transition-transform"
        style={{
          background: 'var(--c-offwhite)',
          borderRight: '1px solid var(--c-slate-line)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          display: 'flex',
        }}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            to="/cardapio"
            onClick={onClose}
            className="flex items-center gap-3"
            style={{ color: 'var(--c-ovenred)' }}
          >
            <span className="text-2xl">🍕</span>
            <span className="font-display text-xl">Forno do Bairro</span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[rgba(31,24,21,0.05)]"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navMarkup}
        <div className="p-4 text-[11px]" style={{ color: 'var(--c-slate-muted)' }}>
          © Forno do Bairro
        </div>
      </aside>
    </>
  )

  return (
    <>
      {desktop}
      {mobile}
    </>
  )
}
