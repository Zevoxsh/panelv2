import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Activity } from 'lucide-react'

interface ActivityLog {
  id: string; event: string; metadata: Record<string, unknown> | null
  ip: string | null; createdAt: string; username: string | null
}

const EVENT_COLORS: Record<string, string> = {
  'server.start':     'text-green-400',
  'server.stop':      'text-yellow-400',
  'server.restart':   'text-blue-400',
  'server.kill':      'text-red-400',
  'server.install':   'text-violet-400',
  'file.upload':      'text-cyan-400',
  'file.delete':      'text-red-400',
  'backup.create':    'text-emerald-400',
  'backup.delete':    'text-orange-400',
  'database.create':  'text-blue-400',
  'database.delete':  'text-red-400',
  'user.add':         'text-teal-400',
  'user.remove':      'text-orange-400',
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
    <div className="p-6 space-y-4 max-w-3xl">
      <p className="text-slate-400 text-sm">{logs.length} event{logs.length !== 1 ? 's' : ''}</p>

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="panel rounded-xl px-8 py-10 text-center">
          <Activity size={28} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No activity yet</p>
          <p className="text-slate-600 text-xs mt-1">Actions on this server will appear here</p>
        </div>
      ) : (
        <div className="panel rounded-xl overflow-hidden">
          {logs.map((log, i) => (
            <div
              key={log.id}
              className={`flex items-start gap-4 px-5 py-3.5 ${i < logs.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${EVENT_COLORS[log.event] ?? 'text-slate-300'}`}>
                  {log.event}
                </p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <p className="text-slate-600 text-xs mt-0.5 font-mono truncate">
                    {JSON.stringify(log.metadata)}
                  </p>
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
      )}
    </div>
  )
}
