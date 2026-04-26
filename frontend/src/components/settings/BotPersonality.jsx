import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Bot, DollarSign, FileText, Shield, Calendar, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'
import PizzaSpinner from '@/components/ui/PizzaSpinner'

export default function BotPersonality() {
  const qc = useQueryClient()
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['bot-config'],
    queryFn: () => api.get('/api/bot/config').then((r) => r.data),
  })

  const [form, setForm] = useState(null)
  useEffect(() => {
    if (cfg) setForm(cfg)
  }, [cfg])

  const save = useMutation({
    mutationFn: (data) => api.put('/api/bot/config', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bot-config'] })
      toast.success('Configurações salvas')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao salvar'),
  })

  if (isLoading || !form) {
    return (
      <div className="glass-card p-8 flex justify-center">
        <PizzaSpinner />
      </div>
    )
  }

  const set = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-display flex items-center gap-2">
        <Bot size={18} /> Personalidade do Bot
      </h3>

      <div>
        <label className="text-xs text-white/50 mb-1 block">Nome do bot</label>
        <input
          type="text"
          value={form.bot_name || ''}
          onChange={(e) => set('bot_name', e.target.value)}
          placeholder="Bia, Lucas, Cida..."
          className="input-field"
        />
        <p className="text-[11px] text-white/40 mt-1">
          Como a atendente virtual se apresenta nas conversas.
        </p>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block">Cumprimento padrão</label>
        <textarea
          rows={2}
          value={form.greeting}
          onChange={(e) => set('greeting', e.target.value)}
          className="input-field resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Início (h)</label>
          <input
            type="number" min="0" max="23"
            value={form.working_hours_start}
            onChange={(e) => set('working_hours_start', Number(e.target.value))}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Fim (h)</label>
          <input
            type="number" min="0" max="24"
            value={form.working_hours_end}
            onChange={(e) => set('working_hours_end', Number(e.target.value))}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
          <Calendar size={12} /> Dias fechados
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label, idx) => {
            const closed = (form.closed_weekdays || []).includes(idx)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const cur = form.closed_weekdays || []
                  const next = closed ? cur.filter((d) => d !== idx) : [...cur, idx].sort()
                  set('closed_weekdays', next)
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  closed
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-glass-border bg-bg/30 text-white/60 hover:border-white/20'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-white/40 mt-1">
          Marque os dias em que a pizzaria está fechada — o bot responde com a mensagem abaixo.
        </p>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block">Mensagem fora de horário / dia fechado</label>
        <textarea
          rows={2}
          value={form.off_hours_message}
          onChange={(e) => set('off_hours_message', e.target.value)}
          className="input-field resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block">Itens máx. por pedido</label>
        <input
          type="number" min="1" max="100"
          value={form.max_items_per_order}
          onChange={(e) => set('max_items_per_order', Number(e.target.value))}
          className="input-field"
        />
      </div>

      <div className="space-y-2 pt-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Oferecer repetir último pedido</span>
          <input
            type="checkbox"
            checked={form.enable_repeat_last_order}
            onChange={(e) => set('enable_repeat_last_order', e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Perguntar CPF na nota</span>
          <input
            type="checkbox"
            checked={form.ask_cpf}
            onChange={(e) => set('ask_cpf', e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Responder com áudio (TTS)</span>
          <input
            type="checkbox"
            checked={form.tts_enabled}
            onChange={(e) => set('tts_enabled', e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
        </label>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block">
          Instruções extras (anexadas ao prompt)
        </label>
        <textarea
          rows={3}
          value={form.extra_system_prompt || ''}
          onChange={(e) => set('extra_system_prompt', e.target.value)}
          className="input-field resize-none"
          placeholder="Ex: enfatizar promoções de quarta, recomendar borda recheada..."
        />
      </div>

      <div className="border-t border-glass-border pt-4 space-y-3">
        <h4 className="font-display text-sm flex items-center gap-2">
          <DollarSign size={14} className="text-accent" /> Regra de pizza meia-a-meia
        </h4>
        <p className="text-xs text-white/50">
          Confirme com o dono qual regra a pizzaria usa antes de fechar pedidos meio-a-meio.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'max', label: 'Mais cara', desc: 'padrão BR' },
            { v: 'average', label: 'Média', desc: 'arredondada' },
            { v: 'first', label: 'Primeiro sabor', desc: 'menos comum' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => set('half_pizza_pricing', opt.v)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                form.half_pizza_pricing === opt.v
                  ? 'border-primary/60 bg-primary/10 text-white'
                  : 'border-glass-border bg-bg/30 text-white/70 hover:border-white/20'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[11px] text-white/40">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-glass-border pt-4 space-y-3">
        <h4 className="font-display text-sm flex items-center gap-2">
          <FileText size={14} className="text-accent" /> Cupom fiscal — Datacaixa
        </h4>
        <p className="text-xs text-white/50">
          Modo <code>manual</code> exige confirmação no painel após cada pedido.
          Mude para <code>auto</code> só depois de confirmar com o suporte da Datacaixa
          que o cupom é emitido automaticamente após o import do .txt.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 'manual', label: 'Manual', desc: 'mais seguro' },
            { v: 'auto', label: 'Automático', desc: 'mais rápido' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => set('fiscal_emission_mode', opt.v)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                form.fiscal_emission_mode === opt.v
                  ? 'border-primary/60 bg-primary/10 text-white'
                  : 'border-glass-border bg-bg/30 text-white/70 hover:border-white/20'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[11px] text-white/40">{opt.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            ['default_ncm', 'NCM padrão'],
            ['default_cfop', 'CFOP padrão'],
            ['default_csosn', 'CSOSN padrão'],
            ['default_cest', 'CEST padrão'],
            ['default_origin_code', 'Origem'],
            ['default_ibpt_code', 'IBPT'],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-[11px] text-white/50 block mb-1 uppercase">
                {label}
              </label>
              <input
                type="text"
                value={form[k] || ''}
                onChange={(e) => set(k, e.target.value)}
                placeholder="—"
                className="input-field text-sm py-1.5"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/40">
          Usados como fallback quando um produto não tem código próprio.
        </p>
      </div>

      <div className="border-t border-glass-border pt-4 space-y-3">
        <h4 className="font-display text-sm flex items-center gap-2">
          <Smartphone size={14} className="text-accent" /> PIX
        </h4>
        <p className="text-xs text-white/50">
          Compartilhada pelo bot somente quando o cliente escolhe pagar com PIX.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={form.pix_key || ''}
            onChange={(e) => set('pix_key', e.target.value)}
            placeholder="CNPJ, telefone, e-mail ou chave aleatória"
            className="input-field text-sm"
          />
          <input
            type="text"
            value={form.pix_holder || ''}
            onChange={(e) => set('pix_holder', e.target.value)}
            placeholder="Titular da conta"
            className="input-field text-sm"
          />
        </div>
      </div>

      <div className="border-t border-glass-border pt-4 space-y-2">
        <h4 className="font-display text-sm flex items-center gap-2">
          <Shield size={14} className="text-accent" /> LGPD &amp; Custos
        </h4>
        <div>
          <label className="text-xs text-white/50 mb-1 block">
            Aviso de privacidade (enviado uma vez por cliente)
          </label>
          <textarea
            rows={2}
            value={form.privacy_notice || ''}
            onChange={(e) => set('privacy_notice', e.target.value)}
            placeholder="Ex: Olá! Atende-lo via bot conforme LGPD; seus dados serão usados apenas para o pedido."
            className="input-field resize-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">
            Limite diário de tokens OpenAI (0 = sem limite)
          </label>
          <input
            type="number" min="0" step="1000"
            value={form.daily_token_budget}
            onChange={(e) => set('daily_token_budget', Number(e.target.value))}
            className="input-field"
          />
          <p className="text-[11px] text-white/40 mt-1">
            Ao atingir, o bot transfere automaticamente para atendimento humano.
          </p>
        </div>
      </div>

      <button
        onClick={() => save.mutate(form)}
        disabled={save.isPending}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Save size={14} /> Salvar
      </button>
    </div>
  )
}
