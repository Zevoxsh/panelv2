import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, RefreshCw, Eye, EyeOff, Database } from 'lucide-react'

interface ServerDatabase {
  id: string; serverId: string; name: string
  username: string; password: string; remote: string
  host: string; port: number; createdAt: string
}

export default function DatabasesTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'databases']
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  const { data: databases = [], isLoading } = useQuery<ServerDatabase[]>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${serverId}/databases`),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post<ServerDatabase>(`/client/servers/${serverId}/databases`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); setShowCreate(false); setName(''); setError('') },
    onError: (e: Error) => setError(e.message),
  })

  const rotateMutation = useMutation({
    mutationFn: (dbId: string) => api.patch(`/client/servers/${serverId}/databases/${dbId}/rotate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (dbId: string) => api.delete(`/client/servers/${serverId}/databases/${dbId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <p className="text-slate-400 text-sm">{databases.length} database{databases.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/[0.14] text-blue-300 border border-blue-500/25 hover:bg-blue-500/[0.22] transition-all"
        >
          <Plus size={13} /> New Database
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 pb-4 shrink-0">
          <div className="panel rounded-xl p-5 space-y-3">
            <p className="text-white font-semibold text-sm">Create Database</p>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Database name"
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
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      ) : databases.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="text-center">
            <Database size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No databases yet</p>
            <p className="text-slate-600 text-xs mt-1">Create one to connect your application</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {databases.map(db => (
              <div key={db.id} className="panel rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold text-sm font-mono">{db.name}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => rotateMutation.mutate(db.id)} disabled={rotateMutation.isPending} title="Rotate password" className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors">
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(db.id)} disabled={deleteMutation.isPending} title="Delete" className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {([['Endpoint', `${db.host}:${db.port}`], ['Username', db.username], ['Connections From', db.remote]] as [string, string][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-slate-600 uppercase tracking-wider text-[10px] mb-0.5">{label}</p>
                      <p className="text-slate-300 font-mono break-all">{value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-slate-600 uppercase tracking-wider text-[10px] mb-0.5">Password</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-slate-300 font-mono">{visiblePasswords[db.id] ? db.password : '••••••••••••'}</p>
                      <button onClick={() => setVisiblePasswords(p => ({ ...p, [db.id]: !p[db.id] }))} className="text-slate-600 hover:text-slate-400 transition-colors">
                        {visiblePasswords[db.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
