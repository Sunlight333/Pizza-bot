import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Trash2, Upload, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'
import { menuApi } from '@/services/menu'
import { resolveMediaUrl } from '@/utils/apiUrl'
import PizzaSpinner from '@/components/ui/PizzaSpinner'

/**
 * Menu image gallery for the bot's send_menu_image tool.
 *
 * Each row is a category the customer might ask about ("manda o cardápio das
 * salgadas" / "tem foto dos sorvetes?"). Operator uploads one image per
 * category; the bot dispatches that image when GPT calls send_menu_image.
 *
 * The list of categories is hardcoded on purpose — the bot's tool enum is
 * also fixed (salgada/doce/sorvete/bebida) so adding a category here without
 * teaching the bot would silently fail. Keep both in sync.
 */
const CATEGORIES = [
  {
    key: 'salgada',
    title: 'Pizzas Salgadas',
    hint: 'Cardápio inteiro de pizzas salgadas. Boa qualidade — vai virar foto no WhatsApp.',
  },
  {
    key: 'doce',
    title: 'Pizzas Doces',
    hint: 'Sabores de doce: chocolate, romeu e julieta, etc.',
  },
  {
    key: 'sorvete',
    title: 'Sorvetes',
    hint: 'Lista de sabores e tamanhos. Útil quando o cliente pergunta de sobremesa.',
  },
  {
    key: 'bebida',
    title: 'Bebidas',
    hint: 'Refrigerantes, sucos, cervejas. Opcional.',
  },
]

export default function MenuImages() {
  const qc = useQueryClient()
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['bot-config'],
    queryFn: () => api.get('/api/bot/config').then((r) => r.data),
  })

  if (isLoading || !cfg) {
    return (
      <div className="glass-card p-8 flex justify-center">
        <PizzaSpinner />
      </div>
    )
  }

  const images = cfg.menu_images || {}

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-display flex items-center gap-2">
        <ImageIcon size={18} /> Cardápios em imagem
      </h3>
      <p className="text-xs text-white/60">
        Quando um cliente pedir "manda o cardápio", "quero ver as pizzas" ou
        "qual sabor de sorvete", o bot envia automaticamente a imagem da
        categoria correspondente. Categorias sem foto cadastrada fazem o bot
        responder em texto.
      </p>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <CategoryRow
            key={cat.key}
            category={cat}
            currentUrl={images[cat.key]}
            onChange={(url) => {
              const next = { ...images }
              if (url) next[cat.key] = url
              else delete next[cat.key]
              api
                .put('/api/bot/config', { menu_images: next })
                .then(() => {
                  qc.invalidateQueries({ queryKey: ['bot-config'] })
                  toast.success(
                    url
                      ? `${cat.title}: imagem atualizada`
                      : `${cat.title}: imagem removida`,
                  )
                })
                .catch((e) =>
                  toast.error(e.response?.data?.detail || 'Erro ao salvar'),
                )
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryRow({ category, currentUrl, onChange }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handlePick = async (file) => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      return
    }
    setUploading(true)
    try {
      const { url } = await menuApi.uploadImage(file)
      onChange(url)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Falha ao enviar imagem')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="border border-glass-border rounded-xl p-3 flex gap-3 items-start">
      <div className="w-20 h-20 rounded-lg bg-bg/50 ring-1 ring-glass-border overflow-hidden shrink-0 relative">
        {currentUrl ? (
          <img
            src={resolveMediaUrl(currentUrl)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <ImageIcon size={24} />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 size={20} className="animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium">{category.title}</span>
          <span className="text-[10px] text-white/30 font-mono">{category.key}</span>
        </div>
        <p className="text-[11px] text-white/50 mb-2 line-clamp-2">{category.hint}</p>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Upload size={12} /> {currentUrl ? 'Trocar' : 'Carregar'}
          </button>
          {currentUrl && (
            <button
              onClick={() => {
                if (confirm(`Remover a imagem de ${category.title}?`)) onChange('')
              }}
              className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 hover:text-red-400"
            >
              <Trash2 size={12} /> Remover
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
