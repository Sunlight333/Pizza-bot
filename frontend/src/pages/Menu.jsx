import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Pizza as PizzaIcon, Tag, Upload, AlertTriangle, Search, Wrench, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

import AnimatedPage from '@/components/layout/AnimatedPage'
import ProductModal from '@/components/menu/ProductModal'
import CategoryManager from '@/components/menu/CategoryManager'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { menuApi } from '@/services/menu'
import { categoryImage, categoryHero, pizzaImage, ASSETS } from '@/utils/assets'
import { resolveMediaUrl } from '@/utils/apiUrl'
import { HIDDEN_IMAGE } from '@/components/menu/ProductModal'
import MenuCardCarousel from '@/components/menu/MenuCardCarousel'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

export default function Menu() {
  const qc = useQueryClient()
  const [activeCat, setActiveCat] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCategories, setShowCategories] = useState(false)
  const [search, setSearch] = useState('')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: menuApi.listCategories,
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', activeCat],
    queryFn: () => menuApi.listProducts(activeCat ? { category_id: activeCat } : {}),
  })

  const saveMut = useMutation({
    mutationFn: (data) =>
      data.id ? menuApi.updateProduct(data.id, data) : menuApi.createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Salvo')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => menuApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Desativado')
    },
  })

  const onEdit = (p) => { setEditing(p); setModalOpen(true) }
  const onNew = () => { setEditing(null); setModalOpen(true) }

  // C2: warn when products are missing fiscal codes (NCM/CFOP/CSOSN)
  const { data: missingTax = [] } = useQuery({
    queryKey: ['products-missing-tax'],
    queryFn: menuApi.missingTax,
    refetchInterval: 60_000,
  })
  const missingIds = new Set(missingTax.map((m) => m.id))

  // Data-quality warnings (suspicious prices, missing crusts, etc.)
  const { data: warnings = [] } = useQuery({
    queryKey: ['products-data-warnings'],
    queryFn: menuApi.dataWarnings,
    refetchInterval: 60_000,
  })

  const bulkAllowsHalf = useMutation({
    mutationFn: () =>
      menuApi.bulkAllowsHalf({
        size_names: ['brotinho', 'pequena', 'média', 'media'],
        allows_half: false,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-data-warnings'] })
      toast.success(
        `Regra aplicada em ${r.products_affected} pizza(s) — agora brotinho/pequena/média são 1 sabor.`,
      )
    },
    onError: (e) =>
      toast.error(e.response?.data?.detail || 'Erro ao aplicar regra'),
  })

  const taxImportRef = useRef(null)
  const taxImport = useMutation({
    mutationFn: (file) => menuApi.taxImport(file),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-missing-tax'] })
      toast.success(`${r.updated} produto(s) atualizados`)
      if (r.not_found?.length) {
        toast(`Não encontrados: ${r.not_found.slice(0, 3).join(', ')}${r.not_found.length > 3 ? '…' : ''}`, { icon: '⚠️' })
      }
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao importar'),
  })

  if (showCategories) {
    return (
      <AnimatedPage className="space-y-3">
        <button
          onClick={() => setShowCategories(false)}
          className="btn-ghost text-sm"
        >
          ← Voltar para produtos
        </button>
        <CategoryManager />
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveCat(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
            ${activeCat === null ? 'bg-primary-gradient text-white shadow-glow-primary' : 'glass-card text-white/60 hover:text-white'}`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${activeCat === c.id ? 'bg-primary-gradient text-white shadow-glow-primary' : 'glass-card text-white/60 hover:text-white'}`}
          >
            {c.name} <span className="text-white/40 ml-1">({c.product_count})</span>
          </button>
        ))}
        <button
          onClick={() => setShowCategories(true)}
          className="btn-ghost flex items-center gap-2 ml-auto text-sm"
        >
          <Tag size={14} /> Categorias
        </button>
        <input
          ref={taxImportRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && taxImport.mutate(e.target.files[0])}
        />
        <button
          onClick={() => taxImportRef.current?.click()}
          className="btn-ghost flex items-center gap-2 text-sm"
          title="Importar NCM/CFOP/CSOSN dos produtos via CSV"
        >
          <Upload size={14} /> CSV Fiscal
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                'Aplicar a regra "brotinho/pequena/média = 1 sabor" em todas as pizzas?\n\n' +
                  'Após isso, a IA vai recusar pedidos de meia-a-meia nesses tamanhos. ' +
                  'Tamanhos diferentes (grande, gigante etc.) não são afetados.',
              )
            ) {
              bulkAllowsHalf.mutate()
            }
          }}
          disabled={bulkAllowsHalf.isPending}
          className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
          title="Define que brotinho/pequena/média não aceitam meia-a-meia em todas as pizzas"
        >
          <Wrench size={14} /> Brotinho 1 sabor
        </button>
        <button onClick={onNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou descrição…"
          className="input-field pl-9 text-sm"
        />
      </div>

      {missingTax.length > 0 && (
        <div className="glass-card p-3 border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <span className="text-yellow-300 font-medium">
              {missingTax.length} produto(s) sem dados fiscais completos.
            </span>
            <span className="text-white/60 ml-2">
              Datacaixa pode rejeitar. Edite o produto ou importe um CSV. Fallback dos
              padrões em <code>Configurações → Bot</code> é usado enquanto isso.
            </span>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="glass-card p-3 border-orange-500/30 bg-orange-500/5">
          <div className="flex items-start gap-3 mb-2">
            <AlertCircle size={18} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <span className="text-orange-300 font-medium">
                {warnings.length} aviso(s) de dados — revise antes da IA cotar pra cliente.
              </span>
            </div>
          </div>
          <ul className="text-xs text-white/70 space-y-1 ml-7 max-h-32 overflow-y-auto">
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    const p = products.find((pp) => pp.id === w.product_id)
                    if (p) onEdit(p)
                  }}
                  className="text-left hover:text-orange-200 transition-colors"
                >
                  <span className="font-medium">{w.name}:</span>{' '}
                  <span className="text-white/60">{w.message}</span>
                </button>
              </li>
            ))}
            {warnings.length > 8 && (
              <li className="text-white/40 italic">
                … e mais {warnings.length - 8}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Category cover banner — shows the visual context for the active filter */}
      {activeCat !== null && (() => {
        const cat = categories.find((c) => c.id === activeCat)
        if (!cat) return null
        return (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative h-28 rounded-2xl overflow-hidden border border-glass-border"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${categoryHero(cat.name)})` }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(15,15,35,0.85) 0%, rgba(15,15,35,0.4) 80%)',
              }}
            />
            <div className="relative h-full flex items-center px-5">
              <div>
                <div className="font-display text-xl">{cat.name}</div>
                <div className="text-xs text-white/60 mt-0.5">{cat.product_count} produtos</div>
              </div>
            </div>
          </motion.div>
        )
      })()}

      {(() => {
        const q = search.trim().toLowerCase()
        const filtered = q
          ? products.filter(
              (p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q),
            )
          : products
        return isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/50">
          <PizzaIcon size={40} className="mx-auto mb-3 text-white/30" />
          {q ? `Nenhum produto encontrado para "${search}"` : 'Nenhum produto nesta categoria'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 items-start">
          {filtered.map((p, i) => {
            const catName = categories.find((c) => c.id === p.category_id)?.name
            const gallery = (Array.isArray(p.image_urls) ? p.image_urls : []).filter(Boolean)
            const imageHidden = p.image_url === HIDDEN_IMAGE && gallery.length === 0
            const autoFallback = pizzaImage(p.name, catName)
            // If a product has no gallery but a single image_url (legacy or
            // pre-migration), feed that one as the only carousel frame so
            // the existing photo still shows.
            const carouselUrls =
              gallery.length > 0
                ? gallery
                : p.image_url && p.image_url !== HIDDEN_IMAGE
                  ? [p.image_url]
                  : []
            const extraCount = Math.max(0, carouselUrls.length - 1)
            return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card overflow-hidden hover:border-primary/30 transition-all hover:-translate-y-0.5 flex flex-col w-64 h-[32rem] shrink-0"
            >
              <div className="relative w-full h-64 shrink-0 bg-bg/50 overflow-hidden">
                {imageHidden ? (
                  <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
                    sem imagem
                  </div>
                ) : (
                  <MenuCardCarousel
                    urls={carouselUrls}
                    fallbackSrc={autoFallback}
                    alt={p.name}
                  />
                )}
                <span
                  className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm ${
                    p.is_active
                      ? 'bg-success/30 text-success ring-1 ring-success/40'
                      : 'bg-black/40 text-white/60 ring-1 ring-white/20'
                  }`}
                >
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </span>
                {extraCount > 0 && !imageHidden && (
                  <span
                    className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white/90 backdrop-blur-sm"
                    title={`${gallery.length} fotos cadastradas`}
                  >
                    +{extraCount} {extraCount === 1 ? 'foto' : 'fotos'}
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1">
                  <h3 className="font-medium truncate">{p.name}</h3>
                  {missingIds.has(p.id) && (
                    <span title="Sem NCM/CFOP/CSOSN — Datacaixa pode rejeitar">
                      <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-white/50 mb-3 line-clamp-2">{p.description}</p>
                )}
                {/*
                  Sizes list scrolls inside the card body so products with
                  many sizes (Coca-Cola 2L has 8) don't push the action row
                  out of the visible 256px body. flex-1 + min-h-0 is the
                  canonical pattern that lets a flex child actually shrink
                  below its content size and become scrollable.
                */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-3 pr-1">
                  {(p.sizes || []).map((s) => (
                    <div key={s.size} className="flex justify-between text-sm">
                      <span className="text-white/60">{s.size}</span>
                      <span className="text-accent font-medium">{brl(s.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-glass-border pt-3 shrink-0">
                  <button onClick={() => onEdit(p)} className="btn-ghost text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                    <Edit2 size={12} /> Editar
                  </button>
                  <button
                    onClick={() => { if (confirm('Desativar este produto?')) deleteMut.mutate(p.id) }}
                    className="btn-ghost text-xs py-1.5 px-3 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )})}
        </div>
      )
      })()}

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(data) => saveMut.mutateAsync(data)}
        product={editing}
        categories={categories}
      />
    </AnimatedPage>
  )
}
