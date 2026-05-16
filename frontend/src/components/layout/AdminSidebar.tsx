import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Palette, Key, Database,
  MapPin, Cpu, Server, Users, HardDrive, Egg, ArrowLeft,
} from 'lucide-react'

const sections = [
  {
    label: 'Administration',
    links: [
      { to: '/admin',          icon: LayoutDashboard, label: 'Overview',        end: true },
      { to: '/admin/settings', icon: Settings,        label: 'Settings',        end: true },
      { to: '/admin/theme',    icon: Palette,         label: 'Theme',           end: true },
      { to: '/admin/api-keys', icon: Key,             label: 'Application API', end: true },
    ],
  },
  {
    label: 'Management',
    links: [
      { to: '/admin/databases', icon: Database, label: 'Databases', end: true },
      { to: '/admin/locations', icon: MapPin,   label: 'Locations', end: true },
      { to: '/admin/nodes',     icon: Cpu,      label: 'Nodes',     end: false },
      { to: '/admin/servers',   icon: Server,   label: 'Servers',   end: false },
      { to: '/admin/users',     icon: Users,    label: 'Users',     end: false },
    ],
  },
  {
    label: 'Services',
    links: [
      { to: '/admin/mounts', icon: HardDrive, label: 'Mounts', end: true },
      { to: '/admin/eggs',   icon: Egg,       label: 'Eggs',   end: false },
    ],
  },
]

function SideLink({ to, icon: Icon, label, end }: { to: string; icon: React.ElementType; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-[13px] font-medium transition-all border ${
          isActive
            ? 'bg-teal/[0.12] text-teal border-teal/25'
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border-transparent'
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
    <aside
      className="w-52 shrink-0 flex flex-col h-screen sticky top-0 z-20"
      style={{ background: '#020407', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}>
          <span className="text-white font-bold text-xs">A</span>
        </div>
        <div>
          <p className="text-slate-200 font-semibold text-[13px] leading-none">Admin</p>
          <p className="text-slate-600 text-[10px] mt-0.5">Panel Control</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 px-5 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map(({ to, icon, label, end }) => (
                <SideLink key={to} to={to} icon={icon} label={label} end={end} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Back to client panel */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => navigate('/servers')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all border border-transparent"
        >
          <ArrowLeft size={14} />
          Client Panel
        </button>
      </div>
    </aside>
  )
}
