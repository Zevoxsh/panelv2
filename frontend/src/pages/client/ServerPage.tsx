import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, wsUrl } from '../../lib/api'
import { ansiToHtml } from '../../lib/ansi'
import {
  ChevronLeft, Play, RotateCcw, Square, Zap,
  Send, Loader2, CheckCircle2, Cpu, MemoryStick, HardDrive, Wifi,
  ShieldAlert, ExternalLink,
} from 'lucide-react'
import FileManagerTab from './FileManagerTab'
import DatabasesTab from './DatabasesTab'
import BackupsTab from './BackupsTab'
import SchedulesTab from './SchedulesTab'
import SubUsersTab from './SubUsersTab'
import NetworkTab from './NetworkTab'
import ActivityTab from './ActivityTab'
import PlayersTab from './PlayersTab'
import PluginsTab from './PluginsTab'

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
  | 'players' | 'plugins' | 'mods'

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: 'console',   label: 'Console' },
  // MC-specific tabs injected here dynamically
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

function detectMcType(eggName: string | null) {
  const n = (eggName ?? '').toLowerCase()
  return {
    isMc:     /paper|spigot|bukkit|purpur|waterfall|forge|fabric|sponge|neoforge|vanilla|minecraft/.test(n),
    isPlugin: /paper|spigot|bukkit|purpur|waterfall/.test(n),
    isMod:    /forge|fabric|sponge|neoforge/.test(n),
  }
}

const STATUS_CFG: Record<ServerStatus, { dot: string; badge: string; label: string }> = {
  online:   { dot: 'bg-green-400 pulse-dot', badge: 'bg-green-500/[0.12] text-green-400 border-green-500/25', label: 'Online' },
  starting: { dot: 'bg-blue-400 animate-pulse', badge: 'bg-blue-500/[0.12] text-blue-400 border-blue-500/25', label: 'Starting' },
  stopping: { dot: 'bg-yellow-400 animate-pulse', badge: 'bg-yellow-500/[0.12] text-yellow-400 border-yellow-500/25', label: 'Stopping' },
  offline:  { dot: 'bg-slate-600', badge: 'bg-white/[0.06] text-slate-400 border-white/[0.08]', label: 'Offline' },
}

// Strip non-color ANSI codes (cursor movement, erase, etc.) before color parsing
const ANSI_NON_COLOR = /\x1B\[[0-9;]*[ABCDEFGJKST]|\x1B\[[0-9;]*[HfRu]|\r/g

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

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  )
  if (!data) return null

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
      {/* Docker image selector */}
      {Object.entries(data.dockerImages).length > 0 && (
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Docker Image</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {Object.entries(data.dockerImages).map(([label, image]) => (
              <button key={image} onClick={() => setSelectedImage(image)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                  selectedImage === image
                    ? 'border-blue-500/30 bg-blue-500/[0.10] text-blue-300'
                    : 'border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedImage === image ? 'bg-blue-400' : 'bg-slate-600'}`} />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
          {imgError && <p className="text-red-400 text-xs">{imgError}</p>}
          <button onClick={saveDockerImage} disabled={selectedImage === data.dockerImage}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all">
            {imgSaved ? 'Saved ✓' : 'Apply Image'}
          </button>
        </div>
      )}

      {/* Startup command preview */}
      <div className="panel rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-3">Startup Command</p>
        <pre className="bg-black/40 rounded-lg px-4 py-3 text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {data.startupPreview}
        </pre>
      </div>

      {/* Variables — 2-col grid on wide screens */}
      {data.variables.length > 0 && (
        <div className="panel rounded-xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Variables</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.variables.map(v => (
              <div key={v.id}>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-wider">
                  {v.name ?? v.envVariable}
                  {!v.userEditable && <span className="ml-2 text-slate-700 normal-case">(read-only)</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    value={values[v.id] ?? v.value}
                    onChange={e => { if (!v.userEditable) return; setValues(s => ({ ...s, [v.id]: e.target.value })); setErrors(s => ({ ...s, [v.id]: '' })) }}
                    readOnly={!v.userEditable}
                    className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
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
        </div>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────
function SettingsTab({ server }: { server: ServerDetail }) {
  const [name, setName] = useState(server.name)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const queryClient = useQueryClient()

  const { data: sftp } = useQuery<{ host: string; port: number; username: string }>({
    queryKey: ['client', 'servers', server.id, 'sftp'],
    queryFn: () => api.get(`/client/servers/${server.id}/sftp`),
  })

  async function saveName() {
    setNameError('')
    try {
      await api.patch(`/client/servers/${server.id}/name`, { name })
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
      queryClient.invalidateQueries({ queryKey: ['client', 'servers', server.id] })
    } catch (e: any) { setNameError(e.message) }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Rename server */}
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Server Name</p>
          <p className="text-slate-500 text-xs">Rename this server — cosmetic only, does not affect the container.</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button
              onClick={saveName}
              disabled={!name.trim() || name === server.name}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all whitespace-nowrap ${
                nameSaved
                  ? 'border-green-700 text-green-400 bg-green-950/40'
                  : 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] disabled:opacity-40'
              }`}
            >
              {nameSaved ? 'Saved ✓' : 'Rename'}
            </button>
          </div>
          {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
        </div>

        {/* SFTP details */}
        <div className="panel rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">SFTP Details</p>
          {!sftp ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : (
            <>
              {([['Host', sftp.host], ['Port', String(sftp.port)], ['Username', sftp.username], ['Password', 'Your panel password']] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-slate-500 text-sm">{label}</span>
                  <span className="font-mono text-slate-200 text-sm">{value}</span>
                </div>
              ))}
              <pre className="bg-black/40 rounded-lg px-4 py-3 text-emerald-300 text-xs font-mono overflow-x-auto">
                {`sftp -P ${sftp.port} ${sftp.username}@${sftp.host}`}
              </pre>
            </>
          )}
        </div>

        {/* Debug info */}
        <div className="panel rounded-xl p-5 space-y-2">
          <p className="text-white font-semibold text-sm">Server Information</p>
          {([
            ['Server ID', server.id],
            ['Node',      server.nodeName ?? '—'],
            ['Image',     server.eggName  ?? '—'],
            ['Address',   `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
              <span className="text-slate-500 text-sm">{label}</span>
              <span className="font-mono text-slate-300 text-xs truncate ml-4 max-w-[60%] text-right">{value}</span>
            </div>
          ))}
        </div>

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
  const [eulaRequired, setEulaRequired] = useState(false)
  const [eulaAccepting, setEulaAccepting] = useState(false)
  const [stopRequested, setStopRequested] = useState(false)

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
        else if (event === 'console output' && args[0]) {
          const raw = args[0].replace(ANSI_NON_COLOR, '')
          setLines(p => [...p.slice(-999), ansiToHtml(raw)])
          if (raw.includes('You need to agree to the EULA')) setEulaRequired(true)
        }
        else if (event === 'install output' && args[0]) setInstallLines(p => [...p.slice(-999), ansiToHtml(args[0].replace(ANSI_NON_COLOR, ''))])
        else if (event === 'install completed') { setInstallDone(true); queryClient.invalidateQueries({ queryKey: ['client', 'servers', id] }) }
        else if (event === 'status' && args[0]) {
          const s = (args[0] === 'running' ? 'online' : args[0]) as ServerStatus
          setStatus(s)
          if (s === 'offline') setStopRequested(false)
        }
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

  async function acceptEula() {
    if (!id || eulaAccepting) return
    setEulaAccepting(true)
    try {
      let content = ''
      try { content = await api.getText(`/client/servers/${id}/files/contents?file=/eula.txt`) } catch {}
      const updated = content.includes('eula=')
        ? content.replace(/eula=false/gi, 'eula=true')
        : content + '\neula=true\n'
      await api.postText(`/client/servers/${id}/files/write?file=/eula.txt`, updated)
      setEulaRequired(false)
      await power('start')
    } catch {}
    setEulaAccepting(false)
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
  const mcType = detectMcType(server.eggName)
  // Insert MC tabs right after Console (index 0)
  const mcTabs: { key: Tab; label: string }[] = [
    ...(mcType.isMc     ? [{ key: 'players' as Tab, label: 'Players' }] : []),
    ...(mcType.isPlugin ? [{ key: 'plugins' as Tab, label: 'Plugins' }] : []),
    ...(mcType.isMod    ? [{ key: 'mods'    as Tab, label: 'Mods'    }] : []),
  ]
  const visibleTabs: { key: Tab; label: string }[] = [
    BASE_TABS[0],
    ...mcTabs,
    ...BASE_TABS.slice(1),
  ]
  const pluginLoader = mcType.isPlugin
    ? /paper|purpur/.test((server.eggName ?? '').toLowerCase()) ? 'paper' : 'spigot'
    : /fabric/.test((server.eggName ?? '').toLowerCase()) ? 'fabric'
    : /forge/.test((server.eggName ?? '').toLowerCase()) ? 'forge'
    : /sponge/.test((server.eggName ?? '').toLowerCase()) ? 'sponge'
    : undefined

  function sendCommandStr(cmd: string) {
    if (!wsRef.current || !connected) return
    wsRef.current.send(JSON.stringify({ event: 'send command', args: [cmd] }))
  }
  const isRunning = status === 'online' || status === 'starting'

  // Compute stat percentages
  const cpuPercent  = stats ? Math.min(stats.cpu_absolute, 100) : 0
  const ramPercent  = stats && server.memory > 0 ? (stats.memory_bytes / (server.memory * 1048576)) * 100 : stats ? 50 : 0
  const diskPercent = stats && server.disk > 0 ? (stats.disk_bytes / (server.disk * 1073741824)) * 100 : stats ? 30 : 0

  return (
    <div className="h-full flex flex-col">

      {/* ── EULA modal ── */}
      {eulaRequired && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,4,15,0.82)', backdropFilter: 'blur(20px)' }}
        >
          {/* Glow behind the card */}
          <div className="absolute w-[420px] h-[320px] rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, #f59e0b 0%, transparent 70%)' }} />

          <div
            className="relative max-w-md w-full rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(30,25,10,0.85) 0%, rgba(10,8,4,0.90) 100%)',
              border: '1px solid rgba(245,158,11,0.22)',
              boxShadow: '0 0 0 1px rgba(245,158,11,0.06) inset, 0 32px 80px -12px rgba(0,0,0,0.8), 0 0 60px -20px rgba(245,158,11,0.18)',
              backdropFilter: 'blur(32px)',
            }}
          >
            {/* Subtle top shimmer */}
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />

            <div className="px-8 pt-8 pb-7">
              {/* Icon */}
              <div className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 100%)',
                  border: '1px solid rgba(245,158,11,0.28)',
                  boxShadow: '0 0 24px -6px rgba(245,158,11,0.4)',
                }}>
                <ShieldAlert size={26} className="text-yellow-400" strokeWidth={1.75} />
              </div>

              {/* Heading */}
              <h2 className="text-white text-lg font-bold text-center mb-1 tracking-tight">
                EULA Agreement Required
              </h2>
              <p className="text-slate-500 text-[13px] text-center mb-5">
                Minecraft — Mojang End User License Agreement
              </p>

              {/* Console excerpt */}
              <div className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(245,158,11,0.12)',
                }}>
                <span className="text-yellow-600 font-mono text-xs mt-px shrink-0">!</span>
                <p className="font-mono text-xs text-yellow-200/70 leading-relaxed">
                  You need to agree to the EULA in order to run the server.
                  Go to eula.txt for more info.
                </p>
              </div>

              {/* Body text */}
              <p className="text-slate-400 text-[13px] leading-relaxed text-center mb-7">
                By clicking <span className="text-white font-semibold">Accept &amp; Start</span> you confirm
                you have read and accept the{' '}
                <a
                  href="https://aka.ms/MinecraftEULA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Minecraft EULA <ExternalLink size={11} className="mb-px" />
                </a>
                .
              </p>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setEulaRequired(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Dismiss
                </button>
                <button
                  onClick={acceptEula}
                  disabled={eulaAccepting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{
                    background: eulaAccepting
                      ? 'rgba(180,120,0,0.5)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#0a0600',
                    boxShadow: eulaAccepting ? 'none' : '0 4px 20px -4px rgba(245,158,11,0.5)',
                  }}
                >
                  {eulaAccepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Accepting…
                    </span>
                  ) : 'Accept & Start'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div ref={installRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-[1.8] text-slate-300">
              {installLines.length === 0
                ? <span className="text-slate-700">Waiting for install output…</span>
                : installLines.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: line || ' ' }} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      {server.installed && (
        <div className="flex items-center border-b border-white/[0.06] px-4 overflow-x-auto shrink-0">
          {visibleTabs.map(({ key, label }) => (
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
              {status === 'offline' ? (
                <button
                  onClick={() => power('start')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                >
                  <Play size={13} /> Start
                </button>
              ) : (
                <>
                  <button
                    onClick={() => power('restart')} disabled={status !== 'online'}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                  >
                    <RotateCcw size={13} /> Restart
                  </button>
                  {stopRequested || status === 'stopping' ? (
                    <button
                      onClick={() => power('kill')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                    >
                      <Zap size={13} /> Kill
                    </button>
                  ) : (
                    <button
                      onClick={() => { setStopRequested(true); power('stop') }} disabled={!isRunning}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 text-slate-200 text-sm font-semibold rounded-lg border border-white/[0.08] transition-all"
                    >
                      <Square size={13} /> Stop
                    </button>
                  )}
                </>
              )}

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
            <div className="panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0" style={{ background: 'rgba(2,5,14,0.92)' }}>
              {/* Terminal header — minimal, no macOS dots */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] shrink-0">
                <span className="text-slate-700 text-[11px] font-mono tracking-wide">CONSOLE</span>
                <span className="text-[11px] text-slate-700 font-mono">{lines.length} lines</span>
              </div>

              {/* Output */}
              <div
                ref={consoleRef}
                className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-[1.8] text-slate-300"
              >
                {lines.length === 0 ? (
                  <span className="text-slate-700">
                    {connected ? 'Waiting for output…' : 'Connecting to daemon…'}
                  </span>
                ) : (
                  lines.map((line, i) => (
                    <div
                      key={i}
                      className="whitespace-pre-wrap break-all"
                      dangerouslySetInnerHTML={{ __html: line || ' ' }}
                    />
                  ))
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
        <div className="flex-1 min-h-0 flex flex-col">
          <StartupTab server={server} />
        </div>
      )}

      {/* ══ SETTINGS TAB ═════════════════════════════════════════════════════ */}
      {server.installed && tab === 'settings' && (
        <div className="flex-1 min-h-0 flex flex-col">
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

      {/* ══ PLAYERS TAB ══════════════════════════════════════════════════════ */}
      {server.installed && tab === 'players' && mcType.isMc && (
        <div className="flex-1 min-h-0 flex flex-col">
          <PlayersTab
            serverId={server.id}
            lines={lines}
            onSendCommand={sendCommandStr}
            connected={connected}
            status={status}
          />
        </div>
      )}

      {/* ══ PLUGINS TAB ══════════════════════════════════════════════════════ */}
      {server.installed && tab === 'plugins' && mcType.isPlugin && (
        <div className="flex-1 min-h-0 flex flex-col">
          <PluginsTab
            serverId={server.id}
            folder="plugins"
            sources={['spiget', 'modrinth']}
            loader={pluginLoader}
          />
        </div>
      )}

      {/* ══ MODS TAB ═════════════════════════════════════════════════════════ */}
      {server.installed && tab === 'mods' && mcType.isMod && (
        <div className="flex-1 min-h-0 flex flex-col">
          <PluginsTab
            serverId={server.id}
            folder="mods"
            sources={['modrinth']}
            loader={pluginLoader}
          />
        </div>
      )}

    </div>
  )
}
