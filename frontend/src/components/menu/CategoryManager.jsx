import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { menuApi } from '@/services/menu'

function SortableCategoryRow({ category, onSave }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  useEffect(() => {
    setName(category.name)
  }, [category.name])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-card p-3 flex items-center gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-white/40 hover:text-white cursor-grab active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical size={16} />
      </button>

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (onSave({ name }), setEditing(false))}
          className="input-field flex-1 py-1"
        />
      ) : (
        <span className="flex-1 font-medium">{category.name}</span>
      )}

      <span className="text-xs text-white/40">{category.product_count} itens</span>

      {editing ? (
        <>
          <button
            onClick={() => { onSave({ name }); setEditing(false) }}
            className="text-success p-1.5 hover:bg-success/10 rounded"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setName(category.name); setEditing(false) }}
            className="text-white/50 p-1.5 hover:bg-white/10 rounded"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-white/50 p-1.5 hover:bg-white/10 rounded"
        >
          <Edit2 size={14} />
        </button>
      )}
    </div>
  )
}

export default function CategoryManager() {
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: menuApi.listCategories,
  })

  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    setItems(categories)
  }, [categories])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const update = useMutation({
    mutationFn: ({ id, data }) => menuApi.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: () => toast.error('Erro ao salvar'),
  })

  const create = useMutation({
    mutationFn: (data) => menuApi.createCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setAdding(false)
      toast.success('Categoria criada')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro'),
  })

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((c) => c.id === active.id)
    const newIndex = items.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    // Persist new display_order for affected items
    reordered.forEach((c, i) => {
      if (c.display_order !== i + 1) {
        update.mutate({ id: c.id, data: { display_order: i + 1 } })
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display">Categorias</h3>
        <button
          onClick={() => setAdding(true)}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <Plus size={12} /> Nova
        </button>
      </div>

      {adding && (
        <div className="glass-card p-3 flex items-center gap-2 bg-primary/5">
          <input
            autoFocus
            placeholder="Nome da categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newName && create.mutate({ name: newName, display_order: items.length + 1 })}
            className="input-field py-1 flex-1"
          />
          <button
            onClick={() => newName && create.mutate({ name: newName, display_order: items.length + 1 })}
            className="text-success p-1.5 hover:bg-success/10 rounded"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setAdding(false); setNewName('') }}
            className="text-white/50 p-1.5 hover:bg-white/10 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {items.map((category) => (
            <SortableCategoryRow
              key={category.id}
              category={category}
              onSave={(data) => update.mutate({ id: category.id, data })}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
