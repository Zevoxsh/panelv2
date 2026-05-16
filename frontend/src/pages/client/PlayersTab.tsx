import { useState, useEffect, useRef } from 'react'
import { Users, ChevronDown } from 'lucide-react'

type ServerStatus = 'offline' | 'online' | 'starting' | 'stopping'

interface Props {
  lines: string[]
  status: ServerStatus
  onSendCommand: (cmd: string) => void
}

const ACTIONS = [
  { label: 'Kick',             cmd: (n: string) => `kick ${n}` },
  { label: 'Ban',              cmd: (n: string) => `ban ${n}` },
  { label: 'Ban IP',           cmd: (n: string) => `ban-ip ${n}` },
  { label: 'Pardon',           cmd: (n: string) => `pardon ${n}` },
  { label: '─', cmd: null },
  { label: 'Op',               cmd: (n: string) => `op ${n}` },
  { label: 'Deop',             cmd: (n: string) => `deop ${n}` },
  { label: '─', cmd: null },
  { label: 'Whitelist add',    cmd: (n: string) => `whitelist add ${n}` },
  { label: 'Whitelist remove', cmd: (n: string) => `whitelist remove ${n}` },
  { label: '─', cmd: null },
  { label: 'Survival',         cmd: (n: string) => `gamemode survival ${n}` },
  { label: 'Creative',         cmd: (n: string) => `gamemode creative ${n}` },
  { label: 'Adventure',        cmd: (n: string) => `gamemode adventure ${n}` },
  { label: 'Spectator',        cmd: (n: string) => `gamemode spectator ${n}` },
]

function stripHtml(s: string) { return s.replace(/<[^>]*>/g, '') }

function PlayerCard({ name, onSendCommand }: { name: string; onSendCommand: (cmd: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="panel rounded-xl p-4 flex flex-col items-center gap-3 relative" ref={ref}>
      {/* Head */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/[0.07] shrink-0">
        <img
          src={`https://minotar.net/helm/${name}/56`}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
        />
      </div>

      {/* Name */}
      <p className="text-white text-sm font-semibold text-center truncate w-full">{name}</p>

      {/* Actions dropdown */}
      <div className="relative w-full">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
        >
          Actions <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            className="absolute bottom-full mb-1.5 left-0 right-0 z-20 rounded-xl overflow-hidden py-1 min-w-[160px]"
            style={{ background: 'rgba(10,14,28,0.97)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 16px 48px -8px rgba(0,0,0,0.8)' }}
          >
            {ACTIONS.map((a, i) =>
              a.cmd === null ? (
                <div key={i} className="mx-3 my-1 h-px bg-white/[0.07]" />
              ) : (
                <button
                  key={i}
                  onClick={() => { onSendCommand(a.cmd!(name)); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {a.label}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayersTab({ lines, status, onSendCommand }: Props) {
  const [players, setPlayers] = useState<Set<string>>(new Set())
  const prevLinesLen = useRef(0)
  const sentList = useRef(false)

  // Send `list` once server is online
  useEffect(() => {
    if (status === 'online' && !sentList.current) {
      sentList.current = true
      onSendCommand('list')
    }
    if (status === 'offline') {
      sentList.current = false
      setPlayers(new Set())
    }
  }, [status])

  // Parse new console lines for player events
  useEffect(() => {
    const newLines = lines.slice(prevLinesLen.current)
    prevLinesLen.current = lines.length

    setPlayers(prev => {
      const next = new Set(prev)
      for (const raw of newLines) {
        const line = stripHtml(raw)

        // Join: "[HH:MM:SS INFO]: PlayerName joined the game"
        const join = line.match(/(\w{2,16}) joined the game/)
        if (join) { next.add(join[1]); continue }

        // Leave: "[HH:MM:SS INFO]: PlayerName left the game"
        const leave = line.match(/(\w{2,16}) left the game/)
        if (leave) { next.delete(leave[1]); continue }

        // Kicked
        const kicked = line.match(/Kicked\s+(\w{2,16})/)
        if (kicked) { next.delete(kicked[1]); continue }

        // List response: "There are X of a max Y players online: p1, p2"
        const listMatch = line.match(/players online:\s*(.+)/i)
        if (listMatch) {
          const names = listMatch[1].split(',').map(s => s.trim()).filter(s => /^\w{2,16}$/.test(s))
          if (names.length > 0) {
            // Replace current set with the list response
            next.clear()
            names.forEach(n => next.add(n))
          }
        }
      }
      return next
    })
  }, [lines])

  const playerList = Array.from(players).sort()

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          {playerList.length} player{playerList.length !== 1 ? 's' : ''} online
        </p>
        {status === 'online' && (
          <button
            onClick={() => onSendCommand('list')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {status === 'offline' ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="text-center">
            <Users size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">Server is offline</p>
            <p className="text-slate-600 text-xs mt-1">Start the server to manage players</p>
          </div>
        </div>
      ) : playerList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="text-center">
            <Users size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No players online</p>
            <p className="text-slate-600 text-xs mt-1">Players will appear here when they join</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {playerList.map(name => (
              <PlayerCard
                key={name}
                name={name}
                onSendCommand={onSendCommand}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
