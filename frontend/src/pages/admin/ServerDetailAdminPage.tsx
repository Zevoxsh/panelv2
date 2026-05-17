import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ArrowLeft, CheckCircle, Clock, PauseCircle, Pause, Play,
  RotateCcw, Trash2, ExternalLink, RefreshCw,
} from 'lucide-react'
import MCJarsInstallModal from '../../components/MCJarsInstallModal'

interface ServerDetail {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  nodeId: string; nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null; eggId: string
  userId: string; userName: string | null; userEmail: string | null
  dockerImage: string; startupCommand: string
  createdAt: string
}

interface ServerVariable {
  id: string; variableId: string; serverId: string; value: string
  name: string | null; envVariable: string | null; description: string | null
  defaultValue: string | null; userViewable: boolean | null; userEditable: boolean | null
}

function StatusBadge({ installed, suspended }: { installed: boolean; suspended: boolean }) {
  if (suspended) return (
    <span className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium border border-yellow-800 bg-yellow-950/60 px-2.5 py-1 rounded-full">
      <PauseCircle size={11} /> Suspendu
    </span>
  )
  if (installed) return (
    <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium border border-green-800 bg-green-950/60 px-2.5 py-1 rounded-full">
      <CheckCircle size={11} /> Installé
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium border border-blue-800 bg-blue-950/60 px-2.5 py-1 rounded-full">
      <Clock size={11} /> Installation...
    </span>
  )
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

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ server, onMcjarsInstall }: { server: ServerDetail; onMcjarsInstall: () => void }) {
  const queryClient = useQueryClient()

  const suspendMutation = useMutation({
    mutationFn: (suspended: boolean) => api.patch(`/admin/servers/${server.id}`, { suspended }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'servers', server.id] }),
  })

  const reinstallMutation = useMutation({
    mutationFn: () => api.post(`/admin/servers/${server.id}/reinstall`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'servers', server.id] }),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/admin/servers/${server.id}/sync`),
  })

  const displayAddress = `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <section className="bg-surface border border-border rounded-xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Informations</p>
          <div className="space-y-2.5 text-sm">
            <Row label="Adresse" value={<span className="font-mono text-xs">{displayAddress}</span>} />
            <Row label="Node" value={server.nodeName ?? '—'} />
            <Row label="Egg" value={server.eggName ?? '—'} />
            <Row label="Propriétaire" value={
              <span>
                <span className="text-white">{server.userName ?? '—'}</span>
                {server.userEmail && <span className="text-muted text-xs ml-1">({server.userEmail})</span>}
              </span>
            } />
            <Row label="Créé le" value={new Date(server.createdAt).toLocaleDateString('fr-FR')} />
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Ressources</p>
          <div className="space-y-2.5 text-sm">
            <Row label="Mémoire" value={`${server.memory.toLocaleString()} MiB`} />
            <Row label="Disque" value={`${server.disk.toLocaleString()} MiB`} />
            <Row label="CPU" value={server.cpu > 0 ? `${server.cpu}%` : 'Illimité'} />
            <Row label="Image Docker" value={<span className="font-mono text-xs">{server.dockerImage}</span>} />
          </div>
        </section>
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-3">Commande de démarrage</p>
        <pre className="bg-base rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {server.startupCommand}
        </pre>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <p className="text-white font-semibold text-sm">Actions</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => suspendMutation.mutate(!server.suspended)}
            disabled={suspendMutation.isPending}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
              server.suspended
                ? 'border-green-700 text-green-400 hover:bg-green-950/40'
                : 'border-yellow-700 text-yellow-400 hover:bg-yellow-950/40'
            }`}
          >
            {server.suspended ? <><Play size={13} /> Réactiver</> : <><Pause size={13} /> Suspendre</>}
          </button>
          <button
            onClick={() => { if (confirm('Réinstaller le serveur ? Les données seront perdues.')) reinstallMutation.mutate() }}
            disabled={reinstallMutation.isPending}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-950/40 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} /> Réinstaller
          </button>
          <button
            onClick={onMcjarsInstall}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-teal-700 text-teal-400 hover:bg-teal-950/40 transition-colors"
          >
            <img src="https://versions.mcjars.app/icons/PAPER" alt="" className="w-3.5 h-3.5 rounded" />
            MCJars
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Re-pousse la configuration du serveur vers Wings (utile si Wings ne connaît pas ce serveur)"
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
              syncMutation.isSuccess ? 'border-green-700 text-green-400' :
              syncMutation.isError ? 'border-red-700 text-red-400' :
              'border-border text-muted hover:text-white hover:bg-border'
            }`}
          >
            <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isSuccess ? 'Synchronisé ✓' : syncMutation.isError ? 'Échec sync' : 'Sync Wings'}
          </button>
          <Link
            to={`/servers/${server.id}`}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-border text-muted hover:text-white hover:bg-border transition-colors"
          >
            <ExternalLink size={13} /> Voir côté client
          </Link>
        </div>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  )
}

// ── Variables Tab ─────────────────────────────────────────────────────────────
function VariablesTab({ server }: { server: ServerDetail }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const { data: vars = [], isLoading } = useQuery<ServerVariable[]>({
    queryKey: ['admin', 'servers', server.id, 'variables'],
    queryFn: () => api.get(`/admin/servers/${server.id}/variables`),
    select: (data) => {
      // Init local state from fetched data (only once)
      if (Object.keys(values).length === 0 && data.length > 0) {
        const init: Record<string, string> = {}
        data.forEach(v => { if (v.envVariable) init[v.id] = v.value })
        setValues(init)
      }
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        vars.map(v => api.patch(`/admin/servers/${server.id}/variables/${v.id}`, { value: values[v.id] ?? v.value }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'servers', server.id, 'variables'] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>

  if (vars.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center max-w-2xl">
        <p className="text-muted text-sm">Aucune variable pour cet egg.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        {vars.map(v => (
          <div key={v.id}>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">
              {v.name ?? v.envVariable}
            </label>
            <input
              value={values[v.id] ?? v.value}
              onChange={e => setValues(prev => ({ ...prev, [v.id]: e.target.value }))}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
            {v.description && <p className="text-muted text-xs mt-1">{v.description}</p>}
            <p className="text-muted/60 text-xs font-mono mt-0.5">{v.envVariable}</p>
          </div>
        ))}
        <button
          onClick={() => { setSaved(false); saveMutation.mutate() }}
          disabled={saveMutation.isPending}
          className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {saved ? 'Sauvegardé ✓' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ── Build Tab ─────────────────────────────────────────────────────────────────
function BuildTab({ server }: { server: ServerDetail }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    memory: server.memory,
    disk: server.disk,
    cpu: server.cpu,
    dockerImage: server.dockerImage,
    startupCommand: server.startupCommand,
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value
      const isNum = k === 'memory' || k === 'disk' || k === 'cpu'
      setForm(f => ({ ...f, [k]: isNum ? (parseInt(raw) || 0) : raw }))
    }

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/servers/${server.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'servers', server.id] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); saveMutation.mutate() }}
      className="space-y-4 max-w-2xl">

      <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm border-b border-border pb-3">Ressources</p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">RAM (MiB)</label>
            <input
              type="number" min={1} required
              value={form.memory}
              onChange={set('memory')}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Disque (MiB)</label>
            <input
              type="number" min={1} required
              value={form.disk}
              onChange={set('disk')}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wider">CPU (%)</label>
            <input
              type="number" min={0}
              value={form.cpu}
              onChange={set('cpu')}
              placeholder="0 = illimité"
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
            <p className="text-muted text-xs mt-1">0 = illimité</p>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm border-b border-border pb-3">Conteneur</p>

        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Image Docker</label>
          <input
            type="text" required
            value={form.dockerImage}
            onChange={set('dockerImage')}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Commande de démarrage</label>
          <textarea
            required rows={3}
            value={form.startupCommand}
            onChange={set('startupCommand')}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary resize-none"
          />
        </div>
      </section>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saveMutation.isPending}
          className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          {saved ? 'Sauvegardé ✓' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
        <p className="text-muted text-xs">
          Les nouvelles limites seront appliquées au prochain démarrage du serveur.
        </p>
      </div>
    </form>
  )
}

// ── Danger Tab ────────────────────────────────────────────────────────────────
function DangerTab({ server }: { server: ServerDetail }) {
  const navigate = useNavigate()

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/servers/${server.id}`),
    onSuccess: () => navigate('/admin/servers'),
  })

  const reinstallMutation = useMutation({
    mutationFn: () => api.post(`/admin/servers/${server.id}/reinstall`),
  })

  return (
    <div className="space-y-4 max-w-2xl">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-1">Réinstaller le serveur</h2>
        <p className="text-muted text-xs mb-4">
          Relance le script d'installation. Les fichiers dans le répertoire du serveur peuvent être écrasés.
        </p>
        <button
          onClick={() => { if (confirm('Réinstaller le serveur ?')) reinstallMutation.mutate() }}
          disabled={reinstallMutation.isPending}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-950/40 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {reinstallMutation.isPending ? 'Réinstallation...' : 'Réinstaller'}
        </button>
      </section>

      <section className="bg-red-950 border border-red-800 rounded-xl p-5">
        <h2 className="text-red-400 font-semibold text-sm mb-1">Supprimer le serveur</h2>
        <p className="text-red-300/70 text-xs mb-4">
          Action irréversible. Le serveur et toutes ses données seront supprimés de Wings.
        </p>
        <button
          onClick={() => { if (confirm(`Supprimer définitivement "${server.name}" ?`)) deleteMutation.mutate() }}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Trash2 size={13} />
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer le serveur'}
        </button>
      </section>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['overview', 'build', 'variables', 'danger'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Vue d\'ensemble',
  build: 'Ressources',
  variables: 'Variables',
  danger: 'Zone dangereuse',
}

export default function ServerDetailAdminPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [mcjarsOpen, setMcjarsOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: server, isLoading } = useQuery<ServerDetail>({
    queryKey: ['admin', 'servers', id],
    queryFn: () => api.get(`/admin/servers/${id}`),
  })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>
  if (!server) return <p className="text-red-400 text-sm">Serveur introuvable.</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/servers')}
          className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white truncate">{server.name}</h1>
            <StatusBadge installed={server.installed} suspended={server.suspended} />
          </div>
          <p className="text-muted text-sm mt-0.5">
            {server.eggName ?? '—'} · {server.nodeName ?? '—'}
          </p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6 -mt-2">
        {TABS.map(t => <TabBtn key={t} label={TAB_LABELS[t]} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {tab === 'overview' && <OverviewTab server={server} onMcjarsInstall={() => setMcjarsOpen(true)} />}
      {tab === 'build' && <BuildTab server={server} />}
      {tab === 'variables' && <VariablesTab server={server} />}
      {tab === 'danger' && <DangerTab server={server} />}

      {mcjarsOpen && (
        <MCJarsInstallModal
          serverId={server.id}
          onClose={() => setMcjarsOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin', 'servers', server.id] })}
        />
      )}
    </div>
  )
}
