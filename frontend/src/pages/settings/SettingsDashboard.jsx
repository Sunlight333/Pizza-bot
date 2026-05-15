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
 * "WhatsApp" status: probes the Cloud API token via /api/whatsapp/status,
 * which calls Graph and returns {ok: bool, display_phone_number, ...}.
 * No more dual-endpoint dance — the WABA-phone binding is permanent at
 * Meta, so a 200 from Graph is the only signal that matters.
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
  const { data: waStatus } = useQuery({
    queryKey: ['wa-status'],
    queryFn: () => api.get('/api/whatsapp/status').then((r) => r.data),
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

  const waConnected = !!waStatus?.ok

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
          title="WhatsApp (Meta)"
          status={
            waConnected
              ? waStatus.verified_name
                ? `Conectado · ${waStatus.verified_name}`
                : 'Token válido — Meta respondeu OK'
              : waStatus?.error
                ? `Falha: ${waStatus.error}`
                : 'Não verificado'
          }
          sub={
            waConnected && waStatus.display_phone_number
              ? waStatus.display_phone_number
              : null
          }
          href="../whatsapp"
          icon={waConnected ? Wifi : WifiOff}
          ok={waConnected}
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
