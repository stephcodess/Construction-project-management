import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Check, FolderOpen, Search, Upload, FileText } from 'lucide-react'
import { format, subMonths } from 'date-fns'

// ── SVG Sparkline ────────────────────────────────────────────
function Sparkline({ data, color = '#CC0000', width = 72, height = 28 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Mini Bar Chart ───────────────────────────────────────────
function MiniBar({ data, color = '#8896B3', width = 72, height = 28 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const bw = Math.floor(width / data.length) - 2
  return (
    <svg width={width} height={height}>
      {data.map((v, i) => {
        const bh = Math.max((v / max) * (height - 4), 2)
        return (
          <rect key={i} x={i * (bw + 2)} y={height - bh - 2}
            width={bw} height={bh} rx="2"
            fill={color} opacity={i === data.length - 1 ? 1 : 0.4} />
        )
      })}
    </svg>
  )
}

// ── Field / Input helpers ────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">{label}</label>
      {children}
    </div>
  )
}
function Input({ ...props }) {
  return (
    <input {...props}
      className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
      onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
      onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
  )
}

// ── Status badge ─────────────────────────────────────────────
const STATUS_CFG = {
  active:    { label: 'Active',    bg: '#CC0000',  text: 'white' },
  completed: { label: 'Completed', bg: '#1C1C1C',  text: 'white' },
  on_hold:   { label: 'Pending',   bg: '#F5F5F5',  text: '#555'  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.on_hold
  return (
    <span className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

// ── 5-Step Wizard ────────────────────────────────────────────
const STEPS = ['Basic Details', 'Financial Details', 'Status', 'Notes', 'Contract Letter', 'Review']

const EMPTY_FORM = {
  project_number: '', name: '', start_date: '', expected_end_date: '',
  project_manager: '', location: '',
  client: '', contract_value: '', estimated_revenue: '', actual_revenue: '',
  estimated_cost: '', actual_cost: '',
  status: 'active',
  description: '', notes: '',
}

function AddProjectWizard({ onClose, onSaved }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contractFile, setContractFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validateStep() {
    if (step === 1 && !form.name.trim()) { setError('Project Name is required'); return false }
    if (step === 2 && !form.client.trim()) { setError('Client is required'); return false }
    setError(''); return true
  }

  function next() { if (validateStep()) setStep(s => Math.min(s + 1, 6)) }
  function back() { setError(''); setStep(s => Math.max(s - 1, 1)) }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setContractFile(dropped)
  }

  async function handleCreate() {
    setSaving(true)
    const payload = {
      ...form,
      status: form.status,
      contract_value:     Number(form.contract_value)     || null,
      estimated_revenue:  Number(form.estimated_revenue)  || null,
      actual_revenue:     Number(form.actual_revenue)     || null,
      estimated_cost:     Number(form.estimated_cost)     || null,
      actual_cost:        Number(form.actual_cost)        || null,
    }
    const { data: inserted, error: err } = await supabase.from('projects').insert([payload]).select().single()
    if (err) { setError(err.message); setSaving(false); return }

    // Upload contract letter if provided
    if (contractFile && inserted?.id) {
      const path = `contract-letters/${Date.now()}-${contractFile.name}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, contractFile)
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        await supabase.from('contract_letters').insert([{
          project_id: inserted.id,
          notes: form.notes,
          file_name: contractFile.name,
          file_path: path,
          file_url: publicUrl,
          file_size: contractFile.size,
        }])
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const fmt = v => v ? `₦${Number(v).toLocaleString()}` : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-black text-lg" style={{ color: '#1C1C1C' }}>Add New Project</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 px-6 py-4 border-b overflow-x-auto" style={{ borderColor: '#F0F0F0' }}>
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = n < step
            const active = n === step
            return (
              <div key={n} className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all"
                    style={{
                      background: done ? '#1C1C1C' : active ? '#CC0000' : '#F0F0F0',
                      color: done || active ? 'white' : '#999'
                    }}>
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </div>
                  <span className="text-xs font-semibold hidden sm:block"
                    style={{ color: active ? '#CC0000' : done ? '#1C1C1C' : '#999' }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-6 h-0.5 rounded" style={{ background: done ? '#1C1C1C' : '#E5E5E5' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
              style={{ background: '#FFF0F0', borderColor: '#CC0000', color: '#CC0000' }}>
              {error}
            </div>
          )}

          {/* Step 1 — Basic Details */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project #"><Input value={form.project_number} onChange={e => set('project_number', e.target.value)} placeholder="e.g. 101" /></Field>
              <Field label="Project Name *"><Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Project Name" /></Field>
              <Field label="Start Date"><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
              <Field label="Expected End Date"><Input type="date" value={form.expected_end_date} onChange={e => set('expected_end_date', e.target.value)} /></Field>
              <Field label="Project Manager"><Input value={form.project_manager} onChange={e => set('project_manager', e.target.value)} placeholder="Manager Name" /></Field>
              <Field label="Location"><Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Site Location" /></Field>
            </div>
          )}

          {/* Step 2 — Financial Details */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Client *"><Input required value={form.client} onChange={e => set('client', e.target.value)} placeholder="Client Name" /></Field>
              <Field label="Contract Value (₦)"><Input type="number" min="0" value={form.contract_value} onChange={e => set('contract_value', e.target.value)} /></Field>
              <Field label="Estimated Revenue (₦)"><Input type="number" min="0" value={form.estimated_revenue} onChange={e => set('estimated_revenue', e.target.value)} /></Field>
              <Field label="Actual Revenue (₦)"><Input type="number" min="0" value={form.actual_revenue} onChange={e => set('actual_revenue', e.target.value)} /></Field>
              <Field label="Estimated Cost (₦)"><Input type="number" min="0" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} /></Field>
              <Field label="Actual Cost (₦)"><Input type="number" min="0" value={form.actual_cost} onChange={e => set('actual_cost', e.target.value)} /></Field>
            </div>
          )}

          {/* Step 3 — Status */}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              {[
                { value: 'active',    label: 'Active',    desc: 'Currently in progress' },
                { value: 'completed', label: 'Completed', desc: 'Work is finished' },
                { value: 'on_hold',   label: 'Pending',   desc: 'Not yet started or paused' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => set('status', opt.value)}
                  className="p-5 rounded-2xl border-2 text-left transition-all"
                  style={{
                    borderColor: form.status === opt.value ? '#CC0000' : '#E5E5E5',
                    background: form.status === opt.value ? '#FFF0F0' : 'white'
                  }}>
                  <div className="w-3 h-3 rounded-full mb-3"
                    style={{ background: STATUS_CFG[opt.value].bg }} />
                  <p className="font-black text-sm" style={{ color: '#1C1C1C' }}>{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
                  {form.status === opt.value && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
                      <span className="text-xs font-bold" style={{ color: '#CC0000' }}>Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 4 — Notes */}
          {step === 4 && (
            <div className="space-y-4">
              <Field label="Description">
                <textarea rows={4} value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Project scope and objectives…"
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none transition"
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
              </Field>
              <Field label="Internal Notes">
                <textarea rows={3} value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Internal remarks, risks, considerations…"
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none transition"
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
              </Field>
            </div>
          )}

          {/* Step 5 — Contract Letter */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Optionally attach the contract award letter for this project. You can skip this step.</p>
              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'scale-[1.01]' : ''}`}
                style={{ borderColor: dragOver || contractFile ? '#CC0000' : '#E5E5E5', background: dragOver ? '#FFF0F0' : '#FAFAFA' }}
                onClick={() => document.getElementById('wizard-file-input').click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}>
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: contractFile ? '#CC0000' : '#F0F0F0' }}>
                  {contractFile
                    ? <FileText className="w-6 h-6 text-white" />
                    : <Upload className="w-6 h-6 text-gray-400" />}
                </div>
                {contractFile ? (
                  <>
                    <p className="font-bold text-sm" style={{ color: '#CC0000' }}>{contractFile.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatSize(contractFile.size)}</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setContractFile(null) }}
                      className="mt-3 text-xs text-gray-400 underline hover:text-gray-600">
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm text-gray-700">Drop file here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, JPG, PNG accepted</p>
                  </>
                )}
                <input id="wizard-file-input" type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setContractFile(e.target.files[0])} />
              </div>
            </div>
          )}

          {/* Step 6 — Review */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#F9FAFB' }}>
                <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#CC0000' }}>Basic Details</p>
                {[
                  ['Project #', form.project_number || '—'],
                  ['Project Name', form.name],
                  ['Client', form.client],
                  ['Start Date', form.start_date || '—'],
                  ['End Date', form.expected_end_date || '—'],
                  ['Manager', form.project_manager || '—'],
                  ['Location', form.location || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#F9FAFB' }}>
                <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#CC0000' }}>Financials</p>
                {[
                  ['Contract Value', fmt(form.contract_value)],
                  ['Est. Revenue', fmt(form.estimated_revenue)],
                  ['Actual Revenue', fmt(form.actual_revenue)],
                  ['Est. Cost', fmt(form.estimated_cost)],
                  ['Actual Cost', fmt(form.actual_cost)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Status</span>
                <StatusBadge status={form.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Contract Letter</span>
                {contractFile ? (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: '#CC0000' }} />
                    <span className="text-sm font-semibold text-gray-800">{contractFile.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">— Not attached</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#F0F0F0' }}>
          <button onClick={back} disabled={step === 1}
            className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition disabled:opacity-30"
            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
            Back
          </button>
          {step === 5 && (
            <button onClick={() => { setError(''); setStep(6) }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              Skip
            </button>
          )}
          {step < 6 ? (
            <button onClick={next}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
              Next →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const FILTER_TABS = ['All', 'Active', 'Completed', 'Pending']

export default function Projects() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const now = new Date()

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data ?? [])
  }

  // KPI derived data
  const total     = projects.length
  const pending   = projects.filter(p => p.status === 'on_hold').length
  const completed = projects.filter(p => p.status === 'completed').length
  const totalProfit = projects.reduce((s, p) => s + ((Number(p.actual_revenue) || 0) - (Number(p.actual_cost) || 0)), 0)

  // Sparkline — projects created per month last 6 months
  const sparklineData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = format(subMonths(now, 5 - i), 'yyyy-MM')
    return projects.filter(p => p.created_at?.startsWith(m)).length
  }), [projects])

  const pendingData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = format(subMonths(now, 5 - i), 'yyyy-MM')
    return projects.filter(p => p.status === 'on_hold' && p.created_at?.startsWith(m)).length
  }), [projects])

  // Filtered list
  const filtered = useMemo(() => projects.filter(p => {
    const matchFilter = filter === 'All' ||
      (filter === 'Active' && p.status === 'active') ||
      (filter === 'Completed' && p.status === 'completed') ||
      (filter === 'Pending' && p.status === 'on_hold')
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.toLowerCase().includes(search.toLowerCase()) ||
      p.project_number?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  }), [projects, filter, search])

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Contracts</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Active Projects</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border" style={{ borderColor: '#E5E5E5' }}>
            {FILTER_TABS.map(tab => (
              <button key={tab} onClick={() => setFilter(tab)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: filter === tab ? '#1C1C1C' : 'transparent',
                  color: filter === tab ? 'white' : '#888'
                }}>
                {tab}
              </button>
            ))}
          </div>
          {profile?.role === 'admin' && (
            <button onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Total Projects</p>
            <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>{total}</p>
          </div>
          <Sparkline data={sparklineData} color="#CC0000" />
        </div>
        {/* Pending */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Pending</p>
            <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>{pending}</p>
          </div>
          <MiniBar data={pendingData} color="#8896B3" />
        </div>
        {/* Completed */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Completed</p>
            <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>{completed}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F5F5F5' }}>
            <FolderOpen className="w-5 h-5" style={{ color: '#1C1C1C' }} />
          </div>
        </div>
        {/* Total Profit — dark card */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: '#1C1C1C' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Total Profit</p>
            <p className="text-2xl font-black text-white">₦{totalProfit.toLocaleString()}</p>
          </div>
          <div className="flex gap-0.5 items-end h-8">
            {[3,5,4,7,6,8,5].map((v, i) => (
              <div key={i} className="w-1.5 rounded-sm"
                style={{ height: `${v * 4}px`, background: i === 6 ? 'white' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-bold text-gray-900">Project List</h3>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}
              className="border-2 border-transparent bg-gray-50 rounded-xl pl-10 pr-3.5 py-2 text-sm focus:outline-none w-52 transition"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9FAFB' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                {['#', 'Project Name', 'Client', 'Est. Revenue', 'Actual Revenue', 'Est. Cost', 'Actual Cost', 'Net Profit', 'Status'].map(h => (
                  <th key={h} className={`px-5 py-3.5 font-semibold ${['Est. Revenue','Actual Revenue','Est. Cost','Actual Cost','Net Profit'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No projects found.</p>
                  </td>
                </tr>
              )}
              {filtered.map(p => {
                const estRev  = Number(p.estimated_revenue)  || 0
                const actRev  = Number(p.actual_revenue)     || 0
                const estCost = Number(p.estimated_cost)     || 0
                const actCost = Number(p.actual_cost)        || 0
                const net     = actRev - actCost
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{p.project_number || '—'}</td>
                    <td className="px-5 py-3.5 font-bold" style={{ color: '#1C1C1C' }}>{p.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{p.client}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{estRev.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{actRev.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{estCost.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{actCost.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-black"
                      style={{ color: net >= 0 ? '#1C1C1C' : '#CC0000' }}>
                      ₦{net.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showWizard && (
        <AddProjectWizard onClose={() => setShowWizard(false)} onSaved={loadProjects} />
      )}
    </div>
  )
}
