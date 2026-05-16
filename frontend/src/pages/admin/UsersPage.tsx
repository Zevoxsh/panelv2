import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, UserX, UserCheck } from 'lucide-react'

interface User {
  id: string; username: string; email: string
  role: 'admin' | 'user'; isActive: boolean; createdAt: string
}

const inputCls = 'w-full bg-black/20 border border-admin-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors'

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
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          <Plus size={14} /> New User
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }}
          className="bg-admin-surface border border-admin-border/50 rounded-lg p-5 mb-6 space-y-4"
        >
          <h2 className="text-white font-semibold text-sm">Create Account</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['username', 'email', 'password'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
                  {field === 'username' ? 'Username' : field === 'email' ? 'Email' : 'Password'}
                </label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  required
                  minLength={field === 'password' ? 8 : undefined}
                  className={inputCls}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                className={inputCls}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={createMutation.isPending}
              className="bg-teal hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity">
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/50">
                {['User', 'Role', 'Status', ''].map(h => (
                  <th key={h} className={`text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium ${h === '' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-admin-border/30 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${user.role === 'admin' ? 'bg-teal/20 text-teal' : 'bg-white/10 text-gray-400'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${user.isActive ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                        className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                        title={user.isActive ? 'Disable' : 'Enable'}
                      >
                        {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this user?')) deleteMutation.mutate(user.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
