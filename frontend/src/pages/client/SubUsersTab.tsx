import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, UserPlus, Users } from 'lucide-react'

interface SubUser {
  id: string; serverId: string; userId: string
  permissions: string[]; createdAt: string
  username: string | null; email: string | null
}

const ALL_PERMISSIONS = [
  { key: 'control.console',  label: 'Console', group: 'Control' },
  { key: 'control.start',    label: 'Start',   group: 'Control' },
  { key: 'control.stop',     label: 'Stop',    group: 'Control' },
  { key: 'control.restart',  label: 'Restart', group: 'Control' },
  { key: 'file.create',      label: 'Create',  group: 'Files' },
  { key: 'file.read',        label: 'Read',    group: 'Files' },
  { key: 'file.update',      label: 'Update',  group: 'Files' },
  { key: 'file.delete',      label: 'Delete',  group: 'Files' },
  { key: 'backup.create',    label: 'Create',  group: 'Backups' },
  { key: 'backup.delete',    label: 'Delete',  group: 'Backups' },
  { key: 'database.create',  label: 'Create',  group: 'Databases' },
  { key: 'database.delete',  label: 'Delete',  group: 'Databases' },
  { key: 'database.view',    label: 'View',    group: 'Databases' },
  { key: 'schedule.create',  label: 'Create',  group: 'Schedules' },
  { key: 'schedule.delete',  label: 'Delete',  group: 'Schedules' },
  { key: 'schedule.update',  label: 'Update',  group: 'Schedules' },
  { key: 'settings.rename',  label: 'Rename',  group: 'Settings' },
  { key: 'settings.reinstall', label: 'Reinstall', group: 'Settings' },
  { key: 'user.create',      label: 'Create',  group: 'Users' },
  { key: 'user.delete',      label: 'Delete',  group: 'Users' },
  { key: 'user.update',      label: 'Update',  group: 'Users' },
]

const GROUPS = ['Control', 'Files', 'Backups', 'Databases', 'Schedules', 'Settings', 'Users']

function PermissionEditor({
  selected, onChange,
}: { selected: string[]; onChange: (p: string[]) => void }) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
  }

  return (
    <div className="space-y-3">
      {GROUPS.map(group => {
        const perms = ALL_PERMISSIONS.filter(p => p.group === group)
        return (
          <div key={group}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">{group}</p>
            <div className="flex flex-wrap gap-2">
              {perms.map(p => (
                <button
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
                    selected.includes(p.key)
                      ? 'bg-blue-500/[0.14] text-blue-300 border-blue-500/25'
                      : 'text-slate-500 border-white/[0.07] hover:text-slate-300 hover:border-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubUserCard({ user, serverId }: { user: SubUser; serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'users']
  const [editing, setEditing] = useState(false)
  const [perms, setPerms] = useState(user.permissions)

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/client/servers/${serverId}/users/${user.id}`, { permissions: perms }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); setEditing(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/client/servers/${serverId}/users/${user.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  return (
    <div className="panel rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium text-sm">{user.username ?? 'Unknown'}</p>
          <p className="text-slate-500 text-xs mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(v => !v); setPerms(user.permissions) }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {!editing && (
        <div className="flex flex-wrap gap-1.5">
          {user.permissions.length === 0
            ? <p className="text-slate-600 text-xs">No permissions assigned</p>
            : user.permissions.map(p => (
              <span key={p} className="px-2 py-0.5 rounded text-[11px] bg-white/[0.05] text-slate-400 border border-white/[0.06]">{p}</span>
            ))
          }
        </div>
      )}

      {editing && (
        <div className="space-y-3 pt-1 border-t border-white/[0.05]">
          <PermissionEditor selected={perms} onChange={setPerms} />
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function SubUsersTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'users']
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [perms, setPerms] = useState<string[]>([])
  const [error, setError] = useState('')

  const { data: users = [], isLoading } = useQuery<SubUser[]>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${serverId}/users`),
  })

  const inviteMutation = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/users`, { email, permissions: perms }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      setShowInvite(false)
      setEmail('')
      setPerms([])
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{users.length} sub-user{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/[0.14] text-blue-300 border border-blue-500/25 hover:bg-blue-500/[0.22] transition-all"
        >
          <UserPlus size={13} /> Add User
        </button>
      </div>

      {showInvite && (
        <div className="panel rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Add Sub-User</p>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="user@example.com"
            className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <PermissionEditor selected={perms} onChange={setPerms} />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!email.trim() || inviteMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all"
            >
              {inviteMutation.isPending ? 'Adding…' : 'Add User'}
            </button>
            <button
              onClick={() => { setShowInvite(false); setEmail(''); setPerms([]); setError('') }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : users.length === 0 ? (
        <div className="panel rounded-xl px-8 py-10 text-center">
          <Users size={28} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No sub-users yet</p>
          <p className="text-slate-600 text-xs mt-1">Share access with specific permissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => <SubUserCard key={u.id} user={u} serverId={serverId} />)}
        </div>
      )}
    </div>
  )
}
