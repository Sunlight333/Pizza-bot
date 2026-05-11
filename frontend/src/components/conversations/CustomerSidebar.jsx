import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User as UserIcon, MapPin, Receipt, Mail, ChevronRight, X,
  Cake, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { customersApi } from '@/services/customers'
import { friendlyPhone, displayName } from '@/utils/customer'

/**
 * Customer sidebar for the Conversations page.
 *
 * Right-side pane that shows the customer's profile, addresses,
 * recent orders, and web-account status for the currently selected
 * conversation. Loads from /api/customers (look up by phone → id, then
 * the regular detail endpoint).
 *
 * The phone in a Conversation isn't always a real Customer (anonymous
 * @lid JIDs, brand-new chats) so we treat absent profiles gracefully.
 */

const initials = (s) =>
  (s || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('')

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

export default function CustomerSidebar({ phone, onClose, headerName }) {
  // Look up the customer by phone via the list endpoint (search=phone
  // returns max-1 row). Then fetch the full detail.
  const { data: row, isLoading: searching } = useQuery({
    queryKey: ['customer-by-phone', phone],
    queryFn: async () => {
      if (!phone) return null
      const list = await customersApi.list({ search: phone, limit: 1 })
      // The list endpoint matches by name OR phone — verify the row's
      // phone really equals what we asked for so we don't show the
      // wrong customer when the WhatsApp JID is anonymous.
      const exact = (list || []).find((r) => r.phone === phone)
      return exact || null
    },
    enabled: !!phone,
  })
  const customerId = row?.id

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: !!customerId,
  })

  return (
    <AnimatePresence>
      {phone && (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.25 }}
          className="glass-card flex flex-col overflow-hidden h-full"
        >
          <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
            <h3 className="font-display text-sm uppercase tracking-wider text-white/60">
              Cliente
            </h3>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden text-white/50 hover:text-white"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {searching ? (
              <div className="text-white/40 text-center py-6">Carregando…</div>
            ) : !row ? (
              <NoProfile phone={phone} headerName={headerName} />
            ) : isLoading || !customer ? (
              <div className="text-white/40 text-center py-6">Carregando…</div>
            ) : (
              <>
                {/* Identity */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-gradient flex items-center justify-center font-display text-lg shrink-0">
                    {initials(customer.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customer.name || 'Sem nome'}</div>
                    <div className="text-xs text-white/50 truncate">{friendlyPhone(customer.phone)}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="glass-card p-2.5">
                    <div className="text-[10px] uppercase text-white/40">Pedidos</div>
                    <div className="font-display text-lg text-accent mt-0.5">
                      {customer.total_orders}
                    </div>
                  </div>
                  <div className="glass-card p-2.5">
                    <div className="text-[10px] uppercase text-white/40">Último</div>
                    <div className="font-display text-xs mt-1.5">{fmtDate(customer.last_order_at)}</div>
                  </div>
                </div>

                {/* Web account */}
                {customer.account && (
                  <div className="glass-card p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-white/40 shrink-0" />
                      <span className="truncate">{customer.account.email || 'sem e-mail'}</span>
                    </div>
                    {customer.account.phone_verified_at ? (
                      <div className="flex items-center gap-2 text-success/90">
                        <ShieldCheck size={12} className="shrink-0" />
                        <span>WhatsApp verificado</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-warning">
                        <ShieldAlert size={12} className="shrink-0" />
                        <span>WhatsApp não verificado</span>
                      </div>
                    )}
                  </div>
                )}

                {customer.birthday && (
                  <div className="glass-card p-3 text-xs flex items-center gap-2">
                    <Cake size={12} className="text-pink-300" />
                    Aniversário:{' '}
                    {new Date(customer.birthday).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long',
                    })}
                  </div>
                )}

                {/* Default address */}
                {customer.addresses?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-1.5 px-1 flex items-center gap-1">
                      <MapPin size={11} /> Endereço padrão
                    </div>
                    {(() => {
                      const idx = customer.default_address_index ?? 0
                      const a = customer.addresses[idx] || customer.addresses[0]
                      return (
                        <div className="glass-card p-3 text-xs">
                          {a.label && (
                            <div className="text-primary text-[10px] uppercase tracking-wider font-semibold mb-1">
                              {a.label}
                            </div>
                          )}
                          <div>
                            {a.street} {a.number}
                            {a.complement && <span className="text-white/60"> · {a.complement}</span>}
                          </div>
                          {a.neighborhood && <div className="text-white/60 mt-0.5">{a.neighborhood}</div>}
                          {a.reference && (
                            <div className="text-white/50 italic mt-0.5">ref: {a.reference}</div>
                          )}
                        </div>
                      )
                    })()}
                    {customer.addresses.length > 1 && (
                      <div className="text-[10px] text-white/40 mt-1 px-1">
                        +{customer.addresses.length - 1} endereço{customer.addresses.length - 1 === 1 ? '' : 's'} cadastrado{customer.addresses.length - 1 === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                )}

                {/* Recent orders */}
                {customer.orders?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-1.5 px-1 flex items-center gap-1">
                      <Receipt size={11} /> Últimos pedidos
                    </div>
                    <div className="space-y-1.5">
                      {customer.orders.slice(0, 5).map((o) => (
                        <div key={o.id} className="glass-card p-2.5 text-xs">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              #{String(o.order_number).padStart(3, '0')}
                            </span>
                            <span className="text-accent">{brl(o.total)}</span>
                          </div>
                          <div className="text-white/50 mt-0.5">
                            {new Date(o.created_at).toLocaleDateString('pt-BR')} · {o.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer actions */}
                <div className="pt-2 border-t border-glass-border">
                  <Link
                    to={`/admin/customers?id=${customer.id}`}
                    className="flex items-center justify-between text-xs text-primary hover:underline"
                  >
                    <span className="flex items-center gap-1.5">
                      <UserIcon size={12} /> Editar cadastro
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function NoProfile({ phone, headerName }) {
  return (
    <div className="text-center py-6">
      <UserIcon size={32} className="mx-auto mb-2 text-white/20" />
      <p className="text-sm font-medium text-white/70">
        {headerName ? displayName(headerName, phone) : 'Cliente novo'}
      </p>
      <p className="text-xs text-white/40 mt-1">
        Ainda não há cadastro para este número. Quando o primeiro pedido
        for finalizado, o cliente aparece aqui automaticamente.
      </p>
    </div>
  )
}
