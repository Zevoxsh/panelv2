import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, Play, ChevronDown, ChevronRight, Clock } from 'lucide-react'

interface ScheduleTask {
  id: string; scheduleId: string; sequence: number
  action: 'command' | 'power' | 'backup'
  payload: string; timeOffset: number; createdAt: string
}

interface Schedule {
  id: string; serverId: string; name: string
  cronMinute: string; cronHour: string
  cronDayOfMonth: string; cronMonth: string; cronDayOfWeek: string
  isActive: boolean; lastRunAt: string | null; createdAt: string
  tasks: ScheduleTask[]
}

const inputCls = 'bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors'

function TaskRow({ task, onDelete }: { task: ScheduleTask; onDelete: () => void }) {
  const actionColors: Record<string, string> = {
    command: 'bg-blue-500/[0.12] text-blue-400 border-blue-500/25',
    power:   'bg-yellow-500/[0.12] text-yellow-400 border-yellow-500/25',
    backup:  'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/25',
  }
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0 text-sm">
      <span className="text-slate-600 w-5 text-right text-xs">{task.sequence}</span>
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${actionColors[task.action]}`}>{task.action}</span>
      <span className="text-slate-300 font-mono text-xs flex-1">{task.payload || '—'}</span>
      {task.timeOffset > 0 && <span className="text-slate-600 text-xs">+{task.timeOffset}s</span>}
      <button onClick={onDelete} className="text-slate-700 hover:text-red-400 transition-colors ml-auto">
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function ScheduleCard({ schedule, serverId }: { schedule: Schedule; serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'schedules']
  const [open, setOpen] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [task, setTask] = useState<{ action: 'command' | 'power' | 'backup'; payload: string; timeOffset: number; sequence: number }>({
    action: 'command', payload: '', timeOffset: 0, sequence: schedule.tasks.length + 1,
  })

  const deleteSched = useMutation({
    mutationFn: () => api.delete(`/client/servers/${serverId}/schedules/${schedule.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })
  const runNow = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/schedules/${schedule.id}/run`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })
  const addTask = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/schedules/${schedule.id}/tasks`, task),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); setShowAddTask(false) },
  })
  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/client/servers/${serverId}/schedules/${schedule.id}/tasks/${taskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={() => setOpen(v => !v)} className="text-slate-600 hover:text-slate-300 transition-colors shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">{schedule.name}</p>
          <p className="font-mono text-xs text-slate-500 mt-0.5">
            {schedule.cronMinute} {schedule.cronHour} {schedule.cronDayOfMonth} {schedule.cronMonth} {schedule.cronDayOfWeek}
          </p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold shrink-0 ${
          schedule.isActive ? 'bg-green-500/[0.12] text-green-400 border-green-500/25' : 'bg-white/[0.06] text-slate-500 border-white/[0.08]'
        }`}>{schedule.isActive ? 'Active' : 'Inactive'}</span>
        <span className="text-slate-600 text-xs shrink-0">{schedule.tasks.length} task{schedule.tasks.length !== 1 ? 's' : ''}</span>
        <button onClick={() => runNow.mutate()} disabled={runNow.isPending} title="Run now" className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors shrink-0">
          <Play size={13} />
        </button>
        <button onClick={() => deleteSched.mutate()} disabled={deleteSched.isPending} title="Delete" className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">Tasks</p>
            <button onClick={() => setShowAddTask(v => !v)} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Plus size={11} /> Add task
            </button>
          </div>
          {schedule.tasks.length === 0 && !showAddTask && (
            <p className="text-slate-600 text-xs py-1">No tasks yet.</p>
          )}
          {schedule.tasks.map(t => (
            <TaskRow key={t.id} task={t} onDelete={() => deleteTask.mutate(t.id)} />
          ))}
          {showAddTask && (
            <div className="pt-2 space-y-2 border-t border-white/[0.04]">
              <div className="flex gap-2">
                <select value={task.action} onChange={e => setTask(p => ({ ...p, action: e.target.value as any }))} className={`${inputCls} w-36`}>
                  <option value="command">command</option>
                  <option value="power">power</option>
                  <option value="backup">backup</option>
                </select>
                <input value={task.payload} onChange={e => setTask(p => ({ ...p, payload: e.target.value }))}
                  placeholder={task.action === 'power' ? 'start / stop / restart' : 'Payload…'}
                  className={`${inputCls} flex-1`} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => addTask.mutate()} disabled={addTask.isPending}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-40">
                  {addTask.isPending ? 'Adding…' : 'Add'}
                </button>
                <button onClick={() => setShowAddTask(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SchedulesTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'schedules']
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', cronMinute: '*/5', cronHour: '*', cronDayOfMonth: '*', cronMonth: '*', cronDayOfWeek: '*' })
  const [error, setError] = useState('')

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${serverId}/schedules`),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/schedules`, { ...form, isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      setShowCreate(false)
      setForm({ name: '', cronMinute: '*/5', cronHour: '*', cronDayOfMonth: '*', cronMonth: '*', cronDayOfWeek: '*' })
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <p className="text-slate-400 text-sm">{schedules.length} schedule{schedules.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/[0.14] text-blue-300 border border-blue-500/25 hover:bg-blue-500/[0.22] transition-all"
        >
          <Plus size={13} /> New Schedule
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 pb-4 shrink-0">
          <div className="panel rounded-xl p-5 space-y-4">
            <p className="text-white font-semibold text-sm">Create Schedule</p>
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
              placeholder="Schedule name" className={`w-full ${inputCls}`} />
            <div>
              <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-2">Cron Expression</p>
              <div className="grid grid-cols-5 gap-2">
                {(['cronMinute', 'cronHour', 'cronDayOfMonth', 'cronMonth', 'cronDayOfWeek'] as const).map((field, i) => (
                  <div key={field}>
                    <p className="text-[10px] text-slate-700 mb-1">{['Minute', 'Hour', 'Day', 'Month', 'Weekday'][i]}</p>
                    <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all">
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setShowCreate(false); setError('') }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="text-center">
            <Clock size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No schedules yet</p>
            <p className="text-slate-600 text-xs mt-1">Automate server tasks on a cron schedule</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          {schedules.map(s => <ScheduleCard key={s.id} schedule={s} serverId={serverId} />)}
        </div>
      )}
    </div>
  )
}
