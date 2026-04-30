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
      // Coerce every shape we've ever shipped into {name, prices: {size: price}}:
      //  - "Catupiry"                    (pre-0007 plain string)
      //  - {name, price}                 (0007..0009 flat per-option price)
      //  - {name, prices: {brotinho:3}}  (post-0010 — the real shape)
      const normalize = (arr) =>
        Array.isArray(arr)
          ? arr.map((e) => {
              if (typeof e === 'string') return { name: e, prices: {} }
              if (e && typeof e === 'object') {
                if (e.prices && typeof e.prices === 'object') {
                  // strip 0/falsy entries — empty == free
                  const cleaned = {}
                  for (const [k, v] of Object.entries(e.prices)) {
                    if (Number(v) > 0) cleaned[k] = Number(v)
                  }
                  return { name: e.name || '', prices: cleaned }
                }
                if (e.price != null) {
                  // Legacy flat price → not enough info to spread per size,
                  // so keep prices empty (operator re-enters per cell).
                  return { name: e.name || '', prices: {} }
                }
                return { name: e.name || '', prices: {} }
              }
              return { name: '', prices: {} }
            })
          : []
      // Resolve each size's allows_half to a concrete bool on load — if it's
      // null/undefined the operator's intent today is the inherited global
      // flag, so persist that explicitly. Otherwise a save without touching
      // the per-size checkbox keeps the null and validate_combination later
      // can't tell if meia-a-meia should be rejected.
      const productAllowsHalf = !!product.allows_half
      const sizes = Array.isArray(product.sizes)
        ? product.sizes.map((s) => ({
            ...s,
            allows_half: s.allows_half == null ? productAllowsHalf : !!s.allows_half,
          }))
        : empty.sizes
      setData({
        ...empty,
        ...product,
        sizes,
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

  // Generic helpers for the size×option matrix used by both bordas and adicionais.
  const addOption = (key) =>
    set(key, [...(data[key] || []), { name: '', prices: {} }])
  const removeOption = (key, i) =>
    set(key, (data[key] || []).filter((_, idx) => idx !== i))
  const updateOptionName = (key, i, name) => {
    const copy = [...(data[key] || [])]
    copy[i] = { ...copy[i], name }
    set(key, copy)
  }
  const updateOptionPrice = (key, i, sizeName, raw) => {
    const copy = [...(data[key] || [])]
    const prices = { ...(copy[i].prices || {}) }
    const num = Number(raw)
    if (raw === '' || raw == null || Number.isNaN(num) || num <= 0) {
      // Empty / 0 / negative => free for that size; remove the entry so the
      // backend treats "missing size" and "explicit 0" the same way.
      delete prices[sizeName]
    } else {
      prices[sizeName] = num
    }
    copy[i] = { ...copy[i], prices }
    set(key, copy)
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
                <div className="relative">
                  <select
                    value={data.category_id}
                    onChange={(e) => set('category_id', e.target.value)}
                    className="input-field appearance-none pr-10 cursor-pointer"
                  >
                    {/*
                      Native <option> elements ignore most CSS — Chrome/Edge use the
                      OS dropdown which paints them on a white surface. The inline
                      style is the only reliable way to keep them readable on the
                      dark theme. Same color tokens as bg-bg-card / text-white.
                    */}
                    <option value="" style={{ backgroundColor: '#1A1A3E', color: '#fff' }}>
                      Selecione...
                    </option>
                    {categories.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        style={{ backgroundColor: '#1A1A3E', color: '#fff' }}
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/50"
                  >
                    ▾
                  </span>
                </div>
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

              {data.is_pizza && (() => {
                // Render a size×option price matrix used by both bordas and adicionais.
                // Each cell is the price of that option on that size; empty = free.
                const sizeNames = (data.sizes || [])
                  .map((s) => s.size)
                  .filter((s) => s && s.trim())

                const matrix = (key, label, addLabel, hint) => (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/50">{label}</label>
                      <button
                        onClick={() => addOption(key)}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Plus size={12} /> {addLabel}
                      </button>
                    </div>
                    {(data[key] || []).length === 0 && (
                      <p className="text-[10px] text-white/40 mb-2">
                        Nenhum item. Clique em "{addLabel}" para incluir.
                      </p>
                    )}
                    {(data[key] || []).length > 0 && sizeNames.length === 0 && (
                      <p className="text-[10px] text-yellow-400/70 mb-2">
                        Adicione tamanhos primeiro para definir os preços por tamanho.
                      </p>
                    )}
                    {(data[key] || []).length > 0 && sizeNames.length > 0 && (
                      <div className="flex gap-1.5 mb-1 px-1 items-center">
                        <span className="flex-1 text-[10px] text-white/30">nome</span>
                        {sizeNames.map((sn) => (
                          <span
                            key={sn}
                            className="w-20 text-[10px] text-white/30 text-center truncate"
                            title={sn}
                          >
                            {sn}
                          </span>
                        ))}
                        <span className="w-5" />
                      </div>
                    )}
                    {(data[key] || []).map((item, i) => (
                      <div key={i} className="flex gap-1.5 mb-2 items-center">
                        <input
                          type="text"
                          placeholder={
                            key === 'available_crusts'
                              ? 'ex: Catupiry'
                              : 'ex: Cebola'
                          }
                          value={item.name || ''}
                          onChange={(e) => updateOptionName(key, i, e.target.value)}
                          className="input-field flex-1 text-sm min-w-0"
                        />
                        {sizeNames.map((sn) => {
                          const v = item.prices?.[sn]
                          return (
                            <input
                              key={sn}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="—"
                              value={v == null || Number(v) === 0 ? '' : v}
                              onChange={(e) => updateOptionPrice(key, i, sn, e.target.value)}
                              className="input-field w-20 text-sm text-center px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title={`${item.name || 'item'} no tamanho ${sn} (vazio = grátis)`}
                            />
                          )
                        })}
                        <button
                          onClick={() => removeOption(key, i)}
                          className="text-white/40 hover:text-red-400 px-1 shrink-0"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-white/40 mt-1">{hint}</p>
                  </div>
                )

                return (
                  <>
                    {matrix(
                      'available_crusts',
                      'Bordas disponíveis',
                      'Adicionar',
                      'Deixe em branco para grátis (ex: Sem Borda). Preço por tamanho — catupiry pode custar menos no brotinho.',
                    )}
                    {matrix(
                      'available_extras',
                      'Adicionais disponíveis',
                      'Adicionar',
                      'Deixe em branco para grátis (cebola, requeijão). Preço por tamanho — extra queijo pode custar menos no brotinho.',
                    )}
                  </>
                )
              })()}

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
