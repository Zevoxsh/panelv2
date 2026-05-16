import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, Network, Star } from 'lucide-react'

interface Allocation {
  id: string; nodeId: string; ip: string; port: number
  alias: string | null; notes: string | null; isPrimary?: boolean
}

interface NetworkData {
  primary: Allocation
  secondary: Allocation[]
}

export default function NetworkTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', serverId, 'network']
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const { data: network, isLoading } = useQuery<NetworkData>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${serverId}/network`),
  })

  const { data: available = [] } = useQuery<Allocation[]>({
    queryKey: ['client', 'servers', serverId, 'network', 'available'],
    queryFn: () => api.get(`/client/servers/${serverId}/network/available`),
    enabled: showAdd,
  })

  const addMutation = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/network`, { allocationId: selectedId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      setShowAdd(false)
      setSelectedId('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (allocationId: string) => api.delete(`/client/servers/${serverId}/network/${allocationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  if (isLoading) return <p className="text-slate-500 text-sm p-6">Loading…</p>
  if (!network) return null

  const allAllocs: (Allocation & { isPrimary: boolean })[] = [
    { ...network.primary, isPrimary: true },
    ...network.secondary.map(a => ({ ...a, isPrimary: false })),
  ]

  function fmtAddr(a: Allocation) {
    return `${a.alias ?? a.ip}:${a.port}`
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{allAllocs.length} allocation{allAllocs.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/[0.14] text-blue-300 border border-blue-500/25 hover:bg-blue-500/[0.22] transition-all"
        >
          <Plus size={13} /> Add Allocation
        </button>
      </div>

      {showAdd && (
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Add Secondary Allocation</p>
          {available.length === 0 ? (
            <p className="text-slate-500 text-sm">No available allocations on this node</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {available.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                    selectedId === a.id
                      ? 'border-blue-500/30 bg-blue-500/[0.10] text-blue-300'
                      : 'border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <Network size={13} className="shrink-0" />
                  <span className="font-mono text-xs">{fmtAddr(a)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate()}
              disabled={!selectedId || addMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all"
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setSelectedId('') }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="panel rounded-xl overflow-hidden">
        {allAllocs.map((a, i) => (
          <div
            key={a.id}
            className={`flex items-center gap-4 px-5 py-3.5 ${i < allAllocs.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-slate-200 font-mono text-sm">{fmtAddr(a)}</p>
                {a.isPrimary && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/[0.12] text-yellow-400 border border-yellow-500/20">
                    <Star size={9} /> Primary
                  </span>
                )}
              </div>
              {a.notes && <p className="text-slate-600 text-xs mt-0.5">{a.notes}</p>}
            </div>
            <span className="text-slate-600 font-mono text-xs">{a.ip}:{a.port}</span>
            {!a.isPrimary && (
              <button
                onClick={() => removeMutation.mutate(a.id)}
                disabled={removeMutation.isPending}
                className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
