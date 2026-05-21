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

// Format a band range as Brazilian comma-decimal label, e.g. "2,1-3 km".
// Kept in sync with backend.api.routes.delivery._band_label so the auto-
// generated neighborhood field matches what the seed/import code produces.
function bandLabel(min, max) {
  const fmt = (v) => {
    const n = Number(v)
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(1).replace('.', ',')
  }
  return `${fmt(min)}-${fmt(max)} km`
}

function nullable(n) {
  if (n === '' || n == null) return null
  const v = Number(n)
  return isNaN(v) ? null : v
}

function BandRow({ band, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState(band)

  const save = async () => {
    const min = nullable(data.distance_min_km)
    const max = nullable(data.distance_max_km)
    if (min == null || max == null || max <= min) {
      toast.error('Distância máxima precisa ser maior que a mínima.')
      return
    }
    await onSave(band.id, {
      neighborhood: bandLabel(min, max),
      fee: Number(data.fee),
      estimated_minutes: Number(data.estimated_minutes),
      distance_min_km: min,
      distance_max_km: max,
      is_active: data.is_active,
    })
    setEditing(false)
  }

  return (
    <tr className="border-b border-glass-border last:border-0">
      <td className="py-3 px-4">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              min="0"
              value={data.distance_min_km ?? ''}
              onChange={(e) => setData({ ...data, distance_min_km: e.target.value })}
              className="input-field py-1 text-sm w-20 tabular-nums"
            />
            <span className="text-white/30 text-xs">a</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={data.distance_max_km ?? ''}
              onChange={(e) => setData({ ...data, distance_max_km: e.target.value })}
              className="input-field py-1 text-sm w-20 tabular-nums"
            />
            <span className="text-white/40 text-xs">km</span>
          </div>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 text-xs font-medium tabular-nums">
            {bandLabel(band.distance_min_km, band.distance_max_km)}
          </span>
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
          brl(band.fee)
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
          `${band.estimated_minutes} min`
        )}
      </td>
      <td className="py-3 px-4">
        {editing ? (
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!data.is_active}
              onChange={(e) => setData({ ...data, is_active: e.target.checked })}
              className="w-4 h-4 accent-success"
            />
            <span className="text-white/70">{data.is_active ? 'Ativo' : 'Inativo'}</span>
          </label>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full ${band.is_active ? 'bg-success/20 text-success' : 'bg-white/10 text-white/40'}`}>
            {band.is_active ? 'Ativo' : 'Inativo'}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right space-x-1">
        {editing ? (
          <>
            <button onClick={save} className="p-1.5 text-success hover:bg-success/10 rounded"><Check size={14} /></button>
            <button onClick={() => { setData(band); setEditing(false) }} className="p-1.5 text-white/50 hover:bg-white/10 rounded"><X size={14} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 text-white/60 hover:bg-white/10 rounded"><Edit2 size={14} /></button>
            <button
              onClick={() => {
                const label = bandLabel(band.distance_min_km, band.distance_max_km)
                if (confirm(`Remover faixa "${label}"?`)) onDelete(band.id)
              }}
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
  const [newBand, setNewBand] = useState({
    distance_min_km: '', distance_max_km: '', fee: 0, estimated_minutes: 45,
    is_active: true,
  })

  const { data: allZones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: deliveryApi.list,
  })

  // Only show rows that actually have a distance window — the page is
  // now purely about distance-based delivery. Legacy named-only zones
  // (if any predate the migration) stay in the DB but are hidden here.
  const bands = allZones
    .filter((z) => z.distance_min_km != null && z.distance_max_km != null)
    .sort((a, b) => Number(a.distance_min_km) - Number(b.distance_min_km))

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => deliveryApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); toast.success('Atualizado') },
  })

  const createMut = useMutation({
    mutationFn: deliveryApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      setAdding(false)
      setNewBand({
        distance_min_km: '', distance_max_km: '', fee: 0, estimated_minutes: 45,
        is_active: true,
      })
      toast.success('Faixa adicionada')
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
      toast.success(`${r.inserted} criadas, ${r.updated} atualizadas`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao importar'),
  })

  const stats = {
    total: bands.length,
    avg: bands.length ? bands.reduce((s, z) => s + Number(z.fee), 0) / bands.length : 0,
    min: bands.length ? Math.min(...bands.map((z) => Number(z.fee))) : 0,
    max: bands.length ? Math.max(...bands.map((z) => Number(z.fee))) : 0,
  }

  const createBand = () => {
    const min = nullable(newBand.distance_min_km)
    const max = nullable(newBand.distance_max_km)
    if (min == null || max == null || max <= min) {
      toast.error('Distância máxima precisa ser maior que a mínima.')
      return
    }
    createMut.mutate({
      neighborhood: bandLabel(min, max),
      fee: Number(newBand.fee),
      estimated_minutes: Number(newBand.estimated_minutes),
      distance_min_km: min,
      distance_max_km: max,
      is_active: newBand.is_active,
    })
  }

  return (
    <AnimatedPage className="space-y-4">
      <DistanceDeliveryConfig />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <div className="text-xs text-white/50 uppercase">Faixas</div>
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
        <DeliveryZoneMap zones={bands} />
        <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
          <Upload size={32} className="text-white/30 mb-2" />
          <h3 className="font-display mb-2">Importar CSV</h3>
          <p className="text-xs text-white/50 mb-4 max-w-xs">
            CSV com colunas: <code>distance_min_km,distance_max_km,fee,estimated_minutes</code>.
            Faixas com a mesma janela (min, max) são atualizadas; novas são criadas.
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
          <h2 className="font-display flex items-center gap-2"><Truck size={18} /> Faixas de Entrega por Distância</h2>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> Adicionar
          </button>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-white/40 border-b border-glass-border">
              <th className="px-4 py-2 font-medium">Distância (km)</th>
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
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="min"
                      value={newBand.distance_min_km}
                      onChange={(e) => setNewBand({ ...newBand, distance_min_km: e.target.value })}
                      className="input-field py-1 text-sm w-20 tabular-nums"
                    />
                    <span className="text-white/30 text-xs">a</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="max"
                      value={newBand.distance_max_km}
                      onChange={(e) => setNewBand({ ...newBand, distance_max_km: e.target.value })}
                      className="input-field py-1 text-sm w-20 tabular-nums"
                    />
                    <span className="text-white/40 text-xs">km</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    step="0.01"
                    value={newBand.fee}
                    onChange={(e) => setNewBand({ ...newBand, fee: e.target.value })}
                    className="input-field py-1 text-sm w-24"
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    value={newBand.estimated_minutes}
                    onChange={(e) => setNewBand({ ...newBand, estimated_minutes: e.target.value })}
                    className="input-field py-1 text-sm w-20"
                  />
                </td>
                <td className="py-3 px-4">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newBand.is_active}
                      onChange={(e) => setNewBand({ ...newBand, is_active: e.target.checked })}
                      className="w-4 h-4 accent-success"
                    />
                    <span className="text-white/70">{newBand.is_active ? 'Ativo' : 'Inativo'}</span>
                  </label>
                </td>
                <td className="py-3 px-4 text-right space-x-1">
                  <button
                    onClick={createBand}
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
            ) : bands.length === 0 && !adding ? (
              <tr><td colSpan={5} className="p-6 text-center text-white/50">Nenhuma faixa cadastrada</td></tr>
            ) : (
              bands.map((z) => (
                <BandRow
                  key={z.id}
                  band={z}
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
