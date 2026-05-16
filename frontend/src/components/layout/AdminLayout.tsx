import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, LogOut } from 'lucide-react'
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
    <div className="flex h-screen bg-admin-base overflow-hidden">
      {sideOpen && <AdminSidebar />}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="h-12 bg-admin-sidebar border-b border-admin-border/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSideOpen(o => !o)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={18} />
            </button>
            <span className="text-white font-semibold text-sm">Pterodactyl</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setDropOpen(o => !o)}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-teal/30 flex items-center justify-center text-xs font-bold text-teal">
                {user?.username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <span className="hidden sm:block">{user?.username}</span>
              <ChevronDown size={13} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-admin-sidebar border border-admin-border/50 rounded-lg shadow-xl z-50">
                <div className="px-3 py-2 border-b border-admin-border/50">
                  <p className="text-white text-xs font-medium">{user?.username}</p>
                  <p className="text-gray-500 text-[11px]">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors rounded-b-lg"
                >
                  <LogOut size={13} />
                  Logout
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
        <footer className="shrink-0 border-t border-admin-border/50 px-6 py-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>Copyright &copy; 2015 - 2026 Pterodactyl Software</span>
          <span>v1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
