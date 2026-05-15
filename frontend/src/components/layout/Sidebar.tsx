import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Server, Key, Users, LayoutDashboard, ChevronLeft, ShieldCheck, ArrowLeft, MapPin, Cpu, Egg } from 'lucide-react'
import { useUIStore } from '../../stores/ui.store'
import { useAuth } from '../../hooks/useAuth'

const userLinks = [
  { to: '/servers', icon: Server, label: 'Serveurs', end: true },
  { to: '/api-keys', icon: Key, label: 'Clés API', end: true },
]

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/servers', icon: Server, label: 'Serveurs' },
  { to: '/admin/eggs', icon: Egg, label: 'Eggs' },
  { to: '/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/admin/nodes', icon: Cpu, label: 'Nodes' },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/api-keys', icon: Key, label: 'Clés API' },
]

function NavItem({ to, icon: Icon, label, end, open }: {
  to: string; icon: React.ElementType; label: string; end?: boolean; open: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
          isActive ? 'bg-purple-950 text-primary-light' : 'text-muted hover:text-white hover:bg-border'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      {open && <span>{label}</span>}
    </NavLink>
  )
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminPanel = location.pathname.startsWith('/admin')

  return (
    <aside className={`bg-[#111827] border-r border-border flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
      <div className="flex items-center justify-end p-2 border-b border-border h-12">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md text-muted hover:text-white hover:bg-border transition-colors">
          <ChevronLeft size={16} className={`transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {(isAdminPanel ? adminLinks : userLinks).map(({ to, icon, label, end }) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={end} open={sidebarOpen} />
        ))}
      </nav>

      {isAdmin && (
        <div className="p-2 border-t border-border">
          {isAdminPanel ? (
            <button onClick={() => navigate('/servers')}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted hover:text-white hover:bg-border transition-colors">
              <ArrowLeft size={16} className="shrink-0" />
              {sidebarOpen && <span>Retour au panel</span>}
            </button>
          ) : (
            <button onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted hover:text-white hover:bg-border transition-colors">
              <ShieldCheck size={16} className="shrink-0" />
              {sidebarOpen && <span>Panel Admin</span>}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
