import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Folder, FileText, File, ChevronRight, Home,
  Upload, FolderPlus, Pencil, Trash2, Download,
  ArrowLeft, Loader2, X, Check, AlertCircle,
} from 'lucide-react'

interface WingsFile {
  name: string
  created: string
  modified: string
  mode: string
  mode_bits: string
  size: number
  directory: boolean
  file: boolean
  symlink: boolean
  mime: string
}

const TEXT_MIMES = new Set([
  'text/plain', 'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/xml', 'text/xml',
  'text/x-yaml', 'application/x-yaml',
  'text/x-sh', 'text/x-shellscript',
  'text/x-properties',
])
const TEXT_EXTS = new Set([
  'txt', 'json', 'yaml', 'yml', 'xml', 'conf', 'cfg', 'ini', 'properties',
  'sh', 'bash', 'py', 'js', 'ts', 'java', 'kt', 'md', 'log', 'toml', 'env',
  'html', 'css', 'lua', 'sql',
])

function isEditable(f: WingsFile) {
  if (f.directory) return false
  if (TEXT_MIMES.has(f.mime)) return true
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTS.has(ext)
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function FileIcon({ file }: { file: WingsFile }) {
  if (file.directory) return <Folder size={15} className="text-yellow-400 shrink-0" />
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTS.has(ext)) return <FileText size={15} className="text-blue-400 shrink-0" />
  return <File size={15} className="text-zinc-400 shrink-0" />
}

// ── Inline rename input ───────────────────────────────────────────────────────
function RenameInput({
  current, onConfirm, onCancel,
}: { current: string; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current)
  return (
    <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (val.trim()) onConfirm(val.trim()) }}
      className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        className="flex-1 bg-base border border-primary rounded px-2 py-0.5 text-white text-sm outline-none"
      />
      <button type="submit" className="text-green-400 hover:text-green-300 p-0.5"><Check size={13} /></button>
      <button type="button" onClick={onCancel} className="text-zinc-500 hover:text-white p-0.5"><X size={13} /></button>
    </form>
  )
}

// ── Text editor modal ─────────────────────────────────────────────────────────
function EditorModal({
  serverId, path, filename, onClose,
}: { serverId: string; path: string; filename: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { isLoading, data: fetchedContent } = useQuery({
    queryKey: ['files', 'contents', serverId, path],
    queryFn: () => api.getText(`/client/servers/${serverId}/files/contents?file=${encodeURIComponent(path)}`),
  })

  useEffect(() => {
    if (fetchedContent !== undefined && content === null) setContent(fetchedContent)
  }, [fetchedContent])

  async function save() {
    if (content === null) return
    setSaving(true); setError(null)
    try {
      await api.postText(`/client/servers/${serverId}/files/write?file=${encodeURIComponent(path)}`, content)
      setDirty(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted hover:text-white p-1 rounded hover:bg-border transition-colors">
          <ArrowLeft size={16} />
        </button>
        <span className="text-white font-mono text-sm font-medium flex-1 truncate">{path}</span>
        {error && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{error}</span>}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 bg-primary hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Sauvegarder
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <textarea
            value={content ?? ''}
            onChange={e => { setContent(e.target.value); setDirty(true) }}
            spellCheck={false}
            className="w-full h-full bg-[#0d0d0d] text-green-300 font-mono text-xs p-4 outline-none resize-none leading-relaxed"
          />
        )}
      </div>
    </div>
  )
}

// ── Main file manager ─────────────────────────────────────────────────────────
export default function FileManagerTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const [directory, setDirectory] = useState('/')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ path: string; name: string } | null>(null)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const qKey = ['files', serverId, directory]

  const { data: files = [], isLoading, isError } = useQuery<WingsFile[]>({
    queryKey: qKey,
    queryFn: async () => {
      const data: any = await api.get(`/client/servers/${serverId}/files/list?directory=${encodeURIComponent(directory)}`)
      const arr: WingsFile[] = Array.isArray(data) ? data : (data?.contents ?? [])
      return [...arr].sort((a, b) => {
        if (a.directory !== b.directory) return a.directory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    },
  })

  function refresh() { queryClient.invalidateQueries({ queryKey: qKey }) }
  function clearError() { setError(null) }

  // Build breadcrumb segments
  const crumbs = directory === '/'
    ? []
    : directory.split('/').filter(Boolean)

  function navigate(dir: string) {
    setDirectory(dir)
    setRenaming(null)
    setNewFolderMode(false)
    setError(null)
  }

  function navigateCrumb(idx: number) {
    if (idx < 0) { navigate('/'); return }
    navigate('/' + crumbs.slice(0, idx + 1).join('/'))
  }

  function enterDir(name: string) {
    const next = directory === '/' ? `/${name}` : `${directory}/${name}`
    navigate(next)
  }

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/client/servers/${serverId}/files/delete`, { root: directory, files: [name] }),
    onSuccess: refresh,
    onError: (e: any) => setError(e.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api.put(`/client/servers/${serverId}/files/rename`, {
        root: directory,
        files: [{ from, to }],
      }),
    onSuccess: () => { setRenaming(null); refresh() },
    onError: (e: any) => setError(e.message),
  })

  const mkdirMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/client/servers/${serverId}/files/mkdir`, { root: directory, name }),
    onSuccess: () => { setNewFolderMode(false); setNewFolderName(''); refresh() },
    onError: (e: any) => setError(e.message),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return
    setUploading(true); setError(null)
    try {
      await api.upload(`/client/servers/${serverId}/files/upload?directory=${encodeURIComponent(directory)}`, picked)
      refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function downloadFile(name: string) {
    const path = directory === '/' ? `/${name}` : `${directory}/${name}`
    window.open(`/api/client/servers/${serverId}/files/download?file=${encodeURIComponent(path)}`, '_blank')
  }

  if (editing) {
    return (
      <EditorModal
        serverId={serverId}
        path={editing.path}
        filename={editing.name}
        onClose={() => { setEditing(null); refresh() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => navigate('/')}
            className="p-1 text-muted hover:text-white rounded hover:bg-border transition-colors shrink-0"
          >
            <Home size={13} />
          </button>
          {crumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              <ChevronRight size={11} className="text-zinc-600" />
              <button
                onClick={() => navigateCrumb(i)}
                className={`px-1 py-0.5 rounded text-xs transition-colors ${
                  i === crumbs.length - 1
                    ? 'text-white font-medium'
                    : 'text-muted hover:text-white hover:bg-border'
                }`}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {error && (
            <span className="text-red-400 text-xs flex items-center gap-1 mr-1">
              <AlertCircle size={11} /> {error}
              <button onClick={clearError}><X size={11} /></button>
            </span>
          )}
          <button
            onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white border border-border hover:bg-border px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <FolderPlus size={12} /> Nouveau dossier
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs bg-primary hover:bg-purple-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg transition-colors"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Envoyer
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* New folder inline input */}
      {newFolderMode && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (newFolderName.trim()) mkdirMutation.mutate(newFolderName.trim()) }}
          className="flex items-center gap-2 mb-2 px-3 py-2 bg-surface border border-primary rounded-lg"
        >
          <Folder size={14} className="text-yellow-400 shrink-0" />
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setNewFolderMode(false))}
            placeholder="Nom du dossier"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
          />
          <button type="submit" disabled={mkdirMutation.isPending} className="text-green-400 hover:text-green-300">
            {mkdirMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button type="button" onClick={() => setNewFolderMode(false)} className="text-zinc-500 hover:text-white">
            <X size={13} />
          </button>
        </form>
      )}

      {/* File list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm">
            <Loader2 size={15} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">
            Impossible de charger les fichiers
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm">
            Dossier vide
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-border/30 group transition-colors cursor-default"
                onDoubleClick={() => {
                  if (file.directory) enterDir(file.name)
                  else if (isEditable(file)) {
                    const path = directory === '/' ? `/${file.name}` : `${directory}/${file.name}`
                    setEditing({ path, name: file.name })
                  }
                }}
              >
                <FileIcon file={file} />

                {/* Name / rename input */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {renaming === file.name ? (
                    <RenameInput
                      current={file.name}
                      onConfirm={(to) => renameMutation.mutate({ from: file.name, to })}
                      onCancel={() => setRenaming(null)}
                    />
                  ) : (
                    <button
                      className="text-white text-sm truncate text-left hover:underline underline-offset-2"
                      onClick={() => {
                        if (file.directory) enterDir(file.name)
                        else if (isEditable(file)) {
                          const path = directory === '/' ? `/${file.name}` : `${directory}/${file.name}`
                          setEditing({ path, name: file.name })
                        }
                      }}
                    >
                      {file.name}
                    </button>
                  )}
                </div>

                {/* Size */}
                <span className="text-muted text-xs shrink-0 w-16 text-right">
                  {file.directory ? '—' : fmt(file.size)}
                </span>

                {/* Modified */}
                <span className="text-muted text-xs shrink-0 w-28 text-right hidden sm:block">
                  {new Date(file.modified).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setRenaming(file.name)}
                    className="p-1.5 text-muted hover:text-white hover:bg-border rounded transition-colors"
                    title="Renommer"
                  >
                    <Pencil size={12} />
                  </button>
                  {!file.directory && (
                    <button
                      onClick={() => downloadFile(file.name)}
                      className="p-1.5 text-muted hover:text-white hover:bg-border rounded transition-colors"
                      title="Télécharger"
                    >
                      <Download size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer "${file.name}" ?`)) deleteMutation.mutate(file.name)
                    }}
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
