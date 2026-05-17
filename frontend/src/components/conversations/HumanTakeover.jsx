import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, UserCog, Bot, Paperclip, Mic, X, Square } from 'lucide-react'
import toast from 'react-hot-toast'

import { conversationsApi } from '@/services/conversations'
import { useVoiceRecorder, formatElapsed } from '@/hooks/useVoiceRecorder'

export default function HumanTakeover({ phone, isHumanTakeover }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  // Staged attachments. Picking an image or finishing a recording does NOT
  // send — it parks the blob here so the operator can preview, add a caption
  // (image only), and commit via the Send button. Either is mutually
  // exclusive at any moment; picking a second item replaces the first.
  const [pendingImage, setPendingImage] = useState(null) // { file, previewUrl }
  const [pendingAudio, setPendingAudio] = useState(null) // { file, previewUrl, durationMs }
  const fileInputRef = useRef(null)
  const recorder = useVoiceRecorder()

  // Revoke object URLs when the staged item changes or the component unmounts
  // — leaking them keeps the blob alive in the renderer process.
  useEffect(() => () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    if (pendingAudio?.previewUrl) URL.revokeObjectURL(pendingAudio.previewUrl)
  }, [pendingImage, pendingAudio])

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
      setPendingImage(null)
      setPendingAudio(null)
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
    // Stage; do not send. Operator commits via the Send button.
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    if (pendingAudio) {
      if (pendingAudio.previewUrl) URL.revokeObjectURL(pendingAudio.previewUrl)
      setPendingAudio(null)
    }
    setPendingImage({ file: f, previewUrl: URL.createObjectURL(f) })
  }

  const discardImage = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  const discardAudio = () => {
    if (pendingAudio?.previewUrl) URL.revokeObjectURL(pendingAudio.previewUrl)
    setPendingAudio(null)
  }

  const startRec = async () => {
    try {
      await recorder.start()
    } catch (err) {
      toast.error('Permissão de microfone negada ou indisponível')
    }
  }

  // Stops recording and STAGES the resulting clip — operator must press Send
  // to actually transmit. Anything shorter than 600 ms is treated as a
  // misclick and discarded so empty blobs never sit in the preview.
  const finishRec = async () => {
    const { blob, mime, durationMs } = await recorder.stop()
    if (durationMs < 600) {
      toast('Áudio muito curto', { icon: '⚠️' })
      return
    }
    const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'm4a'
    const file = new File([blob], `voice.${ext}`, { type: mime })
    if (pendingImage) discardImage()
    setPendingAudio({ file, previewUrl: URL.createObjectURL(blob), durationMs })
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

  // Unified Send: commits whichever attachment is staged (audio > image),
  // or plain text. Text typed alongside a staged image is sent as caption;
  // staged audio ignores the text field since voice notes don't carry one.
  const submit = () => {
    if (pendingAudio) {
      sendMedia.mutate({
        phone, file: pendingAudio.file, mediaType: 'audio',
      })
      return
    }
    if (pendingImage) {
      sendMedia.mutate({
        phone, file: pendingImage.file, mediaType: 'image',
        caption: text.trim() || undefined,
      })
      return
    }
    if (!text.trim()) return
    send.mutate({ phone, content: text.trim() })
  }

  const hasPending = !!(pendingImage || pendingAudio)
  const canSubmit = (hasPending || text.trim().length > 0) && !send.isPending && !sendMedia.isPending

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
          {/* "Parar" stages the clip into the preview row below — the
              outer Send button is what actually transmits. */}
          <button
            onClick={finishRec}
            className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1"
            title="Parar gravação"
          >
            <Square size={14} /> Parar
          </button>
        </div>
      ) : (
        <>
          {(pendingImage || pendingAudio) && (
            <div className="mb-2 flex items-center gap-2 bg-white/5 border border-glass-border rounded-lg p-2">
              {pendingImage && (
                <>
                  <img
                    src={pendingImage.previewUrl}
                    alt=""
                    className="w-12 h-12 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/80 truncate">
                      {pendingImage.file.name}
                    </div>
                    <div className="text-[10px] text-white/40">
                      Imagem pronta — adicione legenda e envie
                    </div>
                  </div>
                </>
              )}
              {pendingAudio && (
                <>
                  <audio
                    src={pendingAudio.previewUrl}
                    controls
                    className="h-8 max-w-[260px]"
                  />
                  <div className="text-[10px] text-white/40 flex-1">
                    Áudio pronto ({formatElapsed(pendingAudio.durationMs)}) — confira e envie
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={pendingImage ? discardImage : discardAudio}
                className="btn-ghost p-1.5 shrink-0"
                title="Descartar"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMedia.isPending || !!pendingAudio}
              className="btn-ghost px-3 py-2 disabled:opacity-50"
              title={pendingAudio ? 'Descarte o áudio antes' : 'Anexar imagem'}
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              onClick={startRec}
              disabled={sendMedia.isPending || !!pendingImage || !!pendingAudio}
              className="btn-ghost px-3 py-2 disabled:opacity-50"
              title={
                pendingImage ? 'Descarte a imagem antes'
                : pendingAudio ? 'Descarte o áudio antes'
                : 'Gravar áudio'
              }
            >
              <Mic size={16} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), canSubmit && submit())}
              placeholder={
                pendingAudio ? 'Áudio pronto — toque em enviar'
                : pendingImage ? 'Legenda (opcional)'
                : isHumanTakeover ? 'Responder ao cliente...'
                : 'Enviar (não interrompe o bot)'
              }
              disabled={!!pendingAudio}
              className="input-field flex-1 py-2 disabled:opacity-50"
            />
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="btn-primary px-4 disabled:opacity-50"
              title="Enviar"
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
