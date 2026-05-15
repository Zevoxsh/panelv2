import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Wifi, WifiOff, Copy, Check, Trash2, Plus, RefreshCw } from 'lucide-react'

interface Node {
  id: string; name: string; description: string | null
  fqdn: string; scheme: 'https' | 'http'; isPublic: boolean; behindProxy: boolean
  daemonDir: string; memory: number; memoryOverallocate: number
  disk: number; diskOverallocate: number; daemonPort: number; daemonSftp: number
  panelUrl: string; locationId: string; locationName: string | null
  tokenId: string; daemonToken: string
}

interface SystemInfo {
  online: boolean; version?: string
  os?: string; architecture?: string; cpu_count?: number; kernel_version?: string
}

interface Allocation {
  id: string; nodeId: string; ip: string; ipAlias: string | null; port: number
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  return {
    copied,
    copy: async (text: string) => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    },
  }
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active
        ? 'border-primary text-primary-light'
        : 'border-transparent text-muted hover:text-white'}`}>
      {label}
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
}

function Toggle({ value, onChange, options }: {
  value: string | boolean
  onChange: (v: string | boolean) => void
  options: { label: string; value: string | boolean }[]
}) {
  return (
    <div className="flex bg-base border border-border rounded-lg p-1 gap-1 w-fit">
      {options.map((opt) => (
        <button key={String(opt.value)} type="button" onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${value === opt.value ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── About Tab ────────────────────────────────────────────────────────────────
function AboutTab({ node }: { node: Node }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: sys } = useQuery<SystemInfo>({
    queryKey: ['admin', 'nodes', node.id, 'system'],
    queryFn: () => api.get(`/admin/nodes/${node.id}/system`),
    refetchInterval: 30_000,
  })

  const { data: allocs = [] } = useQuery<Allocation[]>({
    queryKey: ['admin', 'nodes', node.id, 'allocations'],
    queryFn: () => api.get(`/admin/nodes/${node.id}/allocations`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/nodes/${node.id}`),
    onSuccess: () => navigate('/admin/nodes'),
  })

  const usedMemory = 0
  const usedDisk = 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Informations</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Version daemon</span>
              <span className="text-white font-mono text-xs">
                {sys?.online ? (sys.version ?? '—') : <span className="text-red-400">Hors ligne</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Système</span>
              <span className="text-white text-xs font-mono">
                {sys?.online ? `${sys.os} (${sys.architecture})` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Kernel</span>
              <span className="text-white text-xs font-mono">{sys?.online ? (sys.kernel_version ?? '—') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Threads CPU</span>
              <span className="text-white">{sys?.online ? (sys.cpu_count ?? '—') : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Status</span>
              {sys?.online
                ? <span className="flex items-center gap-1.5 text-xs text-green-400"><Wifi size={12} /> Connecté</span>
                : <span className="flex items-center gap-1.5 text-xs text-red-400"><WifiOff size={12} /> Hors ligne</span>
              }
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Résumé</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Disque alloué</span>
                <span className="text-white">{usedDisk.toLocaleString()} / {node.disk.toLocaleString()} MiB</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((usedDisk / node.disk) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Mémoire allouée</span>
                <span className="text-white">{usedMemory.toLocaleString()} / {node.memory.toLocaleString()} MiB</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((usedMemory / node.memory) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Serveurs</span>
              <span className="text-white">0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Allocations</span>
              <span className="text-white">{allocs.length}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-red-950 border border-red-800 rounded-xl p-5">
        <h2 className="text-red-400 font-semibold text-sm mb-1">Supprimer le node</h2>
        <p className="text-red-300/70 text-xs mb-4">Action irréversible. Il ne doit y avoir aucun serveur associé à ce node.</p>
        <button
          onClick={() => { if (confirm(`Supprimer définitivement "${node.name}" ?`)) deleteMutation.mutate() }}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer le node'}
        </button>
      </section>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ node }: { node: Node }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: node.name, description: node.description ?? '',
    fqdn: node.fqdn, scheme: node.scheme, behindProxy: node.behindProxy,
    isPublic: node.isPublic, panelUrl: node.panelUrl,
    daemonDir: node.daemonDir, memory: String(node.memory),
    memoryOverallocate: String(node.memoryOverallocate),
    disk: String(node.disk), diskOverallocate: String(node.diskOverallocate),
    daemonPort: String(node.daemonPort), daemonSftp: String(node.daemonSftp),
  })
  const [saved, setSaved] = useState(false)

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setVal = (key: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [key]: v }))

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/nodes/${node.id}`, {
      ...form,
      memory: Number(form.memory), memoryOverallocate: Number(form.memoryOverallocate),
      disk: Number(form.disk), diskOverallocate: Number(form.diskOverallocate),
      daemonPort: Number(form.daemonPort), daemonSftp: Number(form.daemonSftp),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'nodes', node.id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const resetKeyMutation = useMutation({
    mutationFn: () => api.post(`/admin/nodes/${node.id}/reset-key`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'nodes', node.id] }),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }} className="space-y-6 max-w-3xl">
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Paramètres</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom">
            <TextInput value={form.name} onChange={set('name')} required maxLength={100} />
          </Field>
          <Field label="FQDN">
            <TextInput value={form.fqdn} onChange={set('fqdn')} required />
          </Field>
          <Field label="URL du panel">
            <TextInput value={form.panelUrl} onChange={set('panelUrl')} required />
          </Field>
          <Field label="Description">
            <TextInput value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Visibilité">
            <Toggle value={form.isPublic} onChange={setVal('isPublic')}
              options={[{ label: 'Public', value: true }, { label: 'Privé', value: false }]} />
          </Field>
          <Field label="Protocole">
            <Toggle value={form.scheme} onChange={setVal('scheme')}
              options={[{ label: 'HTTPS', value: 'https' }, { label: 'HTTP', value: 'http' }]} />
          </Field>
          <Field label="Derrière proxy">
            <Toggle value={form.behindProxy} onChange={setVal('behindProxy')}
              options={[{ label: 'Non', value: false }, { label: 'Oui', value: true }]} />
          </Field>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Limites d'allocation</h2>
        <Field label="Répertoire serveurs">
          <TextInput value={form.daemonDir} onChange={set('daemonDir')} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mémoire totale (MiB)">
            <TextInput value={form.memory} onChange={set('memory')} type="number" required min={1} />
          </Field>
          <Field label="Sur-allocation mémoire (%)">
            <TextInput value={form.memoryOverallocate} onChange={set('memoryOverallocate')} type="number" required />
          </Field>
          <Field label="Disque total (MiB)">
            <TextInput value={form.disk} onChange={set('disk')} type="number" required min={1} />
          </Field>
          <Field label="Sur-allocation disque (%)">
            <TextInput value={form.diskOverallocate} onChange={set('diskOverallocate')} type="number" required />
          </Field>
          <Field label="Port daemon">
            <TextInput value={form.daemonPort} onChange={set('daemonPort')} type="number" required />
          </Field>
          <Field label="Port SFTP">
            <TextInput value={form.daemonSftp} onChange={set('daemonSftp')} type="number" required />
          </Field>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={saveMutation.isPending}
          className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          {saved ? 'Sauvegardé ✓' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-1">Réinitialiser la clé daemon</h2>
        <p className="text-muted text-xs mb-4">Génère un nouveau token. Toutes les requêtes avec l'ancien token seront rejetées. Mets à jour le config.yml de Wings.</p>
        <button type="button" onClick={() => { if (confirm('Réinitialiser la clé daemon ?')) resetKeyMutation.mutate() }}
          disabled={resetKeyMutation.isPending}
          className="flex items-center gap-2 text-sm text-muted hover:text-white border border-border hover:border-primary px-4 py-2 rounded-lg transition-colors">
          <RefreshCw size={14} />
          {resetKeyMutation.isPending ? 'Génération...' : 'Réinitialiser la clé'}
        </button>
      </section>
    </form>
  )
}

// ─── Config Tab ───────────────────────────────────────────────────────────────
function ConfigTab({ node }: { node: Node }) {
  const { copied, copy } = useCopy()
  const { data: config, isLoading } = useQuery<string>({
    queryKey: ['admin', 'nodes', node.id, 'config'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/nodes/${node.id}/config`, { credentials: 'include' })
      return res.text()
    },
  })

  return (
    <section className="bg-surface border border-border rounded-xl p-5 max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">Fichier de configuration Wings</p>
          <p className="text-muted text-xs mt-0.5">À placer dans <code className="bg-border px-1 rounded">/etc/pterodactyl/config.yml</code> puis redémarrer Wings.</p>
        </div>
        <button onClick={() => config && copy(config)} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
          {copied ? <><Check size={13} className="text-green-400" /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
      </div>
      {isLoading ? <p className="text-muted text-sm">Chargement...</p> : (
        <pre className="bg-base rounded-lg p-4 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed">{config}</pre>
      )}
    </section>
  )
}

// ─── Allocation Tab ───────────────────────────────────────────────────────────
function AllocationTab({ node }: { node: Node }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ip: '', ipAlias: '', ports: '' })
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  const { data: allocs = [], isLoading } = useQuery<Allocation[]>({
    queryKey: ['admin', 'nodes', node.id, 'allocations'],
    queryFn: () => api.get(`/admin/nodes/${node.id}/allocations`),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/nodes/${node.id}/allocations`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'nodes', node.id, 'allocations'] })
      setForm({ ip: '', ipAlias: '', ports: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/allocations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'nodes', node.id, 'allocations'] }),
  })

  const totalPages = Math.max(1, Math.ceil(allocs.length / PER_PAGE))
  const paged = allocs.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Allocations existantes</p>
          <p className="text-muted text-xs">{allocs.length} allocation{allocs.length !== 1 ? 's' : ''}</p>
        </div>
        {isLoading ? <p className="text-muted text-sm p-5">Chargement...</p> : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">IP</th>
                  <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Alias</th>
                  <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Port</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                    <td className="px-4 py-2.5 text-white font-mono text-xs">{a.ip}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">{a.ipAlias ?? '—'}</td>
                    <td className="px-4 py-2.5 text-white font-mono text-xs">{a.port}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => deleteMutation.mutate(a.id)}
                        className="p-1 text-muted hover:text-red-400 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {allocs.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">Aucune allocation</td></tr>
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded-md transition-colors ${p === page ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-border'}`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Assigner de nouvelles allocations</h2>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Adresse IP">
              <input value={form.ip} onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                required placeholder="10.10.0.13"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
            </Field>
            <Field label="Alias IP">
              <input value={form.ipAlias} onChange={(e) => setForm((f) => ({ ...f, ipAlias: e.target.value }))}
                placeholder="node.example.com"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
            </Field>
            <Field label="Ports" hint="Ex: 25000-25010, 27015">
              <input value={form.ports} onChange={(e) => setForm((f) => ({ ...f, ports: e.target.value }))}
                required placeholder="25000-25050"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
            </Field>
          </div>
          {createMutation.isError && (
            <p className="text-red-400 text-xs">{createMutation.error?.message}</p>
          )}
          {createMutation.isSuccess && (
            <p className="text-green-400 text-xs">{(createMutation.data as { created: number }).created} port(s) ajouté(s).</p>
          )}
          <button type="submit" disabled={createMutation.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} />
            {createMutation.isPending ? 'Ajout...' : 'Assigner'}
          </button>
        </form>
      </section>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['about', 'settings', 'configuration', 'allocation'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  about: 'À propos', settings: 'Paramètres', configuration: 'Configuration', allocation: 'Allocation',
}

export default function NodeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('about')

  const { data: node, isLoading } = useQuery<Node>({
    queryKey: ['admin', 'nodes', id],
    queryFn: () => api.get(`/admin/nodes/${id}`),
  })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>
  if (!node) return <p className="text-red-400 text-sm">Node introuvable.</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/nodes')} className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{node.name}</h1>
          <p className="text-muted text-sm mt-0.5">{node.fqdn} · {node.locationName ?? '—'}</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6 -mt-2">
        {TABS.map((t) => <TabBtn key={t} label={TAB_LABELS[t]} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {tab === 'about' && <AboutTab node={node} />}
      {tab === 'settings' && <SettingsTab node={node} />}
      {tab === 'configuration' && <ConfigTab node={node} />}
      {tab === 'allocation' && <AllocationTab node={node} />}
    </div>
  )
}
