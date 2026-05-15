import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Server, CheckCircle, Clock, PauseCircle } from 'lucide-react'

interface ServerItem {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null
  userName: string | null; userEmail: string | null
}

function StatusBadge({ installed, suspended }: { installed: boolean; suspended: boolean }) {
  if (suspended) return (
    <span className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium">
      <PauseCircle size={12} /> Suspendu
    </span>
  )
  if (installed) return (
    <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
      <CheckCircle size={12} /> En ligne
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
      <Clock size={12} /> Installation...
    </span>
  )
}

function ServerCard({ server }: { server: ServerItem }) {
  return (
    <Link to={`/servers/${server.id}`} className="block bg-surface border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
            <Server size={16} className="text-primary-light" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{server.name}</p>
            <p className="text-muted text-xs">{server.eggName ?? '—'}</p>
          </div>
        </div>
        <StatusBadge installed={server.installed} suspended={server.suspended} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <p className="text-muted text-xs mb-0.5">Node</p>
          <p className="text-white text-xs font-medium">{server.nodeName ?? '—'}</p>
        </div>
        <div>
          <p className="text-muted text-xs mb-0.5">Adresse</p>
          <p className="text-white text-xs font-mono">{server.allocationIpAlias ?? server.allocationIp ?? '—'}:{server.allocationPort ?? '—'}</p>
        </div>
        <div>
          <p className="text-muted text-xs mb-0.5">Mémoire</p>
          <p className="text-white text-xs">{server.memory.toLocaleString()} MiB</p>
        </div>
      </div>
    </Link>
  )
}

export default function ServersPage() {
  const { user, isAdmin } = useAuth()
  const [showAll, setShowAll] = useState(false)

  const { data: myServers = [], isLoading: loadingMine } = useQuery<ServerItem[]>({
    queryKey: ['client', 'servers'],
    queryFn: () => api.get('/client/servers'),
  })

  const { data: allServers = [], isLoading: loadingAll } = useQuery<ServerItem[]>({
    queryKey: ['admin', 'servers'],
    queryFn: () => api.get('/admin/servers'),
    enabled: isAdmin && showAll,
  })

  const servers = showAll && isAdmin ? allServers : myServers
  const isLoading = showAll && isAdmin ? loadingAll : loadingMine
  const count = servers.length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isAdmin && showAll ? 'Tous les serveurs' : 'Mes serveurs'}
          </h1>
          <p className="text-muted text-sm mt-0.5">{count} serveur{count !== 1 ? 's' : ''}</p>
        </div>

        {isAdmin && (
          <div className="flex items-center bg-surface border border-border rounded-lg p-1">
            <button onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!showAll ? 'bg-primary text-white font-medium' : 'text-muted hover:text-white'}`}>
              Mes serveurs
            </button>
            <button onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${showAll ? 'bg-primary text-white font-medium' : 'text-muted hover:text-white'}`}>
              Tous les serveurs
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mb-4">
            <Server size={20} className="text-muted" />
          </div>
          <p className="text-white font-medium text-sm">Aucun serveur</p>
          <p className="text-muted text-xs mt-1">Les serveurs apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map(s => <ServerCard key={s.id} server={s} />)}
        </div>
      )}
    </div>
  )
}
