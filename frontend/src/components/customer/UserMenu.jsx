import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, LogOut, MapPin, ClipboardList } from 'lucide-react'

import { useCustomerAuth } from '@/stores/customerAuth'

/**
 * Account dropdown in the header. Avatar with initials triggers a small
 * panel with: profile link, addresses link, orders link, and sign out.
 */
export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const customer = useCustomerAuth((s) => s.customer)
  const logout = useCustomerAuth((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!customer) {
    return (
      <Link
        to="/login"
        className="text-[13px] font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
        style={{ color: 'var(--c-charcoal)' }}
      >
        Entrar
      </Link>
    )
  }

  const initials = (customer.name || customer.email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  async function doLogout() {
    setOpen(false)
    await logout()
    toast.success('Você saiu')
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-[13px] transition-transform active:scale-95"
        style={{ background: 'var(--c-crust)', color: 'var(--c-charcoal)' }}
        aria-label="Conta"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{
            background: 'var(--c-offwhite)',
            border: '1px solid var(--c-slate-line)',
            boxShadow: '0 24px 48px -16px rgba(31,24,21,0.18)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--c-slate-line)' }}>
            <p className="font-semibold truncate">{customer.name || 'Sem nome'}</p>
            <p className="text-[12px] truncate" style={{ color: 'var(--c-slate-muted)' }}>
              {customer.email || customer.phone}
            </p>
          </div>
          <ul>
            {[
              { to: '/conta', icon: User, label: 'Meu perfil' },
              { to: '/conta/enderecos', icon: MapPin, label: 'Endereços' },
              { to: '/pedidos', icon: ClipboardList, label: 'Meus pedidos' },
            ].map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-[rgba(31,24,21,0.04)] transition-colors"
                >
                  <Icon className="w-4 h-4" style={{ color: 'var(--c-slate-muted)' }} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            onClick={doLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] border-t hover:bg-[rgba(31,24,21,0.04)] transition-colors"
            style={{ borderColor: 'var(--c-slate-line)', color: 'var(--c-danger)' }}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
