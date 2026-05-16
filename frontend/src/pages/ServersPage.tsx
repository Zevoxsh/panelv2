import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Search, ChevronRight, Server } from 'lucide-react'

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
  return mib === 0 ? '∞' : (mib / 1024).toFixed(1) + ' GiB'
}

function StatusBadge({ installed, suspended }: { installed: boolean; suspended: boolean }) {
  if (suspended) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/[0.12] text-yellow-400 border border-yellow-500/25">
      Suspended
    </span>
  )
  if (!installed) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/[0.12] text-blue-400 border border-blue-500/25">
      Installing
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/[0.12] text-green-400 border border-green-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
      Online
    </span>
  )
}

function ServerCard({ server }: { server: ServerItem }) {
  const address = server.allocationIpAlias ?? server.allocationIp ?? '—'
  const port    = server.allocationPort ?? '—'

  return (
    <Link to={`/servers/${server.id}`} className="block group">
      <div className="panel rounded-xl px-5 py-4 hover:border-white/[0.14] transition-all">
        <div className="flex items-center gap-4">

          {/* Status dot */}
          <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Server size={16} className={
              server.suspended ? 'text-yellow-400' :
              !server.installed ? 'text-blue-400' :
              'text-green-400'
            } />
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <p className="text-slate-100 font-semibold text-sm group-hover:text-blue-300 transition-colors truncate">
              {server.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 flex-wrap">
              <span className="font-mono text-slate-400">{address}:{port}</span>
              {server.nodeName && <><span className="text-slate-700">·</span><span>{server.nodeName}</span></>}
              {server.eggName  && <><span className="text-slate-700">·</span><span>{server.eggName}</span></>}
            </div>
          </div>

          {/* Resource limits */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: 'CPU',  value: server.cpu    === 0 ? '∞' : `${server.cpu}%` },
              { label: 'RAM',  value: fmtGiB(server.memory) },
              { label: 'Disk', value: fmtGiB(server.disk) },
            ].map(({ label, value }) => (
              <div key={label} className="text-center min-w-[40px]">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-mono text-slate-300">{value}</p>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div className="hidden sm:block shrink-0">
            <StatusBadge installed={server.installed} suspended={server.suspended} />
          </div>

          {/* Arrow */}
          <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
        </div>
      </div>
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

      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Your Servers</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isLoading ? 'Loading…' : `${servers.length} server${servers.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search servers…"
                className="bg-white/[0.05] border border-white/[0.07] rounded-lg pl-8 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors w-52"
              />
            </div>

            {/* Admin toggle */}
            {isAdmin && (
              <button
                onClick={() => setShowAll(o => !o)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  showAll
                    ? 'bg-blue-500/[0.14] text-blue-300 border-blue-500/25'
                    : 'text-slate-500 border-white/[0.07] hover:text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                {showAll ? 'All servers' : 'My servers'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Server list ── */}
      <div className="flex-1 px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-600">
              <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm">Loading servers…</p>
            </div>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center panel">
              <Server size={20} className="text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm">
              {search ? 'No servers match your search.' : 'No servers found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map(s => <ServerCard key={s.id} server={s} />)}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-slate-700 text-xs py-4">
        Pterodactyl® © 2015 – {new Date().getFullYear()}
      </p>
    </div>
  )
}
