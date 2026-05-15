import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/client')
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const logged = await login(email, password)
      navigate(logged.role === 'admin' ? '/admin' : '/client')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-base">
      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-purple-950 to-surface p-12">
        <div className="w-16 h-16 bg-primary rounded-2xl mb-6 flex items-center justify-center">
          <span className="text-white text-2xl font-bold">P</span>
        </div>
        <h1 className="text-primary-light text-3xl font-bold mb-3">MonPanel</h1>
        <p className="text-muted text-center text-sm max-w-xs">
          Gestion de serveurs de jeux — rapide, fiable, sous ton contrôle.
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">P</span>
            </div>
            <span className="text-primary-light font-bold text-xl">MonPanel</span>
          </div>

          <h2 className="text-white text-2xl font-bold mb-2">Connexion</h2>
          <p className="text-muted text-sm mb-8">Entrez vos identifiants pour accéder au panel.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-base border border-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="admin@panel.local"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-base border border-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
