import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import AnimatedPage from '@/components/layout/AnimatedPage'
import ConversationList from '@/components/conversations/ConversationList'
import ChatViewer from '@/components/conversations/ChatViewer'
import HumanTakeover from '@/components/conversations/HumanTakeover'
import { conversationsApi } from '@/services/conversations'

export default function Conversations() {
  const [selected, setSelected] = useState(null)

  const { data: active = [] } = useQuery({
    queryKey: ['conv-active'],
    queryFn: conversationsApi.active,
    refetchInterval: 10_000,
  })

  // Auto-select first active conversation if nothing selected
  useEffect(() => {
    if (!selected && active.length) setSelected(active[0].phone)
  }, [active, selected])

  const current = active.find((c) => c.phone === selected)

  return (
    <AnimatedPage>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-130px)]">
        <div className="overflow-y-auto">
          <ConversationList selectedPhone={selected} onSelect={setSelected} />
        </div>

        <div className="glass-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
            <div>
              <div className="font-display">{current?.customer_name || selected || 'Conversa'}</div>
              {selected && <div className="text-xs text-white/50">{selected}</div>}
            </div>
            {current && (
              <span className="text-xs text-white/50">
                {current.cart_items > 0 && `${current.cart_items} itens no carrinho`}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatViewer phone={selected} />
          </div>

          <HumanTakeover phone={selected} isHumanTakeover={current?.is_human_takeover} />
        </div>
      </div>
    </AnimatedPage>
  )
}
