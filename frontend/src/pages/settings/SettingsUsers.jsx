import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, KeyRound, Pencil, X, Check } from 'lucide-react'

import AnimatedPage from '@/components/layout/AnimatedPage'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Settings → Usuários.
 *
 * Admin-only page. Lists every account in `users` with role + status,
 * lets the operator add a new admin/attendant, edit name/role/status,
 * reset another user's password, or disable an account.
 *
 * Self-edit guards (server enforces the same):
 *   - You can't disable yourself.
 *   - You can't demote yourself out of admin.
 */

const ROLE_LABELS = {
  admin: 'Administrador',
  attendant: 'Atendente',
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className="inline-flex items-center px-2 h-6 rounded-full text-[11px] font-semibold"
      style={{
        background: isAdmin ? 'rgba(168,85,247,0.15)' : 'rgba(148,163,184,0.15)',
        color: isAdmin ? '#d8b4fe' : '#cbd5e1',
      }}
    >
      {ROLE_LABELS[role] || role}
    </span>
  )
}

export default function SettingsUsers() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ username: '', password: '', role: 'attendant' })
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ username: '', role: 'attendant' })
  const [resetFor, setResetFor] = useState(null)
  const [resetPwd, setResetPwd] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/admin/users').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/api/admin/users', body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Usuário criado')
      setCreating(false)
      setDraft({ username: '', password: '', role: 'attendant' })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao criar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/api/admin/users/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Usuário atualizado')
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao atualizar'),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }) =>
      api.post(`/api/admin/users/${id}/password`, { password }),
    onSuccess: () => {
      toast.success('Senha redefinida')
      setResetFor(null)
      setResetPwd('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao redefinir'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success('Usuário desativado')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao desativar'),
  })

  function startEdit(u) {
    setEditingId(u.id)
    setEditDraft({ username: u.username, role: u.role })
  }

  return (
    <AnimatedPage className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Usuários</h1>
          <p className="text-sm text-white/60 mt-1">
            Quem pode entrar no painel administrativo.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="btn-primary inline-flex items-center gap-2 px-4 h-10 rounded-xl"
          >
            <Plus size={16} /> Novo usuário
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="glass-card p-5 space-y-3">
          <h2 className="font-display text-lg">Novo usuário</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-white/60">Nome de usuário</span>
              <input
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                placeholder="ex: maria"
                className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Senha (mín. 6)</span>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="••••••"
                className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Papel</span>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary"
              >
                <option value="attendant">Atendente</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => createMutation.mutate(draft)}
              disabled={!draft.username || draft.password.length < 6 || createMutation.isPending}
              className="btn-primary px-4 h-10 rounded-xl disabled:opacity-50"
            >
              Criar
            </button>
            <button
              onClick={() => { setCreating(false); setDraft({ username: '', password: '', role: 'attendant' }) }}
              className="px-4 h-10 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="glass-card overflow-hidden">
        {isLoading && <div className="p-6 text-white/60 text-sm">Carregando…</div>}
        {!isLoading && users.length === 0 && (
          <div className="p-6 text-white/60 text-sm">Nenhum usuário cadastrado.</div>
        )}
        {users.map((u) => {
          const isMe = me?.id === u.id
          const isEditing = editingId === u.id
          return (
            <div
              key={u.id}
              className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 border-b border-white/5 last:border-b-0"
              style={{ opacity: u.is_active ? 1 : 0.5 }}
            >
              {isEditing ? (
                <>
                  <input
                    value={editDraft.username}
                    onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                  <select
                    value={editDraft.role}
                    onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                    disabled={isMe}
                    className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="attendant">Atendente</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={() => updateMutation.mutate({ id: u.id, body: editDraft })}
                    className="p-2 rounded-lg text-success hover:bg-white/5"
                    aria-label="Salvar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
                    aria-label="Cancelar"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{u.username}</p>
                      {isMe && <span className="text-[11px] text-white/40">(você)</span>}
                      {!u.is_active && <span className="text-[11px] text-danger">desativado</span>}
                    </div>
                  </div>
                  <RoleBadge role={u.role} />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setResetFor(u)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                      aria-label="Redefinir senha"
                      title="Redefinir senha"
                    >
                      <KeyRound size={14} />
                    </button>
                    {u.is_active && !isMe && (
                      <button
                        onClick={() => {
                          if (confirm(`Desativar o usuário "${u.username}"?`)) {
                            deleteMutation.mutate(u.id)
                          }
                        }}
                        className="p-2 rounded-lg text-white/60 hover:text-danger hover:bg-white/5"
                        aria-label="Desativar"
                        title="Desativar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {!u.is_active && (
                      <button
                        onClick={() => updateMutation.mutate({ id: u.id, body: { is_active: true } })}
                        className="p-2 rounded-lg text-success hover:bg-white/5 text-[11px] font-semibold px-3"
                        title="Reativar"
                      >
                        Reativar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Password reset modal */}
      {resetFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)' }}
          onClick={() => { setResetFor(null); setResetPwd('') }}
        >
          <div
            className="glass-card p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg">Redefinir senha</h3>
            <p className="text-sm text-white/60 mt-1">
              Definir nova senha para <strong className="text-white">{resetFor.username}</strong>.
              O usuário poderá usá-la na próxima vez que entrar.
            </p>
            <input
              type="password"
              autoFocus
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="mt-4 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => passwordMutation.mutate({ id: resetFor.id, password: resetPwd })}
                disabled={resetPwd.length < 6 || passwordMutation.isPending}
                className="btn-primary px-4 h-10 rounded-xl flex-1 disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                onClick={() => { setResetFor(null); setResetPwd('') }}
                className="px-4 h-10 rounded-xl text-white/70 hover:text-white hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  )
}
