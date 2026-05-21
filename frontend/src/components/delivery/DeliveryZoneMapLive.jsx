import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon } from 'lucide-react'

import { api } from '@/services/api'
import { loadMaps, isMapsAvailable } from '@/services/maps'

/**
 * Live (real-world) map for the distance-based delivery configuration.
 *
 * Different from DeliveryZoneMap.jsx, which is a schematic SVG view of
 * concentric bands. This one uses Google Maps JS to render the actual
 * geography — useful for "does my last band actually reach Bairro X?"
 * style questions.
 *
 * Renders:
 *   - The pizzeria as a draggable marker (drag → onMove(lat, lng))
 *   - One translucent circle per delivery band (radius = distance_max_km)
 *   - One small dot per recent order with stored coordinates
 *
 * Returns a graceful fallback message when the Google Maps key isn't
 * configured or pizzeria coordinates haven't been set yet.
 *
 * Props:
 *   lat, lng           — current pizzeria coords (numbers)
 *   onMove(lat, lng)   — fires when operator drags the pin
 */
export default function DeliveryZoneMapLive({ lat, lng, onMove }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circlesRef = useRef([])
  const orderMarkersRef = useRef([])
  const [available, setAvailable] = useState(isMapsAvailable())
  const [ready, setReady] = useState(false)

  const { data: zones = [] } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: () => api.get('/api/delivery/zones').then((r) => r.data),
  })

  const { data: recent = [] } = useQuery({
    queryKey: ['recent-order-locations'],
    queryFn: () =>
      api.get('/api/orders/recent-locations').then((r) => r.data).catch(() => []),
  })

  // Init the map exactly once, when (a) the key is present, (b) the
  // container is mounted, and (c) the parent has supplied coords (which
  // may arrive asynchronously after the bot-config query resolves). The
  // `mapRef` guard prevents a second init from a later coord change —
  // updates to lat/lng after init are handled by the next useEffect
  // which pans the marker without recreating the map.
  useEffect(() => {
    if (!available || lat == null || lng == null) return
    if (mapRef.current) return
    let cancelled = false
    loadMaps().then((g) => {
      if (cancelled || !g || !containerRef.current) {
        if (!g) setAvailable(false)
        return
      }
      const center = { lat: Number(lat), lng: Number(lng) }
      const map = new g.maps.Map(containerRef.current, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: DARK_STYLE,
      })
      const marker = new g.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: 'Pizzaria (arraste para reposicionar)',
      })
      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        if (pos && onMove) onMove(pos.lat(), pos.lng())
      })
      mapRef.current = map
      markerRef.current = marker
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, lat, lng])

  useEffect(() => {
    if (!ready || !markerRef.current || !mapRef.current) return
    if (lat == null || lng == null) return
    const pos = { lat: Number(lat), lng: Number(lng) }
    markerRef.current.setPosition(pos)
    mapRef.current.panTo(pos)
  }, [lat, lng, ready])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const g = window.google
    if (!g) return

    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = []

    const bands = (zones || [])
      .filter((z) => z.distance_max_km != null && z.is_active)
      .sort((a, b) => Number(a.distance_max_km) - Number(b.distance_max_km))

    const center = { lat: Number(lat), lng: Number(lng) }
    bands.forEach((b, i) => {
      const opacity = 0.08 + (i / Math.max(1, bands.length - 1)) * 0.20
      const circle = new g.maps.Circle({
        strokeColor: '#ef4444',
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: '#ef4444',
        fillOpacity: opacity,
        map: mapRef.current,
        center,
        radius: Number(b.distance_max_km) * 1000,
      })
      circlesRef.current.push(circle)
    })
  }, [ready, zones, lat, lng])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const g = window.google
    if (!g) return
    orderMarkersRef.current.forEach((m) => m.setMap(null))
    orderMarkersRef.current = []
    ;(recent || []).forEach((o) => {
      if (o.lat == null || o.lng == null) return
      const m = new g.maps.Marker({
        position: { lat: Number(o.lat), lng: Number(o.lng) },
        map: mapRef.current,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: '#fbbf24',
          fillOpacity: 0.85,
          strokeColor: '#92400e',
          strokeWeight: 1,
        },
        title: o.order_number ? `Pedido #${o.order_number}` : 'Pedido recente',
      })
      orderMarkersRef.current.push(m)
    })
  }, [ready, recent])

  if (!available) {
    return (
      <div className="glass-card p-4 text-sm text-white/50 flex items-center gap-2">
        <MapIcon size={16} />
        Configure <code className="text-white/70">VITE_GOOGLE_MAPS_KEY</code> para
        habilitar o mapa visual.
      </div>
    )
  }

  if (lat == null || lng == null) {
    return (
      <div className="glass-card p-4 text-sm text-white/50 flex items-center gap-2">
        <MapIcon size={16} />
        Defina as coordenadas da pizzaria abaixo para visualizar no mapa.
      </div>
    )
  }

  return (
    <div className="glass-card p-1.5 overflow-hidden">
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{ height: 320 }}
      />
      <div className="px-2 py-1.5 text-[11px] text-white/50 flex items-center gap-3">
        <span>Arraste o pin para reposicionar.</span>
        <span>Pontos amarelos = pedidos recentes ({recent.length}).</span>
      </div>
    </div>
  )
}

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2933' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2933' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa5b1' }] },
  { featureType: 'water', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', stylers: [{ color: '#323f4b' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]
