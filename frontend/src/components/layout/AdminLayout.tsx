import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, LogOut, Layers } from 'lucide-react'
import AdminSidebar from './AdminSidebar'
import { useAuth } from '../../hooks/useAuth'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dropOpen, setDropOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(true)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#030609' }}>
      {sideOpen && <AdminSidebar />}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header
          className="h-12 flex items-center justify-between px-5 shrink-0"
          style={{ background: '#020407', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSideOpen(o => !o)}
              className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded-md hover:bg-white/[0.05]"
            >
              <Menu size={17} />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
              >
                <Layers size={12} className="text-white" />
              </div>
              <span className="text-slate-300 font-semibold text-sm">Administration</span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setDropOpen(o => !o)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
            >
              <div className="w-6 h-6 rounded-full bg-teal/20 flex items-center justify-center text-xs font-bold text-teal border border-teal/30">
                {user?.username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <span className="hidden sm:block text-[13px]">{user?.username}</span>
              <ChevronDown size={12} className="text-slate-600" />
            </button>

            {dropOpen && (
              <div
                className="absolute right-0 mt-1.5 w-44 rounded-xl shadow-card z-50 overflow-hidden"
                style={{ background: '#0c1018', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="px-3 py-2.5 border-b border-white/[0.06]">
                  <p className="text-slate-200 text-xs font-semibold">{user?.username}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/[0.07] text-[13px] transition-all"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer
          className="shrink-0 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-700"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span>© 2015 – {new Date().getFullYear()} Pterodactyl Software</span>
          <span>v1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
