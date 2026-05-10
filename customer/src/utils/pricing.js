/**
 * Client-side price calculation for the product-detail "live total".
 *
 * Mirrors the server's menu_service helpers for the common single-flavor
 * pizza case + non-pizza case. The server is always authoritative —
 * checkout/quote re-prices using the same logic in Python and the
 * client uses that final number. This helper only exists so the user
 * sees a number update as they pick options on the detail page.
 *
 * Half/half and "sem massa" flat pricing are handled server-side; client
 * shows a placeholder ("calcular no checkout") for those cases.
 */

function _optPrice(opt, sizeName) {
  if (!opt) return 0
  if (opt.prices && typeof opt.prices === 'object') {
    if (sizeName && opt.prices[sizeName] !== undefined) return Number(opt.prices[sizeName] || 0)
    // case-insensitive
    if (sizeName) {
      const k = Object.keys(opt.prices).find(k => k.toLowerCase() === sizeName.toLowerCase())
      if (k) return Number(opt.prices[k] || 0)
    }
    return 0
  }
  return Number(opt.price || 0)
}

export function computeLineTotal(product, selection) {
  if (!product) return 0
  const { size, crust, extras = [], quantity = 1, half_with } = selection
  if (half_with) return 0  // server-priced

  // Find size entry
  const sizeEntry = (product.sizes || []).find(s => (s.size || '').toLowerCase() === (size || '').toLowerCase())
  if (!sizeEntry) return 0
  let unit = Number(sizeEntry.price || 0)

  if (product.is_pizza) {
    if (crust) {
      const c = (product.available_crusts || []).find(x => (x.name || '').toLowerCase() === crust.toLowerCase())
      unit += _optPrice(c, sizeEntry.size)
    }
    for (const ex of extras) {
      const e = (product.available_extras || []).find(x => (x.name || '').toLowerCase() === ex.toLowerCase())
      unit += _optPrice(e, sizeEntry.size)
    }
  }
  return Math.round(unit * quantity * 100) / 100
}

export function buildDescription(product, selection) {
  if (!product) return ''
  const { size, crust, extras = [] } = selection
  let parts = [product.name]
  if (product.is_pizza) {
    if (size) parts.push(`(${size})`)
    if (crust && crust.toLowerCase() !== 'sem borda') parts.push(`borda ${crust}`)
    if (extras.length) parts.push(`+ ${extras.join(', ')}`)
  } else if (size && size.toLowerCase() !== 'único') {
    parts.push(`(${size})`)
  }
  return parts.join(' ')
}
