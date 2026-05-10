import { Link } from 'react-router-dom'
import { ArrowRight, Clock, MapPin, Zap } from 'lucide-react'
import Button from '@/components/Button'
import { asset } from '@/utils/asset'

export default function Landing() {
  return (
    <div className="text-charcoal">
      {/* Hero */}
      <section className="relative min-h-[88vh] md:min-h-[78vh] flex items-end overflow-hidden">
        <picture className="absolute inset-0">
          <source media="(min-width: 768px)" srcSet={asset('images/hero/hero-pizza-overhead-1600.webp')} />
          <img
            src={asset('images/hero/hero-pizza-overhead-800.webp')}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            fetchpriority="high"
            decoding="async"
          />
        </picture>
        {/* Cream gradient — keeps text legible regardless of image */}
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/85 to-cream/0" />

        <div className="relative max-w-2xl mx-auto px-5 pb-12 md:pb-20 text-center">
          <p className="label-eyebrow text-ovenred mb-3">Sua pizzaria do bairro</p>
          <h1 className="font-display text-display-xl md:text-[56px] md:leading-[60px] text-charcoal">
            A pizza que você ama,
            <br />
            agora em <span className="italic text-ovenred">1 minuto</span>.
          </h1>
          <p className="mt-4 text-body-lg text-slateMuted max-w-md mx-auto">
            Cardápio completo, entrega rápida, rastreamento em tempo real.
            O WhatsApp continua, o site é uma opção.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link to="/menu">
              <Button fullWidth>
                Ver cardápio <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" fullWidth>Entrar</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Three quick reassurances */}
      <section className="max-w-5xl mx-auto px-5 -mt-6 md:-mt-10 grid grid-cols-3 gap-3 md:gap-4 relative z-10">
        {[
          { icon: Clock, label: 'Aberto', sub: 'Hoje 18h–23h' },
          { icon: Zap, label: 'Rápido', sub: '~30 min' },
          { icon: MapPin, label: 'Entrega', sub: 'Até 6 km' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="card px-3 py-3 md:py-4 flex flex-col items-center text-center">
            <Icon className="w-5 h-5 text-ovenred mb-1.5" />
            <p className="text-body-sm font-semibold">{label}</p>
            <p className="text-body-sm text-slateMuted">{sub}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 mt-16 md:mt-24">
        <p className="label-eyebrow text-ovenred">Como funciona</p>
        <h2 className="font-display text-display-lg mt-2">Três passos, mais nada.</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { n: '01', t: 'Escolha sua pizza', d: 'Veja o cardápio com fotos. Tamanho, borda e adicionais em uma tela.' },
            { n: '02', t: 'Pague na hora ou na porta', d: 'PIX ou pague ao motoboy. Sem cadastro complicado.' },
            { n: '03', t: 'Acompanhe ao vivo', d: 'Status atualizado em tempo real, do forno até a sua porta.' },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <span className="font-display text-display-md text-ovenred">{s.n}</span>
              <h3 className="font-display text-display-md mt-1">{s.t}</h3>
              <p className="text-body text-slateMuted mt-2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visual break */}
      <section className="mt-16 md:mt-24 relative h-64 md:h-80 overflow-hidden">
        <img
          src={asset('images/hero/hero-oven-fire-1600.webp')}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/40 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-5 h-full flex items-center">
          <div className="max-w-md text-offwhite">
            <p className="label-eyebrow text-crust">Forno a lenha</p>
            <h2 className="font-display text-display-lg md:text-display-xl mt-1">
              Massa fina, queijo na medida, fogo certo.
            </h2>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-5 my-16 md:my-24 text-center">
        <h2 className="font-display text-display-lg">Pronto para pedir?</h2>
        <p className="text-body text-slateMuted mt-2">
          Cardápio aberto. Comece pela margherita.
        </p>
        <Link to="/menu" className="inline-block mt-6">
          <Button>
            Ver o cardápio <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slateLine bg-offwhite mt-8">
        <div className="max-w-5xl mx-auto px-5 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-body-sm text-slateMuted">
          <div>
            <p className="font-display text-charcoal text-display-md italic">Pizzaria</p>
            <p className="mt-2">Forno a lenha, entrega no bairro.</p>
          </div>
          <div>
            <p className="text-charcoal font-semibold">Horário</p>
            <p>Ter–Dom · 18h às 23h</p>
            <p>Segunda · Fechado</p>
          </div>
          <div>
            <p className="text-charcoal font-semibold">Contato</p>
            <p>WhatsApp: (11) XXXX-XXXX</p>
            <p>Centro · Vila Madalena · Pinheiros</p>
          </div>
        </div>
        <div className="border-t border-slateLine py-4 text-center text-body-sm text-slateMuted">
          © {new Date().getFullYear()} Pizzaria · Imagens por Unsplash
        </div>
      </footer>
    </div>
  )
}
