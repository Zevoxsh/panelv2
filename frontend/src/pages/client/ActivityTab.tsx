import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Activity } from 'lucide-react'

interface ActivityLog {
  id: string; event: string; metadata: Record<string, unknown> | null
  ip: string | null; createdAt: string; username: string | null
}

const EVENT_COLORS: Record<string, string> = {
  'server.start':    'text-green-400',
  'server.stop':     'text-yellow-400',
  'server.restart':  'text-blue-400',
  'server.kill':     'text-red-400',
  'server.install':  'text-violet-400',
  'file.upload':     'text-cyan-400',
  'file.delete':     'text-red-400',
  'backup.create':   'text-emerald-400',
  'backup.delete':   'text-orange-400',
  'database.create': 'text-blue-400',
  'database.delete': 'text-red-400',
  'user.add':        'text-teal-400',
  'user.remove':     'text-orange-400',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ActivityTab({ serverId }: { serverId: string }) {
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['client', 'servers', serverId, 'activity'],
    queryFn: () => api.get(`/client/servers/${serverId}/activity`),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <p className="text-slate-400 text-sm">{logs.length} event{logs.length !== 1 ? 's' : ''}</p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="text-center">
            <Activity size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No activity yet</p>
            <p className="text-slate-600 text-xs mt-1">Actions on this server will appear here</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="panel rounded-xl overflow-hidden">
            {logs.map((log, i) => (
              <div key={log.id} className={`flex items-start gap-4 px-5 py-3.5 ${i < logs.length - 1 ? 'border-b border-white/[0.04]' : ''} hover:bg-white/[0.02] transition-colors`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${EVENT_COLORS[log.event] ?? 'text-slate-300'}`}>{log.event}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className="text-slate-600 text-xs mt-0.5 font-mono truncate">{JSON.stringify(log.metadata)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-400 text-xs">{log.username ?? 'System'}</p>
                  {log.ip && <p className="text-slate-700 text-[11px] font-mono mt-0.5">{log.ip}</p>}
                  <p className="text-slate-600 text-[11px] mt-0.5">{fmtDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
