import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Copy, Check, Server } from 'lucide-react'

interface Location { id: string; name: string }
interface CreatedNode { id: string; name: string }

interface NodeForm {
  name: string; description: string; locationId: string
  fqdn: string; scheme: 'https' | 'http'; behindProxy: boolean; isPublic: boolean
  panelUrl: string
  daemonDir: string; memory: string; memoryOverallocate: string
  disk: string; diskOverallocate: string; daemonPort: string; daemonSftp: string
}

const defaults: NodeForm = {
  name: '', description: '', locationId: '', fqdn: '', scheme: 'https',
  behindProxy: false, isPublic: true, panelUrl: '',
  daemonDir: '/var/lib/pterodactyl/volumes',
  memory: '', memoryOverallocate: '0', disk: '', diskOverallocate: '0',
  daemonPort: '8080', daemonSftp: '2022',
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
  return (
    <input {...props}
      className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
  )
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

function WingsConfig({ nodeId }: { nodeId: string }) {
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
    <div className="bg-green-950 border border-green-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-green-400 font-semibold text-sm">Node créé avec succès</p>
          <p className="text-green-600 text-xs mt-0.5">Copie cette configuration dans <code className="bg-green-900 px-1 rounded">/etc/pterodactyl/config.yml</code> sur ton serveur Wings, puis redémarre Wings.</p>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors shrink-0 ml-4">
          {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
      </div>
      {isLoading ? (
        <p className="text-green-600 text-xs">Chargement...</p>
      ) : (
        <pre className="bg-[#0a1f12] rounded-lg p-4 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed">
          {config}
        </pre>
      )}
    </div>
  )
}

export default function NewNodePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<NodeForm>(defaults)
  const [error, setError] = useState('')
  const [createdNode, setCreatedNode] = useState<CreatedNode | null>(null)

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['admin', 'locations'],
    queryFn: () => api.get('/admin/locations'),
  })

  const set = (key: keyof NodeForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setVal = (key: keyof NodeForm) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [key]: v }))

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<CreatedNode>('/admin/nodes', {
        ...form,
        memory: Number(form.memory),
        memoryOverallocate: Number(form.memoryOverallocate),
        disk: Number(form.disk),
        diskOverallocate: Number(form.diskOverallocate),
        daemonPort: Number(form.daemonPort),
        daemonSftp: Number(form.daemonSftp),
      }),
    onSuccess: (node) => setCreatedNode(node),
    onError: (e: Error) => setError(e.message),
  })

  if (createdNode) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center">
            <Server size={16} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{createdNode.name}</h1>
            <p className="text-muted text-sm mt-0.5">Node créé — configure Wings pour le connecter.</p>
          </div>
        </div>
        <div className="max-w-3xl space-y-4">
          <WingsConfig nodeId={createdNode.id} />
          <button onClick={() => navigate('/admin/nodes')}
            className="text-muted hover:text-white text-sm transition-colors">
            ← Retour à la liste des nodes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/nodes')} className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Nouveau node</h1>
          <p className="text-muted text-sm mt-0.5">Créer un node local ou distant pour héberger des serveurs.</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setError(''); createMutation.mutate() }} className="space-y-6 max-w-3xl">

        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Informations de base</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" hint="a-zA-Z0-9_.- et espaces (1–100 caractères)">
              <TextInput value={form.name} onChange={set('name')} required maxLength={100} placeholder="Node-01" />
            </Field>
            <Field label="Location">
              <select value={form.locationId} onChange={set('locationId')} required
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                <option value="">Sélectionner une location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <TextInput value={form.description} onChange={set('description')} placeholder="Optionnel" />
          </Field>
          <Field label="Visibilité" hint="Privé = impossible de déployer automatiquement sur ce node.">
            <Toggle value={form.isPublic} onChange={setVal('isPublic')}
              options={[{ label: 'Public', value: true }, { label: 'Privé', value: false }]} />
          </Field>
        </section>

        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Connexion Wings</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="FQDN" hint="Domaine ou IP du daemon Wings.">
              <TextInput value={form.fqdn} onChange={set('fqdn')} required placeholder="node.example.com" />
            </Field>
            <Field label="URL du panel" hint="URL complète du panel — Wings s'y connecte pour récupérer ses configs.">
              <TextInput value={form.panelUrl} onChange={set('panelUrl')} required placeholder="https://panel.example.com" />
            </Field>
            <Field label="Protocole">
              <Toggle value={form.scheme} onChange={setVal('scheme')}
                options={[{ label: 'SSL (HTTPS)', value: 'https' }, { label: 'HTTP', value: 'http' }]} />
            </Field>
            <Field label="Port daemon">
              <TextInput value={form.daemonPort} onChange={set('daemonPort')} type="number" required />
            </Field>
            <Field label="Port SFTP">
              <TextInput value={form.daemonSftp} onChange={set('daemonSftp')} type="number" required />
            </Field>
          </div>
          <Field label="Derrière un proxy" hint="Activer si Wings est derrière Cloudflare ou un reverse proxy.">
            <Toggle value={form.behindProxy} onChange={setVal('behindProxy')}
              options={[{ label: 'Non', value: false }, { label: 'Oui', value: true }]} />
          </Field>
        </section>

        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Configuration</h2>
          <Field label="Répertoire des fichiers serveurs">
            <TextInput value={form.daemonDir} onChange={set('daemonDir')} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mémoire totale (MiB)">
              <TextInput value={form.memory} onChange={set('memory')} type="number" required min={1} placeholder="8192" />
            </Field>
            <Field label="Sur-allocation mémoire (%)" hint="-1 désactivé, 0 bloque si dépassé.">
              <TextInput value={form.memoryOverallocate} onChange={set('memoryOverallocate')} type="number" required />
            </Field>
            <Field label="Espace disque total (MiB)">
              <TextInput value={form.disk} onChange={set('disk')} type="number" required min={1} placeholder="50000" />
            </Field>
            <Field label="Sur-allocation disque (%)" hint="-1 désactivé, 0 bloque si dépassé.">
              <TextInput value={form.diskOverallocate} onChange={set('diskOverallocate')} type="number" required />
            </Field>
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pb-6">
          <button type="submit" disabled={createMutation.isPending}
            className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            {createMutation.isPending ? 'Création...' : 'Créer le node'}
          </button>
          <button type="button" onClick={() => navigate('/admin/nodes')}
            className="text-muted hover:text-white text-sm px-5 py-2.5 rounded-lg transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
