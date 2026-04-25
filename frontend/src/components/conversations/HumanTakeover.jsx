import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, UserCog, Bot } from 'lucide-react'
import toast from 'react-hot-toast'

import { conversationsApi } from '@/services/conversations'

export default function HumanTakeover({ phone, isHumanTakeover }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')

  const send = useMutation({
    mutationFn: ({ phone, content }) => conversationsApi.send(phone, content),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['chat', phone] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao enviar'),
  })

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

      <div className="flex gap-2">
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
    </div>
  )
}
