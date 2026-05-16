import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Server, Users, Cpu, Egg, MapPin, CheckCircle, PauseCircle, Clock } from 'lucide-react'

interface DashboardStats {
  servers: { total: number; installed: number; suspended: number }
  users: number; nodes: number; eggs: number; locations: number
}

function StatCard({ icon: Icon, label, value, sub, to }: {
  icon: React.ElementType; label: string; value: number; sub?: string; to: string
}) {
  return (
    <Link
      to={to}
      className="bg-admin-surface border border-admin-border/50 rounded-lg p-5 hover:border-teal/50 transition-colors block"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-sm">{label}</p>
        <div className="w-8 h-8 bg-teal/10 border border-teal/20 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-teal" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </Link>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get('/admin/dashboard'),
    refetchInterval: 30_000,
  })

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white">
          Administrative Overview
          <span className="text-base font-normal text-gray-400 ml-3">A quick glance at your system.</span>
        </h1>
      </div>

      <div className="border-t-2 border-red-500 mb-6" />

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : stats ? (
        <div className="space-y-6">
          {/* Quick links */}
          <div className="bg-admin-surface border border-admin-border/50 rounded-lg p-5">
            <h2 className="text-white font-semibold text-sm mb-3">System Information</h2>
            <p className="text-gray-400 text-sm mb-4">Panel is running normally.</p>
            <div className="flex flex-wrap gap-3">
              <a href="https://discord.gg/pterodactyl" target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-medium rounded-md transition-colors">
                Get Help (via Discord)
              </a>
              <a href="https://pterodactyl.io/documentation.html" target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-primary hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors">
                Documentation
              </a>
              <a href="https://github.com/pterodactyl" target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-primary hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors">
                GitHub
              </a>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Server} label="Servers" value={stats.servers.total}
              sub={`${stats.servers.installed} installed`} to="/admin/servers" />
            <StatCard icon={Users} label="Users" value={stats.users} to="/admin/users" />
            <StatCard icon={Cpu} label="Nodes" value={stats.nodes} to="/admin/nodes" />
            <StatCard icon={Egg} label="Eggs" value={stats.eggs} to="/admin/eggs" />
          </div>

          {/* Detail panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-admin-surface border border-admin-border/50 rounded-lg p-5">
              <p className="text-white font-semibold text-sm mb-4">Server Status</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-green-400"><CheckCircle size={13} /> Installed</span>
                  <span className="text-white font-semibold">{stats.servers.installed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-blue-400"><Clock size={13} /> Installing</span>
                  <span className="text-white font-semibold">{stats.servers.total - stats.servers.installed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-yellow-400"><PauseCircle size={13} /> Suspended</span>
                  <span className="text-white font-semibold">{stats.servers.suspended}</span>
                </div>
              </div>
            </div>

            <div className="bg-admin-surface border border-admin-border/50 rounded-lg p-5">
              <p className="text-white font-semibold text-sm mb-4">Infrastructure</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2"><MapPin size={13} /> Locations</span>
                  <span className="text-white font-semibold">{stats.locations}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2"><Cpu size={13} /> Nodes</span>
                  <span className="text-white font-semibold">{stats.nodes}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2"><Egg size={13} /> Eggs</span>
                  <span className="text-white font-semibold">{stats.eggs}</span>
                </div>
              </div>
            </div>

            <div className="bg-admin-surface border border-admin-border/50 rounded-lg p-5">
              <p className="text-white font-semibold text-sm mb-4">Quick Actions</p>
              <div className="space-y-2">
                <Link to="/admin/servers/new" className="flex items-center gap-2 text-sm text-teal hover:underline"><Server size={13} /> Create a server</Link>
                <Link to="/admin/nodes/new" className="flex items-center gap-2 text-sm text-teal hover:underline"><Cpu size={13} /> Add a node</Link>
                <Link to="/admin/users" className="flex items-center gap-2 text-sm text-teal hover:underline"><Users size={13} /> Manage users</Link>
                <Link to="/admin/eggs" className="flex items-center gap-2 text-sm text-teal hover:underline"><Egg size={13} /> Configure eggs</Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
