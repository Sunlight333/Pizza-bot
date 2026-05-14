import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Check, X, Truck, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

import AnimatedPage from '@/components/layout/AnimatedPage'
import DeliveryZoneMap from '@/components/delivery/DeliveryZoneMap'
import DistanceDeliveryConfig from '@/components/delivery/DistanceDeliveryConfig'
import CountUp from '@/components/ui/CountUp'
import { api } from '@/services/api'
import { deliveryApi } from '@/services/delivery'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

function ZoneRow({ zone, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState(zone)

  const save = async () => {
    await onSave(zone.id, {
      neighborhood: data.neighborhood,
      fee: Number(data.fee),
      estimated_minutes: Number(data.estimated_minutes),
      is_active: data.is_active,
    })
    setEditing(false)
  }

  return (
    <tr className="border-b border-glass-border last:border-0">
      <td className="py-3 px-4">
        {editing ? (
          <input
            value={data.neighborhood}
            onChange={(e) => setData({ ...data, neighborhood: e.target.value })}
            className="input-field py-1 text-sm"
          />
        ) : (
          <span className="font-medium">{zone.neighborhood}</span>
        )}
      </td>
      <td className="py-3 px-4 text-accent">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={data.fee}
            onChange={(e) => setData({ ...data, fee: e.target.value })}
            className="input-field py-1 text-sm w-24"
          />
        ) : (
          brl(zone.fee)
        )}
      </td>
      <td className="py-3 px-4 text-white/70">
        {editing ? (
          <input
            type="number"
            value={data.estimated_minutes}
            onChange={(e) => setData({ ...data, estimated_minutes: e.target.value })}
            className="input-field py-1 text-sm w-20"
          />
        ) : (
          `${zone.estimated_minutes} min`
        )}
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full ${zone.is_active ? 'bg-success/20 text-success' : 'bg-white/10 text-white/40'}`}>
          {zone.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="py-3 px-4 text-right space-x-1">
        {editing ? (
          <>
            <button onClick={save} className="p-1.5 text-success hover:bg-success/10 rounded"><Check size={14} /></button>
            <button onClick={() => { setData(zone); setEditing(false) }} className="p-1.5 text-white/50 hover:bg-white/10 rounded"><X size={14} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 text-white/60 hover:bg-white/10 rounded"><Edit2 size={14} /></button>
            <button
              onClick={() => { if (confirm(`Remover "${zone.neighborhood}"?`)) onDelete(zone.id) }}
              className="p-1.5 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

export default function Delivery() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newZone, setNewZone] = useState({ neighborhood: '', fee: 0, estimated_minutes: 45, is_active: true })

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: deliveryApi.list,
  })

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => deliveryApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); toast.success('Atualizado') },
  })

  const createMut = useMutation({
    mutationFn: deliveryApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      setAdding(false)
      setNewZone({ neighborhood: '', fee: 0, estimated_minutes: 45, is_active: true })
      toast.success('Bairro adicionado')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao criar'),
  })

  const deleteMut = useMutation({
    mutationFn: deliveryApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); toast.success('Removido') },
  })

  const fileInputRef = useRef(null)

  const importMut = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/api/delivery/zones/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      toast.success(`${r.inserted} criados, ${r.updated} atualizados`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao importar'),
  })

  const stats = {
    total: zones.length,
    avg: zones.length ? zones.reduce((s, z) => s + Number(z.fee), 0) / zones.length : 0,
    min: zones.length ? Math.min(...zones.map((z) => Number(z.fee))) : 0,
    max: zones.length ? Math.max(...zones.map((z) => Number(z.fee))) : 0,
  }

  return (
    <AnimatedPage className="space-y-4">
      <DistanceDeliveryConfig />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <div className="text-xs text-white/50 uppercase">Bairros</div>
          <div className="text-2xl font-display mt-1"><CountUp value={stats.total} /></div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-white/50 uppercase">Taxa Média</div>
          <div className="text-2xl font-display mt-1 text-accent">
            <CountUp value={stats.avg} format={(n) => brl(n)} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-white/50 uppercase">Mínima</div>
          <div className="text-2xl font-display mt-1">
            <CountUp value={stats.min} format={(n) => brl(n)} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-white/50 uppercase">Máxima</div>
          <div className="text-2xl font-display mt-1">
            <CountUp value={stats.max} format={(n) => brl(n)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeliveryZoneMap zones={zones} />
        <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
          <Upload size={32} className="text-white/30 mb-2" />
          <h3 className="font-display mb-2">Importar CSV</h3>
          <p className="text-xs text-white/50 mb-4 max-w-xs">
            CSV com colunas: <code>neighborhood,fee,estimated_minutes</code>.
            Bairros existentes são atualizados.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && importMut.mutate(e.target.files[0])}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMut.isPending}
            className="btn-primary"
          >
            {importMut.isPending ? 'Importando...' : 'Selecionar arquivo'}
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <h2 className="font-display flex items-center gap-2"><Truck size={18} /> Bairros Atendidos</h2>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> Adicionar
          </button>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-white/40 border-b border-glass-border">
              <th className="px-4 py-2 font-medium">Bairro</th>
              <th className="px-4 py-2 font-medium">Taxa</th>
              <th className="px-4 py-2 font-medium">Tempo</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <motion.tr
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-glass-border bg-primary/5"
              >
                <td className="py-3 px-4">
                  <input
                    autoFocus
                    placeholder="Bairro"
                    value={newZone.neighborhood}
                    onChange={(e) => setNewZone({ ...newZone, neighborhood: e.target.value })}
                    className="input-field py-1 text-sm"
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    step="0.01"
                    value={newZone.fee}
                    onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })}
                    className="input-field py-1 text-sm w-24"
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    value={newZone.estimated_minutes}
                    onChange={(e) => setNewZone({ ...newZone, estimated_minutes: e.target.value })}
                    className="input-field py-1 text-sm w-20"
                  />
                </td>
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-right space-x-1">
                  <button
                    onClick={() => createMut.mutate({ ...newZone, fee: Number(newZone.fee), estimated_minutes: Number(newZone.estimated_minutes) })}
                    className="p-1.5 text-success hover:bg-success/10 rounded"
                  >
                    <Check size={14} />
                  </button>
                  <button onClick={() => setAdding(false)} className="p-1.5 text-white/50 hover:bg-white/10 rounded">
                    <X size={14} />
                  </button>
                </td>
              </motion.tr>
            )}
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-white/50">Carregando...</td></tr>
            ) : zones.length === 0 && !adding ? (
              <tr><td colSpan={5} className="p-6 text-center text-white/50">Nenhum bairro cadastrado</td></tr>
            ) : (
              zones.map((z) => (
                <ZoneRow
                  key={z.id}
                  zone={z}
                  onSave={(id, data) => saveMut.mutateAsync({ id, data })}
                  onDelete={deleteMut.mutate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </AnimatedPage>
  )
}
