import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Trash2, CheckCircle, Clock, PauseCircle, Play, Pause } from 'lucide-react'

interface ServerItem {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  userName: string | null; userEmail: string | null
  nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null
}

function StatusBadge({ installed, suspended }: { installed: boolean; suspended: boolean }) {
  if (suspended) return (
    <span className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium">
      <PauseCircle size={12} /> Suspendu
    </span>
  )
  if (installed) return (
    <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
      <CheckCircle size={12} /> Installé
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
      <Clock size={12} /> Installation...
    </span>
  )
}

export default function ServersAdminPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: servers = [], isLoading } = useQuery<ServerItem[]>({
    queryKey: ['admin', 'servers'],
    queryFn: () => api.get('/admin/servers'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/servers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'servers'] }),
  })

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api.patch(`/admin/servers/${id}`, { suspended }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'servers'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Servers</h1>
          <p className="text-gray-400 text-sm mt-0.5">{servers.length} server{servers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/admin/servers/new')}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          <Plus size={14} />
          New Server
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/50">
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Name</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Owner</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Node / IP</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Resources</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-b border-admin-border/30 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/admin/servers/${s.id}`} className="text-white font-medium hover:text-teal transition-colors">
                      {s.name}
                    </Link>
                    <p className="text-gray-400 text-xs">{s.eggName ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{s.userName ?? '—'}</p>
                    <p className="text-gray-400 text-xs">{s.userEmail ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{s.nodeName ?? '—'}</p>
                    <p className="text-gray-400 text-xs font-mono">
                      {s.allocationIpAlias ?? s.allocationIp ?? '—'}:{s.allocationPort ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {s.memory.toLocaleString()} MiB RAM · {s.disk.toLocaleString()} MiB disk
                    {s.cpu > 0 && ` · ${s.cpu}% CPU`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge installed={s.installed} suspended={s.suspended} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => suspendMutation.mutate({ id: s.id, suspended: !s.suspended })}
                        disabled={suspendMutation.isPending}
                        title={s.suspended ? 'Unsuspend' : 'Suspend'}
                        className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${
                          s.suspended ? 'text-green-400' : 'text-yellow-400'
                        }`}
                      >
                        {s.suspended ? <Play size={13} /> : <Pause size={13} />}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete server "${s.name}"?`)) deleteMutation.mutate(s.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No servers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
