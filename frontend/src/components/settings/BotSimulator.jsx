import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, RefreshCw, Phone, Bot, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'

/**
 * Simulator: drives the same ai_engine.process_incoming() the real WhatsApp
 * webhook uses, but routes the bot's reply back to the panel instead of sending
 * it via Evolution. Lets the operator run the Step-12 scenarios end-to-end
 * without needing a paired WhatsApp number.
 */
export default function BotSimulator() {
  const [phone, setPhone] = useState('5511999990000')
  const [text, setText] = useState('')
  const [history, setHistory] = useState([])

  const send = useMutation({
    mutationFn: () => api.post('/api/admin/simulate', { phone, text }).then((r) => r.data),
    onSuccess: (data) => {
      setHistory((h) => [
        ...h,
        { role: 'user', content: data.user_text },
        { role: 'assistant', content: data.bot_reply || '(sem resposta — handoff)' },
      ])
      data.notes?.forEach((n) => toast(n, { icon: '⚠️' }))
      setText('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro no simulador'),
  })

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
          history.map((m, i) => (
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
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <UserIcon size={14} className="text-white/60" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
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
    </div>
  )
}
