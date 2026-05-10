/** R$ XX,XX — always 2 decimals, comma as separator. */
export function brl(value) {
  const n = Number(value || 0)
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

/** "10 de mai, 19:42" — short Brazilian date+time. */
export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = months[d.getMonth()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd} de ${mm}, ${hh}:${mi}`
}

/** "agora", "há 2 min", "há 1 h" — for live status updates. */
export function timeAgo(iso) {
  const d = new Date(iso)
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `há ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const days = Math.floor(h / 24)
  return `há ${days} d`
}
