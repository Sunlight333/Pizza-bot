import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { UserIcon } from 'lucide-react'

import AnimatedPage from '@/components/layout/AnimatedPage'
import ConversationList from '@/components/conversations/ConversationList'
import ChatViewer from '@/components/conversations/ChatViewer'
import HumanTakeover from '@/components/conversations/HumanTakeover'
import CustomerSidebar from '@/components/conversations/CustomerSidebar'
import { conversationsApi } from '@/services/conversations'
import { displayName, isAnonymousPhone } from '@/utils/customer'

export default function Conversations() {
  const [params, setParams] = useSearchParams()
  const initialPhone = params.get('phone') || null
  const [selected, setSelected] = useState(initialPhone)
  const [profileOpen, setProfileOpen] = useState(true)

  const { data: active = [] } = useQuery({
    queryKey: ['conv-active'],
    queryFn: conversationsApi.active,
    refetchInterval: 10_000,
  })

  // Recent (archived + active) — resolves the customer name for
  // archived conversations so the header still shows the saved pushName
  // instead of falling through to "Anônimo · #<tail>".
  const { data: recent = [] } = useQuery({
    queryKey: ['conv-recent'],
    queryFn: () => conversationsApi.recentPhones(30),
    refetchInterval: 60_000,
  })

  // Auto-select first active conversation if nothing selected.
  useEffect(() => {
    if (!selected && active.length) setSelected(active[0].phone)
  }, [active, selected])

  // Reflect the selection in the URL so the Clientes page → "Abrir
  // conversa" deep-link works on first nav.
  useEffect(() => {
    if (!selected) return
    const current = params.get('phone')
    if (current !== selected) {
      const next = new URLSearchParams(params)
      next.set('phone', selected)
      setParams(next, { replace: true })
    }
  }, [selected, params, setParams])

  const current = active.find((c) => c.phone === selected)
  const recentRow = recent.find((r) => r.phone === selected)
  const headerName = current?.customer_name || recentRow?.customer_name

  // Three-column grid on lg+ (list / chat / customer pane).
  // Two-column on md (list + chat); customer pane is hidden but still
  // toggleable. One-column stack on mobile (list collapses).
  return (
    <AnimatedPage>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr_300px] gap-3 h-[calc(100vh-130px)]">
        <div className="overflow-y-auto">
          <ConversationList selectedPhone={selected} onSelect={setSelected} />
        </div>

        <div className="glass-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-display truncate">
                {selected ? displayName(headerName, selected) : 'Conversa'}
              </div>
              {selected && (
                <div className="text-xs text-white/50 truncate">
                  {isAnonymousPhone(selected)
                    ? 'WhatsApp anônimo (privacidade do nº ativada)'
                    : selected}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {current?.cart_items > 0 && (
                <span className="text-xs text-white/50">
                  {current.cart_items} itens no carrinho
                </span>
              )}
              {/* Toggle customer pane on lg+ (kept always-visible) and on
                  smaller screens (becomes a quick peek). */}
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                title={profileOpen ? 'Ocultar cliente' : 'Ver cliente'}
                aria-label="Alternar painel do cliente"
              >
                <UserIcon size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatViewer phone={selected} />
          </div>

          <HumanTakeover phone={selected} isHumanTakeover={current?.is_human_takeover} />
        </div>

        {/* Customer pane — always visible on lg+; toggleable below */}
        <div className={`${profileOpen ? 'block' : 'hidden'} lg:block min-h-0`}>
          <CustomerSidebar
            phone={selected}
            headerName={headerName}
            onClose={() => setProfileOpen(false)}
          />
        </div>
      </div>
    </AnimatedPage>
  )
}
