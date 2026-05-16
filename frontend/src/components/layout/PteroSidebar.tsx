import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  User, Layers, Settings, LogOut, Moon,
  Terminal, Folder, Database, Calendar, Users, Archive, Globe, Rocket, Activity,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const CLIENT_LINKS = [
  { to: '/account', icon: User,   label: 'Account', end: true },
  { to: '/servers', icon: Layers, label: 'Servers', end: true },
]

const SERVER_TABS = [
  { key: 'console',   label: 'Console',       icon: Terminal },
  { key: 'files',     label: 'File managers', icon: Folder },
  { key: 'databases', label: 'Databases',     icon: Database },
  { key: 'schedules', label: 'Schedules',     icon: Calendar },
  { key: 'users',     label: 'Users',         icon: Users },
  { key: 'backups',   label: 'Backups',       icon: Archive },
  { key: 'network',   label: 'Network',       icon: Globe },
  { key: 'startup',   label: 'Startup',       icon: Rocket },
  { key: 'settings',  label: 'Settings',      icon: Settings },
  { key: 'activity',  label: 'Activity',      icon: Activity },
]

export default function PteroSidebar() {
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const serverMatch = location.pathname.match(/^\/servers\/([^/]+)/)
  const serverId = serverMatch?.[1] ?? null
  const activeTab = searchParams.get('tab') ?? 'console'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-navy h-screen sticky top-0 z-20 border-r border-border/50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <span className="text-white font-semibold text-[15px] tracking-tight">Pterodactyl</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {CLIENT_LINKS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2 ${
                isActive
                  ? 'text-white bg-white/5 border-primary'
                  : 'text-muted hover:text-white hover:bg-white/5 border-transparent'
              }`
            }
          >
            <Icon size={15} className="shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Server controls — shown when inside a server page */}
        {serverId && (
          <div className="mt-4 border-t border-border/40 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1 px-5">
              Server Controls
            </p>
            {SERVER_TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setSearchParams({ tab: key }, { replace: true })}
                  className={`w-full flex items-center gap-3 px-5 py-2 text-sm transition-colors border-l-2 ${
                    isActive
                      ? 'text-white bg-white/5 border-primary'
                      : 'text-muted hover:text-white hover:bg-white/5 border-transparent'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors border-l-2 border-transparent"
            >
              <Settings size={15} className="shrink-0" />
              Admin Panel
            </button>
          </div>
        )}
      </nav>

      {/* Bottom icons */}
      <div className="border-t border-border/40 flex items-center justify-around px-4 py-3">
        <button className="p-2 text-muted hover:text-white transition-colors rounded-md hover:bg-white/5">
          <Moon size={16} />
        </button>
        <button className="p-2 text-muted hover:text-white transition-colors rounded-md hover:bg-white/5">
          <Settings size={16} />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 text-muted hover:text-white transition-colors rounded-md hover:bg-white/5"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
