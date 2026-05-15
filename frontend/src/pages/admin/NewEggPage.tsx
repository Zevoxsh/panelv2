import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { ArrowLeft } from 'lucide-react'

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

export default function NewEggPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    dockerImage: '',
    startupCommand: '',
    stopCommand: '^C',
    startupDoneString: ']',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/eggs', form),
    onSuccess: (data: any) => navigate(`/admin/eggs/${data.id}`),
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/eggs')} className="p-1.5 text-muted hover:text-white hover:bg-border rounded-md transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Nouvel egg</h1>
          <p className="text-muted text-sm mt-0.5">Définit un template de serveur</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}
        className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom">
            <Input value={form.name} onChange={set('name')} required maxLength={100} placeholder="Minecraft Java" />
          </Field>
          <Field label="Commande stop" hint="Ctrl+C = ^C">
            <Input value={form.stopCommand} onChange={set('stopCommand')} required placeholder="^C" />
          </Field>
        </div>
        <Field label="Description">
          <Input value={form.description} onChange={set('description')} placeholder="Optionnel" />
        </Field>
        <Field label="Image Docker" hint="Ex: ghcr.io/pterodactyl/yolks:java_21">
          <Input value={form.dockerImage} onChange={set('dockerImage')} required placeholder="image:tag" />
        </Field>
        <Field label="Commande de démarrage" hint="Variables disponibles sous forme {{VARIABLE}}">
          <Textarea value={form.startupCommand} onChange={set('startupCommand')} required rows={3}
            placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}" />
        </Field>
        <Field label="Chaîne fin de démarrage" hint="Texte dans les logs signalant que le serveur est prêt">
          <Input value={form.startupDoneString} onChange={set('startupDoneString')} required placeholder="]" />
        </Field>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={mutation.isPending}
            className="bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            {mutation.isPending ? 'Création...' : 'Créer l\'egg'}
          </button>
          <button type="button" onClick={() => navigate('/admin/eggs')}
            className="text-muted hover:text-white text-sm px-4 py-2.5 transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
