import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Server, Users, Cpu, Egg, MapPin, CheckCircle, PauseCircle, Clock } from 'lucide-react'

interface DashboardStats {
  servers: { total: number; installed: number; suspended: number }
  users: number
  nodes: number
  eggs: number
  locations: number
}

function StatCard({ icon: Icon, label, value, sub, to }: {
  icon: React.ElementType; label: string; value: number; sub?: string; to: string
}) {
  return (
    <Link to={to} className="bg-surface border border-border rounded-xl p-5 hover:border-primary/50 transition-colors block">
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted text-sm">{label}</p>
        <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-primary-light" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard Admin</h1>
        <p className="text-muted text-sm mt-0.5">Vue d'ensemble du panel</p>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Server}
              label="Serveurs"
              value={stats.servers.total}
              sub={`${stats.servers.installed} installé${stats.servers.installed !== 1 ? 's' : ''}`}
              to="/admin/servers"
            />
            <StatCard icon={Users} label="Utilisateurs" value={stats.users} to="/admin/users" />
            <StatCard icon={Cpu} label="Nodes" value={stats.nodes} to="/admin/nodes" />
            <StatCard icon={Egg} label="Eggs" value={stats.eggs} to="/admin/eggs" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Statut des serveurs</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle size={13} /> Installés
                  </span>
                  <span className="text-white font-semibold">{stats.servers.installed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-blue-400">
                    <Clock size={13} /> En installation
                  </span>
                  <span className="text-white font-semibold">
                    {stats.servers.total - stats.servers.installed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-yellow-400">
                    <PauseCircle size={13} /> Suspendus
                  </span>
                  <span className="text-white font-semibold">{stats.servers.suspended}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Infrastructure</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><MapPin size={13} /> Locations</span>
                  <span className="text-white font-semibold">{stats.locations}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><Cpu size={13} /> Nodes</span>
                  <span className="text-white font-semibold">{stats.nodes}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><Egg size={13} /> Eggs</span>
                  <span className="text-white font-semibold">{stats.eggs}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Accès rapides</p>
              <div className="space-y-2">
                <Link to="/admin/servers/new"
                  className="flex items-center gap-2 text-sm text-primary-light hover:underline">
                  <Server size={13} /> Créer un serveur
                </Link>
                <Link to="/admin/nodes/new"
                  className="flex items-center gap-2 text-sm text-primary-light hover:underline">
                  <Cpu size={13} /> Ajouter un node
                </Link>
                <Link to="/admin/users"
                  className="flex items-center gap-2 text-sm text-primary-light hover:underline">
                  <Users size={13} /> Gérer les utilisateurs
                </Link>
                <Link to="/admin/eggs"
                  className="flex items-center gap-2 text-sm text-primary-light hover:underline">
                  <Egg size={13} /> Configurer les eggs
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
