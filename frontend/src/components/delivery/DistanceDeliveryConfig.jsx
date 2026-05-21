import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MapPin, Compass, Loader2, Check, X, Calculator, Route } from 'lucide-react'

import { api } from '@/services/api'
import { deliveryApi } from '@/services/delivery'
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
    <div className="glass-card p-5">
      {/* Two equal columns. Map on the left (square, fills its half),
          form on the right. 1:1 ratio = the map gets as much horizontal
          real estate as every form field combined, which on a 1300px+
          admin viewport gives a ~600px square — operator can read every
          street label without zooming. Collapses to single column under
          lg so mid-size screens still get a sensible vertical stack. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT — live map (square, fills the column). Sticky so it
            stays in view as the operator scrolls/edits the form on
            the right. */}
        <div className="lg:sticky lg:top-4 self-start w-full order-1">
          <DeliveryZoneMapLive
            lat={lat === '' ? null : Number(lat)}
            lng={lng === '' ? null : Number(lng)}
            onMove={moveMarker}
          />
        </div>

        {/* RIGHT — title, description, address, coords, mode, max radius */}
        <div className="space-y-4 min-w-0 order-2">
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
                Quando ligado, o bot e o site geocodificam o endereço do
                cliente e selecionam a faixa de entrega pela distância (em
                km) até a pizzaria. As faixas (0–2 km, 2,1–3 km, etc.)
                são editadas na tabela abaixo — cada uma precisa ter{' '}
                <strong>distância mín./máx.</strong> preenchida.
              </p>
            </div>
          </div>

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
                    Bot e site vão geocodificar o endereço do cliente e usar
                    a faixa de km correta. Bairros não cadastrados ainda
                    podem ser entregues, desde que caiam dentro de alguma
                    faixa.
                  </>
                ) : (
                  <>Defina latitude e longitude da pizzaria antes de ligar.</>
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

          {/* Address simulator — fills the trailing whitespace of the
              right column with something genuinely useful for the
              operator: paste any address, see the same fee + ETA + map
              the bot would compute for a real customer at that point. */}
          <AddressSimulator coordsSet={coordsSet} enabled={enabled} />
        </div>

      </div>

      <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
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

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

/**
 * Plug-in address tester for the admin Delivery page.
 *
 * Operator pastes any address → backend geocodes it (Google primary,
 * Nominatim fallback), calculates the real driving distance + ETA
 * through Google Distance Matrix, picks the matching delivery band,
 * and returns a signed Static Maps URL drawing the route.
 *
 * Same logic the bot uses at /set_delivery_address — so the simulator
 * is a faithful preview of what a real customer at that address would
 * see at checkout. Useful for: phone-call quotes, scoping coverage
 * before approving a marketing campaign in a new region, debugging
 * "my address doesn't appear" complaints.
 */
function AddressSimulator({ coordsSet, enabled }) {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const mut = useMutation({
    mutationFn: deliveryApi.simulate,
    onSuccess: (data) => {
      setResult(data)
      setError(null)
      if (data && data.found === false) {
        setError(data.reason || 'Endereço não localizado.')
      }
    },
    onError: (e) => {
      setResult(null)
      setError(e.response?.data?.detail || 'Erro ao simular endereço.')
    },
  })

  function submit() {
    const a = address.trim()
    if (!a) return
    mut.mutate(a)
  }

  const d = result?.delivery
  const found = result?.found && !!d
  const outOfZone = d?.out_of_zone
  const km = d?.distance_km
  const etaMin = d?.eta_seconds ? Math.max(1, Math.round(d.eta_seconds / 60)) : null

  return (
    <div className="mt-2 pt-4 border-t border-white/5">
      <h3 className="font-display text-sm mb-1 flex items-center gap-1.5">
        <Calculator size={14} className="text-primary" />
        Simular endereço de entrega
      </h3>
      <p className="text-[11px] text-white/50 mb-3">
        Cole um endereço completo (rua, número, bairro, cidade) — o sistema
        geocoda, calcula a distância de carro real e mostra a faixa de
        taxa que pegaria. Mesma lógica que o bot usa no atendimento.
      </p>

      <div className="flex gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ex: Rua das Flores, 123, Centro, São José do Rio Preto"
          className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
          disabled={!coordsSet || mut.isPending}
        />
        <button
          onClick={submit}
          disabled={!coordsSet || !address.trim() || mut.isPending}
          className="shrink-0 px-3 h-10 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-sm font-medium flex items-center gap-1.5"
        >
          {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
          Calcular
        </button>
      </div>

      {!coordsSet && (
        <p className="text-[11px] text-warning/80 mt-2">
          Defina lat/lng da pizzaria acima antes de simular.
        </p>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200 flex items-start gap-2">
          <X size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {found && (
        <div className="mt-3 glass-card p-3 space-y-3">
          <div className="text-[11px] text-white/40 flex items-start gap-1.5">
            <Check size={12} className="text-success mt-0.5 shrink-0" />
            <span className="truncate">
              <strong className="text-white/70">Match:</strong> {result.address.formatted}
              <span className="text-white/30 ml-2">
                ({result.address.source === 'google' ? 'Google' : 'Nominatim'})
              </span>
            </span>
          </div>

          {outOfZone ? (
            <div className="text-sm text-warning">
              Fora da área de entrega
              {km != null && <span className="text-white/60"> · distância {km} km</span>}
              {d.exceeded_max_km != null && (
                <span className="text-white/60"> · acima do limite {d.exceeded_max_km} km</span>
              )}
            </div>
          ) : d.fee == null ? (
            <div className="text-sm text-warning">
              {enabled
                ? 'Distância calculada, mas nenhuma faixa cobre esse km. Adicione uma faixa apropriada na tabela.'
                : 'Cálculo por distância desligado — ative o toggle acima para que o bot use essa lógica.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Distância" value={km != null ? `${km} km` : '—'} />
              <Stat label="ETA carro" value={etaMin ? `~${etaMin} min` : '—'} />
              <Stat label="Taxa" value={brl(d.fee)} accent />
            </div>
          )}

          {result.route_image_url && (
            <img
              src={result.route_image_url}
              alt="Rota pizzaria → cliente"
              className="w-full rounded-lg block"
              style={{ maxHeight: 220, objectFit: 'cover' }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="p-2 rounded-lg bg-white/5">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div
        className="text-sm font-semibold mt-0.5"
        style={accent ? { color: '#86efac' } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
