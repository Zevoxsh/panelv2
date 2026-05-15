import { create } from 'zustand'
import { api } from '../lib/api'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
}

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const user = await api.post<AuthUser>('/auth/login', { email, password })
    set({ user })
    return user
  },

  logout: async () => {
    await api.post('/auth/logout')
    set({ user: null })
  },

  fetchMe: async () => {
    try {
      const user = await api.get<AuthUser>('/auth/me')
      set({ user, isLoading: false })
    } catch {
      set({ user: null, isLoading: false })
    }
  },
}))
