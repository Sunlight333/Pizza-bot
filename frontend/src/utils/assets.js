/**
 * Single source of truth for static asset paths.
 * Files live under frontend/public/images so they're served at /images/...
 * directly without going through Vite's module pipeline.
 *
 * Real pizza photos live under frontend/public/menu/{savory,sweet,marketing}
 * and are served at /menu/...
 */
export const ASSETS = {
  brand: {
    // Single canonical brand mark — same file used by the public landing,
    // the unified login, the customer top bar, and the admin sidebar so
    // the logo stays consistent everywhere. Update this one path to
    // swap the brand mark across the whole project.
    logo: '/images/landing/logo.png',
    og: '/images/landing/social/og-image.png',
  },
  backgrounds: {
    login: '/images/backgrounds/login-bg.png',
    authPattern: '/images/backgrounds/auth-pattern.png',
    dashboardHero: '/images/backgrounds/dashboard-hero.png',
    loginPizzaPoster: '/images/backgrounds/login-pizza-poster.png',
    orderGlobePoster: '/images/backgrounds/order-globe-poster.png',
  },
  icons: {
    avatar: '/images/icons/avatar-placeholder.png',
    channel: {
      whatsapp: '/images/icons/channel-whatsapp.png',
      manual: '/images/icons/channel-manual.png',
    },
    health: {
      ok: '/images/icons/health-ok.png',
      degraded: '/images/icons/health-degraded.png',
      down: '/images/icons/health-down.png',
    },
    payment: {
      pix: '/images/icons/payment-pix.png',
      credit: '/images/icons/payment-card.png',
      debit: '/images/icons/payment-card.png',
      cash: '/images/icons/payment-cash.png',
      pickup: '/images/icons/payment-cash.png',
    },
    status: {
      received: '/images/icons/status-pending.png',
      confirmed: '/images/icons/status-pending.png',
      preparing: '/images/icons/status-preparing.png',
      out_for_delivery: '/images/icons/status-out-for-delivery.png',
      delivered: '/images/icons/status-delivered.png',
      cancelled: '/images/icons/status-cancelled.png',
    },
    toast: {
      info: '/images/icons/toast-info.png',
      success: '/images/icons/toast-success.png',
      error: '/images/icons/toast-error.png',
    },
  },
  menu: {
    category: {
      // Match against Category.name from the seed; falls back to placeholder.
      'Pizzas Salgadas': '/images/menu/cat-pizza-salgada.png',
      'Pizzas Doces': '/images/menu/cat-pizza-doce.png',
      Bebidas: '/images/menu/cat-bebidas.png',
      Acompanhamentos: '/images/menu/cat-acompanhamentos.png',
    },
    // Hero photos for the category banner backdrop on the Menu page.
    hero: {
      'Pizzas Salgadas': '/menu/savory/pizza-margherita-classica.jpeg',
      'Pizzas Doces': '/menu/sweet/pizza-doce-chocolate-amendoim.jpeg',
    },
    productPlaceholder: '/images/menu/placeholder-product.png',
    fallback: {
      savory: '/menu/savory/pizza-margherita-classica.jpeg',
      sweet: '/menu/sweet/pizza-doce-chocolate-amendoim.jpeg',
    },
  },
  marketing: {
    // Customer-facing flyer ("A FOME BATEU? É só ligar!") — meant for outbound
    // WhatsApp campaigns, not admin chrome.
    fomeBateu: '/menu/marketing/marketing-fome-bateu.jpeg',
  },
}

export const categoryImage = (name) =>
  ASSETS.menu.category[name] || ASSETS.menu.productPlaceholder

export const categoryHero = (name) =>
  ASSETS.menu.hero[name] || categoryImage(name)

// Most-specific keyword first — first match wins, so multi-word entries
// (e.g. "carne seca", "tomate seco") must precede their single-word substrings.
const PIZZA_IMAGE_RULES = [
  { keyword: 'meio a meio', image: '/menu/savory/pizza-meio-a-meio-quatro-queijos-milho.jpeg' },
  { keyword: 'romeu', image: '/menu/sweet/pizza-doce-romeu-julieta.jpeg' },
  { keyword: 'julieta', image: '/menu/sweet/pizza-doce-romeu-julieta.jpeg' },
  { keyword: 'brigadeiro', image: '/menu/sweet/pizza-doce-brigadeiro-coco.jpeg' },
  { keyword: 'prestigio', image: '/menu/sweet/pizza-doce-brigadeiro-coco.jpeg' },
  { keyword: 'pessego', image: '/menu/sweet/pizza-doce-meio-a-meio-chocolate-pessego.jpeg' },
  { keyword: 'chocolate', image: '/menu/sweet/pizza-doce-chocolate-amendoim.jpeg' },
  { keyword: 'banana', image: '/menu/sweet/pizza-doce-chocolate-amendoim.jpeg' },
  { keyword: 'bananela', image: '/menu/savory/pizza-bananela-bacon.jpeg' },
  { keyword: 'carne seca', image: '/menu/savory/pizza-charque-cebola.jpeg' },
  { keyword: 'charque', image: '/menu/savory/pizza-charque-cebola.jpeg' },
  { keyword: 'tomate seco', image: '/menu/savory/pizza-rucula-tomate-seco.jpeg' },
  { keyword: 'rucula', image: '/menu/savory/pizza-rucula-tomate-seco.jpeg' },
  { keyword: 'frango com catupiry', image: '/menu/savory/pizza-frango-catupiry.jpeg' },
  { keyword: 'frango com milho', image: '/menu/savory/pizza-charque-milho.jpeg' },
  { keyword: 'frango', image: '/menu/savory/pizza-frango-cremoso.jpeg' },
  { keyword: 'catupiry', image: '/menu/savory/pizza-frango-catupiry.jpeg' },
  { keyword: 'portuguesa', image: '/menu/savory/pizza-portuguesa-classica.jpeg' },
  { keyword: 'calabresa', image: '/menu/savory/pizza-calabresa-cebola-rodelas.jpeg' },
  { keyword: 'margherita', image: '/menu/savory/pizza-margherita-classica.jpeg' },
  { keyword: 'mussarela', image: '/menu/savory/pizza-mussarela-tomate.jpeg' },
  { keyword: 'napolitana', image: '/menu/savory/pizza-margherita-tomate-fatias.jpeg' },
  { keyword: 'mexicana', image: '/menu/savory/pizza-toscana-pimentao.jpeg' },
  { keyword: 'toscana', image: '/menu/savory/pizza-toscana-pimentao.jpeg' },
  { keyword: 'paulista', image: '/menu/savory/pizza-toscana-pimentao.jpeg' },
  { keyword: 'salame', image: '/menu/savory/pizza-calabresa-frango-grande.jpeg' },
  { keyword: 'salgadas', image: '/menu/savory/pizza-margherita-classica.jpeg' },
  { keyword: 'serrana', image: '/menu/savory/pizza-margherita-cebola.jpeg' },
  { keyword: 'baiana', image: '/menu/savory/pizza-mista-carnes.jpeg' },
  { keyword: 'mista', image: '/menu/savory/pizza-mix-completa.jpeg' },
  { keyword: 'lombo', image: '/menu/savory/pizza-mista-carnes.jpeg' },
  { keyword: 'bacon', image: '/menu/savory/pizza-bacon-ovo.jpeg' },
  { keyword: 'brocolis', image: '/menu/savory/pizza-brocolis.jpeg' },
  { keyword: 'escarola', image: '/menu/savory/pizza-bacon-rucula-cebola.jpeg' },
  { keyword: 'presunto', image: '/menu/savory/pizza-presunto-tomate.jpeg' },
  { keyword: 'queijo', image: '/menu/savory/pizza-quatro-queijos-cheddar.jpeg' },
  { keyword: 'milho', image: '/menu/savory/pizza-charque-milho.jpeg' },
  { keyword: 'pepperoni', image: '/menu/savory/pizza-calabresa-cebola-rodelas.jpeg' },
  { keyword: 'vegetariana', image: '/menu/savory/pizza-brocolis.jpeg' },
  { keyword: 'palmito', image: '/menu/savory/pizza-mussarela-tomate.jpeg' },
  { keyword: 'peito de peru', image: '/menu/savory/pizza-presunto-tomate.jpeg' },
  { keyword: 'strogonoff', image: '/menu/savory/pizza-mista-carnes.jpeg' },
  { keyword: 'provolone', image: '/menu/savory/pizza-quatro-queijos-cheddar.jpeg' },
  { keyword: 'romana', image: '/menu/savory/pizza-calabresa-frango-grande.jpeg' },
  { keyword: 'francesa', image: '/menu/savory/pizza-margherita-cebola.jpeg' },
  { keyword: 'espanhola', image: '/menu/savory/pizza-calabresa-cebola.jpeg' },
  { keyword: 'hot dog', image: '/menu/savory/pizza-calabresa-cebola.jpeg' },
  { keyword: 'atum', image: '/menu/savory/pizza-mussarela-tomate.jpeg' },
  { keyword: 'alho', image: '/menu/savory/pizza-mussarela-tabua.jpeg' },
]

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics

/**
 * Map a pizza product name (and optionally its category) to a real photo
 * served from /menu/savory or /menu/sweet. Returns the placeholder if nothing
 * matches.
 *
 * Used by the Menu page to fill product card thumbnails when an item has no
 * explicit `image_url` set in the database.
 */
export const pizzaImage = (name, categoryName) => {
  const n = normalize(name)
  for (const rule of PIZZA_IMAGE_RULES) {
    if (n.includes(rule.keyword)) return rule.image
  }
  const cat = normalize(categoryName)
  if (cat.includes('doce')) return ASSETS.menu.fallback.sweet
  if (cat.includes('salgada') || cat.includes('pizza')) return ASSETS.menu.fallback.savory
  return ASSETS.menu.productPlaceholder
}
