import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">P</span>
        </div>
        <span className="text-primary-light font-bold text-sm">MonPanel</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-8 h-8 bg-purple-950 rounded-full flex items-center justify-center text-primary-light hover:bg-purple-900 transition-colors"
        >
          <span className="text-xs font-semibold">{user?.username?.[0]?.toUpperCase() ?? 'U'}</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-10">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-white text-sm font-medium">{user?.username}</p>
              <p className="text-muted text-xs">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-muted hover:text-white hover:bg-border text-sm transition-colors rounded-b-lg"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
