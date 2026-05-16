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
          <h1 className="text-2xl font-bold text-white">Locations</h1>
          <p className="text-gray-400 text-sm mt-0.5">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          <Plus size={14} />
          New Location
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="bg-admin-surface border border-admin-border/50 rounded-lg p-5 mb-6 space-y-4"
        >
          <h2 className="text-white font-semibold text-sm">Create Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. France-01"
                className="w-full bg-black/20 border border-admin-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Paris Datacenter"
                className="w-full bg-black/20 border border-admin-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors"
              />
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={createMutation.isPending} className="bg-teal hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity">
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
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Name</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-b border-admin-border/30 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-teal shrink-0" />
                      <span className="text-white font-medium">{loc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{loc.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm('Delete this location?')) deleteMutation.mutate(loc.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">No locations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
