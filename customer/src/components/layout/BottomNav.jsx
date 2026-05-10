import { NavLink } from 'react-router-dom'
import { Pizza, ClipboardList, User } from 'lucide-react'
import { useAuth } from '@/stores/auth'

const TABS = [
  { to: '/menu', label: 'Cardápio', icon: Pizza },
  { to: '/orders', label: 'Pedidos', icon: ClipboardList },
]

export default function BottomNav() {
  const status = useAuth(s => s.status)
  const accountTo = status === 'authenticated' ? '/profile' : '/login'
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden h-16 bg-offwhite border-t border-slateLine"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="h-full grid grid-cols-3">
        {[...TABS, { to: accountTo, label: 'Conta', icon: User }].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/menu'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 transition-colors
               ${isActive ? 'text-ovenred' : 'text-charcoal/60'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 inset-x-6 h-[2px] bg-ovenred rounded-b-full" />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
