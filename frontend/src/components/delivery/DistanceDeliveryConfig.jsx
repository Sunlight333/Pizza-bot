import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MapPin, Compass, Loader2, Check, X } from 'lucide-react'

import { api } from '@/services/api'
import DeliveryZoneMapLive from '@/components/delivery/DeliveryZoneMapLive'

/**
 * Distance-based delivery configuration card.
 *
 * The operator enters the pizzaria's address, clicks "Buscar coordenadas"
 * (which calls Nominatim via /api/delivery/geocode), reviews the
 * returned lat/lng + match string, and toggles "Calcular entrega por
 * distância (km)". When the toggle is ON and coordinates are set, the
 * bot and the customer portal switch to Haversine + delivery_zones
 * distance bands instead of neighborhood-name matching.
 *
 * Bands are managed in the same Delivery page (the table below) — each
 * zone row has optional distance_min_km / distance_max_km fields.
 */
export default function DistanceDeliveryConfig() {
  const qc = useQueryClient()
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['bot-config'],
    queryFn: () => api.get('/api/bot/config').then((r) => r.data),
  })

  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [resolved, setResolved] = useState(null) // display name from last geocode
  const [enabled, setEnabled] = useState(false)
  const [maxKm, setMaxKm] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  // Pull values into local state whenever the config loads.
  useEffect(() => {
    if (!cfg) return
    setAddress(cfg.pizzaria_address || '')
    setLat(cfg.pizzaria_lat ?? '')
    setLng(cfg.pizzaria_lng ?? '')
    setEnabled(!!cfg.delivery_by_distance)
    setMaxKm(cfg.max_delivery_km ?? '')
  }, [cfg])

  const saveMut = useMutation({
    mutationFn: (patch) => api.put('/api/bot/config', patch).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bot-config'] })
      toast.success('Configuração salva')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao salvar'),
  })

  async function lookupCoords() {
    if (!address.trim()) {
      toast.error('Digite o endereço da pizzaria primeiro.')
      return
    }
    setGeocoding(true)
    setResolved(null)
    try {
      const r = await api.post('/api/delivery/geocode', { address: address.trim() })
      const d = r.data
      if (!d.found) {
        toast.error('Endereço não encontrado. Tente com mais detalhes (CEP, bairro, cidade).')
        return
      }
      setLat(d.lat)
      setLng(d.lng)
      setResolved(d.display_name)
      toast.success('Coordenadas localizadas — confira e clique em Salvar.')
    } finally {
      setGeocoding(false)
    }
  }

  function save() {
    const latNum = lat === '' ? null : Number(lat)
    const lngNum = lng === '' ? null : Number(lng)
    if (enabled && (latNum == null || lngNum == null || isNaN(latNum) || isNaN(lngNum))) {
      toast.error('Para ligar o cálculo por km, defina as coordenadas da pizzaria primeiro.')
      return
    }
    let maxKmNum = null
    if (maxKm !== '' && maxKm !== null && maxKm !== undefined) {
      maxKmNum = Number(maxKm)
      if (isNaN(maxKmNum) || maxKmNum <= 0) {
        toast.error('Distância máxima precisa ser um número maior que zero (em km).')
        return
      }
    }
    saveMut.mutate({
      pizzaria_address: address.trim() || null,
      pizzaria_lat: latNum,
      pizzaria_lng: lngNum,
      delivery_by_distance: enabled,
      max_delivery_km: maxKmNum,
    })
  }

  const coordsSet = lat !== '' && lng !== ''
  const dirty =
    address !== (cfg?.pizzaria_address || '') ||
    String(lat) !== String(cfg?.pizzaria_lat ?? '') ||
    String(lng) !== String(cfg?.pizzaria_lng ?? '') ||
    enabled !== !!cfg?.delivery_by_distance ||
    String(maxKm) !== String(cfg?.max_delivery_km ?? '')

  // Drag-to-reposition: persist immediately so the operator gets visual
  // feedback that the move stuck (the marker syncs back via the cfg query
  // refetch). Same payload shape as save() above minus the address.
  function moveMarker(newLat, newLng) {
    setLat(String(newLat))
    setLng(String(newLng))
    saveMut.mutate({
      pizzaria_lat: newLat,
      pizzaria_lng: newLng,
    })
  }

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Square live map, centered at the top of the section. Its own
          component clamps width to 420px so it never dominates the form. */}
      <DeliveryZoneMapLive
        lat={lat === '' ? null : Number(lat)}
        lng={lng === '' ? null : Number(lng)}
        onMove={moveMarker}
      />

      {/* Title + description spans full width so the explanatory copy
          isn't squeezed into a narrow column on desktop. */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: enabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            color: enabled ? '#86efac' : 'white',
          }}
        >
          <Compass size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg leading-tight">
            Cálculo de entrega por distância (km)
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Quando ligado, o bot e o site geocodificam o endereço do cliente
            e selecionam a faixa de entrega pela distância (em km) até a
            pizzaria. As faixas (0–2 km, 2,1–3 km, etc.) são editadas na
            tabela abaixo — cada uma precisa ter <strong>distância mín./máx.</strong>{' '}
            preenchida.
          </p>
        </div>
      </div>

      {/* Two-column form. Left = "where the pizzeria is" (address +
          coords). Right = "how we use it" (mode toggle + max radius).
          Collapses to a single column under md so mobile stays usable. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* LEFT — location */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-white/50 uppercase tracking-wider">
              Endereço da pizzaria
            </span>
            <div className="flex gap-2 mt-1">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. Antônio Antunes Júnior, 6671, Jd Planalto, São José do Rio Preto"
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
                disabled={isLoading}
              />
              <button
                onClick={lookupCoords}
                disabled={geocoding || !address.trim()}
                className="shrink-0 px-3 h-10 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                title="Buscar coordenadas no OpenStreetMap"
              >
                {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                Buscar
              </button>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-white/50 uppercase tracking-wider">Latitude</span>
              <input
                type="number"
                step="0.0000001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-20.7671126"
                className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/50 uppercase tracking-wider">Longitude</span>
              <input
                type="number"
                step="0.0000001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-49.3847098"
                className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
              />
            </label>
          </div>

          {resolved && (
            <div className="text-[11px] text-white/50 flex items-start gap-1.5">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <span><strong className="text-white/70">Match:</strong> {resolved}</span>
            </div>
          )}
        </div>

        {/* RIGHT — usage rules */}
        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
              ${enabled ? 'border-success/40 bg-success/5' : 'border-white/10 bg-white/5'}`}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-success"
              disabled={!coordsSet}
            />
            <div>
              <p className="font-semibold">Usar cálculo por distância (km)</p>
              <p className="text-xs text-white/60 mt-0.5">
                {coordsSet ? (
                  <>
                    Bot e site vão geocodificar o endereço do cliente e usar a
                    faixa de km correta. Bairros não cadastrados ainda podem
                    ser entregues, desde que caiam dentro de alguma faixa.
                  </>
                ) : (
                  <>
                    Defina latitude e longitude da pizzaria antes de ligar.
                  </>
                )}
              </p>
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] text-white/50 uppercase tracking-wider">
              Distância máxima de entrega (km)
            </span>
            <div className="flex gap-2 mt-1 items-center">
              <input
                type="number"
                step="0.1"
                min="0"
                value={maxKm}
                onChange={(e) => setMaxKm(e.target.value)}
                placeholder="Ex: 8"
                className="shrink-0 w-24 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
                disabled={!enabled}
              />
              <span className="text-xs text-white/60 flex-1 min-w-0">
                {enabled ? (
                  maxKm === '' || maxKm === null || maxKm === undefined ? (
                    <>Vazio = sem limite (cliente só é recusado se nenhuma faixa cobrir a distância dele).</>
                  ) : (
                    <>Endereços acima de <strong>{maxKm} km</strong> são recusados antes de buscar faixa.</>
                  )
                ) : (
                  <>Ative o cálculo por distância para usar o limite.</>
                )}
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[11px] text-white/40">
          Geocodificação: OpenStreetMap Nominatim (cache de 7 dias).
        </span>
        <button
          onClick={save}
          disabled={!dirty || saveMut.isPending}
          className="btn-primary px-4 h-9 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Salvar
        </button>
      </div>
    </div>
  )
}
