import { useAuthStore } from '../stores/auth.store'

export function useAuth() {
  const { user, isLoading, login, logout, fetchMe } = useAuthStore()
  return {
    user,
    isLoading,
    isAdmin: user?.role === 'admin',
    isAuthenticated: user !== null,
    login,
    logout,
    fetchMe,
  }
}
