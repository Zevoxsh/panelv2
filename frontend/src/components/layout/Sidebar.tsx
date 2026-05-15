import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Users, Key, ChevronLeft } from 'lucide-react'
import { useUIStore } from '../../stores/ui.store'
import { useAuth } from '../../hooks/useAuth'

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/api-keys', icon: Key, label: 'Clés API' },
]

const clientLinks = [
  { to: '/client', icon: Server, label: 'Mes serveurs', end: true },
  { to: '/client/api-keys', icon: Key, label: 'Clés API' },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { isAdmin } = useAuth()
  const links = isAdmin ? adminLinks : clientLinks

  return (
    <aside className={`bg-[#111827] border-r border-border flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
      <div className="flex items-center justify-end p-2 border-b border-border h-12">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-muted hover:text-white hover:bg-border transition-colors"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft size={16} className={`transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-purple-950 text-primary-light' : 'text-muted hover:text-white hover:bg-border'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
