import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, User, Volume2, ShieldCheck } from 'lucide-react'

import { conversationsApi } from '@/services/conversations'
import PizzaSpinner from '@/components/ui/PizzaSpinner'
import { useChatStream } from '@/hooks/useChatStream'
import { getApiBase } from '@/utils/apiUrl'

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Media URLs are stored as `/media/chats/<file>`; prefix with the API base so
// the <img> / <audio> tags hit the backend (same nginx proxy already serves
// /media in production).
const resolveMedia = (url) =>
  !url ? null : (/^https?:/i.test(url) ? url : `${getApiBase()}${url}`)

function MediaAttachment({ msg, dark }) {
  // dark=true → user/assistant bubbles (existing dark color schemes), use a
  // brighter audio chrome. Admin bubbles already lean light so the default
  // chrome works.
  const url = resolveMedia(msg.media_url)
  if (!url) return null
  const type = msg.media_type || (msg.is_audio ? 'audio' : null)
  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mb-1">
        <img
          src={url}
          alt="anexo"
          loading="lazy"
          className="rounded-lg max-h-72 max-w-full object-contain bg-black/20"
        />
      </a>
    )
  }
  if (type === 'audio') {
    return (
      <audio
        controls
        preload="metadata"
        src={url}
        className={`w-full mt-1 ${dark ? 'audio-dark' : ''}`}
        style={{ maxWidth: 260 }}
      />
    )
  }
  return null
}

function Bubble({ msg }) {
  const isAdmin = msg.role === 'admin'
  const isAssistant = msg.role === 'assistant'
  const isUser = msg.role === 'user'

  if (msg.role === 'system' || msg.role === 'tool') return null

  const align = isUser ? 'justify-start' : 'justify-end'
  const bubbleStyle = isUser
    ? 'bg-white/8 text-white border border-glass-border rounded-tl-md'
    : isAdmin
      ? 'bg-purple-500/15 text-purple-100 border border-purple-500/30 rounded-tr-md'
      : 'bg-primary/15 text-white border border-primary/30 rounded-tr-md'

  // Hide the synthetic placeholder text when an image/audio is shown — the
  // bubble already conveys "media" visually.
  const placeholder = ['[IMAGEM ENVIADA]', '[ÁUDIO ENVIADO]', '[ÁUDIO INAUDÍVEL]']
  const hideText = msg.media_url && placeholder.includes(msg.content)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${align} mb-2`}
    >
      <div className="flex items-end gap-1.5 max-w-[80%]">
        {isUser && (
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <User size={12} />
          </div>
        )}
        <div className={`px-3 py-2 rounded-2xl ${bubbleStyle}`}>
          {isAdmin && (
            <div className="text-[10px] uppercase opacity-70 flex items-center gap-1 mb-1">
              <ShieldCheck size={10} /> Atendente
            </div>
          )}
          <MediaAttachment msg={msg} dark />
          {!hideText && (
            <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
          )}
          <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1 justify-end">
            {(msg.is_audio || msg.media_type === 'audio') && <Volume2 size={10} />}
            {fmtTime(msg.created_at)}
          </div>
        </div>
        {isAssistant && (
          <div className="w-6 h-6 rounded-full bg-primary-gradient flex items-center justify-center shrink-0">
            <Bot size={12} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function ChatViewer({ phone }) {
  const qc = useQueryClient()
  const scrollRef = useRef(null)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', phone],
    queryFn: () => conversationsApi.messages(phone, 200),
    enabled: !!phone,
  })

  // Stream new messages via the existing /api/orders/live websocket — server
  // also broadcasts chat_message events
  useChatStream({
    phone,
    onMessage: () => {
      qc.invalidateQueries({ queryKey: ['chat', phone] })
      qc.invalidateQueries({ queryKey: ['conv-active'] })
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  if (!phone) {
    return (
      <div className="h-full flex items-center justify-center text-white/40">
        Selecione uma conversa
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 bg-bg/40">
      {isLoading ? (
        <div className="flex justify-center py-12"><PizzaSpinner /></div>
      ) : messages.length === 0 ? (
        <div className="text-center text-white/40 text-sm py-12">
          Sem mensagens
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        </AnimatePresence>
      )}
    </div>
  )
}
