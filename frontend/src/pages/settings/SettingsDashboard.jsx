import { useQuery } from '@tanstack/react-query'
import {
  Wifi,
  WifiOff,
  Clock,
  FileSpreadsheet,
  Bot,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import AnimatedPage from '@/components/layout/AnimatedPage'
import { api } from '@/services/api'

/**
 * Settings → Visão geral.
 *
 * Operator-facing status board for the Configurações area. Surfaces the
 * three things that go wrong most often (WhatsApp pairing, Datacaixa
 * sync, bot persona drift) with a one-tap link to the page that fixes
 * each of them.
 *
 * IMPORTANT: agrees with EvolutionConfig by reading BOTH endpoints —
 * connectionState (nested under .instance) AND fetchInstances (flat).
 * Earlier this card read only one of them and crashed into the nested-
 * shape mismatch, showing "Desconectado" when WhatsApp was actually
 * paired and online.
 */

function StatusCard({ title, status, sub, href, icon: Icon, ok }) {
  return (
    <Link
      to={href}
      className="glass-card p-5 flex items-center gap-4 hover:bg-white/5 transition-colors group"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: ok === false ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
          color: ok === false ? '#fca5a5' : ok === true ? '#86efac' : 'white',
        }}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg leading-tight">{title}</p>
        <p className="text-sm text-white/60 truncate">{status}</p>
        {sub && <p className="text-xs text-white/40 mt-0.5 truncate">{sub}</p>}
      </div>
      <ChevronRight size={18} className="text-white/30 group-hover:text-white/60 transition-colors" />
    </Link>
  )
}

export default function SettingsDashboard() {
  // /api/evolution/status returns the raw Evolution payload, which
  // nests state under .instance:  {"instance": {"state": "open"}}
  const { data: evoStatus } = useQuery({
    queryKey: ['evolution-status'],
    queryFn: () => api.get('/api/evolution/status').then((r) => r.data),
    refetchInterval: 30_000,
  })
  // /api/evolution/instance returns a flat row from fetchInstances with
  // a `status` (not `state`!) field plus phone/profile metadata.
  const { data: evoInstance } = useQuery({
    queryKey: ['evolution-instance'],
    queryFn: () => api.get('/api/evolution/instance').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const { data: bridge } = useQuery({
    queryKey: ['bridge-status'],
    queryFn: () => api.get('/api/bridge/status').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const { data: cfg } = useQuery({
    queryKey: ['bot-config'],
    queryFn: () => api.get('/api/bot/config').then((r) => r.data),
  })

  // Same OR-pattern EvolutionConfig already uses, applied here.
  // Both endpoints intermittently lag each other on pairing transitions,
  // so accepting either signal is more reliable than relying on one.
  const evoStateValue = evoStatus?.instance?.state || evoStatus?.state || evoInstance?.status
  const evoConnected = evoStateValue === 'open'

  // Bridge status field is `last_heartbeat`, not `last_seen`.
  const bridgeOnline = !!bridge?.online
  const bridgeLastSeen = bridge?.last_heartbeat

  return (
    <AnimatedPage className="space-y-5">
      <div>
        <h1 className="font-display text-2xl">Visão geral</h1>
        <p className="text-sm text-white/60 mt-1">
          Status rápido das partes do sistema. Toque em qualquer cartão para
          abrir a página correspondente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusCard
          title="WhatsApp"
          status={
            evoConnected
              ? evoInstance?.profile_name
                ? `Pareado · ${evoInstance.profile_name}`
                : 'Pareado e conectado'
              : 'Desconectado — religue para enviar mensagens'
          }
          sub={
            evoConnected && evoInstance?.phone
              ? `+${evoInstance.phone}`
              : evoStateValue
                ? `state: ${evoStateValue}`
                : null
          }
          href="../evolution"
          icon={evoConnected ? Wifi : WifiOff}
          ok={evoConnected}
        />
        <StatusCard
          title="Datacaixa"
          status={bridgeOnline ? 'Bridge online — pedidos sincronizando' : 'Bridge offline'}
          sub={
            bridgeLastSeen
              ? `último ping: ${new Date(bridgeLastSeen).toLocaleString('pt-BR')}${bridge?.host ? ` · ${bridge.host}` : ''}`
              : null
          }
          href="../datacaixa"
          icon={FileSpreadsheet}
          ok={bridgeOnline}
        />
        <StatusCard
          title="Bot"
          status={cfg?.bot_name ? `Persona: ${cfg.bot_name}` : 'Persona não configurada'}
          sub={cfg ? `horário: ${cfg.working_hours_start}h–${cfg.working_hours_end}h` : null}
          href="../bot"
          icon={Bot}
          ok={!!cfg?.bot_name}
        />
        <StatusCard
          title="Horário"
          status={`Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}`}
          sub={cfg ? `Atendimento: ${cfg.working_hours_start}h às ${cfg.working_hours_end}h` : null}
          href="../bot"
          icon={Clock}
        />
      </div>

      <div className="glass-card p-5">
        <p className="text-sm text-white/60">
          Atalhos rápidos: edite a personalidade do bot, gerencie usuários
          do painel ou troque sua senha pelo menu lateral.
        </p>
      </div>
    </AnimatedPage>
  )
}
