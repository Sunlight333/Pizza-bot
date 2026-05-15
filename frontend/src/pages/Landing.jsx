import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowRight,
  Check,
  Clock,
  Flame,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Star,
  Wheat,
  Wallet,
  Bike,
  X,
} from 'lucide-react'

import { getApiBase } from '@/utils/apiUrl'
import '@/styles/landing.css'

// -- Brand constants --------------------------------------------------------
// Edit these once to retarget the page (single source of truth).
const BRAND = {
  name: 'Forno do Bairro',
  tagline: 'Forno a lenha · Pedido pelo WhatsApp',
  // WhatsApp — for wa.me/<digits> chat links. Two separate numbers because
  // the pizzaria has a chat-only mobile (WhatsApp) and a separate landline
  // for voice calls; they're not the same line.
  whatsappNumber: '5517991289777',     // intl format, digits only — for wa.me
  whatsappDisplay: '(17) 99128-9777',  // formatted for humans
  whatsappText: 'Olá! Quero fazer um pedido 🍕',
  phone: '(17) 3237-1112',             // landline, display
  phoneDigits: '551732371112',         // landline, intl format for tel:
  address: 'Rua das Pizzas, 123 — Vila Madalena, São Paulo',
  hoursShort: 'Ter–Dom · 18h às 23h',
  hours: [
    ['Segunda', 'Fechado'],
    ['Terça a Quinta', '18:00 – 23:00'],
    ['Sexta e Sábado', '18:00 – 00:00'],
    ['Domingo', '18:00 – 23:00'],
  ],
  rating: { stars: 4.9, count: 248, source: 'Google' },
  etaMinutes: 35,
}

// Reusable motion preset for entry-on-scroll
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

// =========================================================================
// Live WhatsApp wiring
// -------------------------------------------------------------------------
// Every CTA routes to BRAND.whatsappNumber — the single, customer-facing
// WhatsApp the pizzaria advertises (matches what's printed on the menu).
// We still poll the backend for Cloud API health so the UI can show a
// friendly "bot is configuring" modal when the bot won't reply for a
// while; that flag drives the modal only, never the routed number.
// =========================================================================
async function fetchWhatsappStatus() {
  const url = `${getApiBase()}/api/whatsapp/public/whatsapp`
  const res = await fetch(url, {
    signal: AbortSignal.timeout?.(5000),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json() // { connected: bool, phone: string|null, status: string }
}

function useWhatsappStatus() {
  return useQuery({
    queryKey: ['public-whatsapp'],
    queryFn: fetchWhatsappStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

const WhatsAppContext = createContext(null)

function WhatsAppProvider({ children }) {
  const { data, isLoading } = useWhatsappStatus()
  const [offlineOpen, setOfflineOpen] = useState(false)

  const connected = !!data?.connected
  // Always advertise the canonical number — Cloud API echoes it from the
  // WABA, but BRAND.whatsappNumber is what's printed on flyers and
  // shouldn't drift if the WABA is ever swapped.
  const phone = BRAND.whatsappNumber
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(BRAND.whatsappText)}`

  const value = useMemo(
    () => ({
      connected,
      phone,
      url,
      isLoading,
      openOffline: () => setOfflineOpen(true),
    }),
    [connected, phone, url, isLoading],
  )

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
      <WhatsAppOfflineModal open={offlineOpen} onClose={() => setOfflineOpen(false)} />
    </WhatsAppContext.Provider>
  )
}

function useWhatsapp() {
  return (
    useContext(WhatsAppContext) ?? {
      connected: false,
      phone: null,
      url: null,
      isLoading: false,
      openOffline: () => {},
    }
  )
}

/**
 * Smart link: when the bot is paired, renders an `<a>` to wa.me/<live-number>;
 * when it isn't, renders a `<button>` that opens the reassuring modal. Same
 * className/children API so existing CTAs swap in directly.
 */
function WhatsAppLink({ children, className, ...rest }) {
  const { connected, url, openOffline } = useWhatsapp()
  if (connected && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...rest}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={openOffline} className={className} {...rest}>
      {children}
    </button>
  )
}

function WhatsAppOfflineModal({ open, onClose }) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="wa-offline-title"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{
              background: 'rgba(31,24,21,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative landing-card-3d w-full max-w-md p-7 sm:p-8"
            style={{ borderRadius: 24 }}
          >
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full grid place-items-center transition-colors"
              style={{ color: 'var(--charcoal-soft)' }}
            >
              <X size={18} />
            </button>

            <div
              className="w-12 h-12 rounded-2xl grid place-items-center mb-5"
              style={{
                background: 'linear-gradient(180deg, #FFE4A8 0%, #FFD367 100%)',
                color: 'var(--charcoal)',
                boxShadow: '0 6px 14px -6px rgba(139,26,26,0.4)',
              }}
            >
              <MessageCircle size={22} />
            </div>

            <span className="landing-eyebrow">Atendimento</span>
            <h3
              id="wa-offline-title"
              className="landing-display text-2xl sm:text-3xl mt-3"
            >
              A gente já tá voltando.
            </h3>
            <p
              className="mt-4 text-[15px] leading-relaxed"
              style={{ color: 'var(--charcoal-soft)' }}
            >
              Nosso WhatsApp está sendo configurado nesse exato momento.
              Pode <strong>ligar agora pelo telefone</strong> que a gente
              atende rapidinho — ou volte em alguns minutos pra fazer o
              pedido por mensagem.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a
                href={`tel:+${BRAND.phoneDigits}`}
                className="btn-ember flex-1 text-center justify-center"
                onClick={onClose}
              >
                <Phone size={18} />
                Ligar para {BRAND.phone}
              </a>
              <button
                type="button"
                onClick={onClose}
                className="btn-outline flex-1 justify-center"
              >
                Fechar
              </button>
            </div>

            <p
              className="mt-5 text-xs"
              style={{ color: 'var(--charcoal-soft)' }}
            >
              Atendimento {BRAND.hoursShort}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =========================================================================
// Top nav — transparent over hero, opaque after scroll
// =========================================================================
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'rgba(248,241,228,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(31,24,21,0.08)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <img
            src="/images/landing/logo.png"
            alt={BRAND.name}
            className="w-10 h-10 rounded-xl object-cover"
            style={{
              boxShadow:
                '0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 18px -8px rgba(139,26,26,0.45)',
            }}
            draggable="false"
          />
          <span className="font-display text-lg" style={{ color: 'var(--charcoal)' }}>
            {BRAND.name}
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: 'var(--charcoal)' }}>
          <a href="#cardapio" className="hover:text-[var(--ovenred)] transition-colors">Cardápio</a>
          <a href="#como-funciona" className="hover:text-[var(--ovenred)] transition-colors">Como funciona</a>
          <a href="#avaliacoes" className="hover:text-[var(--ovenred)] transition-colors">Avaliações</a>
          <a href="#entrega" className="hover:text-[var(--ovenred)] transition-colors">Entrega</a>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Single sign-in entry — same /login page handles both
              customers (email + password + first-time OTP) and staff
              (username + password). The form detects which by whether
              '@' appears in the identifier. */}
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-[var(--ovenred)] px-3 py-2 rounded-lg border"
            style={{ color: 'var(--charcoal)', borderColor: 'rgba(31,24,21,0.15)' }}
          >
            <Lock size={14} />
            Entrar
          </Link>

          <WhatsAppLink className="btn-whatsapp text-sm px-4 py-2.5">
            <MessageCircle size={16} />
            <span className="hidden sm:inline">Pedir pelo WhatsApp</span>
            <span className="sm:hidden">Pedir</span>
          </WhatsAppLink>
        </div>
      </div>
    </header>
  )
}

// =========================================================================
// Hero — large, with parallax photo, 3D pizza, floating chips
// =========================================================================
function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const yPhoto = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : ['0%', '18%'])
  const yPizza = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : ['0%', '-12%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4])

  return (
    <section ref={ref} id="top" className="relative pt-28 md:pt-36 pb-20 md:pb-28 overflow-hidden">
      {/* Backdrop photo — wood-fired oven, parallax */}
      <motion.div
        aria-hidden="true"
        className="absolute -top-10 right-[-10%] w-[120%] md:w-[70%] h-[80%] opacity-25 md:opacity-40 pointer-events-none"
        style={{
          y: yPhoto,
          backgroundImage: 'url(/images/landing/hero/woodfired-desktop.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          maskImage:
            'radial-gradient(60% 60% at 60% 40%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)',
          WebkitMaskImage:
            'radial-gradient(60% 60% at 60% 40%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 relative">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-6 items-center">
          {/* Left — copy & CTAs */}
          <motion.div
            className="lg:col-span-6"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.span variants={fadeUp} className="landing-eyebrow">
              Pizzaria do bairro
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="landing-display mt-5 text-[2.6rem] sm:text-6xl lg:text-[4.2rem]"
            >
              Pizza assada na hora,
              <br />
              <span style={{ color: 'var(--ovenred)' }}>
                entregue ainda quente.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg max-w-xl"
              style={{ color: 'var(--charcoal-soft)' }}
            >
              Massa fermentada por <strong>48 horas</strong>, forno a lenha de verdade,
              motoboy do bairro. Você manda mensagem, a gente assa, sai do
              forno direto pra sua porta.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
              <WhatsAppLink className="btn-whatsapp">
                <MessageCircle size={18} />
                Pedir pelo WhatsApp
                <ArrowRight size={16} className="opacity-70" />
              </WhatsAppLink>
              {/* Pedir online — equal-weight alternative; routes through
                  /login (redirects to /cardapio after auth). */}
              <Link to="/login?next=%2Fcardapio" className="btn-outline">
                Pedir online
                <ArrowRight size={16} className="opacity-70" />
              </Link>
            </motion.div>

            {/* Inline social proof row */}
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <div className="star-row">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <span className="text-sm font-medium">{BRAND.rating.stars}</span>
                <span className="text-sm" style={{ color: 'var(--charcoal-soft)' }}>
                  · {BRAND.rating.count} avaliações no Google
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--charcoal-soft)' }}>
                <Clock size={15} />
                <span>Tempo médio: <strong>{BRAND.etaMinutes} min</strong></span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — clean paper-stock card, pizza inside, with overlapping
              glass chips on the edges. Matches the rest of the landing's
              card system (story / featured / offers). */}
          <motion.div
            className="lg:col-span-6 flex justify-center"
            style={{ y: yPizza, opacity }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative w-full max-w-[460px]">
              <div className="hero-card">
                <div className="hero-card-image">
                  <img
                    src="/images/landing/hero/closeup-desktop.png"
                    alt="Pizza margherita saindo do forno a lenha"
                    draggable="false"
                  />
                  <div className="hero-card-caption">
                    <div>
                      <div className="eyebrow">Margherita</div>
                      <div className="title">Saída do forno</div>
                    </div>
                    <span className="badge">~90s no forno</span>
                  </div>
                </div>
              </div>

              {/* Floating chip — top-right: forno a lenha */}
              <motion.div
                className="landing-chip absolute -top-3 -right-3 sm:-right-6 landing-float-slow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <Flame size={14} style={{ color: 'var(--ovenred)' }} />
                <span>Forno a lenha · 380°C</span>
              </motion.div>

              {/* Floating chip — left: 48h dough */}
              <motion.div
                className="landing-chip absolute top-1/3 -left-3 sm:-left-6 landing-float-mid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <Wheat size={14} style={{ color: 'var(--ovenred)' }} />
                <span>Massa fermentada 48h</span>
              </motion.div>

              {/* Floating ETA card — bottom-right, overlapping the card */}
              <motion.div
                className="absolute -bottom-6 -right-3 sm:-right-8 landing-card-3d px-5 py-4 flex items-center gap-3"
                style={{ borderRadius: 18 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
              >
                <span className="step-marker" style={{ width: 36, height: 36, borderRadius: 12 }}>
                  <Bike size={18} />
                </span>
                <div className="text-left">
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ovenred)' }}>
                    Saindo agora
                  </div>
                  <div className="font-display text-base">
                    Chega em ~{BRAND.etaMinutes} min
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// =========================================================================
// Marquee — scrolling trust strip
// =========================================================================
function TrustMarquee() {
  const items = [
    ['⭐', `${BRAND.rating.stars} no Google · ${BRAND.rating.count} avaliações`],
    ['🔥', 'Forno a lenha de verdade'],
    ['🍕', 'Massa fermentada 48 horas'],
    ['🛵', `Entrega em ${BRAND.etaMinutes} minutos`],
    ['💳', 'Pix · Cartão · Dinheiro na entrega'],
    ['📱', 'Pedido fácil pelo WhatsApp'],
    ['🧀', 'Mussarela cortada todo dia'],
    ['🍅', 'Molho de tomate pelado italiano'],
  ]
  // Duplicated for seamless loop
  const row = [...items, ...items]
  return (
    <section className="py-8 border-y" style={{ borderColor: 'rgba(31,24,21,0.08)', background: 'rgba(255,252,247,0.6)' }}>
      <div className="overflow-hidden mask-fade">
        <div className="landing-marquee">
          {row.map(([emoji, text], i) => (
            <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--charcoal-soft)' }}>
              <span className="text-base">{emoji}</span>
              <span className="font-medium">{text}</span>
              <span aria-hidden className="opacity-30">•</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`.mask-fade { mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }`}</style>
    </section>
  )
}

// =========================================================================
// Story — heritage / craft
// =========================================================================
function Story() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        {/* Left — image collage with explicit grid-template-areas
           so cells never collapse. 6 cols × 6 rows = 36 cells, exact fit. */}
        <div
          className="lg:col-span-7 gap-4 h-[460px] sm:h-[560px] lg:h-[640px]"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gridTemplateRows: 'repeat(6, 1fr)',
            gridTemplateAreas: `
              "oven oven oven oven dough dough"
              "oven oven oven oven dough dough"
              "oven oven oven oven ingr ingr"
              "oven oven oven oven ingr ingr"
              "pzia pzia store store cool cool"
              "pzia pzia store store cool cool"
            `,
          }}
        >
          {[
            { area: 'oven', src: '/images/landing/story/oven-flames-detail.png', pos: 'center', delay: 0 },
            { area: 'dough', src: '/images/landing/story/dough-stretching.png', pos: 'center', delay: 0.08 },
            { area: 'ingr', src: '/images/landing/story/ingredients-knolling.png', pos: 'center', delay: 0.16 },
            { area: 'pzia', src: '/images/landing/story/pizzaiolo-back-at-oven.png', pos: '50% 35%', delay: 0.24 },
            { area: 'store', src: '/images/landing/story/storefront-blue-hour.png', pos: 'center', delay: 0.32 },
            { area: 'cool', src: '/images/landing/story/cooling-rack-trio.png', pos: 'center', delay: 0.40 },
          ].map((p) => (
            <motion.div
              key={p.area}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
              className="photo-3d"
              style={{
                gridArea: p.area,
                backgroundImage: `url(${p.src})`,
                backgroundSize: 'cover',
                backgroundPosition: p.pos,
                minHeight: 0,
                minWidth: 0,
              }}
            />
          ))}
        </div>

        {/* Right — copy */}
        <motion.div
          className="lg:col-span-5"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="landing-eyebrow">Nossa cozinha</span>
          <h2 className="landing-display text-4xl sm:text-5xl mt-5">
            Pizza como devia ser:{' '}
            <em style={{ color: 'var(--ovenred)' }}>simples, quente, generosa.</em>
          </h2>
          <p className="mt-6 text-lg" style={{ color: 'var(--charcoal-soft)' }}>
            A massa descansa <strong>48 horas</strong> antes de virar disco. O molho é
            de tomate pelado, sem atalho. O forno é a lenha, marca a borda, dá aquele
            cheiro que entrega o motoboy antes do interfone tocar.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ['Massa fermentada 48h', 'Mais leve, mais digestiva, mais sabor.'],
              ['Forno a lenha 380°C', 'Borda crocante, miolo macio, em 90 segundos.'],
              ['Mussarela fresca', 'Cortada na faca todo dia, nunca pré-rasgada.'],
            ].map(([title, sub]) => (
              <li key={title} className="flex gap-3">
                <span
                  className="mt-0.5 w-6 h-6 rounded-full grid place-items-center shrink-0"
                  style={{
                    background: 'linear-gradient(180deg, #FFE4A8, #FFD367)',
                    boxShadow: '0 4px 10px -4px rgba(139,26,26,0.4)',
                  }}
                >
                  <Check size={14} style={{ color: 'var(--charcoal)' }} strokeWidth={3} />
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm" style={{ color: 'var(--charcoal-soft)' }}>{sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

// =========================================================================
// Featured menu
// =========================================================================
function FeaturedMenu() {
  const items = [
    {
      name: 'Margherita',
      image: '/menu/savory/pizza-margherita-classica.jpeg',
      ingredients: 'Mussarela de búfala, tomate pelado, manjericão fresco',
      price: 'R$ 49',
      tag: 'A clássica',
    },
    {
      name: 'Calabresa',
      image: '/menu/savory/pizza-calabresa-cebola-rodelas.jpeg',
      ingredients: 'Calabresa artesanal, cebola roxa, mussarela, azeitona',
      price: 'R$ 52',
      tag: 'Mais pedida',
    },
    {
      name: 'Quatro Queijos',
      image: '/menu/savory/pizza-quatro-queijos-cheddar.jpeg',
      ingredients: 'Mussarela, gorgonzola, parmesão, catupiry',
      price: 'R$ 58',
      tag: 'Cremosa',
    },
    {
      name: 'Romeu & Julieta',
      image: '/menu/sweet/pizza-doce-romeu-julieta.jpeg',
      ingredients: 'Mussarela, goiabada cremosa, raspas de canela',
      price: 'R$ 46',
      tag: 'Doce',
    },
  ]

  return (
    <section id="cardapio" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <span className="landing-eyebrow">Cardápio</span>
            <h2 className="landing-display text-4xl sm:text-5xl mt-4 max-w-xl">
              As mais pedidas da casa.
            </h2>
          </div>
          <WhatsAppLink
            className="text-sm font-semibold inline-flex items-center gap-1.5 group"
            style={{ color: 'var(--ovenred)' }}
          >
            Ver cardápio completo
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </WhatsAppLink>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((p, i) => (
            <motion.article
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="landing-card-3d p-3 group"
            >
              <div
                className="aspect-square rounded-2xl bg-center bg-cover relative overflow-hidden"
                style={{ backgroundImage: `url(${p.image})` }}
              >
                <span
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: 'rgba(255,252,247,0.92)',
                    color: 'var(--ovenred)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {p.tag}
                </span>
              </div>
              <div className="p-4 pt-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl">{p.name}</h3>
                  <span className="font-display text-lg" style={{ color: 'var(--ovenred)' }}>{p.price}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--charcoal-soft)' }}>
                  {p.ingredients}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

// =========================================================================
// How it works — 4 steps with photos
// =========================================================================
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Você manda zap',
      copy: 'Abre o WhatsApp e diz qual pizza quer. Pode falar normal — “uma calabresa grande e duas Cocas”.',
      image: '/images/landing/how-it-works/01-choose-on-phone.png',
    },
    {
      n: '02',
      title: 'A gente confirma',
      copy: 'Em segundos a cozinha recebe o pedido com tamanho, sabor, observações e endereço.',
      image: '/images/landing/how-it-works/02-kitchen-ticket.png',
    },
    {
      n: '03',
      title: 'Sai do forno',
      copy: 'Forno a lenha, 380°C. Em noventa segundos a pizza tá pronta, na borda crocante.',
      image: '/images/landing/how-it-works/03-pizza-into-oven.png',
    },
    {
      n: '04',
      title: 'Chega quentinha',
      copy: 'Motoboy do bairro, caixa térmica, entrega em até 35 minutos no seu portão.',
      image: '/images/landing/how-it-works/04-handover-at-door.png',
    },
  ]

  return (
    <section id="como-funciona" className="py-24 md:py-32" style={{ background: 'var(--offwhite)' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="landing-eyebrow">Como funciona</span>
          <h2 className="landing-display text-4xl sm:text-5xl mt-4">
            Quatro passos. Zero fricção.
          </h2>
          <p className="mt-5 text-lg" style={{ color: 'var(--charcoal-soft)' }}>
            Sem app pra baixar, sem cadastro chato. Você usa o WhatsApp que já
            tem no bolso.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div
                className="aspect-[4/5] rounded-2xl bg-center bg-cover photo-3d"
                style={{ backgroundImage: `url(${s.image})` }}
              />
              <div className="mt-5 flex items-start gap-4">
                <span className="step-marker shrink-0">{s.n}</span>
                <div>
                  <h3 className="font-display text-xl">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--charcoal-soft)' }}>
                    {s.copy}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <WhatsAppLink className="btn-whatsapp">
            <MessageCircle size={18} />
            Começar pedido agora
          </WhatsAppLink>
        </div>
      </div>
    </section>
  )
}

// =========================================================================
// Offers — combos & promos
// =========================================================================
function Offers() {
  const offers = [
    {
      tag: '20% OFF',
      title: 'Combo Família',
      desc: 'Pizza grande + pizza brotinho doce + refrigerante 2L.',
      image: '/images/landing/offers/combo-familia.png',
      price: 'R$ 89',
      from: 'R$ 112',
    },
    {
      tag: 'CASAL',
      title: 'Combo Casal',
      desc: 'Duas pizzas brotinho (1 salgada + 1 doce) + duas Heinekens.',
      image: '/images/landing/offers/combo-casal.png',
      price: 'R$ 65',
      from: 'R$ 78',
    },
    {
      tag: 'TERÇA DOCE',
      title: 'Toda terça',
      desc: 'Pizza doce em dobro pelo preço de uma. Só na terça, só por delivery.',
      image: '/images/landing/offers/promo-terca-doce.png',
      price: '2 x 1',
      from: '',
    },
    {
      tag: 'BALCÃO',
      title: 'Retirada rápida',
      desc: 'Pediu pelo zap, passou e levou. Sem fila, sem taxa de entrega.',
      image: '/images/landing/offers/promo-balcao-rapido.png',
      price: '−R$ 6',
      from: 'sem taxa',
    },
  ]

  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <span className="landing-eyebrow">Ofertas da semana</span>
            <h2 className="landing-display text-4xl sm:text-5xl mt-4 max-w-2xl">
              Combos pra quem tá com fome de verdade.
            </h2>
          </div>
          <span
            className="landing-chip"
            style={{ background: 'rgba(255, 215, 0, 0.20)', borderColor: 'rgba(139,26,26,0.18)' }}
          >
            <Flame size={14} style={{ color: 'var(--ovenred)' }} />
            Atualizadas toda segunda
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {offers.map((o, i) => (
            <motion.article
              key={o.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="landing-card-3d overflow-hidden relative"
            >
              <span className="discount-tag">{o.tag}</span>
              <div
                className="aspect-[4/3] bg-center bg-cover"
                style={{ backgroundImage: `url(${o.image})` }}
              />
              <div className="p-6">
                <h3 className="font-display text-2xl">{o.title}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--charcoal-soft)' }}>{o.desc}</p>
                <div className="mt-5 flex items-end justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl" style={{ color: 'var(--ovenred)' }}>{o.price}</span>
                    {o.from && (
                      <span className="text-sm line-through" style={{ color: 'var(--charcoal-soft)' }}>
                        {o.from}
                      </span>
                    )}
                  </div>
                  <WhatsAppLink
                    className="text-sm font-semibold inline-flex items-center gap-1.5 group"
                    style={{ color: 'var(--ovenred)' }}
                  >
                    Pedir
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </WhatsAppLink>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

// =========================================================================
// Reviews
// =========================================================================
function Reviews() {
  const reviews = [
    {
      name: 'Marina S.',
      rating: 5,
      quote:
        'Pedi pelo zap, em 30 min tava na porta. A borda fica crocante por fora, fofinha por dentro. Virou nossa pizzaria oficial de sexta.',
      image: '/images/landing/reviews/customer-mid-bite.png',
      meta: 'Vila Madalena · há 2 dias',
    },
    {
      name: 'Roberto e Carla',
      rating: 5,
      quote:
        'O combo casal é perfeito. Recebemos quentinha, bem embalada, e ainda mandam um bilhetinho escrito à mão. Atendimento gentil de verdade.',
      image: '/images/landing/reviews/three-friends-laughing.png',
      meta: 'Pinheiros · semana passada',
    },
    {
      name: 'Família Tanaka',
      rating: 5,
      quote:
        'Já provamos várias do bairro, essa é disparada a melhor. A massa lembra pizza de Nápoles. Os meninos pedem todo fim de semana.',
      initials: 'FT',
      meta: 'Sumarezinho · este mês',
    },
  ]

  return (
    <section
      id="avaliacoes"
      className="py-24 md:py-32"
      style={{
        background:
          'linear-gradient(180deg, var(--offwhite) 0%, #FAEEDA 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid lg:grid-cols-12 gap-10 items-end mb-14">
          <div className="lg:col-span-7">
            <span className="landing-eyebrow">Quem já provou</span>
            <h2 className="landing-display text-4xl sm:text-5xl mt-4">
              4,9 estrelas em 248 avaliações.
              <br />
              <span style={{ color: 'var(--ovenred)' }}>E contando.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            <div className="inline-flex items-center gap-3 landing-card-3d px-5 py-4">
              <div className="star-row">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={18} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <div className="text-left">
                <div className="font-display text-lg leading-none">{BRAND.rating.stars} / 5</div>
                <div className="text-xs mt-1" style={{ color: 'var(--charcoal-soft)' }}>
                  {BRAND.rating.count} avaliações no {BRAND.rating.source}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <motion.figure
              key={r.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="landing-card-3d p-6 relative"
            >
              <Quote
                size={32}
                className="absolute top-5 right-5 opacity-20"
                style={{ color: 'var(--ovenred)' }}
              />
              <div className="star-row mb-3">
                {Array.from({ length: r.rating }).map((_, k) => (
                  <Star key={k} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <blockquote className="text-[15px] leading-relaxed" style={{ color: 'var(--charcoal-soft)' }}>
                “{r.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {r.image ? (
                  <span
                    className="w-10 h-10 rounded-full bg-center bg-cover ring-2 ring-white shrink-0"
                    style={{
                      backgroundImage: `url(${r.image})`,
                      boxShadow: '0 6px 14px -6px rgba(31,24,21,0.4)',
                    }}
                  />
                ) : (
                  <span
                    className="w-10 h-10 rounded-full grid place-items-center ring-2 ring-white shrink-0 font-display text-sm"
                    style={{
                      background: 'linear-gradient(180deg, #FFE4A8, #FFD367)',
                      color: 'var(--charcoal)',
                      boxShadow: '0 6px 14px -6px rgba(31,24,21,0.4)',
                    }}
                  >
                    {r.initials}
                  </span>
                )}
                <div>
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs" style={{ color: 'var(--charcoal-soft)' }}>{r.meta}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// =========================================================================
// Delivery area
// =========================================================================
function Delivery() {
  return (
    <section id="entrega" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        {/* Left — copy & details */}
        <motion.div
          className="lg:col-span-5 order-2 lg:order-1"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="landing-eyebrow">Entrega</span>
          <h2 className="landing-display text-4xl sm:text-5xl mt-4">
            Do forno à sua porta em até <span style={{ color: 'var(--ovenred)' }}>35 minutos.</span>
          </h2>
          <p className="mt-6 text-lg" style={{ color: 'var(--charcoal-soft)' }}>
            Motoboy próprio, caixa térmica de verdade, rota curta — a pizza
            chega no mesmo ponto que saiu do forno.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {[
              { icon: <MapPin size={18} />, label: 'Bairros atendidos', value: 'Vila Madalena, Pinheiros, Sumarezinho' },
              { icon: <Clock size={18} />, label: 'Tempo médio', value: '32 minutos' },
              { icon: <Wallet size={18} />, label: 'Pagamento', value: 'Pix, Cartão, Dinheiro' },
              { icon: <Bike size={18} />, label: 'Taxa de entrega', value: 'A partir de R$ 6' },
            ].map((d) => (
              <div key={d.label} className="landing-card-3d p-4 flex items-start gap-3">
                <span
                  className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                  style={{
                    background: 'linear-gradient(180deg, #FFE4A8, #FFD367)',
                    color: 'var(--charcoal)',
                    boxShadow: '0 4px 10px -4px rgba(139,26,26,0.4)',
                  }}
                >
                  {d.icon}
                </span>
                <div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ovenred)' }}>{d.label}</div>
                  <div className="font-medium text-sm mt-0.5">{d.value}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right — aerial map + ETA mockup */}
        <motion.div
          className="lg:col-span-7 order-1 lg:order-2 relative h-[460px] sm:h-[540px]"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0 photo-3d"
            style={{
              backgroundImage: 'url(/images/landing/delivery/aerial-neighborhood.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          {/* Subtle warm overlay so chips read */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[22px] pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(31,24,21,0) 50%, rgba(31,24,21,0.45) 100%)',
            }}
          />

          {/* Floating moto */}
          <div
            className="absolute top-6 left-6 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-center bg-cover photo-3d landing-float-mid"
            style={{ backgroundImage: 'url(/images/landing/delivery/moto-panning-blur.png)' }}
          />

          {/* ETA phone mockup, bottom-right */}
          <div
            className="absolute bottom-6 right-6 w-44 sm:w-56 aspect-[9/16] bg-center bg-contain bg-no-repeat landing-float-slow"
            style={{
              backgroundImage: 'url(/images/landing/delivery/eta-phone-mockup.png)',
              filter: 'drop-shadow(0 30px 40px rgba(31,24,21,0.45))',
            }}
          />

          {/* Big ETA pill, centered-bottom */}
          <div className="absolute bottom-6 left-6 landing-card-3d px-5 py-4">
            <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ovenred)' }}>
              Tempo médio agora
            </div>
            <div className="font-display text-3xl mt-1">~32 min</div>
            <div className="text-xs mt-1" style={{ color: 'var(--charcoal-soft)' }}>
              Atualizado em tempo real
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// =========================================================================
// Final CTA — full-bleed dark, pizza pull image, big WhatsApp button
// =========================================================================
function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32" style={{ background: 'var(--charcoal)' }}>
      {/* Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 60% at 20% 30%, rgba(255,107,53,0.20), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(255,215,0,0.10), transparent 60%)',
        }}
      />
      <div className="max-w-7xl mx-auto px-5 md:px-8 relative grid lg:grid-cols-12 gap-10 items-center">
        <motion.div
          className="lg:col-span-7"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="landing-eyebrow" style={{ color: 'var(--gold)' }}>
            Tá com fome?
          </span>
          <h2 className="landing-display text-5xl sm:text-6xl lg:text-7xl mt-5" style={{ color: 'var(--cream)' }}>
            A gente assa em <em style={{ color: 'var(--ember)' }}>25 minutos.</em>
          </h2>
          <p className="mt-6 text-lg max-w-xl" style={{ color: 'rgba(248,241,228,0.75)' }}>
            Sem app, sem cadastro, sem fila. Manda mensagem agora — em segundos
            sua pizza tá no forno.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <WhatsAppLink className="btn-whatsapp text-base px-6 py-4">
              <MessageCircle size={20} />
              Pedir agora pelo WhatsApp
              <ArrowRight size={18} className="opacity-80" />
            </WhatsAppLink>
            <a
              href={`tel:+${BRAND.phoneDigits}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border text-base font-semibold transition-colors"
              style={{
                color: 'var(--cream)',
                borderColor: 'rgba(248,241,228,0.2)',
                background: 'rgba(248,241,228,0.04)',
                fontFamily: 'Space Grotesk, Inter, sans-serif',
              }}
            >
              <Phone size={18} />
              Ou ligue {BRAND.phone}
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: 'rgba(248,241,228,0.6)' }}>
            <span className="flex items-center gap-2">
              <Clock size={14} /> Atendimento {BRAND.hoursShort}
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={14} /> {BRAND.address.split(' — ')[1] || BRAND.address}
            </span>
          </div>
        </motion.div>

        {/* Right — close-up pizza pull */}
        <motion.div
          className="lg:col-span-5 relative h-[380px] sm:h-[460px]"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0 bg-center bg-contain bg-no-repeat landing-float-slow"
            style={{
              backgroundImage: 'url(/images/landing/cta/final-pizza-pull.png)',
              filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.6)) drop-shadow(0 0 60px rgba(255,107,53,0.25))',
            }}
          />
        </motion.div>
      </div>
    </section>
  )
}

// =========================================================================
// Footer
// =========================================================================
function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      className="py-16 border-t"
      style={{
        background: 'var(--offwhite)',
        borderColor: 'rgba(31,24,21,0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2.5 mb-4">
            <img
              src="/images/landing/logo.png"
              alt={BRAND.name}
              className="w-10 h-10 rounded-xl object-cover"
              style={{
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 18px -8px rgba(139,26,26,0.45)',
              }}
              draggable="false"
            />
            <span className="font-display text-lg">{BRAND.name}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--charcoal-soft)' }}>
            Pizzaria de bairro, forno a lenha, atendimento pelo WhatsApp.
            Massa fermentada 48 horas e ingredientes que dá pra ler na embalagem.
          </p>
        </div>

        <div className="md:col-span-3">
          <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--ovenred)' }}>
            Horário
          </div>
          <ul className="space-y-1.5 text-sm">
            {BRAND.hours.map(([d, h]) => (
              <li key={d} className="flex justify-between gap-3" style={{ color: 'var(--charcoal-soft)' }}>
                <span>{d}</span>
                <span className="font-medium" style={{ color: 'var(--charcoal)' }}>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--ovenred)' }}>
            Endereço & contato
          </div>
          <p className="text-sm" style={{ color: 'var(--charcoal-soft)' }}>
            {BRAND.address}
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--charcoal-soft)' }}>
            <WhatsAppLink className="hover:underline">
              WhatsApp: {BRAND.whatsappDisplay}
            </WhatsAppLink>
          </p>
        </div>

        <div className="md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--ovenred)' }}>
            Pagamento
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Pix', 'Crédito', 'Débito', 'Dinheiro'].map((m) => (
              <span
                key={m}
                className="px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: 'rgba(31,24,21,0.12)',
                  background: '#fff',
                  color: 'var(--charcoal)',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-rule mt-12" />
      <div className="max-w-7xl mx-auto px-5 md:px-8 mt-6 flex flex-col sm:flex-row justify-between gap-3 text-xs" style={{ color: 'var(--charcoal-soft)' }}>
        <div>© {year} {BRAND.name}. Feito com forno e paciência.</div>
        <div className="flex gap-5">
          <Link to="/login" className="hover:underline">Entrar</Link>
        </div>
      </div>
    </footer>
  )
}

// =========================================================================
// Floating WhatsApp button — always reachable on mobile
// =========================================================================
function FloatingWhatsApp() {
  return (
    <WhatsAppLink
      aria-label="Pedir pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 md:hidden btn-whatsapp px-4 py-3 rounded-full"
      style={{ borderRadius: 999 }}
    >
      <MessageCircle size={20} />
    </WhatsAppLink>
  )
}

// =========================================================================
// Page composition
// =========================================================================
export default function Landing() {
  // The dashboard sets <html class="dark"> globally — strip it for the landing.
  useEffect(() => {
    const html = document.documentElement
    const had = html.classList.contains('dark')
    html.classList.remove('dark')
    return () => {
      if (had) html.classList.add('dark')
    }
  }, [])

  // The provider must live INSIDE `.landing-root` because the offline modal
  // it renders relies on the warm-palette CSS variables (--charcoal,
  // --charcoal-soft, --ovenred) that are scoped to .landing-root. Wrapping
  // it from the outside leaves the modal in the body's `text-white` scope
  // and the text becomes white-on-cream (invisible).
  return (
    <div className="landing-root min-h-screen">
      <WhatsAppProvider>
        <Nav />
        <main>
          <Hero />
          <TrustMarquee />
          <Story />
          <FeaturedMenu />
          <HowItWorks />
          <Offers />
          <Reviews />
          <Delivery />
          <FinalCTA />
        </main>
        <Footer />
        <FloatingWhatsApp />
      </WhatsAppProvider>
    </div>
  )
}
