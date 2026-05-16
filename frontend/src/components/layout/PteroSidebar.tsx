import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  Layers, User, LogOut, Shield,
  Terminal, Folder, Database, Calendar, Users, Archive, Globe, Rocket, Settings, Activity,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const CLIENT_LINKS = [
  { to: '/servers', icon: Layers, label: 'Servers', end: true },
  { to: '/account', icon: User,   label: 'Account', end: true },
]

const SERVER_TABS = [
  { key: 'console',   label: 'Console',   icon: Terminal },
  { key: 'files',     label: 'Files',     icon: Folder },
  { key: 'databases', label: 'Databases', icon: Database },
  { key: 'schedules', label: 'Schedules', icon: Calendar },
  { key: 'users',     label: 'Users',     icon: Users },
  { key: 'backups',   label: 'Backups',   icon: Archive },
  { key: 'network',   label: 'Network',   icon: Globe },
  { key: 'startup',   label: 'Startup',   icon: Rocket },
  { key: 'settings',  label: 'Settings',  icon: Settings },
  { key: 'activity',  label: 'Activity',  icon: Activity },
]

const NAV_BASE = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all border'
const NAV_ACTIVE = 'bg-blue-500/[0.14] text-blue-300 border-blue-500/25'
const NAV_IDLE = 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border-transparent'

export default function PteroSidebar() {
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const serverMatch = location.pathname.match(/^\/servers\/([^/]+)/)
  const serverId = serverMatch?.[1] ?? null
  const activeTab = searchParams.get('tab') ?? 'console'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0 z-20"
      style={{ background: '#02040b', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', boxShadow: '0 0 16px rgba(59,130,246,0.30)' }}
        >
          <Layers size={15} className="text-white" />
        </div>
        <span className="font-bold text-white tracking-tight text-[15px]">Paxcia Panel</span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-4 py-2">

        {/* Main nav links */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 px-2 mb-2">
            Navigation
          </p>
          {CLIENT_LINKS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_IDLE}`}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Server controls */}
        {serverId && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 px-2 mb-2">
              Server
            </p>
            {SERVER_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSearchParams({ tab: key }, { replace: true })}
                className={`w-full ${NAV_BASE} ${activeTab === key ? NAV_ACTIVE : NAV_IDLE}`}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}

      </nav>

      {/* ── Bottom ── */}
      <div
        className="px-3 pb-4 pt-3 space-y-0.5 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className={`w-full ${NAV_BASE} ${location.pathname.startsWith('/admin') ? NAV_ACTIVE : NAV_IDLE}`}
          >
            <Shield size={14} className="shrink-0" />
            Admin Panel
          </button>
        )}
        <button
          onClick={async () => { await logout(); navigate('/login') }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:text-red-400 hover:bg-red-500/[0.07] border border-transparent transition-all"
        >
          <LogOut size={14} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
