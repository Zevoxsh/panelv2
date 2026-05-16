import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Folder, FileText, File, ChevronRight,
  Upload, FolderPlus, Pencil, Trash2, Download,
  ArrowLeft, Loader2, X, Check, AlertCircle, FilePlus, MoreHorizontal,
} from 'lucide-react'

interface WingsFile {
  name: string; created: string; modified: string
  mode: string; mode_bits: string; size: number
  directory: boolean; file: boolean; symlink: boolean; mime: string
}

const TEXT_MIMES = new Set([
  'text/plain', 'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/xml', 'text/xml',
  'text/x-yaml', 'application/x-yaml', 'text/x-sh', 'text/x-shellscript',
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
  return TEXT_EXTS.has(f.name.split('.').pop()?.toLowerCase() ?? '')
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1048576).toFixed(1)} MiB`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `about ${Math.floor(diff / 3600)} hours ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function FileIcon({ file }: { file: WingsFile }) {
  if (file.directory) return <Folder size={15} className="text-yellow-400 shrink-0" />
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTS.has(ext)) return <FileText size={15} className="text-blue-400 shrink-0" />
  return <File size={15} className="text-gray-400 shrink-0" />
}

function RenameInput({ current, onConfirm, onCancel }: { current: string; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current)
  return (
    <form
      onSubmit={e => { e.preventDefault(); e.stopPropagation(); if (val.trim()) onConfirm(val.trim()) }}
      className="flex items-center gap-1 flex-1"
      onClick={e => e.stopPropagation()}
    >
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        className="flex-1 bg-black/30 border border-primary/50 rounded px-2 py-0.5 text-white text-sm outline-none"
      />
      <button type="submit" className="text-green-400 hover:text-green-300 p-0.5"><Check size={13} /></button>
      <button type="button" onClick={onCancel} className="text-gray-500 hover:text-white p-0.5"><X size={13} /></button>
    </form>
  )
}

function EditorModal({ serverId, path, onClose }: { serverId: string; path: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { isLoading, data: fetched } = useQuery({
    queryKey: ['files', 'contents', serverId, path],
    queryFn: () => api.getText(`/client/servers/${serverId}/files/contents?file=${encodeURIComponent(path)}`),
  })

  useEffect(() => {
    if (fetched !== undefined && content === null) setContent(fetched)
  }, [fetched])

  async function save() {
    if (content === null) return
    setSaving(true); setError(null)
    try {
      await api.postText(`/client/servers/${serverId}/files/write?file=${encodeURIComponent(path)}`, content)
      setDirty(false)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-navy border-b border-white/10 shrink-0">
        <button onClick={onClose} className="text-muted hover:text-white p-1 rounded transition-colors">
          <ArrowLeft size={16} />
        </button>
        <span className="text-white font-mono text-sm font-medium flex-1 truncate">{path}</span>
        {error && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{error}</span>}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 bg-primary hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading…
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

// ── Context menu ──────────────────────────────────────────────────────────────
function RowMenu({ file, onRename, onDownload, onDelete }: {
  file: WingsFile
  onRename: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 text-muted hover:text-white hover:bg-white/10 rounded transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-navy border border-white/10 rounded-lg shadow-xl z-20 py-1">
          <button onClick={() => { onRename(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors">
            <Pencil size={12} /> Rename
          </button>
          {!file.directory && (
            <button onClick={() => { onDownload(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors">
              <Download size={12} /> Download
            </button>
          )}
          <button onClick={() => { onDelete(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FileManagerTab({ serverId }: { serverId: string }) {
  const queryClient = useQueryClient()
  const [directory, setDirectory] = useState('/')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ path: string; name: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const crumbs = directory === '/' ? [] : directory.split('/').filter(Boolean)

  function navigate(dir: string) { setDirectory(dir); setRenaming(null); setNewFolderMode(false); setError(null); setSelected(new Set()) }
  function navigateCrumb(idx: number) { idx < 0 ? navigate('/') : navigate('/' + crumbs.slice(0, idx + 1).join('/')) }
  function enterDir(name: string) { navigate(directory === '/' ? `/${name}` : `${directory}/${name}`) }

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.post(`/client/servers/${serverId}/files/delete`, { root: directory, files: [name] }),
    onSuccess: refresh,
    onError: (e: any) => setError(e.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api.put(`/client/servers/${serverId}/files/rename`, { root: directory, files: [{ from, to }] }),
    onSuccess: () => { setRenaming(null); refresh() },
    onError: (e: any) => setError(e.message),
  })

  const mkdirMutation = useMutation({
    mutationFn: (name: string) => api.post(`/client/servers/${serverId}/files/mkdir`, { root: directory, name }),
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
    } catch (err: any) { setError(err.message) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  function downloadFile(name: string) {
    const path = directory === '/' ? `/${name}` : `${directory}/${name}`
    window.open(`/api/client/servers/${serverId}/files/download?file=${encodeURIComponent(path)}`, '_blank')
  }

  function toggleSelect(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === files.length ? new Set() : new Set(files.map(f => f.name)))
  }

  if (editing) {
    return (
      <EditorModal
        serverId={serverId}
        path={editing.path}
        onClose={() => { setEditing(null); refresh() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full ptero-panel rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto text-sm">
          <button onClick={() => navigate('/')} className="text-muted hover:text-white transition-colors px-1">
            /
          </button>
          <span className="text-muted">home</span>
          {crumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              <ChevronRight size={11} className="text-gray-600" />
              <button
                onClick={() => navigateCrumb(i)}
                className={`px-1 transition-colors ${i === crumbs.length - 1 ? 'text-white' : 'text-muted hover:text-white'}`}
              >
                {seg}
              </button>
            </span>
          ))}
          <ChevronRight size={11} className="text-gray-600 shrink-0" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {error && (
            <span className="text-red-400 text-xs flex items-center gap-1">
              <AlertCircle size={11} />{error}
              <button onClick={() => setError(null)}><X size={11} /></button>
            </span>
          )}
          <button
            onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
            className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
          >
            <FolderPlus size={12} /> Create Directory
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-white bg-primary hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
          </button>
          <button
            className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
          >
            <FilePlus size={12} /> New file
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* New folder input */}
      {newFolderMode && (
        <form
          onSubmit={e => { e.preventDefault(); if (newFolderName.trim()) mkdirMutation.mutate(newFolderName.trim()) }}
          className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/5"
        >
          <Folder size={14} className="text-yellow-400 shrink-0" />
          <input
            autoFocus value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setNewFolderMode(false)}
            placeholder="Folder name"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
          />
          <button type="submit" disabled={mkdirMutation.isPending} className="text-green-400 hover:text-green-300">
            {mkdirMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button type="button" onClick={() => setNewFolderMode(false)} className="text-gray-500 hover:text-white">
            <X size={13} />
          </button>
        </form>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[32px_1fr_100px_180px_40px] items-center px-4 py-2 border-b border-white/[0.06] text-xs text-muted">
        <input
          type="checkbox"
          checked={files.length > 0 && selected.size === files.length}
          onChange={toggleAll}
          className="accent-primary"
        />
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="text-right">Last Updated</span>
        <span />
      </div>

      {/* File rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm">
            <Loader2 size={15} className="animate-spin mr-2" /> Loading…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">Failed to load files</div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm">Empty directory</div>
        ) : (
          files.map(file => {
            const path = directory === '/' ? `/${file.name}` : `${directory}/${file.name}`
            return (
              <div
                key={file.name}
                className={`grid grid-cols-[32px_1fr_100px_180px_40px] items-center px-4 py-2.5 transition-colors cursor-default group ${
                  selected.has(file.name) ? 'bg-primary/10' : 'hover:bg-white/[0.04]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(file.name)}
                  onChange={() => toggleSelect(file.name)}
                  onClick={e => e.stopPropagation()}
                  className="accent-primary"
                />

                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon file={file} />
                  {renaming === file.name ? (
                    <RenameInput
                      current={file.name}
                      onConfirm={to => renameMutation.mutate({ from: file.name, to })}
                      onCancel={() => setRenaming(null)}
                    />
                  ) : (
                    <button
                      className="text-white text-sm truncate text-left hover:text-primary transition-colors"
                      onClick={() => {
                        if (file.directory) enterDir(file.name)
                        else if (isEditable(file)) setEditing({ path, name: file.name })
                      }}
                    >
                      {file.name}
                    </button>
                  )}
                </div>

                <span className="text-muted text-xs text-right">{file.directory ? '' : fmt(file.size)}</span>
                <span className="text-muted text-xs text-right">{fmtDate(file.modified)}</span>

                <RowMenu
                  file={file}
                  onRename={() => setRenaming(file.name)}
                  onDownload={() => downloadFile(file.name)}
                  onDelete={() => { if (confirm(`Delete "${file.name}"?`)) deleteMutation.mutate(file.name) }}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
