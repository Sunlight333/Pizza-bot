import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Copy,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'

// Format "5517991289777" → "+55 (17) 99128-9777"
function formatBR(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return `+${digits}`
}

export default function EvolutionConfig() {
  const qc = useQueryClient()
  const [showQR, setShowQR] = useState(false)

  const { data: config } = useQuery({
    queryKey: ['evolution-config'],
    queryFn: () => api.get('/api/evolution/config').then((r) => r.data),
  })

  const { data: status, refetch: refetchStatus, isFetching: refetching } = useQuery({
    queryKey: ['evolution-status'],
    queryFn: () => api.get('/api/evolution/status').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const { data: instance, refetch: refetchInstance } = useQuery({
    queryKey: ['evolution-instance'],
    queryFn: () => api.get('/api/evolution/instance').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const connected = status?.state === 'open' || instance?.status === 'open'

  const { data: qr, refetch: refetchQR, isFetching: qrLoading } = useQuery({
    queryKey: ['evolution-qr'],
    queryFn: () => api.get('/api/evolution/qr').then((r) => r.data),
    enabled: showQR,
    // QR rotates ~every 30s on Evolution's side; refresh just under that
    refetchInterval: showQR ? 25_000 : false,
  })

  const refreshAll = () => {
    refetchStatus()
    refetchInstance()
    if (showQR) refetchQR()
  }

  const logoutMut = useMutation({
    mutationFn: () => api.post('/api/evolution/logout').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evolution-status'] })
      qc.invalidateQueries({ queryKey: ['evolution-instance'] })
      qc.invalidateQueries({ queryKey: ['evolution-qr'] })
      toast.success('WhatsApp desconectado. Escaneie um novo QR para parear outro número.')
      setShowQR(true)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Falha ao desconectar'),
  })

  const resetMut = useMutation({
    mutationFn: () => api.post('/api/evolution/reset').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evolution-status'] })
      qc.invalidateQueries({ queryKey: ['evolution-instance'] })
      qc.invalidateQueries({ queryKey: ['evolution-qr'] })
      toast.success('Instância resetada. QR Code novo gerado para pareamento.')
      setShowQR(true)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Falha ao resetar'),
  })

  const webhookUrl = config?.webhook_url
    ? `${import.meta.env.VITE_API_URL || window.location.origin}${config.webhook_url}`
    : ''

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado')
  }

  const qrImage =
    qr?.base64 || qr?.qrcode || qr?.code || (typeof qr === 'string' ? qr : null)

  const handleLogout = () => {
    if (
      confirm(
        `Desconectar o WhatsApp atual${
          instance?.phone ? ` (${formatBR(instance.phone)})` : ''
        }?\n\n` +
          'A instância será mantida — você poderá escanear um novo QR para parear outro número.',
      )
    ) {
      logoutMut.mutate()
    }
  }

  const handleReset = () => {
    if (
      confirm(
        'Resetar a instância completamente?\n\n' +
          'Isso APAGA toda a sessão atual e cria uma nova. ' +
          'Use quando o desconectar normal não funcionar ou para começar do zero.',
      )
    ) {
      resetMut.mutate()
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2">
          <Smartphone size={18} /> Evolution API (WhatsApp)
        </h3>
        <button
          onClick={refreshAll}
          disabled={refetching}
          className="btn-ghost text-xs flex items-center gap-1"
        >
          <RefreshCw size={12} className={refetching ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      <div className="flex items-center gap-3">
        {connected ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse-slow shadow-glow-primary" />
            <span className="text-success font-medium flex items-center gap-1">
              <Wifi size={14} /> Conectado
            </span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-red-300 flex items-center gap-1">
              <WifiOff size={14} /> {status?.state || instance?.status || 'Desconectado'}
            </span>
          </>
        )}
      </div>

      {/* Currently paired number — only when connected and we have data */}
      {connected && instance?.phone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-3"
        >
          {instance.profile_pic_url ? (
            <img
              src={instance.profile_pic_url}
              alt=""
              className="w-10 h-10 rounded-full ring-1 ring-glass-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
              <UserIcon size={16} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {instance.profile_name || 'Número pareado'}
            </div>
            <div className="text-xs text-white/60 font-mono">
              {formatBR(instance.phone)}
            </div>
          </div>
        </motion.div>
      )}

      <dl className="text-sm space-y-2 border-t border-glass-border pt-3">
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">URL</dt>
          <dd className="font-mono text-xs truncate">{config?.url || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Instância</dt>
          <dd className="font-mono text-xs">{config?.instance || '—'}</dd>
        </div>
        <div className="flex justify-between items-center gap-3">
          <dt className="text-white/50">Webhook URL</dt>
          <dd className="flex items-center gap-2 text-xs">
            <span className="font-mono truncate max-w-[260px]">{webhookUrl}</span>
            {webhookUrl && (
              <button onClick={() => copy(webhookUrl)} className="text-white/50 hover:text-white">
                <Copy size={12} />
              </button>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">HMAC do webhook</dt>
          <dd className="text-xs flex items-center gap-1">
            {config?.webhook_secret_set ? (
              <>
                <ShieldCheck size={12} className="text-success" /> Configurado
              </>
            ) : (
              <>
                <ShieldAlert size={12} className="text-yellow-400" /> Sem segredo (recomendado em
                produção)
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="border-t border-glass-border pt-3 space-y-2">
        {connected ? (
          // Connected — offer ways to swap to a different number
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleLogout}
              disabled={logoutMut.isPending}
              className="btn-ghost flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogOut size={14} />
              {logoutMut.isPending ? 'Desconectando...' : 'Desconectar'}
            </button>
            <button
              onClick={handleReset}
              disabled={resetMut.isPending}
              className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 transition-colors py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {resetMut.isPending ? 'Resetando...' : 'Resetar instância'}
            </button>
          </div>
        ) : (
          // Disconnected — main CTA is "show QR", with Reset available as a fallback
          <>
            <button
              onClick={() => {
                setShowQR((v) => !v)
                refetchQR()
              }}
              className="btn-primary w-full"
            >
              {showQR ? 'Esconder QR Code' : 'Mostrar QR Code para parear'}
            </button>
            <button
              onClick={handleReset}
              disabled={resetMut.isPending}
              className="btn-ghost w-full text-sm flex items-center justify-center gap-2"
              title="Use se o QR não estiver carregando ou a instância estiver travada"
            >
              <Trash2 size={14} />
              {resetMut.isPending ? 'Resetando...' : 'Resetar instância (gera QR novo)'}
            </button>
          </>
        )}

        {showQR && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-white rounded-2xl flex flex-col items-center gap-2"
          >
            {qrLoading && !qrImage ? (
              <div className="text-bg text-sm">Gerando QR...</div>
            ) : qrImage ? (
              <img
                src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`}
                alt="QR code"
                className="w-56 h-56"
              />
            ) : (
              <div className="text-bg text-sm">
                QR não disponível — clique em "Resetar instância" e tente de novo
              </div>
            )}
            <p className="text-bg/70 text-xs text-center">
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
