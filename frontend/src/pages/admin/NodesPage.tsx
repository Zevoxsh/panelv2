import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Trash2, Wifi, WifiOff, Loader, FileText, X, Copy, Check } from 'lucide-react'

interface Node {
  id: string; name: string; fqdn: string; scheme: 'https' | 'http'
  isPublic: boolean; memory: number; disk: number; daemonPort: number
  locationId: string; locationName: string | null
}

interface NodeStatus { online: boolean; statusCode: number | null }

function NodeStatusBadge({ nodeId }: { nodeId: string }) {
  const { data, isLoading } = useQuery<NodeStatus>({
    queryKey: ['admin', 'nodes', nodeId, 'status'],
    queryFn: () => api.get(`/admin/nodes/${nodeId}/status`),
    refetchInterval: 30_000,
  })
  if (isLoading) return <Loader size={14} className="text-gray-400 animate-spin" />
  if (data?.online) return <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium"><Wifi size={13} /> Connected</span>
  return <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium"><WifiOff size={13} /> Offline</span>
}

function ConfigModal({ nodeId, nodeName, onClose }: { nodeId: string; nodeName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const { data: config, isLoading } = useQuery<string>({
    queryKey: ['admin', 'nodes', nodeId, 'config'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/nodes/${nodeId}/config`, { credentials: 'include' })
      return res.text()
    },
  })

  async function copy() {
    if (!config) return
    await navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-admin-surface border border-admin-border/50 rounded-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border/50">
          <div>
            <p className="text-white font-semibold text-sm">Wings Config — {nodeName}</p>
            <p className="text-gray-400 text-xs mt-0.5">Copy to <code className="bg-white/10 px-1 rounded">/etc/pterodactyl/config.yml</code> then restart Wings.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              {copied ? <><Check size={13} className="text-green-400" /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : (
            <pre className="bg-black/40 rounded-lg p-4 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed">{config}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NodesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [configNode, setConfigNode] = useState<{ id: string; name: string } | null>(null)

  const { data: nodes = [], isLoading } = useQuery<Node[]>({
    queryKey: ['admin', 'nodes'],
    queryFn: () => api.get('/admin/nodes'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/nodes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'nodes'] }),
  })

  return (
    <div>
      {configNode && <ConfigModal nodeId={configNode.id} nodeName={configNode.name} onClose={() => setConfigNode(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Nodes</h1>
          <p className="text-gray-400 text-sm mt-0.5">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/admin/nodes/new')}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          <Plus size={14} /> New Node
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/50">
                {['Name', 'Location', 'FQDN', 'Memory', 'Disk', 'Status', ''].map(h => (
                  <th key={h} className={`text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium ${h === '' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map(node => (
                <tr key={node.id} className="border-b border-admin-border/30 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/admin/nodes/${node.id}`} className="text-white font-medium hover:text-teal transition-colors">{node.name}</Link>
                    <p className="text-gray-400 text-xs">{node.isPublic ? 'Public' : 'Private'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{node.locationName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-400 text-xs font-mono">{node.scheme}://{node.fqdn}:{node.daemonPort}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{node.memory.toLocaleString()} MiB</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{node.disk.toLocaleString()} MiB</td>
                  <td className="px-4 py-3"><NodeStatusBadge nodeId={node.id} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setConfigNode({ id: node.id, name: node.name })}
                        className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors" title="Wings config">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => { if (confirm(`Delete node "${node.name}"?`)) deleteMutation.mutate(node.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {nodes.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No nodes found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
