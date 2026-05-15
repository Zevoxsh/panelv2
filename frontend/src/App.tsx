import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/login/LoginPage'
import MainLayout from './components/layout/MainLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import ApiKeysAdminPage from './pages/admin/ApiKeysAdminPage'
import ClientDashboard from './pages/client/ClientDashboard'
import ClientApiKeysPage from './pages/client/ClientApiKeysPage'

function RequireAuth({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base text-muted text-sm">
        Chargement...
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/client" replace />
  return <Outlet />
}

function AppRoutes() {
  const { fetchMe } = useAuth()
  useEffect(() => { fetchMe() }, [fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth adminOnly />}>
        <Route element={<MainLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/api-keys" element={<ApiKeysAdminPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/api-keys" element={<ClientApiKeysPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
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
