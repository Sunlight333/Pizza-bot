import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, RefreshCw, Copy, Smartphone, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'

export default function EvolutionConfig() {
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

  const { data: qr, refetch: refetchQR, isFetching: qrLoading } = useQuery({
    queryKey: ['evolution-qr'],
    queryFn: () => api.get('/api/evolution/qr').then((r) => r.data),
    enabled: showQR,
    refetchInterval: showQR ? 25_000 : false,
  })

  const connected = status?.state === 'open'
  const webhookUrl = config?.webhook_url
    ? `${import.meta.env.VITE_API_URL || window.location.origin}${config.webhook_url}`
    : ''

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado')
  }

  const qrImage =
    qr?.base64 || qr?.qrcode || qr?.code || (typeof qr === 'string' ? qr : null)

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2">
          <Smartphone size={18} /> Evolution API (WhatsApp)
        </h3>
        <button
          onClick={() => refetchStatus()}
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
              <WifiOff size={14} /> {status?.state || 'Desconectado'}
            </span>
          </>
        )}
      </div>

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
              <><ShieldCheck size={12} className="text-success" /> Configurado</>
            ) : (
              <><ShieldAlert size={12} className="text-yellow-400" /> Sem segredo (recomendado em produção)</>
            )}
          </dd>
        </div>
      </dl>

      <div className="border-t border-glass-border pt-3">
        {!connected && (
          <button
            onClick={() => { setShowQR((v) => !v); refetchQR() }}
            className="btn-primary w-full"
          >
            {showQR ? 'Esconder QR Code' : 'Mostrar QR Code para parear'}
          </button>
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
              <div className="text-bg text-sm">QR não disponível — verifique a configuração da Evolution API</div>
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
