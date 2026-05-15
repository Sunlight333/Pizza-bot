import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Send, RefreshCw, Phone, Bot, User as UserIcon,
  Paperclip, Mic, X, Volume2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'
import { getApiBase } from '@/utils/apiUrl'
import { useVoiceRecorder, formatElapsed } from '@/hooks/useVoiceRecorder'

const resolveMedia = (url) =>
  !url ? null : (/^https?:/i.test(url) ? url : `${getApiBase()}${url}`)

/**
 * Simulator: drives the same ai_engine.process_incoming() the real WhatsApp
 * webhook uses, but routes the bot's reply back to the panel instead of sending
 * it through Meta. Lets the operator run the Step-12 scenarios end-to-end
 * without needing a paired WhatsApp number.
 */
export default function BotSimulator() {
  const [phone, setPhone] = useState('5511999990000')
  const [text, setText] = useState('')
  const [history, setHistory] = useState([])
  const fileInputRef = useRef(null)
  const recorder = useVoiceRecorder()
  const lastMediaPreviewRef = useRef(null)

  const append = (entry) => setHistory((h) => [...h, entry])

  const send = useMutation({
    mutationFn: () => api.post('/api/admin/simulate', { phone, text }).then((r) => r.data),
    onSuccess: (data) => {
      append({ role: 'user', content: data.user_text })
      // If the bot's turn invoked send_menu_image (or any future media tool)
      // surface the image as its own bubble before the friendly text reply,
      // matching the order the customer sees on WhatsApp.
      if (data.bot_media_url) {
        append({
          role: 'assistant',
          content: '',
          media_url: data.bot_media_url,
          media_type: data.bot_media_type || 'image',
        })
      }
      append({ role: 'assistant', content: data.bot_reply || '(sem resposta — handoff)' })
      data.notes?.forEach((n) => toast(n, { icon: '⚠️' }))
      setText('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro no simulador'),
  })

  const sendMedia = useMutation({
    mutationFn: ({ file, mediaType, caption }) => {
      const fd = new FormData()
      fd.append('phone', phone)
      fd.append('media_type', mediaType)
      fd.append('file', file)
      if (caption) fd.append('caption', caption)
      return api
        .post('/api/admin/simulate-media', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data)
    },
    onSuccess: (data) => {
      // The backend's response carries user_text (caption / transcription /
      // synthetic placeholder); we already attached the local preview below.
      const previewUrl = lastMediaPreviewRef.current?.url
      const previewType = lastMediaPreviewRef.current?.mediaType
      lastMediaPreviewRef.current = null
      append({
        role: 'user',
        content: data.user_text,
        media_url: previewUrl,
        media_type: previewType,
      })
      if (data.bot_media_url) {
        append({
          role: 'assistant',
          content: '',
          media_url: data.bot_media_url,
          media_type: data.bot_media_type || 'image',
        })
      }
      append({ role: 'assistant', content: data.bot_reply || '(sem resposta — handoff)' })
      data.notes?.forEach((n) => toast(n, { icon: '⚠️' }))
      setText('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro no simulador (mídia)'),
  })

  const onFilePicked = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Selecione uma imagem')
      return
    }
    // Locally previewed via blob URL while the request is in-flight; switched
    // to the persisted URL after the simulator response (next mount of the
    // bubble — for now, blob URL is fine for the simulator's own panel).
    lastMediaPreviewRef.current = {
      url: URL.createObjectURL(f),
      mediaType: 'image',
    }
    sendMedia.mutate({ file: f, mediaType: 'image', caption: text.trim() || undefined })
  }

  const startRec = async () => {
    try {
      await recorder.start()
    } catch {
      toast.error('Permissão de microfone negada ou indisponível')
    }
  }

  const finishRec = async () => {
    const { blob, mime, durationMs } = await recorder.stop()
    if (durationMs < 600) {
      toast('Áudio muito curto', { icon: '⚠️' })
      return
    }
    const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'm4a'
    const file = new File([blob], `voice.${ext}`, { type: mime })
    lastMediaPreviewRef.current = {
      url: URL.createObjectURL(blob),
      mediaType: 'audio',
    }
    sendMedia.mutate({ file, mediaType: 'audio' })
  }

  const reset = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/simulate/reset?phone=${encodeURIComponent(phone)}`).then((r) => r.data),
    onSuccess: () => {
      setHistory([])
      toast.success('Conversa resetada')
    },
  })

  const onSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    send.mutate()
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2">
          <Bot size={18} /> Simulador do Bot
        </h3>
        <button
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          className="btn-ghost text-xs flex items-center gap-1"
          title="Limpar Redis state desta conversa"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>
      <p className="text-xs text-white/50">
        Drive o bot exatamente como no WhatsApp — sem precisar de número emparelhado.
        Use os 7 cenários do Step 12 (saudação, meio-a-meio, áudio, handoff, recorrente, fora de horário).
      </p>

      <div className="flex items-center gap-2">
        <Phone size={14} className="text-white/40" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="5511999999999"
          className="input-field text-sm py-1.5 flex-1"
        />
      </div>

      <div className="bg-bg/40 rounded-xl border border-glass-border h-72 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-12">
            Mande uma mensagem como cliente e veja a resposta do bot.
          </p>
        ) : (
          history.map((m, i) => {
            const url = resolveMedia(m.media_url)
            const placeholder = ['[IMAGEM ENVIADA]', '[ÁUDIO ENVIADO]', '[ÁUDIO INAUDÍVEL]']
            const hideText = url && (!m.content || placeholder.includes(m.content) || /^\[CARDÁPIO /i.test(m.content))
            return (
              <div
                key={i}
                className={`flex gap-2 text-sm ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-primary-gradient text-white'
                      : 'bg-white/5 text-white/90 border border-glass-border'
                  }`}
                >
                  {url && m.media_type === 'image' && (
                    <a href={url} target="_blank" rel="noreferrer" className="block mb-1">
                      <img
                        src={url}
                        alt="anexo"
                        className="rounded-lg max-h-56 max-w-full object-contain bg-black/20"
                      />
                    </a>
                  )}
                  {url && m.media_type === 'audio' && (
                    <audio controls preload="metadata" src={url} className="w-full mt-1" style={{ maxWidth: 240 }} />
                  )}
                  {!hideText && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                  {m.media_type === 'audio' && hideText && (
                    <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                      <Volume2 size={10} /> áudio
                    </div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-white/60" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFilePicked}
      />

      {recorder.recording ? (
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-mono tabular-nums">
            {formatElapsed(recorder.elapsedMs)}
          </span>
          <span className="text-xs text-white/50 flex-1">Gravando…</span>
          <button
            type="button"
            onClick={recorder.cancel}
            className="btn-ghost text-xs flex items-center gap-1"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            type="button"
            onClick={finishRec}
            disabled={sendMedia.isPending}
            className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1 disabled:opacity-50"
          >
            <Send size={14} /> Enviar
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={send.isPending || sendMedia.isPending}
            className="btn-ghost px-3 disabled:opacity-50"
            title="Anexar imagem"
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            onClick={startRec}
            disabled={send.isPending || sendMedia.isPending}
            className="btn-ghost px-3 disabled:opacity-50"
            title="Gravar áudio"
          >
            <Mic size={16} />
          </button>
          <input
            type="text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem do cliente..."
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={send.isPending || !text.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  )
}
