import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Search } from 'lucide-react'

interface ServerItem {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null
  userName: string | null; userEmail: string | null
}

function fmtGiB(mib: number) {
  return (mib / 1024).toFixed(2) + ' GiB'
}

function StatusCell({ installed, suspended }: { installed: boolean; suspended: boolean }) {
  if (suspended) return <span className="text-yellow-400 text-sm">Suspended</span>
  if (!installed) return <span className="text-blue-400 text-sm">Installing</span>
  return <span className="text-online text-sm">Online</span>
}

function ServerRow({ server }: { server: ServerItem }) {
  const address = server.allocationIpAlias ?? server.allocationIp ?? '—'
  const port = server.allocationPort ?? '—'

  return (
    <Link
      to={`/servers/${server.id}`}
      className="grid grid-cols-[120px_1fr_220px_120px_140px_140px_100px] items-center px-6 py-3.5 hover:bg-white/5 transition-colors border-b border-white/[0.04] group"
    >
      <span className="text-muted text-sm font-mono">{server.id.slice(0, 8)}</span>
      <span className="text-white text-sm font-medium group-hover:text-primary transition-colors truncate pr-4">{server.name}</span>
      <span className="text-primary text-sm font-mono">{address}:{port}</span>
      <span className="text-muted text-sm">
        {server.cpu === 0 ? '—' : `${server.cpu} %`}
        <span className="text-[11px] text-muted/50 ml-1">/ Unlimited</span>
      </span>
      <span className="text-muted text-sm">
        {fmtGiB(server.memory)}
        <span className="text-[11px] text-muted/50 ml-1">/ {server.memory === 0 ? 'Unlimited' : fmtGiB(server.memory)}</span>
      </span>
      <span className="text-muted text-sm">
        {fmtGiB(server.disk)}
        <span className="text-[11px] text-muted/50 ml-1">/ Unlimited</span>
      </span>
      <StatusCell installed={server.installed} suspended={server.suspended} />
    </Link>
  )
}

export default function ServersPage() {
  const { isAdmin } = useAuth()
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')

  const { data: myServers = [], isLoading: loadingMine } = useQuery<ServerItem[]>({
    queryKey: ['client', 'servers'],
    queryFn: () => api.get('/client/servers'),
  })

  const { data: allServers = [], isLoading: loadingAll } = useQuery<ServerItem[]>({
    queryKey: ['admin', 'servers'],
    queryFn: () => api.get('/admin/servers'),
    enabled: isAdmin && showAll,
  })

  const raw = showAll && isAdmin ? allServers : myServers
  const isLoading = showAll && isAdmin ? loadingAll : loadingMine
  const servers = search.trim()
    ? raw.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase()),
      )
    : raw

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Something..."
            className="w-full bg-white/[0.06] border border-white/10 rounded-md pl-9 pr-4 py-1.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {isAdmin && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted uppercase tracking-widest">
            <span>Showing Your Servers</span>
            <button
              onClick={() => setShowAll(o => !o)}
              className={`relative w-10 h-5 rounded-full transition-colors ${showAll ? 'bg-primary' : 'bg-white/20'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showAll ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 mx-6 my-4 ptero-panel rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_1fr_220px_120px_140px_140px_100px] px-6 py-3 border-b border-white/[0.06]">
          {['ID', 'Name', 'Allocation', 'CPU', 'Ram', 'Disk', 'Status'].map(h => (
            <span key={h} className="text-gray-400 text-xs font-medium uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">Loading...</div>
        ) : servers.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            {search ? 'No servers match your search.' : 'No servers found.'}
          </div>
        ) : (
          servers.map(s => <ServerRow key={s.id} server={s} />)
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-muted text-xs py-4">
        Pterodactyl&reg; &copy; 2015 - 2026
      </p>
    </div>
  )
}
