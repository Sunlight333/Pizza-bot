import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wifi, WifiOff, RefreshCw, Copy, Smartphone, ShieldCheck, ShieldAlert,
  Send, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'

/**
 * WhatsApp Cloud API (Meta) settings panel.
 *
 * Cloud API has no QR pairing — the phone-WABA binding is permanent
 * at Meta, so there's nothing to pair from this panel —
 * the panel only shows credential health + lets the operator send a
 * test message to verify outbound works end-to-end.
 *
 * What the operator sets in /opt/pizzabot/.env on the VPS:
 *   META_ACCESS_TOKEN, META_APP_SECRET, META_PHONE_NUMBER_ID,
 *   META_WABA_ID, META_DISPLAY_PHONE_NUMBER, META_VERIFY_TOKEN
 */
function formatBR(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  return `+${digits}`
}

export default function MetaWhatsAppConfig() {
  const [testTo, setTestTo] = useState('')
  const [testText, setTestText] = useState('Teste do bot 🍕 — se você recebeu, a integração tá ok.')

  const { data: config } = useQuery({
    queryKey: ['wa-config'],
    queryFn: () => api.get('/api/whatsapp/config').then((r) => r.data),
  })

  const { data: status, refetch: refetchStatus, isFetching: refetching } =
    useQuery({
      queryKey: ['wa-status'],
      queryFn: () => api.get('/api/whatsapp/status').then((r) => r.data),
      refetchInterval: 30_000,
    })

  const connected = !!status?.ok

  const testMut = useMutation({
    mutationFn: () =>
      api.post('/api/whatsapp/test-send', { to: testTo, text: testText })
        .then((r) => r.data),
    onSuccess: () => toast.success('Mensagem enviada — confira o WhatsApp.'),
    onError: (e) =>
      toast.error(e.response?.data?.detail || 'Falha ao enviar — confira logs.'),
  })

  const webhookUrl = config?.webhook_url
    ? `${import.meta.env.VITE_API_URL || window.location.origin}${config.webhook_url}`
    : ''

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado')
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2">
          <Smartphone size={18} /> WhatsApp Cloud API (Meta)
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
              <Wifi size={14} /> Token válido — Meta respondeu OK
            </span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-red-300 flex items-center gap-1">
              <WifiOff size={14} /> {status?.error || 'Não verificado'}
            </span>
          </>
        )}
      </div>

      {/* Number info from Meta */}
      {connected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-success/30 bg-success/5 p-3"
        >
          <div className="font-medium text-sm">
            {status.verified_name || 'Número conectado'}
          </div>
          <div className="text-xs text-white/60 font-mono mt-0.5">
            {formatBR(status.display_phone_number)}
          </div>
          {status.quality_rating && (
            <div className="text-xs text-white/60 mt-1">
              Quality rating Meta: <strong>{status.quality_rating}</strong>
            </div>
          )}
        </motion.div>
      )}

      <dl className="text-sm space-y-2 border-t border-glass-border pt-3">
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Phone Number ID</dt>
          <dd className="font-mono text-xs">{config?.phone_number_id || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">WABA ID</dt>
          <dd className="font-mono text-xs">{config?.waba_id || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Versão Graph API</dt>
          <dd className="font-mono text-xs">{config?.graph_version || '—'}</dd>
        </div>
        <div className="flex justify-between items-center gap-3">
          <dt className="text-white/50">Webhook URL (cole no Meta)</dt>
          <dd className="flex items-center gap-2 text-xs">
            <span className="font-mono truncate max-w-[260px]">{webhookUrl}</span>
            {webhookUrl && (
              <button
                onClick={() => copy(webhookUrl)}
                className="text-white/50 hover:text-white"
              >
                <Copy size={12} />
              </button>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Verify Token</dt>
          <dd className="text-xs flex items-center gap-1">
            {config?.verify_token_set ? (
              <>
                <ShieldCheck size={12} className="text-success" /> Configurado
              </>
            ) : (
              <>
                <ShieldAlert size={12} className="text-red-400" /> Falta — webhook não vai validar
              </>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">App Secret (HMAC)</dt>
          <dd className="text-xs flex items-center gap-1">
            {config?.app_secret_set ? (
              <>
                <ShieldCheck size={12} className="text-success" /> Configurado
              </>
            ) : (
              <>
                <ShieldAlert size={12} className="text-yellow-400" /> Sem segredo (recomendado em produção)
              </>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Access Token</dt>
          <dd className="text-xs flex items-center gap-1">
            {config?.access_token_set ? (
              <>
                <KeyRound size={12} className="text-success" /> Configurado
              </>
            ) : (
              <>
                <ShieldAlert size={12} className="text-red-400" /> Falta — bot não envia mensagens
              </>
            )}
          </dd>
        </div>
      </dl>

      {/* Test send */}
      <div className="border-t border-glass-border pt-4 space-y-2">
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
          Enviar mensagem de teste
        </div>
        <input
          value={testTo}
          onChange={(e) => setTestTo(e.target.value.replace(/\D/g, ''))}
          placeholder="Destino (ex: 5517991234567)"
          className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
        />
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          rows={2}
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary resize-none"
        />
        <button
          onClick={() => testMut.mutate()}
          disabled={!connected || testMut.isPending || testTo.length < 10}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={14} />
          {testMut.isPending ? 'Enviando...' : 'Enviar teste'}
        </button>
        <p className="text-[11px] text-white/40">
          O número precisa ter aceitado mensagens nas últimas 24h, ou estar na
          lista de testers da app no painel da Meta. Fora disso, o Meta exige
          mensagem do tipo template (aprovação prévia).
        </p>
      </div>
    </div>
  )
}
