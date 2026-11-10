import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { format } from 'date-fns'
import {
  Upload, FileText, Trash2, Download, Search, X, FolderOpen, File,
  FileImage, FilePlus, Eye, Plus
} from 'lucide-react'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import Pagination, { usePagination } from '../components/Pagination'

const DEFAULT_DOC_TYPES = ['Contract', 'Drawing', 'BOQ', 'Permit', 'Invoice', 'Report', 'Other']

function useExtendableList(storageKey, defaults) {
  const [list, setList] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const extra = JSON.parse(saved)
        const merged = [...defaults]
        extra.forEach(item => { if (!merged.includes(item)) merged.push(item) })
        return merged
      }
    } catch {}
    return defaults
  })
  function addItem(item) {
    const trimmed = item.trim()
    if (!trimmed || list.includes(trimmed)) return
    const newList = [...list, trimmed]
    setList(newList)
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList.filter(i => !defaults.includes(i))))
    } catch {}
  }
  return [list, addItem]
}

function AddTypeInline({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  const ref             = useRef(null)
  function open_() { setOpen(true); setTimeout(() => ref.current?.focus(), 0) }
  function confirm() { if (val.trim()) { onAdd(val); setVal('') } setOpen(false) }
  if (!open) return (
    <button type="button" onClick={open_}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 border-dashed transition-all"
      style={{ borderColor: '#CC0000', color: '#CC0000' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,0,0,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Plus className="w-3 h-3" /> Add Type
    </button>
  )
  return (
    <div className="flex items-center gap-1.5 border-2 rounded-lg px-2 py-1" style={{ borderColor: '#CC0000' }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm() } if (e.key === 'Escape') { setOpen(false); setVal('') } }}
        placeholder="Type name…"
        className="text-xs outline-none w-20 bg-transparent" />
      <button type="button" onClick={confirm} className="text-[10px] font-black" style={{ color: '#CC0000' }}>✓</button>
      <button type="button" onClick={() => { setOpen(false); setVal('') }} className="text-[10px] text-gray-400">✕</button>
    </div>
  )
}

const TYPE_COLORS = {
  Contract: { bg: '#FFF0F0', color: '#CC0000', border: '#FECACA' },
  Drawing:  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  BOQ:      { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  Permit:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  Invoice:  { bg: '#FDF4FF', color: '#9333EA', border: '#E9D5FF' },
  Report:   { bg: '#F0F9FF', color: '#0284C7', border: '#BAE6FD' },
  Other:    { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
}

function fileIcon(mimeOrName) {
  const name = (mimeOrName || '').toLowerCase()
  if (name.includes('pdf'))  return FileText
  if (name.match(/jpe?g|png|gif|webp|svg/)) return FileImage
  return File
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function TypeBadge({ type }) {
  const cfg = TYPE_COLORS[type] ?? TYPE_COLORS.Other
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      {type}
    </span>
  )
}

// ── Upload Modal ──────────────────────────────────────────────
function UploadModal({ projects, defaultProjectId, onClose, onSaved }) {
  const [file, setFile]       = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm]       = useState({
    project_id: defaultProjectId || '',
    doc_type: 'Contract',
    description: '',
  })
  const [docTypes, addDocType] = useExtendableList('doc_types', DEFAULT_DOC_TYPES)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const inputRef              = useRef(null)

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer?.files?.[0] ?? e.target.files?.[0]
    if (f) setFile(f)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!file) { setError('Please select a file.'); return }
    if (!form.project_id) { setError('Please select a project.'); return }
    setSaving(true)
    setError('')

    const path = `project-docs/${form.project_id}/${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
    if (uploadErr) { setSaving(false); setError(uploadErr.message); return }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('project_documents').insert([{
      project_id:  form.project_id,
      doc_type:    form.doc_type,
      description: form.description.trim() || null,
      file_name:   file.name,
      file_path:   path,
      file_url:    publicUrl,
      file_size:   file.size,
    }])

    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    logActivity({ action: 'document_uploaded', entity_type: 'document', entity_name: file.name, meta: { doc_type: form.doc_type } })
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'linear-gradient(135deg,#1C1C1C,#2E2E2E)', borderColor: '#2E2E2E' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-white">Upload Document</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm border" style={{ background: '#FFF0F0', borderColor: '#CC0000', color: '#CC0000' }}>{error}</div>
          )}

          {/* File drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
            style={{ borderColor: dragOver ? '#CC0000' : '#E5E5E5', background: dragOver ? '#FFF0F0' : '#FAFAFA' }}
          >
            {file ? (
              <>
                <FileText className="w-6 h-6" style={{ color: '#CC0000' }} />
                <p className="text-sm font-semibold text-gray-800 text-center">{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-300" />
                <p className="text-xs text-gray-400">Drag & drop or <span className="font-semibold" style={{ color: '#CC0000' }}>browse</span></p>
                <p className="text-xs text-gray-300">PDF, DOC, XLS, JPG, PNG</p>
              </>
            )}
            <input ref={inputRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.dwg"
              onChange={handleDrop} />
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Project *</label>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}>
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Document Type</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {docTypes.map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, doc_type: t }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all"
                  style={{
                    borderColor: form.doc_type === t ? '#CC0000' : '#E5E5E5',
                    background:  form.doc_type === t ? '#FFF0F0' : 'transparent',
                    color:       form.doc_type === t ? '#CC0000' : '#888',
                  }}>
                  {t}
                </button>
              ))}
              <AddTypeInline onAdd={type => { addDocType(type); setForm(f => ({ ...f, doc_type: type })) }} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Signed contract — revision 2"
              className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
              {saving ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" onClick={onClose}
              className="border-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Documents() {
  const { profile }                       = useAuth()
  const { activeProject }                 = useProject()
  const [docs, setDocs]                   = useState([])
  const [projects, setProjects]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('All')
  const [showUpload, setShowUpload]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting]           = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'accountant'
  const [docTypes, addDocType] = useExtendableList('doc_types', DEFAULT_DOC_TYPES)

  useEffect(() => {
    supabase.from('projects').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  useEffect(() => { loadDocs() }, [activeProject?.id])

  async function loadDocs() {
    setLoading(true)
    let q = supabase.from('project_documents')
      .select('*, projects(name)')
      .order('created_at', { ascending: false })
    if (activeProject) q = q.eq('project_id', activeProject.id)
    const { data } = await q
    setDocs(data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    await supabase.storage.from('documents').remove([confirmDelete.file_path])
    await supabase.from('project_documents').delete().eq('id', confirmDelete.id)
    setDeleting(false)
    setConfirmDelete(null)
    loadDocs()
  }

  const filtered = docs.filter(d => {
    const matchType    = typeFilter === 'All' || d.doc_type === typeFilter
    const matchSearch  = !search ||
      d.file_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase()) ||
      d.projects?.name?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const { page, setPage, totalPages, paginated, total } = usePagination(filtered, 15)

  const typeCounts = docTypes.reduce((acc, t) => {
    acc[t] = docs.filter(d => d.doc_type === t).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Files</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>
            Documents
            {activeProject && <span className="text-base font-semibold ml-2" style={{ color: '#888' }}>— {activeProject.name}</span>}
          </h2>
        </div>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
            <FilePlus className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {/* Type summary pills */}
      <div className="flex flex-wrap gap-2">
        {['All', ...docTypes].map(t => {
          const count = t === 'All' ? docs.length : (typeCounts[t] ?? 0)
          const isActive = typeFilter === t
          return (
            <button key={t} onClick={() => { setTypeFilter(t); setPage(1) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
              style={{
                background:  isActive ? '#1C1C1C' : 'white',
                borderColor: isActive ? '#1C1C1C' : '#E5E5E5',
                color:       isActive ? 'white' : '#555',
              }}>
              {t}
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black"
                style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#F0F0F0', color: isActive ? 'white' : '#888' }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search files, projects…"
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border-2 border-transparent text-sm focus:outline-none shadow-sm transition"
          onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
          onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
      </div>

      {/* Documents grid / table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center py-20 gap-4">
          <FolderOpen className="w-12 h-12 text-gray-200" />
          <p className="text-gray-400 font-medium">No documents found</p>
          {isAdmin && (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
              <FilePlus className="w-4 h-4" /> Upload your first document
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F9F9F9' }}>
                <tr className="text-xs text-gray-400 uppercase tracking-widest">
                  {['File', 'Type', 'Project', 'Description', 'Size', 'Uploaded', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 font-semibold text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(doc => {
                  const Icon = fileIcon(doc.file_name)
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: '#FFF0F0' }}>
                            <Icon className="w-4 h-4" style={{ color: '#CC0000' }} />
                          </div>
                          <span className="font-semibold text-gray-800 truncate max-w-[180px]">{doc.file_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><TypeBadge type={doc.doc_type ?? 'Other'} /></td>
                      <td className="px-5 py-3.5 text-gray-500 text-sm">{doc.projects?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-sm max-w-[200px] truncate">{doc.description ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">
                        {doc.created_at ? format(new Date(doc.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg transition hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                            title="View / Download">
                            <Eye className="w-4 h-4" />
                          </a>
                          <a href={doc.file_url} download={doc.file_name}
                            className="p-1.5 rounded-lg transition hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            title="Download">
                            <Download className="w-4 h-4" />
                          </a>
                          {isAdmin && (
                            <button onClick={() => setConfirmDelete(doc)}
                              className="p-1.5 rounded-lg transition hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPageChange={setPage} />
        </div>
      )}

      {showUpload && (
        <UploadModal
          projects={projects}
          defaultProjectId={activeProject?.id ?? ''}
          onClose={() => setShowUpload(false)}
          onSaved={loadDocs}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          title="Delete Document?"
          description={`"${confirmDelete.file_name}" will be permanently removed from storage.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
