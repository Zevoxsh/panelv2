import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Database } from 'lucide-react'

interface AdminDatabase {
  id: string; serverId: string; name: string
  username: string; remote: string; host: string; port: number; createdAt: string
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DatabasesAdminPage() {
  const { data: databases = [], isLoading } = useQuery<AdminDatabase[]>({
    queryKey: ['admin', 'databases'],
    queryFn: () => api.get('/admin/databases'),
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Databases</h1>
        <p className="text-gray-400 text-sm mt-0.5">{databases.length} database{databases.length !== 1 ? 's' : ''} across all servers</p>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : databases.length === 0 ? (
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl px-8 py-12 text-center">
          <Database size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No databases yet</p>
          <p className="text-gray-600 text-xs mt-1">Databases created by users will appear here</p>
        </div>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/40">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Username</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Host</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Connections</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {databases.map(db => (
                <tr key={db.id} className="border-b border-admin-border/20 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-white font-medium font-mono">{db.name}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{db.username}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{db.host}:{db.port}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{db.remote}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(db.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
