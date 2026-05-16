import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Search, Download, CheckCircle2, AlertCircle, Package, Puzzle } from 'lucide-react'

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

function PluginCard({
  plugin, serverId, folder, loader,
}: { plugin: PluginResult; serverId: string; folder: string; loader?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const install = useMutation({
    mutationFn: () => api.post(`/client/servers/${serverId}/plugins/install`, {
      source: plugin.source,
      ...(plugin.source === 'spiget' ? { resourceId: plugin.id } : { projectId: plugin.id }),
      loader,
      folder,
    }),
    onMutate: () => { setState('loading'); setErrMsg('') },
    onSuccess: () => setState('done'),
    onError: (e: any) => { setState('error'); setErrMsg(e.message ?? 'Install failed') },
  })

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
          {state === 'done'    ? <><CheckCircle2 size={12} /> Installed</> :
           state === 'error'   ? <><AlertCircle  size={12} /> Retry</>    :
           state === 'loading' ? 'Installing…' :
                                 <><Download size={12} /> Install</>}
        </button>
      </div>

      {state === 'error' && errMsg && (
        <p className="text-red-400 text-[11px] leading-relaxed">{errMsg}</p>
      )}
    </div>
  )
}

export default function PluginsTab({ serverId, folder, sources, loader }: Props) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'spiget' | 'modrinth'>(sources[0])
  const [results, setResults] = useState<PluginResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQuery = useRef('')

  async function doSearch(q: string, src: 'spiget' | 'modrinth') {
    if (!q.trim()) return
    lastQuery.current = q
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
      {/* Search bar */}
      <div className="px-6 pt-6 pb-4 shrink-0 space-y-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full bg-black/30 border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Source tabs */}
        {sources.length > 1 && (
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
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        ) : results === null ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Icon size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">Search for {label.toLowerCase()}</p>
              <p className="text-slate-600 text-xs mt-1">Type a name above to find {label.toLowerCase()} to install</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Icon size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No results found</p>
              <p className="text-slate-600 text-xs mt-1">Try a different search term or source</p>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
