import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Settings, Palette, Key, Database, MapPin, Cpu, Server, Users, HardDrive, Egg, ArrowLeft } from 'lucide-react'

const sections = [
  {
    label: 'Basic Administration',
    links: [
      { to: '/admin',           icon: LayoutDashboard, label: 'Overview',        end: true },
      { to: '/admin/settings',  icon: Settings,        label: 'Settings',        end: true },
      { to: '/admin/theme',     icon: Palette,         label: 'Theme',           end: true },
      { to: '/admin/api-keys',  icon: Key,             label: 'Application API', end: true },
    ],
  },
  {
    label: 'Management',
    links: [
      { to: '/admin/databases', icon: Database, label: 'Databases',  end: true },
      { to: '/admin/locations', icon: MapPin,   label: 'Locations',  end: true },
      { to: '/admin/nodes',     icon: Cpu,      label: 'Nodes',      end: false },
      { to: '/admin/servers',   icon: Server,   label: 'Servers',    end: false },
      { to: '/admin/users',     icon: Users,    label: 'Users',      end: false },
    ],
  },
  {
    label: 'Service Management',
    links: [
      { to: '/admin/mounts', icon: HardDrive, label: 'Mounts', end: true },
      { to: '/admin/eggs',   icon: Egg,       label: 'Nests',  end: false },
    ],
  },
]

function SideLink({ to, icon: Icon, label, end }: { to: string; icon: React.ElementType; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 pl-8 pr-4 py-2 text-sm transition-colors ${
          isActive
            ? 'text-white bg-teal/20 border-l-2 border-teal'
            : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
        }`
      }
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </NavLink>
  )
}

export default function AdminSidebar() {
  const navigate = useNavigate()

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-admin-sidebar h-screen sticky top-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-admin-border/50">
        <div className="w-7 h-7 bg-teal rounded-md flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">P</span>
        </div>
        <span className="text-white font-semibold text-[15px] tracking-tight">Pterodactyl</span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-3">
            <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {section.label}
            </p>
            {section.links.map(({ to, icon, label, end }) => (
              <SideLink key={to} to={to} icon={icon} label={label} end={end} />
            ))}
          </div>
        ))}
      </nav>

      {/* Back to client */}
      <div className="border-t border-admin-border/50 p-3">
        <button
          onClick={() => navigate('/servers')}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Panel
        </button>
      </div>
    </aside>
  )
}
