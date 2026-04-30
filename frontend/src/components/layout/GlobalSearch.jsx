import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2, Pizza, User, Receipt } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { menuApi } from '@/services/menu'
import { customersApi } from '@/services/customers'
import { ordersApi } from '@/services/orders'

/**
 * Header global search. Debounces input ~300ms, queries products/customers/
 * orders in parallel, and shows up to 4 results per category in a dropdown.
 * Clicking a result navigates to the relevant page (the destination page's
 * own search input picks it up where applicable).
 */
export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Debounce so we don't fire 3 endpoints on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Close on outside click and on Esc.
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const enabled = debounced.length >= 2

  const { data: products = [], isFetching: pf } = useQuery({
    queryKey: ['gs-products', debounced],
    queryFn: () => menuApi.listProducts({ search: debounced }),
    enabled,
    staleTime: 30_000,
  })

  const { data: customers = [], isFetching: cf } = useQuery({
    queryKey: ['gs-customers', debounced],
    queryFn: () => customersApi.list({ search: debounced }),
    enabled,
    staleTime: 30_000,
  })

  const { data: orders = [], isFetching: of } = useQuery({
    queryKey: ['gs-orders', debounced],
    queryFn: () => ordersApi.list({ search: debounced, limit: 5 }),
    enabled,
    staleTime: 30_000,
  })

  const loading = enabled && (pf || cf || of)
  const total = products.length + customers.length + orders.length

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const goto = (path) => {
    navigate(path)
    close()
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md ml-6">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Buscar pizzas, clientes, pedidos…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="input-field pl-9 pr-9 py-2 text-sm"
      />
      {(query || loading) && (
        <button
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
          title="Limpar"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      )}

      {open && enabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] glass-card max-h-[480px] overflow-y-auto z-30 p-1">
          {!loading && total === 0 && (
            <div className="px-3 py-4 text-sm text-white/50 text-center">
              Nenhum resultado para "{debounced}"
            </div>
          )}

          {products.length > 0 && (
            <Section icon={<Pizza size={12} />} label={`Produtos (${products.length})`}>
              {products.slice(0, 4).map((p) => (
                <Row
                  key={`p-${p.id}`}
                  title={p.name}
                  subtitle={p.description?.slice(0, 60) || ''}
                  onClick={() => goto('/menu')}
                />
              ))}
            </Section>
          )}

          {customers.length > 0 && (
            <Section icon={<User size={12} />} label={`Clientes (${customers.length})`}>
              {customers.slice(0, 4).map((c) => (
                <Row
                  key={`c-${c.id}`}
                  title={c.name || c.phone}
                  subtitle={c.phone}
                  onClick={() => goto('/customers')}
                />
              ))}
            </Section>
          )}

          {orders.length > 0 && (
            <Section icon={<Receipt size={12} />} label={`Pedidos (${orders.length})`}>
              {orders.slice(0, 4).map((o) => (
                <Row
                  key={`o-${o.id}`}
                  title={`Pedido #${String(o.order_number).padStart(3, '0')}`}
                  subtitle={`${o.customer_phone} — R$ ${Number(o.total).toFixed(2).replace('.', ',')}`}
                  onClick={() => goto('/orders')}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ icon, label, children }) {
  return (
    <div className="px-1 py-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/30">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function Row({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex flex-col"
    >
      <span className="text-sm text-white truncate">{title}</span>
      {subtitle && (
        <span className="text-[11px] text-white/50 truncate">{subtitle}</span>
      )}
    </button>
  )
}
