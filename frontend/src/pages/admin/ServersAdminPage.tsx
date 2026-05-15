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
          <h1 className="text-xl font-bold text-white">Serveurs</h1>
          <p className="text-muted text-sm mt-0.5">{servers.length} serveur{servers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/admin/servers/new')}
          className="flex items-center gap-2 bg-primary hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nouveau serveur
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Nom</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Propriétaire</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Node / IP</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Ressources</th>
                <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/admin/servers/${s.id}`} className="text-white font-medium hover:text-primary-light transition-colors">
                      {s.name}
                    </Link>
                    <p className="text-muted text-xs">{s.eggName ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{s.userName ?? '—'}</p>
                    <p className="text-muted text-xs">{s.userEmail ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{s.nodeName ?? '—'}</p>
                    <p className="text-muted text-xs font-mono">
                      {s.allocationIpAlias ?? s.allocationIp ?? '—'}:{s.allocationPort ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
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
                        title={s.suspended ? 'Réactiver' : 'Suspendre'}
                        className={`p-1.5 rounded-md hover:bg-border transition-colors ${
                          s.suspended ? 'text-green-400 hover:text-green-300' : 'text-yellow-400 hover:text-yellow-300'
                        }`}
                      >
                        {s.suspended ? <Play size={13} /> : <Pause size={13} />}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Supprimer le serveur "${s.name}" ?`)) deleteMutation.mutate(s.id) }}
                        className="p-1.5 text-muted hover:text-red-400 rounded-md hover:bg-border transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">Aucun serveur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
