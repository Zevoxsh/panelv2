import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, MapPin } from 'lucide-react'

interface Location {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export default function LocationsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ['admin', 'locations'],
    queryFn: () => api.get('/admin/locations'),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<Location>('/admin/locations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] })
      setShowForm(false)
      setForm({ name: '', description: '' })
      setFormError('')
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/locations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Locations</h1>
          <p className="text-muted text-sm mt-0.5">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nouvelle location
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-white font-semibold text-sm">Créer une location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Nom</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="ex: France-01"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="ex: Datacenter Paris"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
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
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Nom</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-primary shrink-0" />
                      <span className="text-white font-medium">{loc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{loc.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm('Supprimer cette location ?')) deleteMutation.mutate(loc.id) }}
                      className="p-1.5 text-muted hover:text-red-400 rounded-md hover:bg-border transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted text-sm">Aucune location</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
