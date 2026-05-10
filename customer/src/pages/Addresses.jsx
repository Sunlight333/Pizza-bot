import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Star, Trash2, Plus } from 'lucide-react'

import { profile as profileApi, lookupCep } from '@/services/api'
import Button from '@/components/Button'
import Input from '@/components/Input'
import EmptyState from '@/components/EmptyState'

const EMPTY = { label: 'Casa', cep: '', street: '', number: '', neighborhood: '', complement: '', reference: '' }

export default function Addresses() {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: profileApi.addresses.list,
  })

  const [editing, setEditing] = useState(null) // null | -1 (new) | index
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  function startNew() {
    setEditing(-1)
    setDraft({ ...EMPTY })
  }
  function startEdit(idx) {
    setEditing(idx)
    setDraft({ ...EMPTY, ...(data.addresses[idx] || {}) })
  }
  function cancel() {
    setEditing(null)
    setDraft(EMPTY)
  }

  async function onCepBlur() {
    const info = await lookupCep(draft.cep || '')
    if (info) {
      setDraft(d => ({
        ...d,
        street: d.street || info.street || '',
        neighborhood: d.neighborhood || info.neighborhood || '',
      }))
    }
  }

  async function save() {
    if (!draft.street || !draft.number || !draft.neighborhood || !draft.label) {
      toast.error('Preencha rua, número, bairro e rótulo')
      return
    }
    setBusy(true)
    try {
      if (editing === -1) {
        await profileApi.addresses.add(draft)
        toast.success('Endereço adicionado')
      } else {
        await profileApi.addresses.update(editing, draft)
        toast.success('Endereço atualizado')
      }
      cancel()
      refetch()
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function setDefault(idx) {
    try {
      await profileApi.addresses.setDefault(idx)
      toast.success('Endereço padrão atualizado')
      refetch()
    } catch (e) { toast.error(e?.message || 'Erro') }
  }

  async function remove(idx) {
    if (!confirm('Remover este endereço?')) return
    try {
      await profileApi.addresses.remove(idx)
      toast.success('Endereço removido')
      refetch()
    } catch (e) { toast.error(e?.message || 'Erro ao remover') }
  }

  if (isLoading) return <div className="max-w-md mx-auto px-5 py-6"><div className="skeleton h-20 rounded-xl" /></div>

  if (editing !== null) {
    return (
      <div className="max-w-md mx-auto px-5 py-6">
        <h1 className="font-display text-display-lg mb-6">
          {editing === -1 ? 'Novo endereço' : 'Editar endereço'}
        </h1>
        <div className="space-y-4">
          <Input label="Rótulo (Casa, Trabalho…)" value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Input label="CEP" value={draft.cep || ''} inputMode="numeric"
            onChange={(e) => setDraft({ ...draft, cep: e.target.value })}
            onBlur={onCepBlur}
            placeholder="00000-000" />
          <Input label="Rua" value={draft.street}
            onChange={(e) => setDraft({ ...draft, street: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Número" className="col-span-1" value={draft.number}
              onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="123" />
            <Input label="Complemento" className="col-span-2" value={draft.complement || ''}
              onChange={(e) => setDraft({ ...draft, complement: e.target.value })} placeholder="apto 4B" />
          </div>
          <Input label="Bairro" value={draft.neighborhood}
            onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })} />
          <Input label="Referência (opcional)" value={draft.reference || ''}
            onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
            placeholder="próximo ao mercado…" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={cancel}>Cancelar</Button>
            <Button onClick={save} loading={busy} className="flex-1">Salvar endereço</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!data?.addresses?.length) {
    return (
      <EmptyState
        title="Nenhum endereço salvo"
        description="Adicione seu primeiro endereço para entrega rápida."
        action={<Button fullWidth onClick={startNew}>Adicionar endereço</Button>}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto px-5 py-6">
      <h1 className="font-display text-display-lg mb-6">Endereços</h1>

      <div className="space-y-3">
        {data.addresses.map((a, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold capitalize">{a.label}</p>
                  {data.default_index === i && (
                    <span className="text-[11px] uppercase tracking-wider font-bold text-ovenred bg-ovenred/10 px-1.5 py-0.5 rounded">
                      Padrão
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-slateMuted mt-1">
                  {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ''}
                </p>
                <p className="text-body-sm text-slateMuted">{a.neighborhood}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setDefault(i)}
                  disabled={data.default_index === i}
                  className="p-2 rounded-lg text-slateMuted hover:text-ovenred disabled:opacity-30"
                  aria-label="Tornar padrão"
                >
                  <Star className="w-4 h-4" fill={data.default_index === i ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => remove(i)}
                  className="p-2 rounded-lg text-slateMuted hover:text-danger"
                  aria-label="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              onClick={() => startEdit(i)}
              className="mt-2 text-body-sm text-ovenred font-semibold"
            >
              Editar
            </button>
          </div>
        ))}
      </div>

      <Button fullWidth className="mt-6" variant="secondary" onClick={startNew}>
        <Plus className="w-4 h-4" /> Novo endereço
      </Button>
    </div>
  )
}
