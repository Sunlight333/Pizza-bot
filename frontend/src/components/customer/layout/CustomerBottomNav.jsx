import { NavLink } from 'react-router-dom'
import { Pizza, ClipboardList, User } from 'lucide-react'
import { useCustomerAuth } from '@/stores/customerAuth'

const TABS = [
  { to: '/cardapio', label: 'Cardápio', icon: Pizza, end: true },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
]

export default function CustomerBottomNav() {
  const status = useCustomerAuth((s) => s.status)
  const accountTo = status === 'authenticated' ? '/conta' : '/login'
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden h-16 border-t"
      style={{
        background: 'var(--c-offwhite)',
        borderColor: 'var(--c-slate-line)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="h-full grid grid-cols-3">
        {[...TABS, { to: accountTo, label: 'Conta', icon: User }].map(
          ({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={!!end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? '' : 'opacity-60'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--c-ovenred)' : 'var(--c-charcoal)',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute top-0 inset-x-6 h-[2px] rounded-b-full"
                      style={{ background: 'var(--c-ovenred)' }}
                    />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}
