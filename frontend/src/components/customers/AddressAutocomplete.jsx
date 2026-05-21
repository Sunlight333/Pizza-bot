import { useEffect, useRef, useState } from 'react'
import { Search, MapPin } from 'lucide-react'

import { loadMaps, isMapsAvailable } from '@/services/maps'

/**
 * Google Places Autocomplete input.
 *
 * Renders nothing when no Maps key is configured — callers must render
 * the legacy manual form as fallback, so the page never breaks.
 *
 * On place selection, calls onPick with a structured payload:
 *   { street, number, neighborhood, city, cep,
 *     lat, lng, place_id, formatted }
 *
 * The parent form should merge those fields into its draft; the user
 * can still tweak any individual field after (Google sometimes gets the
 * house number wrong on long streets).
 *
 * Props:
 *   onPick(payload)  — required, called on Google place selection
 *   biasLat, biasLng — optional centre for proximity bias (pizzeria coords)
 *   biasRadiusKm     — optional bias radius in km, default 15
 */
export default function AddressAutocomplete({
  onPick,
  biasLat,
  biasLng,
  biasRadiusKm = 15,
}) {
  const inputRef = useRef(null)
  const acRef = useRef(null)
  const [available, setAvailable] = useState(isMapsAvailable())
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!available) return
    let cancelled = false
    setLoading(true)
    loadMaps().then((g) => {
      if (cancelled || !g || !inputRef.current) {
        setLoading(false)
        if (!g) setAvailable(false)
        return
      }
      const options = {
        componentRestrictions: { country: 'br' },
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
        types: ['address'],
      }
      if (biasLat != null && biasLng != null) {
        options.locationBias = {
          center: { lat: Number(biasLat), lng: Number(biasLng) },
          radius: biasRadiusKm * 1000,
        }
      }
      const ac = new g.maps.places.Autocomplete(inputRef.current, options)
      acRef.current = ac
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const payload = parsePlace(place)
        if (payload) {
          onPick?.(payload)
          // Keep the visible text in sync with what Google says.
          setText(payload.formatted || '')
        }
      })
      setLoading(false)
    })
    return () => {
      cancelled = true
      // Google attaches a pac-container directly to <body>; cleaning up
      // the listener on the Autocomplete instance is enough — gc handles
      // the rest when the input is removed from the DOM.
      if (acRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(acRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available])

  if (!available) return null

  return (
    <label className="block">
      <span className="text-[11px] text-white/50 flex items-center gap-1">
        <MapPin size={11} /> Buscar endereço (Google)
      </span>
      <div className="relative mt-0.5">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={loading ? 'Carregando…' : 'Digite e selecione um endereço'}
          disabled={loading}
          className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          autoComplete="off"
        />
      </div>
      <span className="text-[10px] text-white/40 mt-1 block">
        Sugestões automáticas. Você pode ajustar os campos abaixo depois.
      </span>
    </label>
  )
}

/**
 * Parse a Google Places result into our internal address shape.
 * Returns null if the place has no geometry (e.g. user typed without
 * picking a suggestion).
 */
function parsePlace(place) {
  if (!place?.geometry?.location) return null
  const comps = place.address_components || []
  const get = (type) => comps.find((c) => (c.types || []).includes(type))

  const street = get('route')?.long_name || ''
  const number = get('street_number')?.long_name || ''
  // Google uses 'sublocality_level_1' for neighbourhood in Brazil.
  const neighborhood =
    get('sublocality_level_1')?.long_name ||
    get('sublocality')?.long_name ||
    get('political')?.long_name ||
    ''
  // Brazilian city sometimes lands in 'administrative_area_level_2' (município)
  // and sometimes in 'locality' (older mapping). Pick whichever is present.
  const city =
    get('administrative_area_level_2')?.long_name ||
    get('locality')?.long_name ||
    ''
  const cep = (get('postal_code')?.long_name || '').replace(/\D/g, '')

  const loc = place.geometry.location
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng

  return {
    street,
    number,
    neighborhood,
    city,
    cep,
    lat,
    lng,
    place_id: place.place_id || null,
    formatted: place.formatted_address || '',
  }
}
