import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Folder, FileText, File, ChevronRight,
  Upload, FolderPlus, Pencil, Trash2, Download,
  Loader2, X, Check, AlertCircle, FilePlus, MoreHorizontal,
  Save, ArrowLeft,
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

const LANG_LABELS: Record<string, string> = {
  json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML', css: 'CSS',
  js: 'JavaScript', ts: 'TypeScript', py: 'Python', sh: 'Shell', bash: 'Bash',
  java: 'Java', kt: 'Kotlin', lua: 'Lua', sql: 'SQL', md: 'Markdown',
  toml: 'TOML', ini: 'INI', cfg: 'Config', conf: 'Config', properties: 'Properties',
  txt: 'Text', log: 'Log', env: 'Env',
}

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
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FileIcon({ file }: { file: WingsFile }) {
  if (file.directory) return <Folder size={14} className="text-yellow-400/80 shrink-0" />
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTS.has(ext)) return <FileText size={14} className="text-blue-400/70 shrink-0" />
  return <File size={14} className="text-slate-500 shrink-0" />
}

function RenameInput({ current, onConfirm, onCancel }: { current: string; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current)
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); if (val.trim()) onConfirm(val.trim()) }}
      className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()}
        className="flex-1 bg-black/40 border border-blue-500/40 rounded px-2 py-0.5 text-white text-sm outline-none" />
      <button type="submit" className="text-green-400 p-0.5"><Check size={13} /></button>
      <button type="button" onClick={onCancel} className="text-slate-500 p-0.5"><X size={13} /></button>
    </form>
  )
}

// ── Code editor ───────────────────────────────────────────────────────────────
function EditorModal({ serverId, path, onClose }: { serverId: string; path: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)

  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const lang = LANG_LABELS[ext] ?? 'Plain Text'

  const { isLoading, data: fetched } = useQuery({
    queryKey: ['files', 'contents', serverId, path],
    queryFn: () => api.getText(`/client/servers/${serverId}/files/contents?file=${encodeURIComponent(path)}`),
  })

  useEffect(() => {
    if (fetched !== undefined && content === null) setContent(fetched)
  }, [fetched])

  const syncLineNums = useCallback(() => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  async function save() {
    if (content === null || saving) return
    setSaving(true); setError(null)
    try {
      await api.postText(`/client/servers/${serverId}/files/write?file=${encodeURIComponent(path)}`, content)
      setDirty(false); setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart; const end = ta.selectionEnd
      const newVal = (content ?? '').slice(0, start) + '  ' + (content ?? '').slice(end)
      setContent(newVal); setDirty(true)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
    }
  }

  const lineCount = Math.max((content ?? '').split('\n').length, 1)

  // Path breadcrumb
  const segments = path.split('/').filter(Boolean)

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: '#0b0f1a' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0 border-b"
        style={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 text-sm transition-colors pr-3 border-r border-white/[0.07]">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 text-sm flex-1 min-w-0 overflow-hidden">
          <span className="text-slate-600">/</span>
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              <ChevronRight size={12} className="text-slate-700" />
              <span className={i === segments.length - 1 ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                {seg}
              </span>
            </span>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {error && (
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <AlertCircle size={12} /> {error}
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded border font-mono"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)', color: '#94a3b8' }}>
            {lang}
          </span>
          <span className="text-slate-700 text-[11px] hidden sm:block">Ctrl+S to save</span>
          <button
            onClick={save}
            disabled={saving || !dirty || content === null}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white'
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Editor area ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace" }}>
          {/* Line numbers */}
          <div
            ref={lineNumRef}
            className="overflow-hidden select-none shrink-0 text-right"
            style={{
              width: `${String(lineCount).length * 10 + 32}px`,
              background: '#0d1320',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              color: '#3d4f6b',
              fontSize: '12px',
              lineHeight: '21px',
              paddingTop: '16px',
              paddingRight: '12px',
              paddingLeft: '8px',
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content ?? ''}
            onChange={e => { setContent(e.target.value); setDirty(true) }}
            onScroll={syncLineNums}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="flex-1 outline-none resize-none"
            style={{
              background: '#0b0f1a',
              color: '#cdd6f4',
              fontSize: '12px',
              lineHeight: '21px',
              padding: '16px',
              caretColor: '#89b4fa',
            }}
          />
        </div>
      )}

      {/* ── Status bar ── */}
      <div
        className="flex items-center gap-4 px-4 py-1 shrink-0 text-[11px]"
        style={{ background: '#0d1320', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#3d4f6b' }}
      >
        <span>{lineCount} lines</span>
        {dirty && <span className="text-yellow-500/70">● Unsaved changes</span>}
        <span className="ml-auto">{path}</span>
      </div>
    </div>
  )
}

// ── Row context menu ──────────────────────────────────────────────────────────
function RowMenu({ file, onRename, onDownload, onDelete }: {
  file: WingsFile; onRename: () => void; onDownload: () => void; onDelete: () => void
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
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] rounded transition-colors opacity-0 group-hover:opacity-100">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 panel rounded-lg shadow-xl z-20 py-1 border border-white/[0.08]">
          <button onClick={() => { onRename(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <Pencil size={11} /> Rename
          </button>
          {!file.directory && (
            <button onClick={() => { onDownload(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              <Download size={11} /> Download
            </button>
          )}
          <button onClick={() => { onDelete(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30 transition-colors">
            <Trash2 size={11} /> Delete
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
    onSuccess: refresh, onError: (e: any) => setError(e.message),
  })
  const renameMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api.put(`/client/servers/${serverId}/files/rename`, { root: directory, files: [{ from, to }] }),
    onSuccess: () => { setRenaming(null); refresh() }, onError: (e: any) => setError(e.message),
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
    try { await api.upload(`/client/servers/${serverId}/files/upload?directory=${encodeURIComponent(directory)}`, picked); refresh() }
    catch (err: any) { setError(err.message) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
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
        onClose={() => { setEditing(null); refresh() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full panel rounded-xl overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] shrink-0 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 text-sm overflow-x-auto scrollbar-none">
          <button onClick={() => navigate('/')} className="text-slate-600 hover:text-slate-300 transition-colors px-1 shrink-0 font-medium">
            /
          </button>
          <span className="text-slate-600 shrink-0">home</span>
          {crumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              <ChevronRight size={11} className="text-slate-700" />
              <button onClick={() => navigateCrumb(i)}
                className={`px-1 transition-colors ${i === crumbs.length - 1 ? 'text-white font-medium' : 'text-slate-500 hover:text-white'}`}>
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Error */}
        {error && (
          <span className="text-red-400 text-xs flex items-center gap-1 shrink-0">
            <AlertCircle size={11} /> {error}
            <button onClick={() => setError(null)}><X size={11} /></button>
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:bg-white/[0.06] px-2.5 py-1.5 rounded-lg transition-all">
            <FolderPlus size={12} /> New Folder
          </button>
          <button
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:bg-white/[0.06] px-2.5 py-1.5 rounded-lg transition-all">
            <FilePlus size={12} /> New File
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* ── New folder input ── */}
      {newFolderMode && (
        <form onSubmit={e => { e.preventDefault(); if (newFolderName.trim()) mkdirMutation.mutate(newFolderName.trim()) }}
          className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/[0.03] shrink-0">
          <Folder size={13} className="text-yellow-400 shrink-0" />
          <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setNewFolderMode(false)} placeholder="Folder name"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-700" />
          <button type="submit" disabled={mkdirMutation.isPending} className="text-green-400 hover:text-green-300">
            {mkdirMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button type="button" onClick={() => setNewFolderMode(false)} className="text-slate-600 hover:text-white"><X size={13} /></button>
        </form>
      )}

      {/* ── Column headers ── */}
      <div className="grid items-center px-4 py-2 border-b border-white/[0.05] text-[11px] font-semibold uppercase tracking-wider text-slate-600 shrink-0"
        style={{ gridTemplateColumns: '1fr 80px 140px 36px' }}>
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="text-right">Modified</span>
        <span />
      </div>

      {/* ── File rows ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            <Loader2 size={15} className="animate-spin mr-2" /> Loading…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">Failed to load directory</div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Empty directory</div>
        ) : (
          files.map(file => {
            const path = directory === '/' ? `/${file.name}` : `${directory}/${file.name}`
            const canEdit = isEditable(file)
            return (
              <div
                key={file.name}
                className="grid items-center px-4 py-2.5 border-b border-white/[0.03] transition-colors cursor-default group hover:bg-white/[0.03]"
                style={{ gridTemplateColumns: '1fr 80px 140px 36px' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileIcon file={file} />
                  {renaming === file.name ? (
                    <RenameInput current={file.name}
                      onConfirm={to => renameMutation.mutate({ from: file.name, to })}
                      onCancel={() => setRenaming(null)} />
                  ) : (
                    <button
                      className={`text-sm truncate text-left transition-colors ${
                        file.directory || canEdit
                          ? 'text-slate-200 hover:text-blue-300 cursor-pointer'
                          : 'text-slate-400 cursor-default'
                      }`}
                      onClick={() => {
                        if (file.directory) enterDir(file.name)
                        else if (canEdit) setEditing({ path, name: file.name })
                      }}
                    >
                      {file.name}
                    </button>
                  )}
                </div>

                <span className="text-slate-600 text-xs text-right font-mono">{file.directory ? '' : fmt(file.size)}</span>
                <span className="text-slate-600 text-xs text-right">{fmtDate(file.modified)}</span>

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
