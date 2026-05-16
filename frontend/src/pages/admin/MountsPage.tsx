import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, HardDrive, Pencil } from 'lucide-react'

interface Mount {
  id: string; name: string; description: string | null
  source: string; target: string
  readOnly: boolean; userMountable: boolean; createdAt: string
}

const inputCls = 'w-full bg-black/20 border border-admin-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors'

const emptyForm = { name: '', description: '', source: '', target: '', readOnly: false, userMountable: false }

export default function MountsPage() {
  const queryClient = useQueryClient()
  const qKey = ['admin', 'mounts']
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Mount | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const { data: mounts = [], isLoading } = useQuery<Mount[]>({
    queryKey: qKey,
    queryFn: () => api.get('/admin/mounts'),
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true) }
  function openEdit(m: Mount) {
    setEditing(m)
    setForm({ name: m.name, description: m.description ?? '', source: m.source, target: m.target, readOnly: m.readOnly, userMountable: m.userMountable })
    setError('')
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm); setError('') }

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.patch<Mount>(`/admin/mounts/${editing.id}`, form)
      : api.post<Mount>('/admin/mounts', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/mounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mounts</h1>
          <p className="text-gray-400 text-sm mt-0.5">{mounts.length} mount{mounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          <Plus size={14} /> New Mount
        </button>
      </div>

      {showForm && (
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl p-5 mb-6 space-y-4">
          <p className="text-white font-semibold text-sm">{editing ? 'Edit Mount' : 'Create Mount'}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="my-mount" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Source Path (host)</label>
              <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inputCls} placeholder="/mnt/data" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Path (container)</label>
              <input value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className={inputCls} placeholder="/data" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.readOnly}
                onChange={e => setForm(f => ({ ...f, readOnly: e.target.checked }))}
                className="accent-teal"
              />
              <span className="text-gray-300 text-sm">Read Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.userMountable}
                onChange={e => setForm(f => ({ ...f, userMountable: e.target.checked }))}
                className="accent-teal"
              />
              <span className="text-gray-300 text-sm">User Mountable</span>
            </label>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || !form.source.trim() || !form.target.trim() || saveMutation.isPending}
              className="bg-teal hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
            >
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </button>
            <button onClick={closeForm} className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg border border-admin-border/40 hover:bg-admin-surface transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : mounts.length === 0 ? (
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl px-8 py-12 text-center">
          <HardDrive size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No mounts configured</p>
          <p className="text-gray-600 text-xs mt-1">Mounts allow you to bind paths from the host into server containers</p>
        </div>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/40">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Source</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Target</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Flags</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {mounts.map(m => (
                <tr key={m.id} className="border-b border-admin-border/20 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">{m.name}</p>
                    {m.description && <p className="text-gray-500 text-xs mt-0.5">{m.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{m.source}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{m.target}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {m.readOnly && <span className="px-2 py-0.5 rounded text-[11px] bg-yellow-500/[0.12] text-yellow-400 border border-yellow-500/20">RO</span>}
                      {m.userMountable && <span className="px-2 py-0.5 rounded text-[11px] bg-teal/[0.12] text-teal border border-teal/20">User</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 text-gray-500 hover:text-teal transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
