import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import PizzaBuilder from '@/components/3d/PizzaBuilder'

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

  useEffect(() => {
    if (product) {
      setData({ ...empty, ...product })
    } else {
      setData(empty)
    }
  }, [product, open])

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
                {data.sizes?.map((s, i) => (
                  <div key={i} className="flex gap-2 mb-2">
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
                      className="input-field w-28"
                    />
                    <button onClick={() => removeSize(i)} className="text-white/40 hover:text-red-400 px-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

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
                  <div className="rounded-xl overflow-hidden bg-bg/40">
                    <PizzaBuilder
                      flavorA={data.name || 'Mussarela'}
                      flavorB={data.allows_half ? 'Calabresa' : null}
                      height={180}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      Bordas disponíveis (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={(data.available_crusts || []).join(', ')}
                      onChange={(e) =>
                        set('available_crusts', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      Adicionais disponíveis (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={(data.available_extras || []).join(', ')}
                      onChange={(e) =>
                        set('available_extras', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                      }
                      className="input-field"
                    />
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
