import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, wsUrl } from '../../lib/api'
import {
  ChevronLeft, Play, RotateCcw, Square, Zap, Send,
  Cpu, HardDrive, MemoryStick, Wifi, Terminal, FolderOpen, MonitorDot,
  Loader2, CheckCircle2, Settings2,
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

interface SftpInfo {
  host: string
  port: number
  username: string
}

interface WingsStats {
  cpu_absolute: number
  memory_bytes: number
  memory_limit_bytes: number
  disk_bytes: number
  network?: { rx_bytes: number; tx_bytes: number }
  uptime?: number
}

type ServerStatus = 'offline' | 'online' | 'starting' | 'stopping'
type Tab = 'console' | 'files' | 'startup' | 'sftp'

const STATUS_LABEL: Record<ServerStatus, string> = {
  offline: 'Hors ligne',
  online: 'En ligne',
  starting: 'Démarrage',
  stopping: 'Arrêt',
}

const STATUS_DOT: Record<ServerStatus, string> = {
  offline: 'bg-zinc-500',
  online: 'bg-green-400',
  starting: 'bg-blue-400',
  stopping: 'bg-yellow-400',
}

const STATUS_RING: Record<ServerStatus, string> = {
  offline: 'text-zinc-400 bg-zinc-800/60 border-zinc-700',
  online: 'text-green-400 bg-green-950/60 border-green-800',
  starting: 'text-blue-400 bg-blue-950/60 border-blue-800',
  stopping: 'text-yellow-400 bg-yellow-950/60 border-yellow-800',
}

const ANSI_STRIP = /\x1B\[[0-9;]*[mGKHF]/g

function fmtGiB(bytes: number) {
  return (bytes / 1073741824).toFixed(2) + ' GiB'
}

function StatBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3">
      <Icon size={15} className="text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-muted text-[11px] leading-none mb-1">{label}</p>
        <p className="text-white text-xs font-mono font-semibold truncate">{value}</p>
      </div>
    </div>
  )
}

// ── Startup tab ───────────────────────────────────────────────────────────────
interface StartupData {
  startupCommand: string
  startupPreview: string
  dockerImage: string
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
    } catch (e: any) {
      setErrors(s => ({ ...s, [varId]: e.message }))
    }
  }

  async function saveDockerImage() {
    setImgError('')
    try {
      await api.patch(`/client/servers/${server.id}/docker-image`, { dockerImage: selectedImage })
      setImgSaved(true)
      setTimeout(() => setImgSaved(false), 2500)
      queryClient.invalidateQueries({ queryKey: qKey })
    } catch (e: any) {
      setImgError(e.message)
    }
  }

  if (isLoading) return <p className="text-muted text-sm">Chargement…</p>
  if (!data) return null

  const imageOptions = Object.entries(data.dockerImages)

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Docker image selector */}
      {imageOptions.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <p className="text-white font-semibold text-sm">Version Java</p>
          <p className="text-muted text-xs">Choisissez la version Java à utiliser. Prend effet au prochain redémarrage.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {imageOptions.map(([label, image]) => (
              <button
                key={image}
                onClick={() => setSelectedImage(image)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                  selectedImage === image
                    ? 'border-primary bg-primary/10 text-primary-light'
                    : 'border-border text-muted hover:text-white hover:bg-border'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${selectedImage === image ? 'bg-primary' : 'bg-zinc-600'}`} />
                {label}
              </button>
            ))}
          </div>
          {imgError && <p className="text-red-400 text-xs">{imgError}</p>}
          <button
            onClick={saveDockerImage}
            disabled={selectedImage === data.dockerImage}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-40 ${
              imgSaved
                ? 'border-green-700 text-green-400 bg-green-950/40'
                : 'border-border text-muted hover:text-white hover:bg-border'
            }`}
          >
            {imgSaved ? 'Sauvegardé ✓' : 'Appliquer la version Java'}
          </button>
        </section>
      )}

      {/* Startup command display */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-1">Commande de démarrage</p>
        <p className="text-muted text-xs mb-3">Variables substituées avec vos valeurs actuelles.</p>
        <pre className="bg-base rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {data.startupPreview}
        </pre>
      </section>

      {/* Editable variables */}
      {data.variables.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Variables</p>
          {data.variables.map(v => (
            <div key={v.id}>
              <label className="block text-xs text-muted mb-1 uppercase tracking-wider">
                {v.name ?? v.envVariable}
                {!v.userEditable && (
                  <span className="ml-2 text-zinc-600 normal-case tracking-normal">(lecture seule)</span>
                )}
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
                  className={`flex-1 bg-base border rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition-colors ${
                    v.userEditable
                      ? 'border-border focus:border-primary'
                      : 'border-border opacity-60 cursor-default'
                  }`}
                />
                {v.userEditable && (
                  <button
                    onClick={() => saveVar(v.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      saved[v.id]
                        ? 'border-green-700 text-green-400 bg-green-950/40'
                        : 'border-border text-muted hover:text-white hover:bg-border'
                    }`}
                  >
                    {saved[v.id] ? 'Sauvegardé ✓' : 'Appliquer'}
                  </button>
                )}
              </div>
              {v.description && <p className="text-muted text-xs mt-1">{v.description}</p>}
              {errors[v.id] && <p className="text-red-400 text-xs mt-1">{errors[v.id]}</p>}
              <p className="text-zinc-600 text-xs font-mono mt-0.5">{v.envVariable}</p>
            </div>
          ))}
          <p className="text-muted text-xs pt-1 border-t border-border">
            Les changements prennent effet au prochain démarrage du serveur.
          </p>
        </section>
      )}
    </div>
  )
}

// ── SFTP tab ──────────────────────────────────────────────────────────────────
function SftpTab({ server }: { server: ServerDetail }) {
  const { data: sftp, isLoading } = useQuery<SftpInfo>({
    queryKey: ['client', 'servers', server.id, 'sftp'],
    queryFn: () => api.get(`/client/servers/${server.id}/sftp`),
  })

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
        <span className="text-muted text-sm shrink-0">{label}</span>
        <span className="font-mono text-white text-sm text-right break-all">{value}</span>
      </div>
    )
  }

  if (isLoading) return <p className="text-muted text-sm">Chargement…</p>
  if (!sftp) return <p className="text-red-400 text-sm">Impossible de récupérer les infos SFTP</p>

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Connexion SFTP</p>
        <Row label="Hôte" value={sftp.host} />
        <Row label="Port" value={String(sftp.port)} />
        <Row label="Identifiant" value={sftp.username} />
        <Row label="Mot de passe" value="Votre mot de passe du panel" />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-white font-semibold text-sm mb-2">Ligne de commande</p>
        <pre className="bg-base rounded-lg px-4 py-3 text-green-300 text-xs font-mono overflow-x-auto">
          {`sftp -P ${sftp.port} ${sftp.username}@${sftp.host}`}
        </pre>
        <p className="text-muted text-xs mt-3">
          Ou utilisez un client graphique comme FileZilla / WinSCP avec les informations ci-dessus.
        </p>
      </div>
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
    // Poll every 4s while installing so the page refreshes when install completes
    refetchInterval: (query) => {
      const data = query.state.data as ServerDetail | undefined
      return data && !data.installed ? 4000 : false
    },
  })

  // Auto-scroll console
  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  // Auto-scroll install console
  useEffect(() => {
    const el = installRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [installLines])

  // WebSocket proxy connection (same-origin → panel → Wings)
  // Connect even during install so we can stream install output.
  // Auto-reconnects on unexpected disconnect (not on permanent errors).
  useEffect(() => {
    if (!id || !server || server?.suspended) return

    let retryDelay = 3000
    let destroyed = false

    function connect() {
      if (destroyed) return
      const url = wsUrl(`/client/servers/${id}/ws`)
      setWsError(null)
      setConnected(false)

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onmessage = (e) => {
        let msg: { event: string; args: string[] }
        try { msg = JSON.parse(e.data) } catch { return }
        const { event, args } = msg

        if (event === 'connected') {
          retryDelay = 3000
          setConnected(true)
        } else if (event === 'console output' && args[0]) {
          const line = args[0].replace(ANSI_STRIP, '')
          setLines(prev => [...prev.slice(-999), line])
        } else if (event === 'install output' && args[0]) {
          const line = args[0].replace(ANSI_STRIP, '')
          setInstallLines(prev => [...prev.slice(-999), line])
        } else if (event === 'install completed') {
          setInstallDone(true)
          queryClient.invalidateQueries({ queryKey: ['client', 'servers', id] })
        } else if (event === 'status' && args[0]) {
          const raw = args[0]
          setStatus((raw === 'running' ? 'online' : raw) as ServerStatus)
        } else if (event === 'stats' && args[0]) {
          try { setStats(JSON.parse(args[0])) } catch {}
        }
      }

      ws.onerror = () => {}
      ws.onclose = (e) => {
        setConnected(false)
        if (wsRef.current === ws) wsRef.current = null

        // Permanent errors — don't retry
        if (e.code === 4001) { setWsError('Non authentifié'); return }
        if (e.code === 4003) { setWsError('Accès refusé'); return }
        if (e.code === 4005) { setWsError('Wings a rejeté l\'authentification — vérifiez le token daemon'); return }
        if (e.code === 4404) { setWsError('Serveur introuvable dans Wings — re-synchronisez depuis le panel admin'); return }

        // Transient errors — auto-reconnect
        setStatus('offline')
        if (!destroyed) {
          retryDelay = Math.min(retryDelay * 1.5, 30000)
          reconnectTimerRef.current = setTimeout(connect, retryDelay)
        }
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
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        Chargement...
      </div>
    )
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-white font-medium text-sm">Serveur introuvable</p>
        <Link to="/servers" className="text-primary-light text-xs hover:underline">← Retour</Link>
      </div>
    )
  }

  const displayAddress = `${server.allocationIpAlias ?? server.allocationIp ?? '—'}:${server.allocationPort ?? '—'}`
  // Power actions use REST — they work regardless of WS state.
  // If WS is disconnected we don't know the real status, so enable all actions.
  const knownStatus = connected
  const canStart   = !knownStatus || status === 'offline'
  const canStop    = !knownStatus || status === 'online' || status === 'starting'
  const canRestart = !knownStatus || status === 'online'
  const canKill    = !knownStatus || status === 'online' || status === 'starting' || status === 'stopping'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <Link to="/servers" className="inline-flex items-center gap-1 text-muted text-xs hover:text-white transition-colors mb-3">
          <ChevronLeft size={13} /> Mes serveurs
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">{server.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-muted text-xs">
              <span className="font-mono">{displayAddress}</span>
              <span>·</span>
              <span>{server.nodeName ?? '—'}</span>
              {server.eggName && <><span>·</span><span>{server.eggName}</span></>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_RING[status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* Stats (only when running) */}
      {stats && server.installed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox icon={Cpu} label="CPU" value={`${stats.cpu_absolute.toFixed(1)} %`} />
          <StatBox icon={MemoryStick} label="RAM" value={fmtGiB(stats.memory_bytes)} />
          <StatBox icon={HardDrive} label="Disque" value={fmtGiB(stats.disk_bytes)} />
          <StatBox
            icon={Wifi}
            label="Réseau ↑↓"
            value={stats.network
              ? `${fmtGiB(stats.network.tx_bytes)} / ${fmtGiB(stats.network.rx_bytes)}`
              : '—'}
          />
        </div>
      )}

      {/* ── Installation in progress ── */}
      {!server.installed && (
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            installDone
              ? 'bg-green-950/40 border-green-800 text-green-400'
              : 'bg-blue-950/40 border-blue-800 text-blue-400'
          }`}>
            {installDone
              ? <CheckCircle2 size={15} />
              : <Loader2 size={15} className="animate-spin" />}
            {installDone
              ? 'Installation terminée — rechargement en cours…'
              : 'Installation en cours…'}
          </div>

          <div className="bg-[#0d0d0d] border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-muted text-xs uppercase tracking-wider font-medium">Sortie d'installation</span>
              {!connected && (
                <span className="text-zinc-600 text-xs ml-auto flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Connexion…
                </span>
              )}
            </div>
            <div
              ref={installRef}
              className="h-80 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6] select-text"
            >
              {installLines.length === 0
                ? <span className="text-zinc-600">En attente de la sortie d'installation…</span>
                : installLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Normal tabs (only once installed) ── */}
      {server.installed && (
        <>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: 'console',  label: 'Console',   icon: Terminal },
          { key: 'files',    label: 'Fichiers',   icon: FolderOpen },
          { key: 'startup',  label: 'Démarrage',  icon: Settings2 },
          { key: 'sftp',     label: 'SFTP',       icon: MonitorDot },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary text-primary-light'
                : 'border-transparent text-muted hover:text-white'
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Console tab */}
      {tab === 'console' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => power('start')}
              disabled={!canStart}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors">
              <Play size={13} /> Démarrer
            </button>
            <button onClick={() => power('restart')}
              disabled={!canRestart}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors">
              <RotateCcw size={13} /> Redémarrer
            </button>
            <button onClick={() => power('stop')}
              disabled={!canStop}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors">
              <Square size={13} /> Arrêter
            </button>
            <button onClick={() => power('kill')}
              disabled={!canKill}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors">
              <Zap size={13} /> Kill
            </button>

            <span className="text-xs ml-1 flex items-center gap-2">
              {wsError ? (
                <>
                  <span className="text-red-400">{wsError}</span>
                  <button onClick={() => { setWsError(null); setReconnectTick(t => t + 1) }}
                    className="text-xs text-primary-light hover:underline">
                    Reconnecter
                  </button>
                </>
              ) : !connected ? (
                <span className="text-muted flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Connexion au daemon…
                </span>
              ) : null}
            </span>
          </div>

          <div className="bg-[#0d0d0d] border border-border rounded-xl overflow-hidden flex flex-col">
            <div
              ref={consoleRef}
              className="h-96 overflow-y-auto p-4 font-mono text-xs text-green-300 leading-[1.6] select-text"
            >
              {lines.length === 0
                ? <span className="text-zinc-600">{connected ? 'En attente de sortie console…' : 'Connexion en cours…'}</span>
                : lines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">{line || ' '}</div>
                ))}
            </div>

            <form onSubmit={sendCommand} className="flex items-center border-t border-border">
              <span className="text-green-600 font-mono text-sm px-3 select-none">$</span>
              <input
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                disabled={!connected || status === 'offline'}
                placeholder={!connected ? 'Connexion…' : status === 'offline' ? 'Serveur hors ligne' : 'Entrer une commande…'}
                className="flex-1 bg-transparent py-3 pr-2 text-sm font-mono text-white placeholder:text-zinc-600 outline-none disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!connected || !command.trim() || status === 'offline'}
                className="px-3 py-3 text-muted hover:text-white disabled:opacity-30 transition-colors"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </>
      )}

      {tab === 'files' && <FileManagerTab serverId={server.id} />}
      {tab === 'startup' && <StartupTab server={server} />}
      {tab === 'sftp' && <SftpTab server={server} />}
        </>
      )}
    </div>
  )
}
