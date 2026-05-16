import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, Archive, CheckCircle2, XCircle } from 'lucide-react'

interface Backup {
  id: string; serverId: string; name: string
  bytes: number | null; completed: boolean; successful: boolean
  checksum: string | null; createdAt: string
}

function fmtBytes(b: number | null) {
  if (!b) return '—'
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GiB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MiB'
  return Math.round(b / 1024) + ' KiB'
}

export default function BackupsTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'backups']
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${serverId}/backups`),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post<Backup>(`/client/servers/${serverId}/backups`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      setShowCreate(false)
      setName('')
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (backupId: string) => api.delete(`/client/servers/${serverId}/backups/${backupId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  function fmtDate(s: string) {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{backups.length} backup{backups.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/[0.14] text-blue-300 border border-blue-500/25 hover:bg-blue-500/[0.22] transition-all"
        >
          <Plus size={13} /> Create Backup
        </button>
      </div>

      {showCreate && (
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Create Backup</p>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="Backup name"
            className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setName(''); setError('') }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : backups.length === 0 ? (
        <div className="panel rounded-xl px-8 py-10 text-center">
          <Archive size={28} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No backups yet</p>
          <p className="text-slate-600 text-xs mt-1">Create a backup to protect your server data</p>
        </div>
      ) : (
        <div className="panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Size</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-slate-200 font-medium">{b.name}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{fmtBytes(b.bytes)}</td>
                  <td className="px-5 py-3">
                    {b.completed && b.successful ? (
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 size={12} /> Complete
                      </span>
                    ) : b.completed && !b.successful ? (
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                        <XCircle size={12} /> Failed
                      </span>
                    ) : (
                      <span className="text-blue-400 text-xs">In progress…</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(b.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(b.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
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
