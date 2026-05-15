import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, Copy, Check } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  type: 'admin' | 'user'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface CreatedKey extends ApiKey {
  token: string
}

export default function ApiKeysPage({ adminMode = false }: { adminMode?: boolean }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: (adminMode ? 'admin' : 'user') as 'admin' | 'user' })
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys'),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<CreatedKey>('/api-keys', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewToken(data.token)
      setShowForm(false)
      setForm({ name: '', type: adminMode ? 'admin' : 'user' })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  async function copyToken() {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Clés API</h1>
          <p className="text-muted text-sm mt-0.5">{keys.length} clé{keys.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setNewToken(null) }}
          className="flex items-center gap-2 bg-primary hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nouvelle clé
        </button>
      </div>

      {newToken && (
        <div className="bg-green-950 border border-green-800 rounded-xl p-4 mb-6">
          <p className="text-green-400 text-sm font-medium mb-2">Clé créée — copiez-la maintenant, elle ne sera plus visible.</p>
          <div className="flex items-center gap-2 bg-base rounded-lg px-3 py-2">
            <code className="text-green-300 text-xs flex-1 truncate">{newToken}</code>
            <button onClick={copyToken} className="text-muted hover:text-white transition-colors shrink-0">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-white font-semibold text-sm">Créer une clé API</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Nom</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Ex: Déploiement CI"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {adminMode && (
              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'admin' | 'user' }))}
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
          </div>
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
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Nom</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Type</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Dernière utilisation</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                  <td className="px-4 py-3 text-white">{key.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${key.type === 'admin' ? 'bg-purple-950 text-primary-light' : 'bg-border text-muted'}`}>
                      {key.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('fr') : 'Jamais'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm('Révoquer cette clé ?')) revokeMutation.mutate(key.id) }}
                      className="p-1.5 text-muted hover:text-red-400 rounded-md hover:bg-border transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">Aucune clé API</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
