import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, UserCog, Bot, Paperclip, Mic, X, Square } from 'lucide-react'
import toast from 'react-hot-toast'

import { conversationsApi } from '@/services/conversations'
import { useVoiceRecorder, formatElapsed } from '@/hooks/useVoiceRecorder'

export default function HumanTakeover({ phone, isHumanTakeover }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const fileInputRef = useRef(null)
  const recorder = useVoiceRecorder()

  const send = useMutation({
    mutationFn: ({ phone, content }) => conversationsApi.send(phone, content),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['chat', phone] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao enviar'),
  })

  const sendMedia = useMutation({
    mutationFn: ({ phone, file, mediaType, caption }) =>
      conversationsApi.sendMedia(phone, { file, mediaType, caption }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['chat', phone] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Falha ao enviar mídia'),
  })

  const onFilePicked = (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-picking same file later
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Selecione uma imagem')
      return
    }
    sendMedia.mutate({
      phone,
      file: f,
      mediaType: 'image',
      caption: text.trim() || undefined,
    })
  }

  const startRec = async () => {
    try {
      await recorder.start()
    } catch (err) {
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
    sendMedia.mutate({ phone, file, mediaType: 'audio' })
  }

  const takeover = useMutation({
    mutationFn: () => conversationsApi.takeover(phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conv-active'] })
      toast.success('Conversa transferida para você')
    },
  })

  const release = useMutation({
    mutationFn: () => conversationsApi.release(phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conv-active'] })
      toast.success('Devolvida ao bot')
    },
  })

  if (!phone) return null

  const submit = () => {
    if (!text.trim()) return
    send.mutate({ phone, content: text.trim() })
  }

  return (
    <div className="border-t border-glass-border p-3 bg-bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/50">
          {isHumanTakeover ? '⚠ Você está atendendo manualmente' : 'Bot está atendendo'}
        </div>
        {isHumanTakeover ? (
          <button
            onClick={() => release.mutate()}
            disabled={release.isPending}
            className="btn-ghost text-xs flex items-center gap-1"
          >
            <Bot size={12} /> Voltar para bot
          </button>
        ) : (
          <button
            onClick={() => takeover.mutate()}
            disabled={takeover.isPending}
            className="btn-ghost text-xs flex items-center gap-1 hover:text-primary"
          >
            <UserCog size={12} /> Assumir conversa
          </button>
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
          <span className="text-sm font-mono tabular-nums text-white/80">
            {formatElapsed(recorder.elapsedMs)}
          </span>
          <span className="text-xs text-white/50 flex-1">Gravando áudio…</span>
          <button
            onClick={recorder.cancel}
            className="btn-ghost text-xs flex items-center gap-1"
            title="Cancelar"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            onClick={finishRec}
            disabled={sendMedia.isPending}
            className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1 disabled:opacity-50"
            title="Enviar áudio"
          >
            <Send size={14} /> Enviar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMedia.isPending}
            className="btn-ghost px-3 py-2 disabled:opacity-50"
            title="Anexar imagem"
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            onClick={startRec}
            disabled={sendMedia.isPending}
            className="btn-ghost px-3 py-2 disabled:opacity-50"
            title="Gravar áudio"
          >
            <Mic size={16} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
            placeholder={
              isHumanTakeover ? 'Responder ao cliente...' : 'Enviar (não interrompe o bot)'
            }
            className="input-field flex-1 py-2"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || send.isPending}
            className="btn-primary px-4 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
