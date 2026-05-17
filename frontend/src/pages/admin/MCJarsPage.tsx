import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Save, Eye, EyeOff, BarChart2, Settings, Layers, ChevronDown, ChevronUp } from 'lucide-react'

interface McType {
  type: string; name: string; category: string; icon: string
  homepage: string | null; deprecated: boolean; experimental: boolean
  environment: string; hidden: boolean; sortOrder: number; eggId: string | null
}

interface EggOption { id: string; name: string }
interface TypesData { types: McType[]; availableEggs: EggOption[] }
interface Stats {
  byType: { type: string; count: number }[]
  byVersion: { type: string; version: string; count: number }[]
  recent: { id: string; type: string; version: string; build: string; serverId: string | null; installedAt: string }[]
}

function TabBtn({ label, icon: Icon, active, onClick }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'
    }`}>
      <Icon size={14} />{label}
    </button>
  )
}

// ── Type row ──────────────────────────────────────────────────────────────────
function TypeRow({ t, eggs, onChange }: {
  t: McType; eggs: EggOption[]
  onChange: (type: string, patch: Partial<McType>) => void
}) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState({ category: t.category, sortOrder: t.sortOrder, eggId: t.eggId ?? '' })

  function save() {
    onChange(t.type, { ...local, eggId: local.eggId || null })
    setOpen(false)
  }

  return (
    <div className="bg-black/20 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <img src={t.icon} alt="" className="w-8 h-8 rounded-lg object-cover bg-white/5 shrink-0"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-medium">{t.name}</span>
            <span className="text-[10px] font-semibold text-slate-500 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.07] font-mono">{t.type}</span>
            {t.deprecated && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">Deprecated</span>}
            {t.experimental && <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">Experimental</span>}
          </div>
          <p className="text-slate-600 text-xs mt-0.5">{local.category} · {t.environment}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onChange(t.type, { hidden: !t.hidden })}
            className={`p-1.5 rounded-lg transition-colors ${t.hidden ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'}`}
            title={t.hidden ? 'Masqué — cliquer pour afficher' : 'Visible — cliquer pour masquer'}
          >
            {t.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-black/10">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Catégorie</label>
              <input
                value={local.category}
                onChange={e => setLocal(l => ({ ...l, category: e.target.value }))}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Ordre</label>
              <input
                type="number"
                value={local.sortOrder}
                onChange={e => setLocal(l => ({ ...l, sortOrder: Number(e.target.value) }))}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Egg lié</label>
              <select
                value={local.eggId}
                onChange={e => setLocal(l => ({ ...l, eggId: e.target.value }))}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">— Aucun —</option>
                {eggs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={save} className="flex items-center gap-2 bg-primary hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Save size={13} /> Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['mcjars', 'config'], queryFn: () => api.get<{ orgKey: string }>('/admin/mcjars/config') })
  const [orgKey, setOrgKey] = useState('')
  const mutation = useMutation({ mutationFn: () => api.patch('/admin/mcjars/config', { orgKey }) })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>
  if (data && orgKey === '' && data.orgKey) setOrgKey(data.orgKey)

  return (
    <div className="max-w-md space-y-4">
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-white font-semibold text-sm mb-1">Organisation Key</h3>
          <p className="text-muted text-xs mb-3">Clé MCJars pour le tracking d'installations et les limites de taux.</p>
          <input
            value={orgKey}
            onChange={e => setOrgKey(e.target.value)}
            placeholder="mcjars-org-..."
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary"
          />
        </div>
        {mutation.isSuccess && <p className="text-green-400 text-xs">Enregistré.</p>}
        {mutation.isError && <p className="text-red-400 text-xs">Erreur lors de l'enregistrement.</p>}
        <div className="flex justify-end">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Save size={13} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab() {
  const { data, isLoading } = useQuery<Stats>({ queryKey: ['mcjars', 'stats'], queryFn: () => api.get('/admin/mcjars/stats') })

  if (isLoading) return <p className="text-muted text-sm">Chargement...</p>
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-white font-semibold text-sm mb-3">Top types installés</p>
          {data.byType.length === 0 ? (
            <p className="text-muted text-xs">Aucune installation enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {data.byType.map(r => (
                <div key={r.type} className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm font-mono w-28 shrink-0">{r.type}</span>
                  <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (r.count / (data.byType[0]?.count ?? 1)) * 100)}%` }} />
                  </div>
                  <span className="text-slate-500 text-xs w-8 text-right shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-white font-semibold text-sm mb-3">Top versions</p>
          {data.byVersion.length === 0 ? (
            <p className="text-muted text-xs">Aucune installation enregistrée.</p>
          ) : (
            <div className="space-y-1.5">
              {data.byVersion.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 font-mono">{r.type} {r.version}</span>
                  <span className="text-slate-500 text-xs">{r.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-3">Installations récentes</p>
        {data.recent.length === 0 ? (
          <p className="text-muted text-xs">Aucune installation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-slate-400 font-mono w-24 shrink-0">{r.type}</span>
                <span className="text-slate-500">{r.version}</span>
                <span className="text-slate-600 text-xs">build {r.build}</span>
                <span className="ml-auto text-slate-600 text-xs">{new Date(r.installedAt).toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Types tab ─────────────────────────────────────────────────────────────────
function TypesTab() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery<TypesData>({
    queryKey: ['mcjars', 'types'],
    queryFn: () => api.get('/admin/mcjars/types'),
  })
  const [filter, setFilter] = useState('')

  const saveMutation = useMutation({
    mutationFn: ({ type, patch }: { type: string; patch: Partial<McType> }) =>
      api.patch(`/admin/mcjars/types/${type}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcjars', 'types'] }),
  })

  if (isLoading) return <p className="text-muted text-sm">Connexion à MCJars...</p>
  if (isError) return <p className="text-red-400 text-sm">Impossible de joindre l'API MCJars.</p>
  if (!data) return null

  const types = [...data.types]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.type.toLowerCase().includes(filter.toLowerCase()))

  const categories = [...new Set(data.types.map(t => t.category))].sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrer les types..."
          className="bg-base border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-muted focus:outline-none focus:border-primary w-64"
        />
        <span className="text-muted text-xs">{types.length} type{types.length !== 1 ? 's' : ''} · {categories.length} catégorie{categories.length !== 1 ? 's' : ''}</span>
      </div>

      {categories.filter(cat => types.some(t => t.category === cat)).map(cat => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">{cat}</p>
          <div className="space-y-2">
            {types.filter(t => t.category === cat).map(t => (
              <TypeRow
                key={t.type}
                t={t}
                eggs={data.availableEggs}
                onChange={(type, patch) => saveMutation.mutate({ type, patch })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MCJarsPage() {
  const [tab, setTab] = useState<'types' | 'stats' | 'settings'>('types')

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <img src="https://versions.mcjars.app/icons/PAPER" alt="" className="w-6 h-6 rounded" />
          MCJars
        </h1>
        <p className="text-muted text-sm mt-0.5">Gérer les types de serveur, installer des builds, suivre les installations.</p>
      </div>

      <div className="flex border-b border-border mb-6">
        <TabBtn label="Types" icon={Layers} active={tab === 'types'} onClick={() => setTab('types')} />
        <TabBtn label="Statistiques" icon={BarChart2} active={tab === 'stats'} onClick={() => setTab('stats')} />
        <TabBtn label="Paramètres" icon={Settings} active={tab === 'settings'} onClick={() => setTab('settings')} />
      </div>

      {tab === 'types'    && <TypesTab />}
      {tab === 'stats'    && <StatsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
