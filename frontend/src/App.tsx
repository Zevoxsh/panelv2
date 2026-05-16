import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/login/LoginPage'
import MainLayout from './components/layout/MainLayout'
import AdminLayout from './components/layout/AdminLayout'
import ServersPage from './pages/ServersPage'
import ApiKeysPage from './pages/shared/ApiKeysPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import ApiKeysAdminPage from './pages/admin/ApiKeysAdminPage'
import LocationsPage from './pages/admin/LocationsPage'
import NodesPage from './pages/admin/NodesPage'
import NewNodePage from './pages/admin/NewNodePage'
import NodeDetailPage from './pages/admin/NodeDetailPage'
import EggsPage from './pages/admin/EggsPage'
import NewEggPage from './pages/admin/NewEggPage'
import EggDetailPage from './pages/admin/EggDetailPage'
import ServersAdminPage from './pages/admin/ServersAdminPage'
import NewServerPage from './pages/admin/NewServerPage'
import ServerDetailAdminPage from './pages/admin/ServerDetailAdminPage'
import MountsPage from './pages/admin/MountsPage'
import SettingsPage from './pages/admin/SettingsPage'
import DatabasesAdminPage from './pages/admin/DatabasesAdminPage'
import ServerPage from './pages/client/ServerPage'

function RequireAuth({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-admin-base text-muted text-sm">
        Loading...
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/servers" replace />
  return <Outlet />
}

function AppRoutes() {
  const { fetchMe } = useAuth()
  useEffect(() => { fetchMe() }, [fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Client routes — MainLayout (bg image + navy sidebar) */}
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/servers/:id" element={<ServerPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/account" element={<ApiKeysPage />} />
        </Route>
      </Route>

      {/* Admin routes — AdminLayout (flat dark + teal sidebar) */}
      <Route element={<RequireAuth adminOnly />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/api-keys" element={<ApiKeysAdminPage />} />
          <Route path="/admin/locations" element={<LocationsPage />} />
          <Route path="/admin/nodes" element={<NodesPage />} />
          <Route path="/admin/nodes/new" element={<NewNodePage />} />
          <Route path="/admin/nodes/:id" element={<NodeDetailPage />} />
          <Route path="/admin/eggs" element={<EggsPage />} />
          <Route path="/admin/eggs/new" element={<NewEggPage />} />
          <Route path="/admin/eggs/:id" element={<EggDetailPage />} />
          <Route path="/admin/servers" element={<ServersAdminPage />} />
          <Route path="/admin/servers/new" element={<NewServerPage />} />
          <Route path="/admin/servers/:id" element={<ServerDetailAdminPage />} />
          <Route path="/admin/mounts" element={<MountsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/databases" element={<DatabasesAdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/servers" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
