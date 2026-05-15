import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface Egg {
  id: string; name: string; description: string | null
  dockerImage: string; startupCommand: string; stopCommand: string; startupDoneString: string
  installScript: string; installContainer: string; installEntrypoint: string
}

interface EggVariable {
  id: string; eggId: string; name: string; description: string | null
  envVariable: string; defaultValue: string; userViewable: boolean; userEditable: boolean; rules: string
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary font-mono resize-none" />
}

function Toggle({ value, onChange, options }: {
  value: boolean
  onChange: (v: boolean) => void
  options: [string, string]
}) {
  return (
    <div className="flex bg-base border border-border rounded-lg p-1 gap-1 w-fit">
      {([true, false] as const).map((v, i) => (
        <button key={i} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${value === v ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
          {options[i]}
        </button>
      ))}
    </div>
  )
}

function SettingsTab({ egg }: { egg: Egg }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: egg.name, description: egg.description ?? '',
    dockerImage: egg.dockerImage, startupCommand: egg.startupCommand,
    stopCommand: egg.stopCommand, startupDoneString: egg.startupDoneString,
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/eggs/${egg.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'eggs', egg.id] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); saveMutation.mutate() }}
      className="bg-surface border border-border rounded-xl p-6 space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom">
          <Input value={form.name} onChange={set('name')} required />
        </Field>
        <Field label="Commande stop" hint="^C pour SIGINT, sinon commande stdin">
          <Input value={form.stopCommand} onChange={set('stopCommand')} required />
        </Field>
      </div>
      <Field label="Description">
        <Input value={form.description} onChange={set('description')} />
      </Field>
      <Field label="Image Docker">
        <Input value={form.dockerImage} onChange={set('dockerImage')} required />
      </Field>
      <Field label="Commande de démarrage">
        <Textarea value={form.startupCommand} onChange={set('startupCommand')} required rows={3} />
      </Field>
      <Field label="Chaîne de démarrage terminé" hint="Texte dans les logs indiquant que le serveur est prêt">
        <Input value={form.startupDoneString} onChange={set('startupDoneString')} required placeholder="]" />
      </Field>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button type="submit" disabled={saveMutation.isPending}
        className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        {saved ? 'Sauvegardé ✓' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </form>
  )
}

function VariablesTab({ egg }: { egg: Egg }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newVar, setNewVar] = useState({
    name: '', description: '', envVariable: '', defaultValue: '', rules: '',
    userViewable: true, userEditable: true,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: vars = [] } = useQuery<EggVariable[]>({
    queryKey: ['admin', 'eggs', egg.id, 'variables'],
    queryFn: () => api.get(`/admin/eggs/${egg.id}/variables`),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/eggs/${egg.id}/variables`, newVar),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'eggs', egg.id, 'variables'] })
      setNewVar({ name: '', description: '', envVariable: '', defaultValue: '', rules: '', userViewable: true, userEditable: true })
      setShowForm(false)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (varId: string) => api.delete(`/admin/eggs/${egg.id}/variables/${varId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'eggs', egg.id, 'variables'] }),
  })

  const setV = (k: keyof typeof newVar) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNewVar(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Variables d'environnement</p>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
            <Plus size={13} /> Ajouter
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-base/40">
            <form onSubmit={(e) => { e.preventDefault(); setFormError(null); createMutation.mutate() }}
              className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Nom</label>
                <input value={newVar.name} onChange={setV('name')} required placeholder="Server Jar File"
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Variable env</label>
                <input value={newVar.envVariable} onChange={setV('envVariable')} required placeholder="SERVER_JARFILE"
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Valeur par défaut</label>
                <input value={newVar.defaultValue} onChange={setV('defaultValue')} placeholder="server.jar"
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <input value={newVar.description} onChange={setV('description')} placeholder="Optionnel"
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Visible utilisateur</label>
                <Toggle value={newVar.userViewable} onChange={(v) => setNewVar(f => ({ ...f, userViewable: v }))} options={['Oui', 'Non']} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Modifiable utilisateur</label>
                <Toggle value={newVar.userEditable} onChange={(v) => setNewVar(f => ({ ...f, userEditable: v }))} options={['Oui', 'Non']} />
              </div>
              {formError && <p className="col-span-2 text-red-400 text-xs">{formError}</p>}
              <div className="col-span-2 flex gap-2">
                <button type="submit" disabled={createMutation.isPending}
                  className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                  {createMutation.isPending ? 'Ajout...' : 'Ajouter la variable'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-muted hover:text-white text-xs px-3 py-2 transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Nom</th>
              <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Variable</th>
              <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">Défaut</th>
              <th className="text-left text-xs text-muted uppercase tracking-wider px-4 py-3 font-medium">User</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {vars.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0 hover:bg-border/30 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="text-white text-xs font-medium">{v.name}</p>
                  {v.description && <p className="text-muted text-xs">{v.description}</p>}
                </td>
                <td className="px-4 py-2.5 text-green-300 text-xs font-mono">{v.envVariable}</td>
                <td className="px-4 py-2.5 text-muted text-xs font-mono">{v.defaultValue || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs ${v.userViewable ? 'text-green-400' : 'text-muted'}`}>
                    {v.userViewable ? (v.userEditable ? 'Vue + Edit' : 'Vue') : 'Caché'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => deleteMutation.mutate(v.id)}
                    className="p-1 text-muted hover:text-red-400 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {vars.length === 0 && !showForm && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">Aucune variable</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InstallTab({ egg }: { egg: Egg }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    installContainer: egg.installContainer,
    installEntrypoint: egg.installEntrypoint,
    installScript: egg.installScript,
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/admin/eggs/${egg.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'eggs', egg.id] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); saveMutation.mutate() }}
      className="space-y-4 max-w-2xl">
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-sm border-b border-border pb-3">Script d'installation</h2>
        <p className="text-muted text-xs">Exécuté par Wings dans un conteneur isolé avant le démarrage du serveur.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Image du conteneur" hint="Ex: ghcr.io/ptero-eggs/installers:alpine">
            <Input value={form.installContainer} onChange={set('installContainer')} placeholder="ghcr.io/ptero-eggs/installers:alpine" />
          </Field>
          <Field label="Entrypoint">
            <Input value={form.installEntrypoint} onChange={set('installEntrypoint')} placeholder="ash" />
          </Field>
        </div>
        <Field label="Script">
          <textarea
            value={form.installScript}
            onChange={set('installScript')}
            rows={16}
            placeholder="#!/bin/ash&#10;# Installation script"
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-green-300 text-xs font-mono focus:outline-none focus:border-primary resize-none leading-relaxed"
          />
        </Field>
      </section>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button type="submit" disabled={saveMutation.isPending}
        className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        {saved ? 'Sauvegardé ✓' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </form>
  )
}

const TABS = ['settings', 'install', 'variables'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = { settings: 'Paramètres', install: 'Installation', variables: 'Variables' }

export default function EggDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('settings')

  const { data: egg, isLoading } = useQuery<Egg>({
    queryKey: ['admin', 'eggs', id],
    queryFn: () => api.get(`/admin/eggs/${id}`),
  })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>
  if (!egg) return <p className="text-red-400 text-sm">Egg introuvable.</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/eggs')} className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{egg.name}</h1>
          <p className="text-muted text-sm mt-0.5">{egg.dockerImage}</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6 -mt-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary-light' : 'border-transparent text-muted hover:text-white'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'settings' && <SettingsTab egg={egg} />}
      {tab === 'install' && <InstallTab egg={egg} />}
      {tab === 'variables' && <VariablesTab egg={egg} />}
    </div>
  )
}
