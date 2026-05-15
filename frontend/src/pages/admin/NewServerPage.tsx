import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

interface Egg { id: string; name: string; description: string | null; dockerImage: string; startupCommand: string }
interface EggVariable { id: string; name: string; description: string | null; envVariable: string; defaultValue: string; userViewable: boolean; userEditable: boolean; rules: string }
interface Node { id: string; name: string; fqdn: string; locationName: string | null; memory: number; disk: number }
interface User { id: string; username: string; email: string }
interface Allocation { id: string; ip: string; ipAlias: string | null; port: number }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
      {props.children}
    </select>
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary font-mono resize-none" />
}

function StepIndicator({ step, current }: { step: number; current: number }) {
  const labels = ['Egg', 'Ressources', 'Variables']
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-white' : 'bg-border text-muted'}`}>
              {done ? <Check size={13} /> : num}
            </div>
            <span className={`text-sm ${active ? 'text-white font-medium' : 'text-muted'}`}>{label}</span>
            {i < labels.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

export default function NewServerPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Step 1: egg + owner + node + allocation + name
  const [form, setForm] = useState({
    name: '', description: '',
    eggId: '', userId: '', nodeId: '', allocationId: '',
    dockerImage: '', startupCommand: '',
    memory: '512', disk: '1024', cpu: '0',
  })

  // Step 3: variable values (envVariable → value)
  const [variables, setVariables] = useState<Record<string, string>>({})

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: eggs = [] } = useQuery<Egg[]>({ queryKey: ['admin', 'eggs'], queryFn: () => api.get('/admin/eggs') })
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['admin', 'users'], queryFn: () => api.get('/admin/users') })
  const { data: nodes = [] } = useQuery<Node[]>({ queryKey: ['admin', 'nodes'], queryFn: () => api.get('/admin/nodes') })

  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ['admin', 'nodes', form.nodeId, 'allocations'],
    queryFn: () => api.get(`/admin/nodes/${form.nodeId}/allocations`),
    enabled: !!form.nodeId,
  })

  const { data: eggVars = [] } = useQuery<EggVariable[]>({
    queryKey: ['admin', 'eggs', form.eggId, 'variables'],
    queryFn: () => api.get(`/admin/eggs/${form.eggId}/variables`),
    enabled: !!form.eggId,
  })

  const selectedEgg = eggs.find(e => e.id === form.eggId)

  function handleEggSelect(eggId: string) {
    const egg = eggs.find(e => e.id === eggId)
    setForm(f => ({
      ...f,
      eggId,
      dockerImage: egg?.dockerImage ?? '',
      startupCommand: egg?.startupCommand ?? '',
    }))
  }

  function handleNodeSelect(nodeId: string) {
    setForm(f => ({ ...f, nodeId, allocationId: '' }))
  }

  // Init variables with defaults when entering step 3
  function initVariables() {
    const defaults: Record<string, string> = {}
    for (const v of eggVars) {
      defaults[v.envVariable] = variables[v.envVariable] ?? v.defaultValue
    }
    setVariables(defaults)
  }

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/servers', {
      ...form,
      memory: Number(form.memory),
      disk: Number(form.disk),
      cpu: Number(form.cpu),
      variables,
    }),
    onSuccess: () => navigate('/admin/servers'),
    onError: (e: Error) => setError(e.message),
  })

  const canStep1 = form.name && form.eggId && form.userId && form.nodeId && form.allocationId
  const canStep2 = Number(form.memory) > 0 && Number(form.disk) > 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/servers')} className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Nouveau serveur</h1>
          <p className="text-muted text-sm mt-0.5">Créer et déployer un serveur sur Wings</p>
        </div>
      </div>

      <StepIndicator step={step} current={step} />

      {/* ─ Step 1: Egg, Owner, Node, Allocation ─ */}
      {step === 1 && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Informations générales</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom du serveur">
              <Input value={form.name} onChange={set('name')} required placeholder="Mon Minecraft" />
            </Field>
            <Field label="Egg">
              <Select value={form.eggId} onChange={e => handleEggSelect(e.target.value)} required>
                <option value="">— Sélectionner —</option>
                {eggs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <Input value={form.description} onChange={set('description')} placeholder="Optionnel" />
          </Field>

          <Field label="Propriétaire">
            <Select value={form.userId} onChange={set('userId')} required>
              <option value="">— Sélectionner un utilisateur —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.email})</option>)}
            </Select>
          </Field>

          <Field label="Node">
            <Select value={form.nodeId} onChange={e => handleNodeSelect(e.target.value)} required>
              <option value="">— Sélectionner un node —</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.fqdn})</option>)}
            </Select>
          </Field>

          {form.nodeId && (
            <Field label="Allocation (IP:Port)">
              <Select value={form.allocationId} onChange={set('allocationId')} required>
                <option value="">— Sélectionner une allocation —</option>
                {allocations.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.ipAlias ? `${a.ipAlias} (${a.ip})` : a.ip}:{a.port}
                  </option>
                ))}
              </Select>
              {allocations.length === 0 && <p className="text-xs text-yellow-400 mt-1">Aucune allocation disponible sur ce node.</p>}
            </Field>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} disabled={!canStep1}
              className="flex items-center gap-2 bg-primary hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              Suivant <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─ Step 2: Resources + Docker + Startup ─ */}
      {step === 2 && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Ressources & configuration</h2>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Mémoire (MiB)">
              <Input type="number" value={form.memory} onChange={set('memory')} required min={1} />
            </Field>
            <Field label="Disque (MiB)">
              <Input type="number" value={form.disk} onChange={set('disk')} required min={1} />
            </Field>
            <Field label="CPU (%)" hint="0 = illimité">
              <Input type="number" value={form.cpu} onChange={set('cpu')} required min={0} />
            </Field>
          </div>

          <Field label="Image Docker" hint="Laisser tel quel pour utiliser celle de l'egg">
            <Input value={form.dockerImage} onChange={set('dockerImage')} required />
          </Field>

          <Field label="Commande de démarrage">
            <Textarea value={form.startupCommand} onChange={set('startupCommand')} required rows={3} />
          </Field>

          <div className="flex gap-3 justify-between pt-2">
            <button onClick={() => setStep(1)}
              className="flex items-center gap-2 text-muted hover:text-white text-sm px-4 py-2.5 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button onClick={() => { initVariables(); setStep(3) }} disabled={!canStep2}
              className="flex items-center gap-2 bg-primary hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              Suivant <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─ Step 3: Variables ─ */}
      {step === 3 && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Variables d'environnement</h2>

          {eggVars.length === 0 ? (
            <p className="text-muted text-sm">Aucune variable pour cet egg.</p>
          ) : (
            <div className="space-y-3">
              {eggVars.map(v => (
                <Field key={v.id} label={v.name} hint={v.description ?? undefined}>
                  <Input
                    value={variables[v.envVariable] ?? v.defaultValue}
                    onChange={e => setVariables(prev => ({ ...prev, [v.envVariable]: e.target.value }))}
                    placeholder={v.defaultValue}
                  />
                  <p className="text-xs text-muted/60 mt-0.5 font-mono">{v.envVariable}</p>
                </Field>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm font-medium">Erreur</p>
              <p className="text-red-300/80 text-xs mt-0.5">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-between pt-2">
            <button onClick={() => setStep(2)} disabled={mutation.isPending}
              className="flex items-center gap-2 text-muted hover:text-white disabled:opacity-40 text-sm px-4 py-2.5 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button onClick={() => { setError(null); mutation.mutate() }} disabled={mutation.isPending}
              className="flex items-center gap-2 bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              {mutation.isPending ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Création...</>
              ) : 'Créer le serveur'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
