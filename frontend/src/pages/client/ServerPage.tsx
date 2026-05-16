import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, wsUrl } from '../../lib/api'
import {
  ChevronLeft, Play, RotateCcw, Square,
  Send, Loader2, CheckCircle2, ExternalLink,
} from 'lucide-react'
import FileManagerTab from './FileManagerTab'

interface ServerDetail {
  id: string; name: string; description: string | null
  memory: number; disk: number; cpu: number
  installed: boolean; suspended: boolean
  nodeId: string; nodeName: string | null; nodeFqdn: string | null
  allocationIp: string | null; allocationPort: number | null; allocationIpAlias: string | null
  eggName: string | null
  userId: string
}

interface SftpInfo { host: string; port: number; username: string }

interface WingsStats {
  cpu_absolute: number
  memory_bytes: number
  memory_limit_bytes: number
  disk_bytes: number
  network?: { rx_bytes: number; tx_bytes: number }
  uptime?: number
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

const IMPLEMENTED_TABS = new Set<Tab>(['console', 'files', 'startup'])

const STATUS_COLOR: Record<ServerStatus, string> = {
  offline:  'text-gray-400',
  online:   'text-online',
  starting: 'text-blue-400',
  stopping: 'text-yellow-400',
}

const ANSI_STRIP = /\x1B\[[0-9;]*[mGKHF]/g

function fmtGiB(bytes: number) {
  return (bytes / 1073741824).toFixed(2) + ' GiB'
}

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

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
    <div className="p-6 space-y-5 max-w-2xl">
      {Object.entries(data.dockerImages).length > 0 && (
        <div className="ptero-panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Java Version</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.dockerImages).map(([label, image]) => (
              <button
                key={image}
                onClick={() => setSelectedImage(image)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                  selectedImage === image
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/10 text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${selectedImage === image ? 'bg-primary' : 'bg-gray-600'}`} />
                {label}
              </button>
            ))}
          </div>
          {imgError && <p className="text-red-400 text-xs">{imgError}</p>}
          <button
            onClick={saveDockerImage}
            disabled={selectedImage === data.dockerImage}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-white/10 text-muted hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            {imgSaved ? 'Saved ✓' : 'Apply Java Version'}
          </button>
        </div>
      )}

      <div className="ptero-panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-1">Startup Command</p>
        <p className="text-muted text-xs mb-3">Variables substituted with your current values.</p>
        <pre className="bg-black/40 rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
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
                {!v.userEditable && <span className="ml-2 text-gray-600 normal-case tracking-normal">(read-only)</span>}
              </label>
              <div className="flex gap-2">
                <input
                  value={values[v.id] ?? v.value}
                  onChange={e => {
                    if (!v.userEditable) return
                    setValues(s => ({ ...s, [v.id]: e.target.value }))
                    setErrors(s => ({ ...s, [v.id]: '' }))
                  }}
                  readOnly={!v.userEditable}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
                {v.userEditable && (
                  <button
                    onClick={() => saveVar(v.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      saved[v.id]
                        ? 'border-green-700 text-green-400 bg-green-950/40'
                        : 'border-white/10 text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
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

// ── SFTP info (shown in Settings placeholder) ─────────────────────────────────
function SftpInfo({ server }: { server: ServerDetail }) {
  const { data: sftp } = useQuery<SftpInfo>({
    queryKey: ['client', 'servers', server.id, 'sftp'],
    queryFn: () => api.get(`/client/servers/${server.id}/sftp`),
  })
  if (!sftp) return null
  return (
    <div className="ptero-panel rounded-xl p-5 max-w-lg">
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
  )
}

// ── Coming soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-muted text-sm">
      {label} — Coming soon
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ServerPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('console')

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
    refetchInterval: (query) => {
      const data = query.state.data as ServerDetail | undefined
      return data && !data.installed ? 4000 : false
    },
  })

  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  useEffect(() => {
    const el = installRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [installLines])

  useEffect(() => {
    if (!id || !server || server?.suspended) return
    let retryDelay = 3000
    let destroyed = false

    function connect() {
      if (destroyed) return
      const url = wsUrl(`/client/servers/${id}/ws`)
      setWsError(null); setConnected(false)
      const ws = new WebSocket(url)
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-muted text-sm">Loading...</div>
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-white text-sm">Server not found</p>
        <Link to="/servers" className="text-primary text-xs hover:underline">← Back</Link>
      </div>
    )
  }

  const displayAddress = `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`
  const knownStatus = connected
  const canStart   = !knownStatus || status === 'offline'
  const canStop    = !knownStatus || status === 'online' || status === 'starting'
  const canRestart = !knownStatus || status === 'online'

  return (
    <div className="flex flex-col min-h-full">
      {/* Top bar with search + back */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.06]">
        <Link to="/servers" className="p-1.5 text-muted hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="relative max-w-sm flex-1">
          <input
            placeholder="Search Something..."
            className="w-full bg-white/[0.06] border border-white/10 rounded-md px-4 py-1.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-0 border-b border-white/[0.06] px-4 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === key
                ? 'text-white border-primary'
                : 'text-muted border-transparent hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
        <button className="ml-auto p-3 text-muted hover:text-white transition-colors">
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Server header card */}
      <div className="mx-6 mt-4 ptero-panel rounded-xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white font-semibold text-lg">{server.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm">
            {/* Status badge */}
            <span className={`flex items-center gap-1.5 ${STATUS_COLOR[status]}`}>
              <span className="relative flex items-center justify-center">
                <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-online' : status === 'starting' ? 'bg-blue-400' : status === 'stopping' ? 'bg-yellow-400' : 'bg-gray-500'}`} />
              </span>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

            <span className="flex items-center gap-1.5 text-muted">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span className="font-mono text-xs">{displayAddress}</span>
            </span>

            <span className="flex items-center gap-1.5 text-muted">
              <span className="text-xs">#</span>
              <span className="font-mono text-xs">{server.id.slice(0, 8)}</span>
            </span>

            <span className="flex items-center gap-1.5 text-muted">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              <span className="text-xs">{server.nodeName ?? '—'}</span>
            </span>

            {stats?.uptime !== undefined && stats.uptime > 0 && (
              <span className="flex items-center gap-1.5 text-muted">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2v10l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                <span className="text-xs">{fmtUptime(stats.uptime / 1000)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Power buttons */}
        {server.installed && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => power('start')}
              disabled={!canStart}
              className="px-4 py-2 bg-primary hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              Start
            </button>
            <button
              onClick={() => power('restart')}
              disabled={!canRestart}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              Restart
            </button>
            <button
              onClick={() => power('stop')}
              disabled={!canStop}
              className="px-4 py-2 bg-danger hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      {!server.installed ? (
        /* Installation in progress */
        <div className="mx-6 mt-4 flex flex-col gap-3">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            installDone ? 'bg-green-950/40 border-green-800 text-green-400' : 'bg-blue-950/40 border-blue-800 text-blue-400'
          }`}>
            {installDone ? <CheckCircle2 size={15} /> : <Loader2 size={15} className="animate-spin" />}
            {installDone ? 'Installation complete — reloading…' : 'Installation in progress…'}
          </div>
          <div className="ptero-panel rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
              <span className="text-muted text-xs uppercase tracking-wider font-medium">Install Output</span>
              {!connected && <span className="text-gray-600 text-xs ml-auto flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Connecting…</span>}
            </div>
            <div ref={installRef} className="h-80 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6]">
              {installLines.length === 0
                ? <span className="text-gray-600">Waiting for install output…</span>
                : installLines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)}
            </div>
          </div>
        </div>
      ) : tab === 'console' ? (
        /* Console tab — 2 column layout */
        <div className="mx-6 mt-4 flex gap-4 flex-1 pb-4">
          {/* Left: server info + stats */}
          <div className="w-60 shrink-0 space-y-4">
            <div className="ptero-panel rounded-xl p-4 space-y-3">
              <p className="text-white font-medium text-sm">{server.name}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted">
                  <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-online' : 'bg-gray-500'}`} />
                  <span className={STATUS_COLOR[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
                <p className="text-muted text-xs font-mono">{displayAddress}</p>
                <p className="text-muted text-xs font-mono">#{server.id.slice(0, 8)}</p>
                <p className="text-muted text-xs">{server.nodeName ?? '—'}</p>
              </div>
            </div>

            {stats && (
              <>
                <div className="ptero-panel rounded-xl p-4">
                  <p className="text-white text-2xl font-bold">{fmtGiB(stats.memory_bytes)}</p>
                  <p className="text-muted text-xs mt-1">/ {server.memory === 0 ? '∞ ram' : fmtGiB(server.memory * 1048576)}</p>
                </div>
                <div className="ptero-panel rounded-xl p-4">
                  <p className="text-white text-2xl font-bold">{stats.cpu_absolute.toFixed(2)}%</p>
                  <p className="text-muted text-xs mt-1">/ ∞ CPU</p>
                </div>
                <div className="ptero-panel rounded-xl p-4">
                  <p className="text-white text-2xl font-bold">{fmtGiB(stats.disk_bytes)}</p>
                  <p className="text-muted text-xs mt-1">/ ∞ Disk</p>
                </div>
              </>
            )}
          </div>

          {/* Right: console */}
          <div className="flex-1 ptero-panel rounded-xl overflow-hidden flex flex-col">
            <div
              ref={consoleRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6] min-h-0"
              style={{ minHeight: '300px' }}
            >
              {lines.length === 0
                ? <span className="text-gray-600">{connected ? 'Waiting for console output…' : 'Connecting…'}</span>
                : lines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)}
            </div>

            {/* Command + power row */}
            <div className="border-t border-white/[0.06]">
              <form onSubmit={sendCommand} className="flex items-center px-3 py-2 gap-2">
                <span className="text-muted font-mono text-sm select-none">&gt;&gt;</span>
                <input
                  type="text"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  disabled={!connected || status === 'offline'}
                  placeholder="Type a command"
                  className="flex-1 bg-transparent text-sm font-mono text-white placeholder-gray-600 outline-none disabled:opacity-40"
                />
                <button onClick={() => power('start')} disabled={!canStart} className="px-3 py-1.5 bg-primary hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors">Start</button>
                <button onClick={() => power('restart')} disabled={!canRestart} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors">Restart</button>
                <button onClick={() => power('stop')} disabled={!canStop} className="px-3 py-1.5 bg-danger hover:bg-red-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors">Stop</button>
              </form>
              {wsError && (
                <div className="flex items-center gap-2 px-4 pb-2 text-xs text-red-400">
                  {wsError}
                  <button onClick={() => { setWsError(null); setReconnectTick(t => t + 1) }} className="text-primary hover:underline ml-1">Reconnect</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'files' ? (
        <div className="mx-6 mt-4 flex-1 pb-4"><FileManagerTab serverId={server.id} /></div>
      ) : tab === 'startup' ? (
        <StartupTab server={server} />
      ) : tab === 'settings' ? (
        <div className="p-6"><SftpInfo server={server} /></div>
      ) : IMPLEMENTED_TABS.has(tab) ? null : (
        <div className="mx-6 mt-4"><ComingSoon label={TABS.find(t => t.key === tab)?.label ?? tab} /></div>
      )}
    </div>
  )
}
