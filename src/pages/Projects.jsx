import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, FolderOpen, Calendar, DollarSign } from 'lucide-react'
import { format } from 'date-fns'

const STATUS = {
  active:    { label: 'Active',    bg: '#CC0000', text: 'white' },
  completed: { label: 'Completed', bg: '#1C1C1C', text: 'white' },
  on_hold:   { label: 'On Hold',   bg: '#F5F5F5', text: '#666'  },
}

export default function Projects() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', client: '', contract_value: '', start_date: '', status: 'active', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data ?? [])
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('projects').insert([form])
    setSaving(false)
    setShowForm(false)
    setForm({ name: '', client: '', contract_value: '', start_date: '', status: 'active', description: '' })
    loadProjects()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Contracts</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Projects / Contracts</h2>
        </div>
        {profile?.role === 'admin' && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
            <Plus className="w-4 h-4" /> Add Project
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">New Project / Contract</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Project Name', key: 'name', type: 'text', required: true },
              { label: 'Client',       key: 'client', type: 'text', required: true },
              { label: 'Contract Value (₦)', key: 'contract_value', type: 'number' },
              { label: 'Start Date',   key: 'start_date', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">{f.label}</label>
                <input
                  type={f.type}
                  required={f.required}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
              style={{ background: '#CC0000' }}>
              {saving ? 'Saving…' : 'Save Project'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No projects yet. Add your first contract.</p>
          </div>
        )}
        {projects.map(p => {
          const s = STATUS[p.status] ?? STATUS.on_hold
          return (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-gray-900 leading-tight">{p.name}</h3>
                <span className="text-xs px-2.5 py-1 rounded-lg font-bold whitespace-nowrap shrink-0"
                  style={{ background: s.bg, color: s.text }}>
                  {s.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">Client: <span className="text-gray-700 font-medium">{p.client}</span></p>
              {p.contract_value && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
                  <span className="font-black text-base" style={{ color: '#CC0000' }}>
                    ₦{Number(p.contract_value).toLocaleString()}
                  </span>
                </div>
              )}
              {p.start_date && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(p.start_date), 'dd MMM yyyy')}
                </div>
              )}
              {p.description && <p className="text-xs text-gray-400 line-clamp-2 border-t pt-2 mt-1" style={{ borderColor: '#F0F0F0' }}>{p.description}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
