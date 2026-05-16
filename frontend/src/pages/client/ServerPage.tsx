import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, wsUrl } from '../../lib/api'
import {
  ChevronLeft, Play, RotateCcw, Square, Zap,
  Send, Loader2, CheckCircle2, Cpu, MemoryStick, HardDrive, Wifi,
} from 'lucide-react'
import FileManagerTab from './FileManagerTab'
import DatabasesTab from './DatabasesTab'
import BackupsTab from './BackupsTab'
import SchedulesTab from './SchedulesTab'
import SubUsersTab from './SubUsersTab'
import NetworkTab from './NetworkTab'
import ActivityTab from './ActivityTab'

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
  { key: 'files',     label: 'Files' },
  { key: 'databases', label: 'Databases' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'users',     label: 'Users' },
  { key: 'backups',   label: 'Backups' },
  { key: 'network',   label: 'Network' },
  { key: 'startup',   label: 'Startup' },
  { key: 'settings',  label: 'Settings' },
  { key: 'activity',  label: 'Activity' },
]

const STATUS_CFG: Record<ServerStatus, { dot: string; badge: string; label: string }> = {
  online:   { dot: 'bg-green-400 pulse-dot', badge: 'bg-green-500/[0.12] text-green-400 border-green-500/25', label: 'Online' },
  starting: { dot: 'bg-blue-400 animate-pulse', badge: 'bg-blue-500/[0.12] text-blue-400 border-blue-500/25', label: 'Starting' },
  stopping: { dot: 'bg-yellow-400 animate-pulse', badge: 'bg-yellow-500/[0.12] text-yellow-400 border-yellow-500/25', label: 'Stopping' },
  offline:  { dot: 'bg-slate-600', badge: 'bg-white/[0.06] text-slate-400 border-white/[0.08]', label: 'Offline' },
}

const ANSI_STRIP = /\x1B\[[0-9;]*[mGKHF]/g

function fmtGiB(bytes: number) { return (bytes / 1073741824).toFixed(2) }
function fmtMiB(mib: number)   { return (mib / 1024).toFixed(1) + ' GiB' }

// ── Stat card with progress bar ────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, unit, limit, percent, color,
}: {
  icon: React.ElementType; label: string; value: string; unit?: string
  limit: string; percent: number; color: string
}) {
  return (
    <div className="panel rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Icon size={13} />
          <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <span className="text-[11px] text-slate-600 font-mono">{limit}</span>
      </div>
      <div>
        <p className="text-white font-bold text-xl font-mono leading-none">
          {value}<span className="text-slate-500 text-sm font-normal ml-1">{unit}</span>
        </p>
      </div>
      <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  )
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

  if (isLoading) return <p className="text-slate-500 text-sm p-6">Loading…</p>
  if (!data) return null

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      {Object.entries(data.dockerImages).length > 0 && (
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Docker Image</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.dockerImages).map(([label, image]) => (
              <button key={image} onClick={() => setSelectedImage(image)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                  selectedImage === image
                    ? 'border-blue-500/30 bg-blue-500/[0.10] text-blue-300'
                    : 'border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedImage === image ? 'bg-blue-400' : 'bg-slate-600'}`} />
                {label}
              </button>
            ))}
          </div>
          {imgError && <p className="text-red-400 text-xs">{imgError}</p>}
          <button onClick={saveDockerImage} disabled={selectedImage === data.dockerImage}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] disabled:opacity-40 transition-all">
            {imgSaved ? 'Saved ✓' : 'Apply Image'}
          </button>
        </div>
      )}

      <div className="panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-3">Startup Command</p>
        <pre className="bg-black/40 rounded-lg px-4 py-3 text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {data.startupPreview}
        </pre>
      </div>

      {data.variables.length > 0 && (
        <div className="panel rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Variables</p>
          {data.variables.map(v => (
            <div key={v.id}>
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-wider">
                {v.name ?? v.envVariable}
                {!v.userEditable && <span className="ml-2 text-slate-700 normal-case">(read-only)</span>}
              </label>
              <div className="flex gap-2">
                <input value={values[v.id] ?? v.value}
                  onChange={e => { if (!v.userEditable) return; setValues(s => ({ ...s, [v.id]: e.target.value })); setErrors(s => ({ ...s, [v.id]: '' })) }}
                  readOnly={!v.userEditable}
                  className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors" />
                {v.userEditable && (
                  <button onClick={() => saveVar(v.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                      saved[v.id]
                        ? 'border-green-700 text-green-400 bg-green-950/40'
                        : 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                    }`}>
                    {saved[v.id] ? 'Saved ✓' : 'Save'}
                  </button>
                )}
              </div>
              {v.description && <p className="text-slate-600 text-xs mt-1">{v.description}</p>}
              {errors[v.id] && <p className="text-red-400 text-xs mt-1">{errors[v.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings (SFTP) tab ────────────────────────────────────────────────────────
function SettingsTab({ server }: { server: ServerDetail }) {
  const { data: sftp } = useQuery<{ host: string; port: number; username: string }>({
    queryKey: ['client', 'servers', server.id, 'sftp'],
    queryFn: () => api.get(`/client/servers/${server.id}/sftp`),
  })
  if (!sftp) return <div className="p-6 text-slate-500 text-sm">Loading…</div>
  return (
    <div className="p-6 max-w-lg">
      <div className="panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-4">SFTP Details</p>
        {([['Host', sftp.host], ['Port', String(sftp.port)], ['Username', sftp.username], ['Password', 'Your panel password']] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
            <span className="text-slate-500 text-sm">{label}</span>
            <span className="font-mono text-slate-200 text-sm">{value}</span>
          </div>
        ))}
        <pre className="mt-4 bg-black/40 rounded-lg px-4 py-3 text-emerald-300 text-xs font-mono overflow-x-auto">
          {`sftp -P ${sftp.port} ${sftp.username}@${sftp.host}`}
        </pre>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={20} className="text-slate-600 animate-spin" />
    </div>
  )

  if (!server) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-slate-300 text-sm">Server not found</p>
      <Link to="/servers" className="text-blue-400 text-xs hover:underline">← Back to servers</Link>
    </div>
  )

  const displayAddress = `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`
  const cfg = STATUS_CFG[status]
  const canStart   = !connected || status === 'offline'
  const canStop    = !connected || status === 'online' || status === 'starting'
  const canRestart = !connected || status === 'online'
  const canKill    = !connected || ['online', 'starting', 'stopping'].includes(status)

  // Compute stat percentages
  const cpuPercent  = stats ? Math.min(stats.cpu_absolute, 100) : 0
  const ramPercent  = stats && server.memory > 0 ? (stats.memory_bytes / (server.memory * 1048576)) * 100 : stats ? 50 : 0
  const diskPercent = stats && server.disk > 0 ? (stats.disk_bytes / (server.disk * 1073741824)) * 100 : stats ? 30 : 0

  return (
    <div className="h-full flex flex-col">

      {/* ── Server header ── */}
      <div className="px-6 pt-5 pb-4 shrink-0">
        <Link to="/servers" className="inline-flex items-center gap-1.5 text-slate-600 text-xs hover:text-slate-300 transition-colors mb-4">
          <ChevronLeft size={12} /> Back to servers
        </Link>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-xl font-bold">{server.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="font-mono text-slate-400">{displayAddress}</span>
              {server.nodeName && <><span className="text-slate-700">·</span><span>{server.nodeName}</span></>}
              {server.eggName  && <><span className="text-slate-700">·</span><span>{server.eggName}</span></>}
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {stats && server.installed && (
        <div className="grid grid-cols-4 gap-3 px-6 mb-4 shrink-0">
          <StatCard
            icon={Cpu} label="CPU"
            value={stats.cpu_absolute.toFixed(1)} unit="%"
            limit={server.cpu === 0 ? '/ ∞' : `/ ${server.cpu}%`}
            percent={cpuPercent}
            color="bg-blue-500"
          />
          <StatCard
            icon={MemoryStick} label="Memory"
            value={fmtGiB(stats.memory_bytes)} unit="GiB"
            limit={server.memory === 0 ? '/ ∞' : `/ ${fmtMiB(server.memory)}`}
            percent={ramPercent}
            color="bg-violet-500"
          />
          <StatCard
            icon={HardDrive} label="Disk"
            value={fmtGiB(stats.disk_bytes)} unit="GiB"
            limit={server.disk === 0 ? '/ ∞' : `/ ${fmtMiB(server.disk)}`}
            percent={diskPercent}
            color="bg-emerald-500"
          />
          {stats.network && (
            <StatCard
              icon={Wifi} label="Network"
              value={fmtGiB(stats.network.tx_bytes)} unit="GiB"
              limit={`↓ ${fmtGiB(stats.network.rx_bytes)}`}
              percent={0}
              color="bg-cyan-500"
            />
          )}
        </div>
      )}

      {/* ── Installing state ── */}
      {!server.installed && (
        <div className="mx-6 mt-2 flex flex-col gap-3 flex-1 min-h-0 pb-4">
          <div className={`shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            installDone
              ? 'bg-green-500/[0.10] border-green-500/25 text-green-400'
              : 'bg-blue-500/[0.10] border-blue-500/25 text-blue-400'
          }`}>
            {installDone ? <CheckCircle2 size={15} /> : <Loader2 size={15} className="animate-spin" />}
            {installDone ? 'Installation complete — reloading…' : 'Installation in progress…'}
          </div>
          <div className="panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05] shrink-0">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Install Log</span>
              {!connected && (
                <span className="ml-auto text-slate-700 text-xs flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" /> Connecting…
                </span>
              )}
            </div>
            <div ref={installRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs text-emerald-300 leading-[1.7]">
              {installLines.length === 0
                ? <span className="text-slate-700">Waiting for install output…</span>
                : installLines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      {server.installed && (
        <div className="flex items-center border-b border-white/[0.06] px-4 overflow-x-auto shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSearchParams({ tab: key }, { replace: true })}
              className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                tab === key
                  ? 'text-blue-300 border-blue-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══ CONSOLE TAB — 2-column ═══════════════════════════════════════════ */}
      {server.installed && tab === 'console' && (
        <div className="flex gap-4 px-6 mt-4 flex-1 min-h-0 pb-4">

          {/* Left column: info + limits */}
          <div className="w-56 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="panel rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-3">Information</p>
              {[
                ['Address', displayAddress],
                ['Node',    server.nodeName ?? '—'],
                ['Service', server.eggName  ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="py-2 border-b border-white/[0.05] last:border-0">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-slate-200 text-xs font-mono break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="panel rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-3">Limits</p>
              {[
                ['CPU',    server.cpu    === 0 ? 'Unlimited' : `${server.cpu}%`],
                ['Memory', server.memory === 0 ? 'Unlimited' : fmtMiB(server.memory)],
                ['Disk',   server.disk   === 0 ? 'Unlimited' : fmtMiB(server.disk)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</span>
                  <span className="text-slate-300 text-xs font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: power + terminal */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">

            {/* Power actions */}
            <div className="shrink-0 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => power('start')} disabled={!canStart}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
              >
                <Play size={13} /> Start
              </button>
              <button
                onClick={() => power('restart')} disabled={!canRestart}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
              >
                <RotateCcw size={13} /> Restart
              </button>
              <button
                onClick={() => power('stop')} disabled={!canStop}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 text-slate-200 text-sm font-semibold rounded-lg border border-white/[0.08] transition-all"
              >
                <Square size={13} /> Stop
              </button>
              <button
                onClick={() => power('kill')} disabled={!canKill}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
              >
                <Zap size={13} /> Kill
              </button>

              <div className="ml-auto flex items-center gap-2">
                {wsError ? (
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    {wsError}
                    <button
                      onClick={() => { setWsError(null); setReconnectTick(t => t + 1) }}
                      className="text-blue-400 hover:underline"
                    >
                      Retry
                    </button>
                  </span>
                ) : !connected ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Loader2 size={10} className="animate-spin" /> Connecting…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot" /> Connected
                  </span>
                )}
              </div>
            </div>

            {/* Terminal */}
            <div className="panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0" style={{ background: 'rgba(2,5,14,0.90)' }}>
              {/* Terminal header */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.05] shrink-0">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <span className="text-slate-700 text-[11px] ml-2 font-mono">console</span>
              </div>

              {/* Output */}
              <div
                ref={consoleRef}
                className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs text-emerald-300 leading-[1.7]"
              >
                {lines.length === 0 ? (
                  <span className="text-slate-700">
                    {connected ? 'Waiting for output…' : 'Connecting to daemon…'}
                  </span>
                ) : (
                  lines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>)
                )}
              </div>

              {/* Command input */}
              <form
                onSubmit={sendCommand}
                className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-2.5 shrink-0"
              >
                <span className="text-emerald-600 font-mono text-sm select-none shrink-0">&gt;_</span>
                <input
                  type="text"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  disabled={!connected || status === 'offline'}
                  placeholder={
                    !connected ? 'Connecting…'
                    : status === 'offline' ? 'Server is offline'
                    : 'Enter a command…'
                  }
                  className="flex-1 bg-transparent text-sm font-mono text-slate-200 placeholder-slate-700 outline-none disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!connected || !command.trim() || status === 'offline'}
                  className="p-1.5 text-slate-600 hover:text-slate-300 disabled:opacity-30 transition-colors shrink-0"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ FILES TAB ═════════════════════════════════════════════════════════ */}
      {server.installed && tab === 'files' && (
        <div className="mx-6 mt-4 flex-1 min-h-0 pb-4">
          <FileManagerTab serverId={server.id} />
        </div>
      )}

      {/* ══ STARTUP TAB ══════════════════════════════════════════════════════ */}
      {server.installed && tab === 'startup' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StartupTab server={server} />
        </div>
      )}

      {/* ══ SETTINGS TAB ═════════════════════════════════════════════════════ */}
      {server.installed && tab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SettingsTab server={server} />
        </div>
      )}

      {/* ══ DATABASES TAB ════════════════════════════════════════════════════ */}
      {server.installed && tab === 'databases' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <DatabasesTab serverId={server.id} />
        </div>
      )}

      {/* ══ BACKUPS TAB ══════════════════════════════════════════════════════ */}
      {server.installed && tab === 'backups' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <BackupsTab serverId={server.id} />
        </div>
      )}

      {/* ══ SCHEDULES TAB ════════════════════════════════════════════════════ */}
      {server.installed && tab === 'schedules' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <SchedulesTab serverId={server.id} />
        </div>
      )}

      {/* ══ USERS TAB ════════════════════════════════════════════════════════ */}
      {server.installed && tab === 'users' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <SubUsersTab serverId={server.id} />
        </div>
      )}

      {/* ══ NETWORK TAB ══════════════════════════════════════════════════════ */}
      {server.installed && tab === 'network' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <NetworkTab serverId={server.id} />
        </div>
      )}

      {/* ══ ACTIVITY TAB ═════════════════════════════════════════════════════ */}
      {server.installed && tab === 'activity' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <ActivityTab serverId={server.id} />
        </div>
      )}

    </div>
  )
}
