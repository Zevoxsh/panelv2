import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Trash2, Egg, Upload, X } from 'lucide-react'

interface EggItem {
  id: string
  name: string
  description: string | null
  dockerImage: string
  createdAt: string
}

interface PtdlEgg {
  meta?: { version?: string }
  name: string
  description?: string
  startup: string
  docker_images?: Record<string, string>
  config?: { stop?: string }
  variables?: Array<{
    name: string; description?: string; env_variable: string
    default_value?: string; user_viewable?: boolean; user_editable?: boolean; rules?: string
  }>
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<PtdlEgg | null>(null)
  const [selectedImage, setSelectedImage] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const dockerImages: Record<string, string> = parsed?.docker_images ?? {}
  const imageEntries = Object.entries(dockerImages)

  function handleFile(file: File) {
    setParseError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as PtdlEgg
        if (!json.name || !json.startup) throw new Error('Format invalide (name/startup manquant)')
        setParsed(json)
        const firstUrl = Object.values(json.docker_images ?? {})[0] ?? ''
        setSelectedImage(firstUrl)
      } catch (err: any) {
        setParseError(err.message)
      }
    }
    reader.readAsText(file)
  }

  const importMutation = useMutation({
    mutationFn: () => api.post('/admin/eggs/import', { data: parsed, dockerImage: selectedImage }),
    onSuccess: () => { onImported(); onClose() },
    onError: (e: Error) => setImportError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-admin-surface border border-admin-border/50 rounded-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border/50">
          <p className="text-white font-semibold text-sm">Importer un egg Pterodactyl</p>
          <button onClick={onClose} className="p-1 text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload size={20} className="text-muted mx-auto mb-2" />
            <p className="text-white text-sm font-medium">Glisser un fichier .json</p>
            <p className="text-muted text-xs mt-0.5">ou cliquer pour sélectionner</p>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          {parseError && <p className="text-red-400 text-xs">{parseError}</p>}

          {parsed && (
            <div className="space-y-3">
              {/* Preview */}
              <div className="bg-base rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Nom</span>
                  <span className="text-white font-medium">{parsed.name}</span>
                </div>
                {parsed.description && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted shrink-0">Description</span>
                    <span className="text-white text-xs text-right">{parsed.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Variables</span>
                  <span className="text-white">{parsed.variables?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Stop</span>
                  <span className="text-white font-mono text-xs">{parsed.config?.stop ?? '^C'}</span>
                </div>
              </div>

              {/* Docker image selector */}
              {imageEntries.length > 0 && (
                <div>
                  <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Image Docker par défaut</label>
                  <select
                    value={selectedImage}
                    onChange={(e) => setSelectedImage(e.target.value)}
                    className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  >
                    {imageEntries.map(([label, url]) => (
                      <option key={url} value={url}>{label} — {url}</option>
                    ))}
                  </select>
                </div>
              )}

              {imageEntries.length === 0 && (
                <p className="text-yellow-400 text-xs">Aucune image Docker trouvée dans le fichier.</p>
              )}

              {importError && <p className="text-red-400 text-xs">{importError}</p>}

              <button
                onClick={() => { setImportError(null); importMutation.mutate() }}
                disabled={!selectedImage || importMutation.isPending}
                className="w-full bg-teal hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {importMutation.isPending ? 'Import en cours...' : `Importer "${parsed.name}"`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EggsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)

  const { data: eggs = [], isLoading } = useQuery<EggItem[]>({
    queryKey: ['admin', 'eggs'],
    queryFn: () => api.get('/admin/eggs'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/eggs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'eggs'] }),
  })

  return (
    <div>
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['admin', 'eggs'] })}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Eggs</h1>
          <p className="text-muted text-sm mt-0.5">{eggs.length} egg{eggs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 text-gray-400 hover:text-white border border-admin-border/50 hover:border-teal/50 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Upload size={14} />
            Importer
          </button>
          <button
            onClick={() => navigate('/admin/eggs/new')}
            className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nouvel egg
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : (
        <div className="bg-admin-surface border border-admin-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/50">
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Nom</th>
                <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3 font-medium">Image Docker</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {eggs.map((egg) => (
                <tr key={egg.id} className="border-b border-admin-border/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/admin/eggs/${egg.id}`} className="text-white font-medium hover:text-teal transition-colors flex items-center gap-2">
                      <Egg size={14} className="text-muted" />
                      {egg.name}
                    </Link>
                    {egg.description && <p className="text-muted text-xs mt-0.5">{egg.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs font-mono">{egg.dockerImage}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Supprimer l'egg "${egg.name}" ?`)) deleteMutation.mutate(egg.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {eggs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center">
                    <Egg size={24} className="text-muted mx-auto mb-2" />
                    <p className="text-muted text-sm">Aucun egg — importe depuis Pterodactyl ou crée-en un manuellement.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
