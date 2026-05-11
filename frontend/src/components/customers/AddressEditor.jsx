import { useState, useEffect } from 'react'
import { Star, Trash2, Plus, MapPin, X, Check, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

import { lookupCep, formatCep } from '@/utils/cep'
import { customersApi } from '@/services/customers'

/**
 * Full address management for one customer.
 *
 * Used inside the Clientes drawer (and reusable elsewhere). The customer
 * row's `addresses` JSONB list is treated as the source of truth; every
 * edit / add / remove / set-default rewrites the whole list via PUT
 * /api/customers/{id}. That matches the existing backend contract
 * (CustomerUpdate replaces `addresses` wholesale).
 *
 * Props:
 *   customerId      — int
 *   addresses       — current list (saved)
 *   defaultIndex    — int
 *   onSaved(customer) — called after a successful PUT, with the
 *                       refreshed customer payload
 */

const EMPTY_DRAFT = {
  label: 'Casa',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  reference: '',
}

function AddressCard({ addr, isDefault, onEdit, onRemove, onSetDefault }) {
  return (
    <div className="glass-card p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary text-xs uppercase tracking-wider font-semibold">
              {addr.label || 'Endereço'}
            </span>
            {isDefault && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }}
              >
                Padrão
              </span>
            )}
          </div>
          <div className="text-white/90">
            {addr.street} {addr.number}
            {addr.complement && <span className="text-white/60"> · {addr.complement}</span>}
          </div>
          {addr.neighborhood && (
            <div className="text-white/60 text-xs mt-0.5">
              {addr.neighborhood}
              {addr.cep && <span className="text-white/40"> · CEP {addr.cep}</span>}
            </div>
          )}
          {addr.reference && (
            <div className="text-white/50 text-xs italic mt-1">ref: {addr.reference}</div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onSetDefault}
            disabled={isDefault}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Tornar padrão"
            aria-label="Tornar padrão"
          >
            <Star size={14} fill={isDefault ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
            title="Editar"
            aria-label="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-white/50 hover:text-danger hover:bg-white/5"
            title="Remover"
            aria-label="Remover"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddressForm({ draft, setDraft, onSubmit, onCancel, busy }) {
  // CEP-blur autocomplete fills street + neighborhood when empty.
  async function handleCepBlur() {
    const info = await lookupCep(draft.cep)
    if (!info) return
    setDraft((d) => ({
      ...d,
      street: d.street || info.street || '',
      neighborhood: d.neighborhood || info.neighborhood || '',
    }))
  }

  const valid =
    draft.label?.trim() &&
    draft.street?.trim() &&
    draft.number?.trim() &&
    draft.neighborhood?.trim()

  return (
    <div className="glass-card p-3 space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[11px] text-white/50">Rótulo</span>
          <input
            value={draft.label || ''}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Casa, Trabalho…"
            className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/50">CEP</span>
          <input
            value={formatCep(draft.cep || '')}
            onChange={(e) => setDraft({ ...draft, cep: e.target.value })}
            onBlur={handleCepBlur}
            placeholder="00000-000"
            inputMode="numeric"
            className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/50">Bairro</span>
          <input
            value={draft.neighborhood || ''}
            onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
            className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="grid grid-cols-12 gap-2">
        <label className="block col-span-8">
          <span className="text-[11px] text-white/50">Rua</span>
          <input
            value={draft.street || ''}
            onChange={(e) => setDraft({ ...draft, street: e.target.value })}
            className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block col-span-4">
          <span className="text-[11px] text-white/50">Número</span>
          <input
            value={draft.number || ''}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
            placeholder="123 · s/n"
            className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] text-white/50">Complemento (opcional)</span>
        <input
          value={draft.complement || ''}
          onChange={(e) => setDraft({ ...draft, complement: e.target.value })}
          placeholder="apto 4B, bloco C…"
          className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="text-[11px] text-white/50">Ponto de referência (opcional)</span>
        <input
          value={draft.reference || ''}
          onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
          placeholder="próximo ao mercado…"
          className="mt-0.5 w-full h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={!valid || busy}
          className="btn-primary px-3 h-9 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} /> Salvar endereço
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 h-9 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function AddressEditor({ customerId, addresses = [], defaultIndex = 0, onSaved }) {
  // editing: null = no form open, -1 = adding new, integer = editing index
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)

  // Keep `draft` in sync when the caller passes a new addresses list and
  // we're not in edit mode (e.g. after a save).
  useEffect(() => {
    if (editing === null) setDraft(EMPTY_DRAFT)
  }, [addresses, editing])

  function startAdd() {
    setEditing(-1)
    setDraft({ ...EMPTY_DRAFT })
  }
  function startEdit(idx) {
    setEditing(idx)
    setDraft({ ...EMPTY_DRAFT, ...(addresses[idx] || {}) })
  }
  function cancel() {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
  }

  async function saveList(nextList, nextDefaultIndex) {
    setBusy(true)
    try {
      const updated = await customersApi.update(customerId, {
        addresses: nextList,
        default_address_index: Math.max(0, Math.min(nextDefaultIndex, nextList.length - 1)),
      })
      onSaved?.(updated)
      cancel()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao salvar endereço')
    } finally {
      setBusy(false)
    }
  }

  async function submitDraft() {
    const next = [...addresses]
    let nextDefault = defaultIndex
    if (editing === -1) {
      next.push(draft)
      // First address auto-default.
      if (next.length === 1) nextDefault = 0
    } else if (editing != null) {
      next[editing] = draft
    }
    await saveList(next, nextDefault)
  }

  async function remove(idx) {
    if (!confirm('Remover este endereço?')) return
    const next = addresses.filter((_, i) => i !== idx)
    let nextDefault = defaultIndex
    if (idx === defaultIndex) nextDefault = 0
    else if (idx < defaultIndex) nextDefault = defaultIndex - 1
    await saveList(next, nextDefault)
  }

  async function setDefault(idx) {
    if (idx === defaultIndex) return
    await saveList(addresses, idx)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/70 flex items-center gap-1.5">
          <MapPin size={14} /> Endereços ({addresses.length})
        </h4>
        {editing === null && (
          <button
            onClick={startAdd}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <Plus size={12} /> Novo endereço
          </button>
        )}
      </div>

      {/* New address form */}
      {editing === -1 && (
        <AddressForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={submitDraft}
          onCancel={cancel}
          busy={busy}
        />
      )}

      {/* List */}
      {addresses.length === 0 && editing !== -1 ? (
        <div className="glass-card p-4 text-sm text-white/40 text-center">
          Nenhum endereço cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((a, i) =>
            editing === i ? (
              <AddressForm
                key={i}
                draft={draft}
                setDraft={setDraft}
                onSubmit={submitDraft}
                onCancel={cancel}
                busy={busy}
              />
            ) : (
              <AddressCard
                key={i}
                addr={a}
                isDefault={i === defaultIndex}
                onEdit={() => startEdit(i)}
                onRemove={() => remove(i)}
                onSetDefault={() => setDefault(i)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
