import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, User, Phone, Clock, X, Receipt, Pencil, Check, Mail,
  Calendar, ShieldCheck, ShieldAlert, MessageCircle, Cake,
  Trash2, CheckSquare, Square, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import AnimatedPage from '@/components/layout/AnimatedPage'
import CountUp from '@/components/ui/CountUp'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { customersApi } from '@/services/customers'
import { ASSETS } from '@/utils/assets'
import { friendlyPhone } from '@/utils/customer'
import AddressEditor from '@/components/customers/AddressEditor'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

const initials = (s) =>
  (s || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('')

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

// ---------- Section: profile (name + CPF + identity card) ----------

function ProfileSection({ customer, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer.name || '')
  const [cpf, setCpf] = useState(customer.cpf || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await customersApi.update(customer.id, {
        name: name.trim() || null,
        cpf: cpf.trim() || null,
      })
      onSaved(updated)
      setEditing(false)
      toast.success('Perfil atualizado')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setName(customer.name || '')
    setCpf(customer.cpf || '')
    setEditing(false)
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white/70">Perfil</h4>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <Pencil size={12} /> Editar
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs text-success hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
            >
              <Check size={12} /> Salvar
            </button>
            <button
              onClick={cancel}
              className="text-xs text-white/60 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1.5 text-sm">
          <Row label="Nome" value={customer.name || '—'} muted={!customer.name} />
          <Row label="Telefone" value={friendlyPhone(customer.phone)} />
          <Row label="CPF" value={customer.cpf || '—'} muted={!customer.cpf} />
          {customer.birthday && (
            <Row
              label="Aniversário"
              value={
                <span className="inline-flex items-center gap-1">
                  <Cake size={12} className="text-pink-300" />
                  {new Date(customer.birthday).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'long',
                  })}
                </span>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] text-white/50">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como o cliente se identifica"
              className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
            />
          </label>
          <div className="text-[11px] text-white/40">
            Telefone: {friendlyPhone(customer.phone)} (não editável — é a chave do cadastro)
          </div>
          <label className="block">
            <span className="text-[11px] text-white/50">CPF (opcional, para nota fiscal)</span>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50 shrink-0">{label}</span>
      <span className={muted ? 'text-white/40 italic' : 'text-white'}>{value}</span>
    </div>
  )
}

// ---------- Section: web-portal account (if exists) ----------

function AccountSection({ account, phoneVerified }) {
  if (!account) {
    return (
      <div className="glass-card p-4">
        <h4 className="text-sm font-medium text-white/70 mb-2">Conta no site</h4>
        <p className="text-xs text-white/40">
          Cliente ainda não criou cadastro no site. Pedidos vêm pelo WhatsApp.
        </p>
      </div>
    )
  }

  const verified = !!account.phone_verified_at
  return (
    <div className="glass-card p-4 space-y-2 text-sm">
      <h4 className="text-sm font-medium text-white/70 mb-1">Conta no site</h4>
      <div className="flex items-center gap-2">
        <Mail size={14} className="text-white/40" />
        <span className="truncate">{account.email || 'sem e-mail'}</span>
      </div>
      <div className="flex items-center gap-2">
        {verified ? (
          <>
            <ShieldCheck size={14} className="text-success" />
            <span className="text-white/70 text-xs">
              WhatsApp verificado · login em uma etapa
            </span>
          </>
        ) : (
          <>
            <ShieldAlert size={14} className="text-warning" />
            <span className="text-white/70 text-xs">
              WhatsApp ainda não verificado · login pede OTP
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-white/40" />
        <span className="text-white/60 text-xs">
          Criada em {fmtDate(account.created_at)}
          {account.last_login_at && ` · último acesso ${fmtDate(account.last_login_at)}`}
        </span>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span
          className="text-[11px] px-2 py-1 rounded-full font-semibold"
          style={
            account.marketing_opt_in
              ? { background: 'rgba(34,197,94,0.15)', color: '#86efac' }
              : { background: 'rgba(148,163,184,0.15)', color: '#cbd5e1' }
          }
        >
          {account.marketing_opt_in ? '✓ Aceita promoções' : '✗ Sem promoções'}
        </span>
      </div>
    </div>
  )
}

// ---------- Customer drawer ----------

function CustomerProfile({ customerId, onClose }) {
  const qc = useQueryClient()
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: !!customerId,
  })

  function applyUpdate(updated) {
    // Update the cache so the drawer reflects the new state immediately.
    qc.setQueryData(['customer', customerId], (prev) => ({
      ...(prev || {}),
      ...updated,
    }))
    // Invalidate the list so the parent grid refreshes (e.g. name change).
    qc.invalidateQueries({ queryKey: ['customers'] })
  }

  return (
    <AnimatePresence>
      {customerId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md h-full overflow-y-auto rounded-none border-l border-glass-border"
          >
            {/* Sticky header */}
            <div className="sticky top-0 bg-bg-card/85 backdrop-blur-xl px-5 py-3 flex items-center justify-between border-b border-glass-border z-10">
              <h3 className="font-display text-lg">Cliente</h3>
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/5"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {isLoading || !customer ? (
                <div className="text-white/50 text-sm py-10 text-center">Carregando…</div>
              ) : (
                <>
                  {/* Identity header */}
                  <div className="flex items-center gap-4">
                    {customer.name ? (
                      <div className="w-16 h-16 rounded-full bg-primary-gradient flex items-center justify-center font-display text-xl shadow-glow-primary shrink-0">
                        {initials(customer.name)}
                      </div>
                    ) : (
                      <img
                        src={ASSETS.icons.avatar}
                        alt=""
                        className="w-16 h-16 rounded-full ring-1 ring-glass-border object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-xl truncate">{customer.name || 'Sem nome'}</h2>
                      <p className="text-white/60 text-sm">{friendlyPhone(customer.phone)}</p>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card p-3">
                      <div className="text-xs text-white/50">Pedidos</div>
                      <div className="text-2xl font-display text-accent mt-0.5">
                        <CountUp value={customer.total_orders} />
                      </div>
                    </div>
                    <div className="glass-card p-3">
                      <div className="text-xs text-white/50">Último pedido</div>
                      <div className="text-sm font-medium mt-1">
                        {fmtDate(customer.last_order_at)}
                      </div>
                    </div>
                  </div>

                  {/* Profile (name / cpf / birthday) — editable */}
                  <ProfileSection customer={customer} onSaved={applyUpdate} />

                  {/* Account info if registered on the web */}
                  <AccountSection
                    account={customer.account}
                    phoneVerified={!!customer.account?.phone_verified_at}
                  />

                  {/* Address management — full CRUD */}
                  <AddressEditor
                    customerId={customer.id}
                    addresses={customer.addresses || []}
                    defaultIndex={customer.default_address_index ?? 0}
                    onSaved={applyUpdate}
                  />

                  {/* Recent orders */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                      <Receipt size={14} /> Histórico de pedidos
                    </h4>
                    {(customer.orders || []).length === 0 ? (
                      <div className="glass-card p-4 text-center text-white/40 text-sm">
                        Sem pedidos
                      </div>
                    ) : (
                      customer.orders.map((o) => (
                        <div key={o.id} className="glass-card p-3 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              #{String(o.order_number).padStart(3, '0')}
                            </span>
                            <span className="text-accent font-medium">{brl(o.total)}</span>
                          </div>
                          <div className="text-xs text-white/50 mt-1">
                            {new Date(o.created_at).toLocaleString('pt-BR')} · {o.status} · {o.payment_method}
                          </div>
                          {o.items?.[0] && (
                            <div className="text-xs text-white/40 mt-1 line-clamp-1">
                              {o.items[0].description}
                              {o.items.length > 1 && ` +${o.items.length - 1}`}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer link to conversation */}
                  <div className="pt-2 border-t border-glass-border">
                    <Link
                      to={`/admin/conversations?phone=${encodeURIComponent(customer.phone)}`}
                      onClick={onClose}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      Abrir conversa no WhatsApp
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Confirm dialog ----------

function ConfirmDialog({ open, title, message, confirmLabel, danger, requireText, onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (!open) setTyped('') }, [open])

  const canConfirm = !busy && (!requireText || typed === requireText)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 16, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}
              >
                <AlertTriangle size={20} className={danger ? 'text-red-400' : 'text-warning'} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg leading-tight">{title}</h3>
                <p className="text-sm text-white/70 mt-1.5 whitespace-pre-line">{message}</p>
              </div>
            </div>

            {requireText && (
              <label className="block">
                <span className="text-xs text-white/60">
                  Para confirmar, digite <code className="px-1 py-0.5 rounded bg-white/10 text-white">{requireText}</code>
                </span>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-red-400"
                  placeholder={requireText}
                />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onCancel}
                disabled={busy}
                className="px-3 h-9 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className="px-4 h-9 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ background: danger ? '#ef4444' : '#f59e0b' }}
              >
                {busy ? 'Apagando…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Page ----------

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'recent', label: 'Pedidos recentes' },
  { key: 'no-orders', label: 'Sem pedidos' },
  { key: 'no-name', label: 'Sem nome' },
]

export default function Customers() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  // Deep-link: /admin/customers?id=123 → open that customer's drawer
  // (used by the Conversas right-pane "Editar cadastro" link).
  const [selected, setSelected] = useState(
    params.get('id') ? Number(params.get('id')) : null,
  )

  // Selection mode: clicks toggle a checkbox instead of opening the
  // drawer. Reset whenever the operator exits the mode so re-entering
  // doesn't carry stale ids.
  const [selectMode, setSelectMode] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [busy, setBusy] = useState(false)

  // Keep the URL in sync with the open drawer so deep-links survive
  // refresh and back/forward.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (selected) next.set('id', String(selected))
    else next.delete('id')
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [selected, params, setParams])

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list({ search: search || undefined, limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (filter === 'all') return customers
    if (filter === 'no-orders') return customers.filter((c) => !c.total_orders)
    if (filter === 'no-name') return customers.filter((c) => !c.name)
    if (filter === 'recent') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      return customers.filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= cutoff)
    }
    return customers
  }, [customers, filter])

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setPicked(new Set(filtered.map((c) => c.id)))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setPicked(new Set())
  }

  async function doBulkDelete() {
    setBusy(true)
    try {
      const ids = Array.from(picked)
      const { deleted } = await customersApi.bulkDelete(ids)
      toast.success(`${deleted} cliente${deleted === 1 ? '' : 's'} apagado${deleted === 1 ? '' : 's'}`)
      setConfirmBulk(false)
      exitSelectMode()
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao apagar')
    } finally {
      setBusy(false)
    }
  }

  async function doWipeAll() {
    setBusy(true)
    try {
      await customersApi.wipeAll('APAGAR TUDO')
      toast.success('Banco zerado. Pronto para operação real.')
      setConfirmWipe(false)
      exitSelectMode()
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao zerar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatedPage className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center">
          {FILTERS.map(({ key, label }) => {
            const isActive = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="shrink-0 inline-flex items-center px-3 h-8 rounded-full text-xs font-medium transition-colors"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.12)', color: 'white' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.10)' }
                }
              >
                {label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/40 whitespace-nowrap">
              {filtered.length} cliente{filtered.length === 1 ? '' : 's'}
            </span>
            {!selectMode ? (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium text-white/80 hover:text-white border border-white/15 hover:border-white/30"
                >
                  <CheckSquare size={13} /> Selecionar
                </button>
                <button
                  onClick={() => setConfirmWipe(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold text-red-300 hover:text-red-100 border border-red-400/30 hover:border-red-400/60 hover:bg-red-500/10"
                >
                  <Trash2 size={13} /> Apagar tudo
                </button>
              </>
            ) : (
              <button
                onClick={selectAllVisible}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium text-white/80 hover:text-white border border-white/15"
              >
                Marcar visíveis ({filtered.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/50">
          <User size={40} className="mx-auto mb-3 text-white/30" />
          Nenhum cliente encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
          {filtered.map((c, i) => {
            const isPicked = picked.has(c.id)
            return (
              <motion.button
                key={c.id}
                onClick={() => (selectMode ? togglePick(c.id) : setSelected(c.id))}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="glass-card p-4 text-left transition-all hover:-translate-y-0.5 relative"
                style={
                  selectMode && isPicked
                    ? { borderColor: 'rgba(239,68,68,0.55)', background: 'rgba(239,68,68,0.08)' }
                    : undefined
                }
              >
                {selectMode && (
                  <div className="absolute top-2 right-2 text-white/70">
                    {isPicked ? (
                      <CheckSquare size={18} className="text-red-300" />
                    ) : (
                      <Square size={18} />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {c.name ? (
                    <div className="w-12 h-12 rounded-full bg-primary-gradient flex items-center justify-center font-display text-lg shrink-0">
                      {initials(c.name)}
                    </div>
                  ) : (
                    <img
                      src={ASSETS.icons.avatar}
                      alt=""
                      className="w-12 h-12 rounded-full ring-1 ring-glass-border object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name || 'Sem nome'}</div>
                    <div className="text-xs text-white/50 truncate flex items-center gap-1">
                      <Phone size={10} /> {friendlyPhone(c.phone)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-white/50 mt-3 pt-3 border-t border-glass-border">
                  <span>{c.total_orders} pedido{c.total_orders === 1 ? '' : 's'}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {fmtDate(c.last_order_at)}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Floating action bar while in selection mode */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass-card px-4 py-2.5 flex items-center gap-3 shadow-2xl"
          >
            <span className="text-sm text-white/80">
              {picked.size} selecionado{picked.size === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setConfirmBulk(true)}
              disabled={picked.size === 0}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} /> Apagar
            </button>
            <button
              onClick={exitSelectMode}
              className="px-3 h-9 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmBulk}
        title={`Apagar ${picked.size} cliente${picked.size === 1 ? '' : 's'}?`}
        message="Os pedidos, contas no site e carrinhos relacionados serão apagados junto. As conversas no WhatsApp são preservadas (anonimizadas)."
        confirmLabel={`Apagar ${picked.size}`}
        danger
        busy={busy}
        onConfirm={doBulkDelete}
        onCancel={() => setConfirmBulk(false)}
      />

      <ConfirmDialog
        open={confirmWipe}
        title="Zerar TODO o histórico operacional?"
        message={
          'Vai apagar: todos os clientes, contas, carrinhos, pedidos e conversas.\n' +
          'Vai preservar: cardápio, zonas de entrega, configurações e usuário admin.\n\n' +
          'Use isso só antes de subir para operação real.'
        }
        confirmLabel="Apagar tudo"
        danger
        requireText="APAGAR TUDO"
        busy={busy}
        onConfirm={doWipeAll}
        onCancel={() => setConfirmWipe(false)}
      />

      <CustomerProfile customerId={selected} onClose={() => setSelected(null)} />
    </AnimatedPage>
  )
}
