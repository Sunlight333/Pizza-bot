import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MessageCircle, Clock, ShoppingBag } from 'lucide-react'

import { conversationsApi, STATE_LABEL } from '@/services/conversations'
import { ASSETS } from '@/utils/assets'

const relTime = (iso) => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'agora'
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return new Date(iso).toLocaleDateString('pt-BR')
}

// WhatsApp's privacy protocol now routes 1:1 chats with `<id>@lid` JIDs and
// hides the real phone number. Show the LID contact in a friendlier shape:
// last 6 digits of the LID + a tag, instead of the raw `<long>@lid` string.
const isLid = (s) => typeof s === 'string' && s.endsWith('@lid')
const friendlyPhone = (phone) => {
  if (!phone) return ''
  if (!isLid(phone)) return phone
  const id = phone.slice(0, -4)         // strip "@lid"
  const tail = id.length > 6 ? id.slice(-6) : id
  return `Anônimo · #${tail}`
}

export default function ConversationList({ selectedPhone, onSelect }) {
  const { data: active = [], isLoading } = useQuery({
    queryKey: ['conv-active'],
    queryFn: conversationsApi.active,
    refetchInterval: 10_000,
  })

  const { data: recent = [] } = useQuery({
    queryKey: ['conv-recent'],
    queryFn: () => conversationsApi.recentPhones(30),
    refetchInterval: 60_000,
  })

  const activePhones = new Set(active.map((c) => c.phone))
  const archived = recent.filter((r) => !activePhones.has(r.phone))

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs uppercase text-white/40 mb-2 px-1 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
          Ativas ({active.length})
        </h4>
        {isLoading ? (
          <div className="text-xs text-white/40 px-1">Carregando...</div>
        ) : active.length === 0 ? (
          <div className="text-xs text-white/40 px-1">Nenhuma conversa ativa</div>
        ) : (
          <div className="space-y-1.5">
            {active.map((c, i) => {
              const state = STATE_LABEL[c.state] || { label: c.state, color: 'bg-white/10' }
              const isSelected = selectedPhone === c.phone
              return (
                <motion.button
                  key={c.phone}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onSelect(c.phone)}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${
                    isSelected ? 'bg-primary/15 border border-primary/40' : 'glass-card hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={c.is_human_takeover ? ASSETS.icons.channel.manual : ASSETS.icons.channel.whatsapp}
                        alt=""
                        className="w-5 h-5 rounded-md ring-1 ring-glass-border shrink-0"
                        title={c.is_human_takeover ? 'Atendimento humano' : 'WhatsApp / bot'}
                      />
                      <div className="font-medium text-sm truncate">
                        {c.customer_name || friendlyPhone(c.phone)}
                      </div>
                    </div>
                    <span className="text-[10px] text-white/40 flex items-center gap-0.5 shrink-0">
                      <Clock size={10} /> {relTime(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${state.color}`}>
                      {state.label}
                    </span>
                    {c.cart_items > 0 && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <ShoppingBag size={10} /> {c.cart_items}
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div>
          <h4 className="text-xs uppercase text-white/40 mb-2 px-1">Arquivadas</h4>
          <div className="space-y-1">
            {archived.slice(0, 20).map((r) => (
              <button
                key={r.phone}
                onClick={() => onSelect(r.phone)}
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg transition-colors ${
                  selectedPhone === r.phone ? 'bg-primary/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="text-white/60 truncate">{friendlyPhone(r.phone)}</span>
                <span className="text-white/30">{relTime(r.last)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading && active.length === 0 && archived.length === 0 && (
        <div className="glass-card p-6 text-center text-white/40 text-sm">
          <MessageCircle size={28} className="mx-auto mb-2 text-white/20" />
          Sem conversas ainda
        </div>
      )}
    </div>
  )
}
