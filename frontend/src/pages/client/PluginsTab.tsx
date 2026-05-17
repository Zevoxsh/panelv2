import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Search, Download, CheckCircle2, AlertCircle, Package, Puzzle, Trash2, RefreshCw } from 'lucide-react'

interface PluginResult {
  id: string
  name: string
  description: string
  downloads: number
  version: string
  author: string
  iconUrl: string
  source: 'spiget' | 'modrinth'
}

interface InstallResult {
  ok: boolean
  fileName: string
  versionNumber?: string
  gameVersions?: string[]
}

interface InstalledFile {
  name: string
  size: number
  modified: string
}

interface Props {
  serverId: string
  folder: 'plugins' | 'mods'
  sources: ('spiget' | 'modrinth')[]
  loader?: string
}

function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function useGameVersion(serverId: string) {
  const [gameVersion, setGameVersion] = useState<string | undefined>()
  useEffect(() => {
    api.get<{ variables: { envVariable: string | null; value: string }[] }>(
      `/client/servers/${serverId}/startup`,
    ).then(data => {
      const v = data.variables.find(v =>
        /minecraft.version|mc.version|server.version/i.test(v.envVariable ?? ''),
      )
      if (v?.value && /^\d+\.\d+/.test(v.value)) setGameVersion(v.value)
    }).catch(() => {})
  }, [serverId])
  return gameVersion
}

function PluginCard({
  plugin, serverId, folder, loader, gameVersion,
}: { plugin: PluginResult; serverId: string; folder: string; loader?: string; gameVersion?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [installed, setInstalled] = useState<InstallResult | null>(null)

  const install = useMutation({
    mutationFn: () => api.post<InstallResult>(`/client/servers/${serverId}/plugins/install`, {
      source: plugin.source,
      ...(plugin.source === 'spiget' ? { resourceId: plugin.id } : { projectId: plugin.id }),
      loader,
      gameVersion,
      folder,
    }),
    onMutate: () => { setState('loading'); setErrMsg('') },
    onSuccess: (res) => { setState('done'); setInstalled(res) },
    onError: (e: any) => { setState('error'); setErrMsg(e.message ?? 'Install failed') },
  })

  const versionMismatch = installed?.gameVersions?.length
    && gameVersion
    && !installed.gameVersions.some(v => v.startsWith(gameVersion.split('.').slice(0, 2).join('.')))

  return (
    <div className="panel rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-white/[0.07] shrink-0 flex items-center justify-center">
          {plugin.iconUrl ? (
            <img src={plugin.iconUrl} alt="" className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <Package size={18} className="text-slate-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{plugin.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {plugin.author && <span className="text-slate-600 text-xs">{plugin.author}</span>}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              plugin.source === 'spiget'
                ? 'bg-orange-500/[0.10] text-orange-400 border-orange-500/20'
                : 'bg-emerald-500/[0.10] text-emerald-400 border-emerald-500/20'
            }`}>
              {plugin.source === 'spiget' ? 'SpigotMC' : 'Modrinth'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 flex-1">{plugin.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Download size={11} />
          <span>{fmtDownloads(plugin.downloads)}</span>
          {plugin.version && <span className="text-slate-700">v{plugin.version}</span>}
        </div>

        <button
          onClick={() => install.mutate()}
          disabled={state === 'loading' || state === 'done'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
            state === 'done'
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : state === 'error'
              ? 'bg-red-600/20 text-red-400 border border-red-600/30'
              : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white'
          }`}
        >
          {state === 'done'    ? <><CheckCircle2 size={12} /> Installé</> :
           state === 'error'   ? <><AlertCircle  size={12} /> Réessayer</>    :
           state === 'loading' ? 'Installation…' :
                                 <><Download size={12} /> Installer</>}
        </button>
      </div>

      {/* Post-install info */}
      {state === 'done' && installed && (
        <div className="space-y-1">
          {installed.versionNumber && (
            <p className="text-[11px] text-slate-500">
              Installé <span className="text-slate-300">v{installed.versionNumber}</span>
              {installed.gameVersions?.length ? (
                <> — MC <span className="text-slate-300">{installed.gameVersions.slice(-3).join(', ')}{installed.gameVersions.length > 3 ? '…' : ''}</span></>
              ) : null}
            </p>
          )}
          {versionMismatch && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertCircle size={11} />
              Peut ne pas être compatible avec votre serveur ({gameVersion})
            </p>
          )}
        </div>
      )}

      {state === 'error' && errMsg && (
        <p className="text-red-400 text-[11px] leading-relaxed">{errMsg}</p>
      )}
    </div>
  )
}

function InstalledRow({ file, onDelete, deleting }: {
  file: InstalledFile; onDelete: () => void; deleting: boolean
}) {
  const [confirm, setConfirm] = useState(false)

  function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    onDelete()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl panel border border-white/[0.06]">
      <Package size={14} className="text-slate-500 shrink-0" />
      <p className="flex-1 text-sm text-slate-200 font-mono truncate">{file.name}</p>
      <span className="text-[11px] text-slate-600 shrink-0">{fmtSize(file.size)}</span>
      <button
        onClick={handleDelete}
        onBlur={() => setConfirm(false)}
        disabled={deleting}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
          confirm
            ? 'bg-red-600/20 text-red-400 border border-red-600/30'
            : 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
        } disabled:opacity-40`}
      >
        {deleting ? (
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 size={12} />
        )}
        {confirm && !deleting ? 'Confirmer' : null}
      </button>
    </div>
  )
}

export default function PluginsTab({ serverId, folder, sources, loader }: Props) {
  const [mode, setMode] = useState<'search' | 'installed'>('search')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'spiget' | 'modrinth'>(sources[0])
  const [results, setResults] = useState<PluginResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const gameVersion = useGameVersion(serverId)

  const { data: installedFiles = [], refetch: refetchInstalled, isFetching: loadingInstalled } = useQuery<InstalledFile[]>({
    queryKey: ['plugins-installed', serverId, folder],
    queryFn: async () => {
      const data: any = await api.get(`/client/servers/${serverId}/files/list?directory=${encodeURIComponent('/' + folder)}`)
      const arr: any[] = Array.isArray(data) ? data : (data?.contents ?? [])
      return arr
        .filter((f: any) => !f.directory && f.name.endsWith('.jar'))
        .map((f: any) => ({ name: f.name, size: f.size ?? 0, modified: f.modified ?? '' }))
        .sort((a: InstalledFile, b: InstalledFile) => a.name.localeCompare(b.name))
    },
    enabled: mode === 'installed',
  })

  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (fileName: string) => {
      setDeletingFile(fileName)
      return api.post(`/client/servers/${serverId}/files/delete`, { root: `/${folder}`, files: [fileName] })
    },
    onSettled: () => { setDeletingFile(null); refetchInstalled() },
  })

  async function doSearch(q: string, src: 'spiget' | 'modrinth') {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const type = folder === 'mods' ? 'mod' : 'plugin'
      const data: PluginResult[] = await api.get(
        `/client/servers/${serverId}/plugins/search?q=${encodeURIComponent(q)}&source=${src}&type=${type}`,
      )
      setResults(data)
    } catch (e: any) {
      setError(e.message ?? 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSearch(query, source)
  }

  function switchSource(s: 'spiget' | 'modrinth') {
    setSource(s)
    if (results !== null && query.trim()) doSearch(query, s)
  }

  const label = folder === 'mods' ? 'Mods' : 'Plugins'
  const Icon = folder === 'mods' ? Package : Puzzle

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <div className="flex gap-1 border-b border-white/[0.06] pb-0">
          {(['search', 'installed'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                mode === m
                  ? 'text-white border-blue-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {m === 'search' ? 'Rechercher' : `Installés`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search mode ── */}
      {mode === 'search' && (
        <>
          <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Rechercher des ${label.toLowerCase()}…`}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all"
              >
                {loading ? 'Recherche…' : 'Rechercher'}
              </button>
            </form>

            <div className="flex items-center justify-between">
              {sources.length > 1 ? (
                <div className="flex gap-1">
                  {sources.map(s => (
                    <button
                      key={s}
                      onClick={() => switchSource(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        source === s
                          ? 'bg-blue-500/[0.14] text-blue-300 border-blue-500/25'
                          : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      {s === 'spiget' ? 'SpigotMC' : 'Modrinth'}
                    </button>
                  ))}
                </div>
              ) : <div />}
              {gameVersion && (
                <span className="text-[11px] text-slate-600">MC {gameVersion}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {error ? (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            ) : results === null ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                  <Icon size={32} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">Rechercher des {label.toLowerCase()}</p>
                  <p className="text-slate-600 text-xs mt-1">Tapez un nom ci-dessus pour trouver des {label.toLowerCase()} à installer</p>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Icon size={32} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">Aucun résultat</p>
                  <p className="text-slate-600 text-xs mt-1">Essayez un autre terme ou une autre source</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {results.map(p => (
                  <PluginCard
                    key={`${p.source}-${p.id}`}
                    plugin={p}
                    serverId={serverId}
                    folder={folder}
                    loader={loader}
                    gameVersion={gameVersion}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Installed mode ── */}
      {mode === 'installed' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-500 text-xs">
              {installedFiles.length} fichier{installedFiles.length !== 1 ? 's' : ''} dans /{folder}
            </p>
            <button
              onClick={() => refetchInstalled()}
              disabled={loadingInstalled}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              <RefreshCw size={11} className={loadingInstalled ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>

          {loadingInstalled && installedFiles.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : installedFiles.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Icon size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Aucun {label.toLowerCase()} installé</p>
                <p className="text-slate-600 text-xs mt-1">Le dossier /{folder} est vide</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {installedFiles.map(f => (
                <InstalledRow
                  key={f.name}
                  file={f}
                  onDelete={() => deleteMutation.mutate(f.name)}
                  deleting={deletingFile === f.name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
