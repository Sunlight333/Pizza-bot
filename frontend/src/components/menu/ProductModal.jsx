import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, RotateCcw, Upload, Camera, EyeOff, Eye, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { pizzaImage, ASSETS } from '@/utils/assets'
import { resolveMediaUrl } from '@/utils/apiUrl'
import { menuApi } from '@/services/menu'

// Sentinel stored in image_url when the operator chose to suppress the image
// entirely (no auto fallback, no custom photo). Kept short so it fits the
// String(500) column with room to spare.
export const HIDDEN_IMAGE = '__hidden__'

const empty = {
  category_id: '',
  name: '',
  description: '',
  sizes: [{ size: 'único', price: 0 }],
  is_pizza: false,
  allows_half: false,
  available_crusts: [],
  available_extras: [],
  ncm: '',
  cfop: '',
  csosn: '',
  cest: '',
  ibpt_code: '',
  origin_code: '',
  datacaixa_code: '',
  is_active: true,
  image_url: '',
}

export default function ProductModal({ open, onClose, onSave, product, categories }) {
  const [data, setData] = useState(empty)
  const [showTax, setShowTax] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    if (product) {
      // Pre-migration data may store extras/crusts as plain strings; normalize
      // so both editors below always work with {name, price} rows.
      const normalize = (arr) =>
        Array.isArray(arr)
          ? arr.map((e) =>
              typeof e === 'string'
                ? { name: e, price: 0 }
                : { name: e.name || '', price: Number(e.price) || 0 },
            )
          : []
      setData({
        ...empty,
        ...product,
        available_extras: normalize(product.available_extras),
        available_crusts: normalize(product.available_crusts),
      })
    } else {
      setData(empty)
    }
  }, [product, open])

  const handleImageFile = async (file) => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      return
    }
    setUploading(true)
    try {
      const { url } = await menuApi.uploadImage(file)
      set('image_url', url)
      toast.success('Foto carregada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Falha ao enviar imagem')
    } finally {
      setUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))

  const addSize = () =>
    set('sizes', [...(data.sizes || []), { size: '', price: 0 }])
  const removeSize = (i) =>
    set('sizes', data.sizes.filter((_, idx) => idx !== i))
  const updateSize = (i, k, v) => {
    const copy = [...data.sizes]
    copy[i] = { ...copy[i], [k]: k === 'price' ? Number(v) : v }
    set('sizes', copy)
  }

  const addExtra = () =>
    set('available_extras', [...(data.available_extras || []), { name: '', price: 0 }])
  const removeExtra = (i) =>
    set(
      'available_extras',
      (data.available_extras || []).filter((_, idx) => idx !== i),
    )
  const updateExtra = (i, k, v) => {
    const copy = [...(data.available_extras || [])]
    copy[i] = { ...copy[i], [k]: k === 'price' ? Number(v) : v }
    set('available_extras', copy)
  }

  const addCrust = () =>
    set('available_crusts', [...(data.available_crusts || []), { name: '', price: 0 }])
  const removeCrust = (i) =>
    set(
      'available_crusts',
      (data.available_crusts || []).filter((_, idx) => idx !== i),
    )
  const updateCrust = (i, k, v) => {
    const copy = [...(data.available_crusts || [])]
    copy[i] = { ...copy[i], [k]: k === 'price' ? Number(v) : v }
    set('available_crusts', copy)
  }

  const handleSave = async () => {
    if (!data.name || !data.category_id) {
      toast.error('Preencha nome e categoria')
      return
    }
    try {
      await onSave({ ...data, category_id: Number(data.category_id) })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md h-full overflow-y-auto m-0 rounded-none border-l border-glass-border"
          >
            <div className="sticky top-0 bg-bg-card/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-glass-border z-10">
              <h3 className="font-display text-lg">
                {product ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Categoria</label>
                <select
                  value={data.category_id}
                  onChange={(e) => set('category_id', e.target.value)}
                  className="input-field"
                >
                  <option value="">Selecione...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Descrição</label>
                <textarea
                  value={data.description || ''}
                  onChange={(e) => set('description', e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-white/50">Tamanhos / Preços</label>
                  <button onClick={addSize} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                {data.sizes?.map((s, i) => {
                  // Per-size meia-a-meia. null/undefined falls back to the
                  // product-level allows_half (legacy rows). Once edited,
                  // the per-size flag wins on the backend.
                  const halfChecked =
                    s.allows_half == null ? !!data.allows_half : !!s.allows_half
                  return (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input
                        type="text"
                        placeholder="tamanho"
                        value={s.size}
                        onChange={(e) => updateSize(i, 'size', e.target.value)}
                        className="input-field flex-1"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="preço"
                        value={s.price}
                        onChange={(e) => updateSize(i, 'price', e.target.value)}
                        className="input-field w-24"
                      />
                      {data.is_pizza && (
                        <label
                          className="flex items-center gap-1 text-[11px] text-white/60 select-none whitespace-nowrap"
                          title="Marque para permitir meia-a-meia neste tamanho"
                        >
                          <input
                            type="checkbox"
                            checked={halfChecked}
                            onChange={(e) => updateSize(i, 'allows_half', e.target.checked)}
                          />
                          1/2
                        </label>
                      )}
                      <button onClick={() => removeSize(i)} className="text-white/40 hover:text-red-400 px-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
                {data.is_pizza && (
                  <p className="text-[10px] text-white/40 mt-1">
                    "1/2" libera meia-a-meia naquele tamanho. Tamanhos sem marca não aceitam dois sabores.
                  </p>
                )}
              </div>

              {(() => {
                const catName = categories.find((c) => c.id === Number(data.category_id))?.name
                const autoSrc = pizzaImage(data.name, catName)
                const isHidden = data.image_url === HIDDEN_IMAGE
                const isCustom = !!data.image_url && !isHidden
                const previewSrc = isCustom ? resolveMediaUrl(data.image_url) : autoSrc
                const status = isHidden
                  ? 'Imagem oculta — não aparece no cardápio nem nas mensagens.'
                  : isCustom
                    ? 'Foto personalizada — sobrescreve a automática.'
                    : `Automática via pizzaImage("${data.name || '…'}").`
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/50">Foto</label>
                      <div className="flex items-center gap-1">
                        {isCustom && (
                          <button
                            onClick={() => set('image_url', '')}
                            className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                            title="Voltar para a foto automática (pizzaImage)"
                          >
                            <RotateCcw size={12} /> Automática
                          </button>
                        )}
                        <button
                          onClick={() =>
                            set('image_url', isHidden ? '' : HIDDEN_IMAGE)
                          }
                          className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                          title={
                            isHidden
                              ? 'Mostrar a imagem novamente'
                              : 'Esconder a imagem (nem a automática nem a personalizada serão exibidas)'
                          }
                        >
                          {isHidden ? (
                            <>
                              <Eye size={12} /> Mostrar
                            </>
                          ) : (
                            <>
                              <EyeOff size={12} /> Ocultar
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full aspect-square max-h-72 rounded-xl overflow-hidden ring-1 ring-glass-border bg-bg/50 mb-3">
                      {isHidden ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-2">
                          <EyeOff size={36} />
                          <span className="text-xs">Imagem oculta</span>
                        </div>
                      ) : (
                        <img
                          src={previewSrc}
                          alt=""
                          onError={(e) => {
                            if (e.currentTarget.dataset.fallback === '1') return
                            e.currentTarget.dataset.fallback = '1'
                            e.currentTarget.src = ASSETS.menu.productPlaceholder
                          }}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {!isCustom && !isHidden && (
                        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/60 text-white/80 rounded px-2 py-0.5 backdrop-blur-sm">
                          Automática
                        </span>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <Loader2 size={28} className="animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFile(e.target.files?.[0])}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleImageFile(e.target.files?.[0])}
                    />
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-ghost text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Upload size={14} /> Carregar do dispositivo
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-ghost text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Camera size={14} /> Tirar foto
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="/menu/savory/...jpeg ou URL completa (deixe vazio para foto automática)"
                      value={isHidden ? '' : data.image_url || ''}
                      disabled={isHidden}
                      onChange={(e) => set('image_url', e.target.value)}
                      className="input-field text-xs disabled:opacity-50"
                    />
                    <p className="text-[10px] text-white/40 mt-1.5 leading-snug">{status}</p>
                  </div>
                )
              })()}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.is_pizza}
                    onChange={(e) => set('is_pizza', e.target.checked)}
                  />
                  Pizza
                </label>
                {data.is_pizza && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={data.allows_half}
                      onChange={(e) => set('allows_half', e.target.checked)}
                    />
                    Meia-a-meia
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm ml-auto">
                  <input
                    type="checkbox"
                    checked={data.is_active}
                    onChange={(e) => set('is_active', e.target.checked)}
                  />
                  Ativo
                </label>
              </div>

              {data.is_pizza && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/50">Bordas disponíveis</label>
                      <button
                        onClick={addCrust}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {(data.available_crusts || []).length === 0 && (
                      <p className="text-[10px] text-white/40 mb-2">
                        Nenhuma borda. Clique em "Adicionar" para incluir.
                      </p>
                    )}
                    {(data.available_crusts || []).map((cr, i) => {
                      const isFree = !cr.price || Number(cr.price) === 0
                      return (
                        <div key={i} className="flex gap-2 mb-2 items-center">
                          <input
                            type="text"
                            placeholder="nome (ex: Catupiry, Sem Borda)"
                            value={cr.name || ''}
                            onChange={(e) => updateCrust(i, 'name', e.target.value)}
                            className="input-field flex-1 text-sm"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-white/60 select-none whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isFree}
                              onChange={(e) =>
                                updateCrust(i, 'price', e.target.checked ? 0 : cr.price || 1)
                              }
                            />
                            Grátis
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="R$"
                            value={isFree ? '' : cr.price}
                            disabled={isFree}
                            onChange={(e) => updateCrust(i, 'price', e.target.value)}
                            className="input-field w-20 text-sm disabled:opacity-40"
                          />
                          <button
                            onClick={() => removeCrust(i)}
                            className="text-white/40 hover:text-red-400 px-1"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-white/40 mt-1">
                      Marque "Grátis" para bordas sem custo (ex: Sem Borda).
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/50">Adicionais disponíveis</label>
                      <button
                        onClick={addExtra}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {(data.available_extras || []).length === 0 && (
                      <p className="text-[10px] text-white/40 mb-2">
                        Nenhum adicional. Clique em "Adicionar" para incluir.
                      </p>
                    )}
                    {(data.available_extras || []).map((ex, i) => {
                      const isFree = !ex.price || Number(ex.price) === 0
                      return (
                        <div key={i} className="flex gap-2 mb-2 items-center">
                          <input
                            type="text"
                            placeholder="nome (ex: Cebola, Extra Bacon)"
                            value={ex.name || ''}
                            onChange={(e) => updateExtra(i, 'name', e.target.value)}
                            className="input-field flex-1 text-sm"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-white/60 select-none whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isFree}
                              onChange={(e) =>
                                updateExtra(i, 'price', e.target.checked ? 0 : ex.price || 1)
                              }
                            />
                            Grátis
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="R$"
                            value={isFree ? '' : ex.price}
                            disabled={isFree}
                            onChange={(e) => updateExtra(i, 'price', e.target.value)}
                            className="input-field w-20 text-sm disabled:opacity-40"
                          />
                          <button
                            onClick={() => removeExtra(i)}
                            className="text-white/40 hover:text-red-400 px-1"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-white/40 mt-1">
                      Marque "Grátis" para adicionais sem custo (ex: cebola, requeijão).
                    </p>
                  </div>
                </>
              )}

              <button
                onClick={() => setShowTax((v) => !v)}
                className="text-xs text-white/50 hover:text-white flex items-center gap-1"
              >
                {showTax ? '−' : '+'} Dados fiscais (Datacaixa)
              </button>

              {showTax && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {['ncm', 'cfop', 'csosn', 'cest', 'ibpt_code', 'origin_code', 'datacaixa_code'].map((k) => (
                    <div key={k}>
                      <label className="text-xs text-white/50 mb-1 block uppercase">{k.replace('_', ' ')}</label>
                      <input
                        type="text"
                        value={data[k] || ''}
                        onChange={(e) => set(k, e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleSave} className="btn-primary flex-1">Salvar</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
