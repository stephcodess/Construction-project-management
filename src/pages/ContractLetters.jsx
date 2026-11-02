import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, FileText, Download, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function ContractLetters() {
  const { profile } = useAuth()
  const [letters, setLetters] = useState([])
  const [projects, setProjects] = useState([])
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ project_id: '', notes: '' })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { loadLetters(); loadProjects() }, [])

  async function loadLetters() {
    const { data } = await supabase.from('contract_letters').select('*, projects(name)').order('created_at', { ascending: false })
    setLetters(data ?? [])
  }

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name')
    setProjects(data ?? [])
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    setUploading(true); setError('')
    const path = `contract-letters/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    await supabase.from('contract_letters').insert([{
      project_id: form.project_id || null, notes: form.notes,
      file_name: file.name, file_path: path, file_url: publicUrl, file_size: file.size,
    }])
    setUploading(false); setFile(null); setForm({ project_id: '', notes: '' })
    loadLetters()
  }

  async function handleDelete(letter) {
    if (!confirm('Delete this contract letter?')) return
    await supabase.storage.from('documents').remove([letter.file_path])
    await supabase.from('contract_letters').delete().eq('id', letter.id)
    loadLetters()
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Documents</p>
        <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Contract Award Letters</h2>
      </div>

      {(profile?.role === 'admin' || profile?.role === 'accountant') && (
        <form onSubmit={handleUpload} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">Upload Contract Letter</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Related Project</label>
              <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none">
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Phase 1 award letter"
                className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'scale-[1.01]' : ''}`}
            style={{ borderColor: dragOver || file ? '#CC0000' : '#E5E5E5', background: dragOver ? '#FFF0F0' : '#FAFAFA' }}
            onClick={() => document.getElementById('file-input').click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}>
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: file ? '#CC0000' : '#F0F0F0' }}>
              <Upload className={`w-5 h-5 ${file ? 'text-white' : 'text-gray-400'}`} />
            </div>
            {file ? (
              <>
                <p className="font-bold text-sm" style={{ color: '#CC0000' }}>{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{formatSize(file.size)}</p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm text-gray-700">Drop file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, JPG, PNG accepted</p>
              </>
            )}
            <input id="file-input" type="file" className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files[0])} />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm border"
              style={{ background: '#FFF0F0', borderColor: '#CC0000', color: '#CC0000' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={uploading}
            className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
            style={{ background: '#CC0000' }}>
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      )}

      {/* Document list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-bold text-gray-900">Uploaded Documents ({letters.length})</h3>
        </div>
        {letters.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F5F5F5' }}>
            {letters.map(l => (
              <div key={l.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF0F0' }}>
                  <FileText className="w-5 h-5" style={{ color: '#CC0000' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{l.file_name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {l.projects?.name && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ background: '#CC0000' }}>
                        {l.projects.name}
                      </span>
                    )}
                    {l.notes && <span className="text-xs text-gray-400">{l.notes}</span>}
                    {l.file_size && <span className="text-xs text-gray-300">{formatSize(l.file_size)}</span>}
                    <span className="text-xs text-gray-300">{format(new Date(l.created_at), 'dd MMM yyyy')}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={l.file_url} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
                    title="Download">
                    <Download className="w-4 h-4 text-gray-500" />
                  </a>
                  {profile?.role === 'admin' && (
                    <button onClick={() => handleDelete(l)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 transition">
                      <Trash2 className="w-4 h-4" style={{ color: '#CC0000' }} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
