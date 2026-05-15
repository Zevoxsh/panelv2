import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, UserX, UserCheck } from 'lucide-react'

interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' as 'admin' | 'user' })
  const [formError, setFormError] = useState('')

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users'),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<User>('/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setShowForm(false)
      setForm({ username: '', email: '', password: '', role: 'user' })
      setFormError('')
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Utilisateurs</h1>
          <p className="text-muted text-sm mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nouvel utilisateur
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-white font-semibold text-sm">Créer un compte</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['username', 'email', 'password'] as const).map((field) => (
              <div key={field}>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wider">
                  {field === 'username' ? "Nom d'utilisateur" : field === 'email' ? 'Email' : 'Mot de passe'}
                </label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  required
                  minLength={field === 'password' ? 8 : undefined}
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {createMutation.isPending ? 'Création...' : 'Créer'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Annuler
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Utilisateur</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Rôle</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Statut</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-muted text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${user.role === 'admin' ? 'bg-purple-950 text-primary-light' : 'bg-border text-muted'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${user.isActive ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                      {user.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                        className="p-1.5 text-muted hover:text-white rounded-md hover:bg-border transition-colors"
                        title={user.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => { if (confirm('Supprimer cet utilisateur ?')) deleteMutation.mutate(user.id) }}
                        className="p-1.5 text-muted hover:text-red-400 rounded-md hover:bg-border transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
