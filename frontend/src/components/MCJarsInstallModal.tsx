import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { X, ChevronRight, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'

interface McType {
  type: string; name: string; category: string; icon: string
  deprecated: boolean; experimental: boolean; hidden: boolean
  sortOrder: number; eggId: string | null
}
interface TypesData { types: McType[] }

interface Props {
  serverId: string
  onClose: () => void
  onSuccess: () => void
}

type Step = 'type' | 'version' | 'build' | 'confirm'

function categoryOrder(cat: string) {
  const order: Record<string, number> = {
    Vanilla: 0, Fork: 1, Modded: 2, Proxy: 3,
  }
  return order[cat] ?? 99
}

export default function MCJarsInstallModal({ serverId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [selType, setSelType] = useState<McType | null>(null)
  const [selVersion, setSelVersion] = useState<string | null>(null)
  const [selBuild, setSelBuild] = useState<string | null>(null)
  const [eula, setEula] = useState(true)
  const [wipe, setWipe] = useState(false)
  const [filter, setFilter] = useState('')

  // Fetch types
  const { data: typesData, isLoading: typesLoading, isError: typesError } = useQuery<TypesData>({
    queryKey: ['mcjars', 'types'],
    queryFn: () => api.get('/admin/mcjars/types'),
  })

  // Fetch versions for selected type
  const { data: versionsRaw, isLoading: versionsLoading } = useQuery<any>({
    queryKey: ['mcjars', 'builds', selType?.type],
    queryFn: () => api.get(`/admin/mcjars/builds/${selType!.type}`),
    enabled: !!selType && step !== 'type',
  })

  // Fetch builds for selected version
  const { data: buildsRaw, isLoading: buildsLoading } = useQuery<any>({
    queryKey: ['mcjars', 'builds', selType?.type, selVersion],
    queryFn: () => api.get(`/admin/mcjars/builds/${selType!.type}/${selVersion}`),
    enabled: !!selType && !!selVersion && (step === 'build' || step === 'confirm'),
  })

  const installMutation = useMutation({
    mutationFn: () => api.post(`/admin/servers/${serverId}/mcjars/install`, {
      type: selType!.type,
      version: selVersion!,
      build: selBuild!,
      eula,
      wipe,
    }),
    onSuccess: () => { onSuccess(); onClose() },
  })

  // Parse versions from the API response
  const versions: string[] = (() => {
    if (!versionsRaw) return []
    const buildsMap: Record<string, any> = versionsRaw.builds ?? versionsRaw ?? {}
    if (typeof buildsMap !== 'object' || Array.isArray(buildsMap)) return []
    return Object.keys(buildsMap).sort((a, b) => {
      // Sort by semver descending
      const pa = a.split('.').map(Number)
      const pb = b.split('.').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
        if (diff !== 0) return diff
      }
      return 0
    })
  })()

  // Parse individual builds
  const builds: { id: number | string; build: string; created: string }[] = (() => {
    if (!buildsRaw) return []
    const arr: any[] = buildsRaw.builds ?? buildsRaw ?? []
    if (!Array.isArray(arr)) return []
    return arr.slice(0, 20).map(b => ({
      id: b.id ?? b.build,
      build: String(b.build ?? b.id ?? '?'),
      created: b.created ?? b.installedAt ?? '',
    }))
  })()

  // Organize types by category
  const visibleTypes = (typesData?.types ?? [])
    .filter(t => !t.hidden)
    .filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.type.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name))

  const categories = [...new Set(visibleTypes.map(t => t.category))].sort((a, b) => categoryOrder(a) - categoryOrder(b))

  function pickType(t: McType) {
    setSelType(t)
    setSelVersion(null)
    setSelBuild(null)
    setStep('version')
  }

  function pickVersion(v: string) {
    setSelVersion(v)
    setSelBuild(null)
    setStep('build')
  }

  function pickBuild(b: string) {
    setSelBuild(b)
    setStep('confirm')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#0c1018', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <img src="https://versions.mcjars.app/icons/PAPER" alt="" className="w-5 h-5 rounded" />
            <span className="text-white font-semibold text-sm">Installer via MCJars</span>
          </div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-slate-500 flex-1 justify-center">
            <button onClick={() => setStep('type')} className={step !== 'type' ? 'hover:text-slate-300 transition-colors' : 'text-white font-medium'}>Type</button>
            {selType && <><ChevronRight size={10} /><button onClick={() => setStep('version')} className={step === 'version' ? 'text-white font-medium' : 'hover:text-slate-300 transition-colors'}>{selType.name}</button></>}
            {selVersion && <><ChevronRight size={10} /><button onClick={() => setStep('build')} className={step === 'build' ? 'text-white font-medium' : 'hover:text-slate-300 transition-colors'}>{selVersion}</button></>}
            {selBuild && <><ChevronRight size={10} /><span className={step === 'confirm' ? 'text-white font-medium' : ''}>Build {selBuild}</span></>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step: Type ── */}
          {step === 'type' && (
            <div className="space-y-4">
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filtrer les types..."
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
              {typesLoading && <p className="text-muted text-sm text-center py-8">Chargement des types MCJars...</p>}
              {typesError && <p className="text-red-400 text-sm text-center py-8">Impossible de joindre l'API MCJars.</p>}
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">{cat}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleTypes.filter(t => t.category === cat).map(t => (
                      <button key={t.type} onClick={() => pickType(t)}
                        className="flex items-center gap-2.5 p-3 rounded-xl text-left border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/[0.06] transition-all group">
                        <img src={t.icon} alt="" className="w-8 h-8 rounded-lg shrink-0 bg-white/5"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate group-hover:text-blue-300 transition-colors">{t.name}</p>
                          <p className="text-slate-600 text-[10px] font-mono truncate">{t.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Step: Version ── */}
          {step === 'version' && (
            <div>
              {versionsLoading ? (
                <p className="text-muted text-sm text-center py-8">Chargement des versions...</p>
              ) : versions.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">Aucune version disponible.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {versions.map(v => (
                    <button key={v} onClick={() => pickVersion(v)}
                      className="px-3 py-2.5 rounded-xl border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/[0.06] text-slate-200 text-sm font-mono text-center transition-all hover:text-blue-300">
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Build ── */}
          {step === 'build' && (
            <div>
              {buildsLoading ? (
                <p className="text-muted text-sm text-center py-8">Chargement des builds...</p>
              ) : builds.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">Aucun build disponible.</p>
              ) : (
                <div className="space-y-1.5">
                  {builds.map((b, i) => (
                    <button key={b.id} onClick={() => pickBuild(b.build)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/[0.06] transition-all text-left">
                      <span className="text-white text-sm font-mono">Build #{b.build}</span>
                      {i === 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Latest</span>}
                      {b.created && <span className="text-slate-600 text-xs ml-auto">{new Date(b.created).toLocaleDateString('fr-FR')}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Confirm ── */}
          {step === 'confirm' && selType && selVersion && selBuild && (
            <div className="space-y-4">
              <div className="bg-black/20 border border-white/[0.06] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <img src={selType.icon} alt="" className="w-10 h-10 rounded-xl bg-white/5"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  <div>
                    <p className="text-white font-semibold">{selType.name} {selVersion}</p>
                    <p className="text-slate-500 text-sm">Build #{selBuild}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.1] cursor-pointer transition-colors">
                  <input type="checkbox" checked={eula} onChange={e => setEula(e.target.checked)} className="w-4 h-4 accent-blue-500 shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium">Accepter le EULA Minecraft</p>
                    <p className="text-slate-500 text-xs">Crée automatiquement <code className="font-mono">eula.txt</code> avec <code className="font-mono">eula=true</code></p>
                  </div>
                </label>

                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 hover:border-red-500/30 cursor-pointer transition-colors">
                  <input type="checkbox" checked={wipe} onChange={e => setWipe(e.target.checked)} className="w-4 h-4 accent-red-500 shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium">Supprimer les fichiers existants</p>
                    <p className="text-red-400 text-xs">Efface tous les fichiers du serveur avant l'installation</p>
                  </div>
                </label>
              </div>

              {installMutation.isError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="shrink-0" />
                  {(installMutation.error as any)?.message ?? 'Erreur lors de l\'installation'}
                </div>
              )}

              {installMutation.isSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm bg-green-950/50 border border-green-800/50 rounded-xl px-4 py-3">
                  <CheckCircle2 size={14} className="shrink-0" />
                  Installation lancée avec succès.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'confirm' && (
          <div className="flex justify-between items-center px-5 py-4 border-t border-white/[0.06] shrink-0">
            <button onClick={() => setStep('build')} className="text-muted hover:text-white text-sm transition-colors">
              ← Retour
            </button>
            <button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending || installMutation.isSuccess}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              {installMutation.isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installation...</>
                : <><RotateCcw size={14} /> Installer {selType?.name} {selVersion}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
