import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, wsUrl } from '../../lib/api'
import {
  ChevronLeft, Play, RotateCcw, Square, Zap,
  Send, Loader2, CheckCircle2,
} from 'lucide-react'
import FileManagerTab from './FileManagerTab'

interface ServerDetail {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  nodeId: string; nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null; userId: string
}

interface WingsStats {
  cpu_absolute: number; memory_bytes: number; memory_limit_bytes: number
  disk_bytes: number; network?: { rx_bytes: number; tx_bytes: number }; uptime?: number
}

type ServerStatus = 'offline' | 'online' | 'starting' | 'stopping'

type Tab =
  | 'console' | 'files' | 'databases' | 'schedules'
  | 'users' | 'backups' | 'network' | 'startup' | 'settings' | 'activity'

const TABS: { key: Tab; label: string }[] = [
  { key: 'console',   label: 'Console' },
  { key: 'files',     label: 'File managers' },
  { key: 'databases', label: 'Databases' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'users',     label: 'Users' },
  { key: 'backups',   label: 'Backups' },
  { key: 'network',   label: 'Network' },
  { key: 'startup',   label: 'Startup' },
  { key: 'settings',  label: 'Settings' },
  { key: 'activity',  label: 'Activity' },
]

const STATUS_DOT: Record<ServerStatus, string> = {
  offline: 'bg-gray-500', online: 'bg-online', starting: 'bg-blue-400', stopping: 'bg-yellow-400',
}
const STATUS_TEXT: Record<ServerStatus, string> = {
  offline: 'text-gray-400', online: 'text-online', starting: 'text-blue-400', stopping: 'text-yellow-400',
}

const ANSI_STRIP = /\x1B\[[0-9;]*[mGKHF]/g

function fmtGiB(bytes: number) { return (bytes / 1073741824).toFixed(2) + ' GiB' }
function fmtMiB(mib: number) { return (mib / 1024).toFixed(2) + ' GiB' }

// ── Startup tab ───────────────────────────────────────────────────────────────
interface StartupData {
  startupCommand: string; startupPreview: string; dockerImage: string
  dockerImages: Record<string, string>
  variables: {
    id: string; name: string | null; envVariable: string | null
    description: string | null; value: string; defaultValue: string | null
    userEditable: boolean | null
  }[]
}

function StartupTab({ server }: { server: ServerDetail }) {
  const queryClient = useQueryClient()
  const qKey = ['client', 'servers', server.id, 'startup']
  const { data, isLoading } = useQuery<StartupData>({
    queryKey: qKey,
    queryFn: () => api.get(`/client/servers/${server.id}/startup`),
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imgSaved, setImgSaved] = useState(false)
  const [imgError, setImgError] = useState('')
  const [selectedImage, setSelectedImage] = useState('')

  useEffect(() => {
    if (data) {
      if (Object.keys(values).length === 0) {
        const init: Record<string, string> = {}
        data.variables.forEach(v => { init[v.id] = v.value })
        setValues(init)
      }
      if (!selectedImage) setSelectedImage(data.dockerImage)
    }
  }, [data])

  async function saveVar(varId: string) {
    try {
      await api.patch(`/client/servers/${server.id}/variables/${varId}`, { value: values[varId] ?? '' })
      setSaved(s => ({ ...s, [varId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [varId]: false })), 2000)
      queryClient.invalidateQueries({ queryKey: qKey })
    } catch (e: any) { setErrors(s => ({ ...s, [varId]: e.message })) }
  }

  async function saveDockerImage() {
    setImgError('')
    try {
      await api.patch(`/client/servers/${server.id}/docker-image`, { dockerImage: selectedImage })
      setImgSaved(true)
      setTimeout(() => setImgSaved(false), 2500)
      queryClient.invalidateQueries({ queryKey: qKey })
    } catch (e: any) { setImgError(e.message) }
  }

  if (isLoading) return <p className="text-muted text-sm p-6">Loading…</p>
  if (!data) return null

  return (
    <div className="p-6 space-y-4 max-w-2xl overflow-y-auto">
      {Object.entries(data.dockerImages).length > 0 && (
        <div className="ptero-panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Java Version</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.dockerImages).map(([label, image]) => (
              <button key={image} onClick={() => setSelectedImage(image)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                  selectedImage === image ? 'border-primary bg-primary/10 text-white' : 'border-white/10 text-muted hover:text-white hover:bg-white/5'
                }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${selectedImage === image ? 'bg-primary' : 'bg-gray-600'}`} />
                {label}
              </button>
            ))}
          </div>
          {imgError && <p className="text-red-400 text-xs">{imgError}</p>}
          <button onClick={saveDockerImage} disabled={selectedImage === data.dockerImage}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-white/10 text-muted hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors">
            {imgSaved ? 'Saved ✓' : 'Apply Java Version'}
          </button>
        </div>
      )}

      <div className="ptero-panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-1">Startup Command</p>
        <pre className="bg-black/40 rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all mt-3">
          {data.startupPreview}
        </pre>
      </div>

      {data.variables.length > 0 && (
        <div className="ptero-panel rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Variables</p>
          {data.variables.map(v => (
            <div key={v.id}>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">
                {v.name ?? v.envVariable}
                {!v.userEditable && <span className="ml-2 text-gray-600 normal-case">(read-only)</span>}
              </label>
              <div className="flex gap-2">
                <input value={values[v.id] ?? v.value}
                  onChange={e => { if (!v.userEditable) return; setValues(s => ({ ...s, [v.id]: e.target.value })); setErrors(s => ({ ...s, [v.id]: '' })) }}
                  readOnly={!v.userEditable}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                {v.userEditable && (
                  <button onClick={() => saveVar(v.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      saved[v.id] ? 'border-green-700 text-green-400 bg-green-950/40' : 'border-white/10 text-muted hover:text-white hover:bg-white/5'
                    }`}>
                    {saved[v.id] ? 'Saved ✓' : 'Save'}
                  </button>
                )}
              </div>
              {v.description && <p className="text-muted text-xs mt-1">{v.description}</p>}
              {errors[v.id] && <p className="text-red-400 text-xs mt-1">{errors[v.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SFTP (settings tab) ───────────────────────────────────────────────────────
function SettingsTab({ server }: { server: ServerDetail }) {
  const { data: sftp } = useQuery<{ host: string; port: number; username: string }>({
    queryKey: ['client', 'servers', server.id, 'sftp'],
    queryFn: () => api.get(`/client/servers/${server.id}/sftp`),
  })
  if (!sftp) return <div className="p-6 text-muted text-sm">Loading SFTP info…</div>
  return (
    <div className="p-6 max-w-lg overflow-y-auto">
      <div className="ptero-panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-4">SFTP Connection</p>
        {([['Host', sftp.host], ['Port', String(sftp.port)], ['Username', sftp.username], ['Password', 'Your panel password']] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
            <span className="text-muted text-sm">{label}</span>
            <span className="font-mono text-white text-sm">{value}</span>
          </div>
        ))}
        <pre className="mt-4 bg-black/40 rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto">
          {`sftp -P ${sftp.port} ${sftp.username}@${sftp.host}`}
        </pre>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ServerPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'console'

  const [lines, setLines] = useState<string[]>([])
  const [installLines, setInstallLines] = useState<string[]>([])
  const [installDone, setInstallDone] = useState(false)
  const [status, setStatus] = useState<ServerStatus>('offline')
  const [stats, setStats] = useState<WingsStats | null>(null)
  const [command, setCommand] = useState('')
  const [connected, setConnected] = useState(false)
  const [wsError, setWsError] = useState<string | null>(null)
  const [reconnectTick, setReconnectTick] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const consoleRef = useRef<HTMLDivElement>(null)
  const installRef = useRef<HTMLDivElement>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: server, isLoading } = useQuery<ServerDetail>({
    queryKey: ['client', 'servers', id],
    queryFn: () => api.get(`/client/servers/${id}`),
    enabled: !!id,
    refetchInterval: q => { const d = q.state.data as ServerDetail | undefined; return d && !d.installed ? 4000 : false },
  })

  useEffect(() => { const el = consoleRef.current; if (el) el.scrollTop = el.scrollHeight }, [lines])
  useEffect(() => { const el = installRef.current; if (el) el.scrollTop = el.scrollHeight }, [installLines])

  useEffect(() => {
    if (!id || !server || server.suspended) return
    let retryDelay = 3000, destroyed = false

    function connect() {
      if (destroyed) return
      setWsError(null); setConnected(false)
      const ws = new WebSocket(wsUrl(`/client/servers/${id}/ws`))
      wsRef.current = ws
      ws.onmessage = (e) => {
        let msg: { event: string; args: string[] }
        try { msg = JSON.parse(e.data) } catch { return }
        const { event, args } = msg
        if (event === 'connected') { retryDelay = 3000; setConnected(true) }
        else if (event === 'console output' && args[0]) setLines(p => [...p.slice(-999), args[0].replace(ANSI_STRIP, '')])
        else if (event === 'install output' && args[0]) setInstallLines(p => [...p.slice(-999), args[0].replace(ANSI_STRIP, '')])
        else if (event === 'install completed') { setInstallDone(true); queryClient.invalidateQueries({ queryKey: ['client', 'servers', id] }) }
        else if (event === 'status' && args[0]) setStatus((args[0] === 'running' ? 'online' : args[0]) as ServerStatus)
        else if (event === 'stats' && args[0]) { try { setStats(JSON.parse(args[0])) } catch {} }
      }
      ws.onerror = () => {}
      ws.onclose = (e) => {
        setConnected(false)
        if (wsRef.current === ws) wsRef.current = null
        if (e.code === 4001) { setWsError('Unauthenticated'); return }
        if (e.code === 4003) { setWsError('Access denied'); return }
        if (e.code === 4005) { setWsError('Wings rejected auth'); return }
        if (e.code === 4404) { setWsError('Server not found in Wings'); return }
        setStatus('offline')
        if (!destroyed) { retryDelay = Math.min(retryDelay * 1.5, 30000); reconnectTimerRef.current = setTimeout(connect, retryDelay) }
      }
    }
    connect()
    return () => {
      destroyed = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) { wsRef.current.close(1000); wsRef.current = null }
    }
  }, [id, server?.id, server?.suspended, reconnectTick])

  function sendCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!wsRef.current || !connected || !command.trim()) return
    wsRef.current.send(JSON.stringify({ event: 'send command', args: [command.trim()] }))
    setCommand('')
  }

  async function power(action: 'start' | 'stop' | 'restart' | 'kill') {
    await api.post(`/client/servers/${id}/power`, { action })
  }

  if (isLoading) return <div className="flex items-center justify-center h-48 text-muted text-sm">Loading...</div>

  if (!server) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-white text-sm">Server not found</p>
      <Link to="/servers" className="text-blue-400 text-xs hover:underline">← Back</Link>
    </div>
  )

  const displayAddress = `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`
  const canStart   = !connected || status === 'offline'
  const canStop    = !connected || status === 'online' || status === 'starting'
  const canRestart = !connected || status === 'online'
  const canKill    = !connected || status === 'online' || status === 'starting' || status === 'stopping'

  const statusLabel = status === 'online' ? 'Online' : status === 'starting' ? 'Starting' : status === 'stopping' ? 'Stopping' : 'Offline'

  return (
    <div className="h-full flex flex-col">

      {/* ── Header: back + title + status ── */}
      <div className="px-6 pt-5 pb-3 shrink-0">
        <Link to="/servers" className="inline-flex items-center gap-1 text-muted text-xs hover:text-white transition-colors mb-3">
          <ChevronLeft size={13} /> My Servers
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-xl font-bold leading-tight">{server.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-muted text-xs flex-wrap">
              <span className="font-mono">{displayAddress}</span>
              {server.nodeName && <><span>·</span><span>{server.nodeName}</span></>}
              {server.eggName && <><span>·</span><span>{server.eggName}</span></>}
            </div>
          </div>
          <div className={`flex items-center gap-2 text-sm font-medium ${STATUS_TEXT[status]}`}>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            {statusLabel}
          </div>
        </div>
      </div>

      {/* ── Large stat numbers ── */}
      {stats && server.installed && (
        <div className="grid grid-cols-4 gap-3 px-6 mb-3 shrink-0">
          {[
            { label: 'CPU',     value: `${stats.cpu_absolute.toFixed(1)}%`,  sub: `/ ${server.cpu === 0 ? '∞' : server.cpu + '%'}` },
            { label: 'Memory',  value: fmtGiB(stats.memory_bytes),           sub: `/ ${server.memory === 0 ? '∞' : fmtMiB(server.memory)}` },
            { label: 'Disk',    value: fmtGiB(stats.disk_bytes),             sub: '/ ∞' },
            ...(stats.network ? [{ label: 'Network', value: fmtGiB(stats.network.tx_bytes), sub: `↑ ${fmtGiB(stats.network.rx_bytes)} ↓` }] : []),
          ].map(({ label, value, sub }) => (
            <div key={label} className="ptero-panel rounded-xl px-5 py-4 text-center">
              <p className="text-white text-2xl font-bold leading-none">{value}</p>
              <p className="text-muted text-xs mt-1">{sub}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-2">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Install progress (server not yet installed) ── */}
      {!server.installed && (
        <div className="mx-6 mt-3 flex flex-col gap-3 flex-1 min-h-0 pb-4">
          <div className={`shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            installDone ? 'bg-green-950/40 border-green-800 text-green-400' : 'bg-blue-950/40 border-blue-800 text-blue-400'
          }`}>
            {installDone ? <CheckCircle2 size={15} /> : <Loader2 size={15} className="animate-spin" />}
            {installDone ? 'Installation complete — reloading…' : 'Installation in progress…'}
          </div>
          <div className="ptero-panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] shrink-0">
              <span className="text-muted text-xs uppercase tracking-wider font-medium">Install Output</span>
              {!connected && <span className="text-gray-600 text-xs ml-auto flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Connecting…</span>}
            </div>
            <div ref={installRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6]">
              {installLines.length === 0
                ? <span className="text-gray-600">Waiting for install output…</span>
                : installLines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs row ── */}
      {server.installed && (
        <div className="flex items-center border-b border-white/[0.08] px-4 overflow-x-auto shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSearchParams({ tab: key }, { replace: true })}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? 'text-white border-primary' : 'text-muted border-transparent hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Console tab: 2-column layout ── */}
      {server.installed && tab === 'console' && (
        <div className="flex gap-4 px-6 mt-4 flex-1 min-h-0 pb-4">

          {/* Left: server info + limits */}
          <div className="w-60 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="ptero-panel rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-3">Information</p>
              {[
                ['Address', displayAddress],
                ['Node', server.nodeName ?? '—'],
                ['Service', server.eggName ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="py-2 border-b border-white/[0.05] last:border-0">
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-white text-xs font-mono break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="ptero-panel rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-3">Limits</p>
              {[
                ['CPU',    server.cpu    === 0 ? 'Unlimited' : `${server.cpu}%`],
                ['Memory', server.memory === 0 ? 'Unlimited' : fmtMiB(server.memory)],
                ['Disk',   server.disk   === 0 ? 'Unlimited' : fmtMiB(server.disk)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
                  <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
                  <span className="text-white text-xs font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: power buttons + console terminal */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">

            {/* Power actions */}
            <div className="shrink-0 flex items-center gap-2 flex-wrap">
              <button onClick={() => power('start')} disabled={!canStart}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <Play size={13} /> Start
              </button>
              <button onClick={() => power('restart')} disabled={!canRestart}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <RotateCcw size={13} /> Restart
              </button>
              <button onClick={() => power('stop')} disabled={!canStop}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <Square size={13} /> Stop
              </button>
              <button onClick={() => power('kill')} disabled={!canKill}
                className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <Zap size={13} /> Kill
              </button>

              {wsError ? (
                <span className="text-red-400 text-xs flex items-center gap-1.5 ml-2">
                  {wsError}
                  <button
                    onClick={() => { setWsError(null); setReconnectTick(t => t + 1) }}
                    className="text-blue-400 hover:underline"
                  >
                    Reconnect
                  </button>
                </span>
              ) : !connected ? (
                <span className="text-muted text-xs flex items-center gap-1.5 ml-2">
                  <Loader2 size={10} className="animate-spin" /> Connecting to daemon…
                </span>
              ) : null}
            </div>

            {/* Console terminal */}
            <div className="ptero-panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
              <div
                ref={consoleRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6]"
              >
                {lines.length === 0
                  ? <span className="text-gray-600">{connected ? 'Waiting for console output…' : 'Connecting…'}</span>
                  : lines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)}
              </div>

              <form onSubmit={sendCommand} className="flex items-center border-t border-white/[0.08] px-3 py-2.5 gap-2 shrink-0">
                <span className="text-green-600 font-mono text-sm select-none">&gt;_</span>
                <input
                  type="text" value={command}
                  onChange={e => setCommand(e.target.value)}
                  disabled={!connected || status === 'offline'}
                  placeholder={!connected ? 'Connecting…' : status === 'offline' ? 'Server is offline' : 'Type a command…'}
                  className="flex-1 bg-transparent text-sm font-mono text-white placeholder-gray-600 outline-none disabled:opacity-40"
                />
                <button type="submit" disabled={!connected || !command.trim() || status === 'offline'}
                  className="p-1.5 text-muted hover:text-white disabled:opacity-30 transition-colors">
                  <Send size={13} />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ── Files tab ── */}
      {server.installed && tab === 'files' && (
        <div className="mx-6 mt-4 flex-1 min-h-0 pb-4">
          <FileManagerTab serverId={server.id} />
        </div>
      )}

      {/* ── Startup tab ── */}
      {server.installed && tab === 'startup' && (
        <div className="flex-1 overflow-y-auto">
          <StartupTab server={server} />
        </div>
      )}

      {/* ── Settings tab ── */}
      {server.installed && tab === 'settings' && (
        <div className="flex-1 overflow-y-auto">
          <SettingsTab server={server} />
        </div>
      )}

      {/* ── Coming soon tabs ── */}
      {server.installed && !['console', 'files', 'startup', 'settings'].includes(tab) && (
        <div className="flex items-center justify-center mx-6 mt-4 ptero-panel rounded-xl shrink-0" style={{ height: '160px' }}>
          <p className="text-muted text-sm">{TABS.find(t => t.key === tab)?.label} — Coming soon</p>
        </div>
      )}

    </div>
  )
}
