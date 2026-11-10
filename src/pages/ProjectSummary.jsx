import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProject } from '../context/ProjectContext'
import { useCompany } from '../context/CompanyContext'
import { exportProjectPLPDF, exportInvoicePDF } from '../lib/pdf'
import { logActivity } from '../lib/activity'
import {
  ArrowLeft, TrendingUp, TrendingDown, FileText, FilePlus,
  Calendar, MapPin, User, Hash, Building2, ChevronRight,
  CircleDollarSign, AlertCircle, CheckCircle2, Clock,
  Receipt, FolderOpen, Download, ExternalLink, BarChart3,
  Layers, Activity, Percent, Banknote, FileCheck,
  Plus, Check, Pencil, Trash2, Flag, X,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays, isPast, isFuture } from 'date-fns'
import InfoTooltip from '../components/InfoTooltip'

// ─── helpers ────────────────────────────────────────────────────────────────
const RED   = '#CC0000'
const DARK  = '#1C1C1C'
const BG    = '#F5F5F5'

function fmt(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function shortMoney(n) {
  const v = Math.abs(Number(n) || 0)
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `₦${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `₦${(v / 1_000).toFixed(1)}K`
  return `₦${v.toFixed(0)}`
}

const STATUS_CFG = {
  active:    { label: 'Active',    bg: '#DCFCE7', color: '#16A34A', dot: '#22C55E' },
  completed: { label: 'Completed', bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  on_hold:   { label: 'On Hold',   bg: '#FEF9C3', color: '#A16207', dot: '#EAB308' },
}
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: '#F3F4F6', color: '#374151', dot: '#9CA3AF' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, value, sub, icon: Icon, accent = false, red = false, trend, info }) {
  const bg    = red ? RED : accent ? DARK : 'white'
  const color = (red || accent) ? 'white' : DARK
  const muted = (red || accent) ? 'rgba(255,255,255,0.65)' : '#6B7280'
  return (
    <div className="rounded-2xl p-5 shadow-sm flex flex-col gap-3"
      style={{ background: bg, border: accent || red ? 'none' : '1px solid #EBEBEB' }}>
      <div className="flex items-start justify-between">
        <p className="flex items-center text-xs font-bold uppercase tracking-widest" style={{ color: muted }}>
          {label}
          {info && <InfoTooltip text={info} size={11} />}
        </p>
        {Icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: (red || accent) ? 'rgba(255,255,255,0.15)' : '#F5F5F5' }}>
            <Icon className="w-4 h-4" style={{ color: (red || accent) ? 'white' : RED }} />
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-black leading-none" style={{ color }}>{value}</p>
        {sub && <p className="text-xs mt-1 font-medium" style={{ color: muted }}>{sub}</p>}
      </div>
      {trend != null && (
        <div className="flex items-center gap-1">
          {trend >= 0
            ? <TrendingUp className="w-3.5 h-3.5" style={{ color: (red || accent) ? 'rgba(255,255,255,0.7)' : '#16A34A' }} />
            : <TrendingDown className="w-3.5 h-3.5" style={{ color: (red || accent) ? 'rgba(255,255,255,0.7)' : RED }} />}
          <span className="text-xs font-bold" style={{ color: muted }}>
            {trend >= 0 ? '+' : ''}{fmt(trend)} vs estimate
          </span>
        </div>
      )}
    </div>
  )
}

function ProgressBar({ value, max, color = RED, bg = '#F0F0F0', height = 8 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: bg, height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function SectionTitle({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FFF0F0' }}>
          <Icon className="w-4 h-4" style={{ color: RED }} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: DARK }}>{title}</h3>
      </div>
      {action}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 md:p-6 ${className}`}
      style={{ border: '1px solid #EBEBEB' }}>
      {children}
    </div>
  )
}

// ─── Invoice status badge ────────────────────────────────────────────────────
const INV_STATUS = {
  draft:     { label: 'Draft',     bg: '#F3F4F6', color: '#6B7280' },
  sent:      { label: 'Sent',      bg: '#EFF6FF', color: '#1D4ED8' },
  partial:   { label: 'Partial',   bg: '#FEF9C3', color: '#A16207' },
  paid:      { label: 'Paid',      bg: '#DCFCE7', color: '#16A34A' },
  overdue:   { label: 'Overdue',   bg: '#FFF0F0', color: RED       },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', color: '#9CA3AF' },
}
function InvBadge({ status }) {
  const cfg = INV_STATUS[status] ?? INV_STATUS.draft
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

// ─── Horizontal bar chart for categories ────────────────────────────────────
function CategoryBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold truncate max-w-[55%]" style={{ color: '#374151' }}>{label}</span>
        <span className="font-bold tabular-nums" style={{ color: DARK }}>₦{fmt(value)}</span>
      </div>
      <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: '#F0F0F0' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Milestone helpers ────────────────────────────────────────────────────────
const MILESTONE_STATUS_CFG = {
  pending:     { label: 'Pending',     color: '#9CA3AF', bg: '#F3F4F6', dot: '#9CA3AF' },
  in_progress: { label: 'In Progress', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  completed:   { label: 'Completed',   color: '#16A34A', bg: '#DCFCE7', dot: '#22C55E' },
  delayed:     { label: 'Delayed',     color: RED,       bg: '#FFF0F0', dot: RED       },
}
function mStatusColor(status) {
  return (MILESTONE_STATUS_CFG[status] ?? MILESTONE_STATUS_CFG.pending).dot
}
function MilestoneBadge({ status }) {
  const cfg = MILESTONE_STATUS_CFG[status] ?? MILESTONE_STATUS_CFG.pending
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

const DEFAULT_PHASES = ['Foundation', 'Superstructure', 'Roofing', 'MEP', 'Finishing', 'Commissioning', 'Handover']

const PHASE_COLORS = {
  Foundation:     '#6366F1',
  Superstructure: '#F59E0B',
  Roofing:        '#10B981',
  MEP:            '#3B82F6',
  Finishing:      '#EC4899',
  Commissioning:  '#8B5CF6',
  Handover:       '#16A34A',
}
function phaseColor(phase) {
  return PHASE_COLORS[phase] ?? '#6B7280'
}

function PhasePill({ phase }) {
  if (!phase) return null
  const c = phaseColor(phase)
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: c + '20', color: c }}>
      {phase}
    </span>
  )
}

// ─── Milestones Section ──────────────────────────────────────────────────────
function MilestonesSection({ milestones, projectId, onAdd, onEdit, onDelete }) {
  const completed = milestones.filter(m => m.status === 'completed').length
  const total     = milestones.length

  return (
    <Card>
      <SectionTitle
        icon={Flag}
        title="Project Milestones"
        action={
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="text-xs text-gray-500 font-semibold">
                {completed}/{total} completed
              </span>
            )}
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity"
              style={{ background: RED }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus className="w-3.5 h-3.5" /> Add Milestone
            </button>
          </div>
        }
      />

      {/* Progress bar across all milestones */}
      {total > 0 && (
        <div className="mb-5">
          <ProgressBar value={completed} max={total} color="#16A34A" height={6} />
          <p className="text-[11px] text-gray-400 mt-1">
            {completed} of {total} milestone{total !== 1 ? 's' : ''} completed
          </p>
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Flag className="w-8 h-8 text-gray-200 mb-2" />
          <p className="text-xs text-gray-400 font-semibold">No milestones yet</p>
          <p className="text-[11px] text-gray-300 mt-1">Add milestones to track project phases and key deliverables</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical spine */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5" style={{ background: '#E5E5E5' }} />

          {milestones.map((m, idx) => {
            const hasActual    = !!m.actual_date
            const isCompleted  = m.status === 'completed'
            const expectedDate = m.expected_date ? new Date(m.expected_date) : null
            const actualDate   = m.actual_date   ? new Date(m.actual_date)   : null

            let variance = null
            let varianceLabel = null
            if (hasActual && expectedDate && actualDate) {
              variance = differenceInDays(actualDate, expectedDate)
              varianceLabel = variance === 0
                ? 'On time'
                : variance > 0
                  ? `${variance}d late`
                  : `${Math.abs(variance)}d early`
            } else if (!isCompleted && expectedDate) {
              const daysLeft = differenceInDays(expectedDate, new Date())
              if (daysLeft < 0) {
                varianceLabel = `${Math.abs(daysLeft)}d overdue`
              } else if (daysLeft === 0) {
                varianceLabel = 'Due today'
              } else {
                varianceLabel = `${daysLeft}d remaining`
              }
            }

            const isOverdue  = !isCompleted && expectedDate && isPast(expectedDate)
            const varColor   = hasActual
              ? (variance === null || variance <= 0 ? '#16A34A' : RED)
              : (isOverdue ? RED : '#16A34A')

            return (
              <div key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Status dot */}
                <div
                  className="relative z-10 w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center shrink-0"
                  style={{ background: mStatusColor(m.status), marginTop: '2px' }}
                >
                  {isCompleted && <Check className="w-3 h-3 text-white" />}
                </div>

                {/* Content card */}
                <div className="flex-1 bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid #EBEBEB' }}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-black truncate" style={{ color: DARK }}>{m.name}</span>
                      {m.phase && <PhasePill phase={m.phase} />}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <MilestoneBadge status={m.status} />
                      <button
                        onClick={() => onEdit(m)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(m)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {m.description && (
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{m.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Expected</p>
                      <p className="text-xs font-bold" style={{ color: DARK }}>
                        {m.expected_date ? format(new Date(m.expected_date), 'dd MMM yyyy') : '—'}
                      </p>
                    </div>
                    {hasActual && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Actual</p>
                        <p className="text-xs font-bold" style={{ color: '#16A34A' }}>
                          {format(new Date(m.actual_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                    )}
                    {varianceLabel && (
                      <div className="ml-auto">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            background: varColor + '18',
                            color: varColor,
                          }}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {varianceLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Milestone Modal ─────────────────────────────────────────────────────────
function MilestoneModal({ projectId, milestone, onClose, onSaved }) {
  const isEdit = !!milestone
  const EMPTY = {
    name: '', phase: '', expected_date: '', actual_date: '',
    status: 'pending', description: '', sort_order: 0,
  }
  const [form, setForm] = useState(isEdit ? {
    name:          milestone.name          ?? '',
    phase:         milestone.phase         ?? '',
    expected_date: milestone.expected_date ?? '',
    actual_date:   milestone.actual_date   ?? '',
    status:        milestone.status        ?? 'pending',
    description:   milestone.description   ?? '',
    sort_order:    milestone.sort_order    ?? 0,
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [phases, setPhases] = useState(DEFAULT_PHASES)
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhase,    setNewPhase]    = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.name.trim()) { setError('Milestone name is required'); return }
    if (!form.expected_date) { setError('Expected date is required'); return }
    setSaving(true)
    setError('')
    const payload = {
      project_id:    projectId,
      name:          form.name.trim(),
      phase:         form.phase || null,
      expected_date: form.expected_date,
      actual_date:   form.actual_date || null,
      status:        form.status,
      description:   form.description.trim() || null,
      sort_order:    Number(form.sort_order) || 0,
    }
    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('milestones').update(payload).eq('id', milestone.id))
    } else {
      ;({ error: err } = await supabase.from('milestones').insert([payload]))
      if (!err) {
        logActivity({
          action: 'milestone_added',
          entity_type: 'milestone',
          entity_name: form.name,
          meta: { project_id: projectId, phase: form.phase },
        })
      }
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const inputCls = "w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 overflow-hidden shrink-0"
          style={{ background: DARK }}>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20" style={{ background: RED }} />
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-white/50 mb-0.5">
              {isEdit ? 'Edit Milestone' : 'Add Milestone'}
            </p>
            <h3 className="font-black text-lg text-white leading-tight">
              {isEdit ? milestone.name : 'New Milestone'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition z-10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm border"
              style={{ background: '#FFF0F0', borderColor: RED, color: RED }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Name *
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Foundation Completion"
              className={inputCls}
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            />
          </div>

          {/* Phase */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Phase</label>
              {!addingPhase && (
                <button type="button" onClick={() => setAddingPhase(true)}
                  className="flex items-center gap-1 text-xs font-semibold transition"
                  style={{ color: RED }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            {addingPhase && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={newPhase}
                  onChange={e => setNewPhase(e.target.value)}
                  placeholder="New phase name…"
                  className="border rounded-lg px-2 py-1 text-xs flex-1 focus:outline-none"
                  style={{ borderColor: RED }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (newPhase.trim() && !phases.includes(newPhase.trim())) {
                        setPhases(p => [...p, newPhase.trim()])
                        set('phase', newPhase.trim())
                      }
                      setNewPhase(''); setAddingPhase(false)
                    }
                    if (e.key === 'Escape') { setAddingPhase(false); setNewPhase('') }
                  }}
                />
                <button type="button"
                  onClick={() => {
                    if (newPhase.trim() && !phases.includes(newPhase.trim())) {
                      setPhases(p => [...p, newPhase.trim()])
                      set('phase', newPhase.trim())
                    }
                    setNewPhase(''); setAddingPhase(false)
                  }}
                  className="text-xs font-bold px-2 py-1 rounded-lg text-white"
                  style={{ background: RED }}>OK</button>
                <button type="button" onClick={() => { setAddingPhase(false); setNewPhase('') }}
                  className="text-xs text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <select
              value={form.phase}
              onChange={e => set('phase', e.target.value)}
              className={inputCls}
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              <option value="">— None —</option>
              {phases.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Expected Date *
              </label>
              <input
                type="date"
                value={form.expected_date}
                onChange={e => set('expected_date', e.target.value)}
                className={inputCls}
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Actual Date
              </label>
              <input
                type="date"
                value={form.actual_date}
                onChange={e => set('actual_date', e.target.value)}
                className={inputCls}
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className={inputCls}
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this milestone…"
              className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none transition"
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            />
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Sort Order
            </label>
            <input
              type="number"
              min="0"
              value={form.sort_order}
              onChange={e => set('sort_order', e.target.value)}
              className={inputCls}
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: '#F0F0F0' }}>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition"
            style={{ borderColor: '#E5E5E5', color: DARK }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
            style={{ background: RED }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = RED }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Milestone'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Milestone Delete Confirm ─────────────────────────────────────────────────
function MilestoneDeleteConfirm({ milestone, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: '#FFF0F0' }}>
          <Trash2 className="w-6 h-6" style={{ color: RED }} />
        </div>
        <h3 className="text-base font-black text-center mb-1" style={{ color: DARK }}>Delete Milestone?</h3>
        <p className="text-sm text-gray-500 text-center mb-5">
          "<span className="font-semibold">{milestone.name}</span>" will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition"
            style={{ borderColor: '#E5E5E5', color: DARK }}>
            Cancel
          </button>
          <button
            onClick={async () => { setDeleting(true); await onConfirm() }}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
            style={{ background: RED }}
            onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = '#AA0000' }}
            onMouseLeave={e => { if (!deleting) e.currentTarget.style.background = RED }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProjectSummary() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setActiveProject } = useProject()
  const { company } = useCompany()

  const [project,    setProject]    = useState(null)
  const [journal,    setJournal]    = useState([])
  const [invoices,   setInvoices]   = useState([])
  const [documents,  setDocuments]  = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading,    setLoading]    = useState(true)

  // Milestone modal state
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editingMilestone,   setEditingMilestone]   = useState(null)
  const [deletingMilestone,  setDeletingMilestone]  = useState(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('journal_entries').select('*').eq('project_id', id).order('date', { ascending: false }),
      supabase.from('invoices').select('*').eq('project_id', id).order('invoice_date', { ascending: false }),
      supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('milestones').select('*').eq('project_id', id).order('sort_order').order('expected_date'),
    ]).then(([p, j, inv, docs, ms]) => {
      setProject(p.data)
      setJournal(j.data ?? [])
      setInvoices(inv.data ?? [])
      setDocuments(docs.data ?? [])
      setMilestones(ms.data ?? [])
      if (p.data) setActiveProject(p.data)
      setLoading(false)
    })
  }, [id])

  async function refetchMilestones() {
    const { data } = await supabase.from('milestones').select('*').eq('project_id', id).order('sort_order').order('expected_date')
    setMilestones(data ?? [])
  }

  // ── Derived financials ──────────────────────────────────────────────────
  const receipts = useMemo(() => journal.filter(e => e.type === 'receipt'), [journal])
  const payments = useMemo(() => journal.filter(e => e.type === 'payment'), [journal])
  const totalInflow  = useMemo(() => receipts.reduce((s, e) => s + Number(e.amount), 0), [receipts])
  const totalOutflow = useMemo(() => payments.reduce((s, e) => s + Number(e.amount), 0), [payments])
  const netCash = totalInflow - totalOutflow

  const totalBilled      = useMemo(() => invoices.reduce((s, i) => s + Number(i.total_amount), 0), [invoices])
  const totalCollected   = useMemo(() => invoices.reduce((s, i) => s + Number(i.amount_paid),   0), [invoices])
  const totalOutstanding = totalBilled - totalCollected
  const overdueInvoices  = useMemo(() => invoices.filter(i =>
    i.due_date && isPast(new Date(i.due_date)) && i.status !== 'paid' && i.status !== 'cancelled'
  ), [invoices])

  const estRevenue  = Number(project?.estimated_revenue  ?? 0)
  const actRevenue  = Number(project?.actual_revenue     ?? 0)
  const estCost     = Number(project?.estimated_cost     ?? 0)
  const actCost     = Number(project?.actual_cost        ?? 0)
  const contractVal = Number(project?.contract_value     ?? 0)
  const grossProfit = actRevenue - actCost
  const margin      = actRevenue > 0 ? (grossProfit / actRevenue) * 100 : 0
  const budgetUsed  = estCost > 0 ? (actCost / estCost) * 100 : 0

  // ── Category breakdown ──────────────────────────────────────────────────
  const paymentsByCategory = useMemo(() => {
    const map = {}
    payments.forEach(e => {
      const cat = e.category || 'Uncategorised'
      map[cat] = (map[cat] ?? 0) + Number(e.amount)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [payments])

  const receiptsByCategory = useMemo(() => {
    const map = {}
    receipts.forEach(e => {
      const cat = e.category || 'Uncategorised'
      map[cat] = (map[cat] ?? 0) + Number(e.amount)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [receipts])

  // ── Timeline progress ───────────────────────────────────────────────────
  const timelineProgress = useMemo(() => {
    if (!project?.start_date || !project?.expected_end_date) return null
    const start = new Date(project.start_date)
    const end   = new Date(project.expected_end_date)
    const now   = new Date()
    const total = differenceInDays(end, start)
    const elapsed = differenceInDays(now, start)
    const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0
    const daysLeft = differenceInDays(end, now)
    return { pct, daysLeft, total, overdue: daysLeft < 0 }
  }, [project])

  // ── VAT ─────────────────────────────────────────────────────────────────
  const totalVat = useMemo(() =>
    journal.filter(e => e.vat_applicable).reduce((s, e) => s + Number(e.vat_amount ?? 0), 0),
  [journal])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: RED, borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-400">Loading project…</p>
      </div>
    </div>
  )

  if (!project) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <AlertCircle className="w-10 h-10 mx-auto" style={{ color: RED }} />
        <p className="text-sm font-semibold text-gray-500">Project not found</p>
        <button onClick={() => navigate('/projects')}
          className="text-sm font-bold underline" style={{ color: RED }}>Back to Projects</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-12 w-full">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="mt-1 w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0"
            style={{ background: 'white', border: '1px solid #E5E5E5' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: DARK }} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: '#F0F0F0', color: '#888' }}>
                #{project.project_number || '—'}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl font-black mt-1" style={{ color: DARK }}>{project.name}</h1>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {project.client && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Building2 className="w-3.5 h-3.5" /> {project.client}
                </span>
              )}
              {project.project_manager && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3.5 h-3.5" /> {project.project_manager}
                </span>
              )}
              {project.location && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5" /> {project.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => { setActiveProject(project); navigate('/cashflow') }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#F5F5F5', color: DARK, border: '1px solid #E5E5E5' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EBEBEB'}
            onMouseLeave={e => e.currentTarget.style.background = '#F5F5F5'}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Cash Flow
          </button>
          <button
            onClick={() => { setActiveProject(project); navigate('/invoices') }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#F5F5F5', color: DARK, border: '1px solid #E5E5E5' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EBEBEB'}
            onMouseLeave={e => e.currentTarget.style.background = '#F5F5F5'}
          >
            <FilePlus className="w-3.5 h-3.5" /> Invoices
          </button>
          <button
            onClick={() => exportProjectPLPDF(project, journal, company)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-opacity"
            style={{ background: RED }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Download className="w-3.5 h-3.5" /> P&L Report
          </button>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Contract Sum"        value={shortMoney(contractVal)}  icon={FileCheck}        accent
          info="Total amount agreed in the signed contract with the client. The ceiling value for this project." />
        <KpiCard label="Recognised Revenue"  value={shortMoney(actRevenue)}   icon={CircleDollarSign} trend={actRevenue - estRevenue}
          info="Revenue actually earned or received to date. Compare against Budgeted Revenue to track progress." />
        <KpiCard label="Cost to Date"        value={shortMoney(actCost)}      icon={Banknote}         trend={actCost - estCost}
          info="Total costs actually incurred on the project so far. A positive variance means you are under budget." />
        <KpiCard label="Gross Margin"        value={shortMoney(grossProfit)}  icon={TrendingUp}       red={grossProfit < 0}
          info="Recognised Revenue minus Cost to Date. The profit earned before deducting company overheads." />
        <KpiCard label="Net Margin %"        value={`${margin.toFixed(1)}%`}  icon={Percent}          sub={grossProfit >= 0 ? 'Healthy' : 'Below target'}
          info="Gross Margin as a percentage of Recognised Revenue. E.g. 25% means ₦25 profit per ₦100 earned." />
        <KpiCard label="Total Billed"        value={shortMoney(totalBilled)}  icon={Receipt}          sub={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
          info="Total value of all invoices raised on this project, regardless of payment status." />
      </div>

      {/* ── Row 2: Timeline + Invoice Summary + Budget ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Timeline */}
        <Card>
          <SectionTitle icon={Calendar} title="Timeline" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Start Date</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: DARK }}>
                  {project.start_date ? format(new Date(project.start_date), 'dd MMM yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">End Date</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: DARK }}>
                  {project.expected_end_date ? format(new Date(project.expected_end_date), 'dd MMM yyyy') : '—'}
                </p>
              </div>
            </div>

            {timelineProgress ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-500">Progress</span>
                  <span className="font-bold" style={{ color: timelineProgress.overdue ? RED : DARK }}>
                    {timelineProgress.overdue
                      ? `${Math.abs(timelineProgress.daysLeft)}d overdue`
                      : `${timelineProgress.daysLeft}d left`}
                  </span>
                </div>
                <ProgressBar
                  value={timelineProgress.pct}
                  max={100}
                  color={timelineProgress.overdue ? RED : '#16A34A'}
                />
                <p className="text-[11px] text-gray-400">{timelineProgress.pct.toFixed(0)}% of project duration elapsed</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No timeline set</p>
            )}

            {project.description && (
              <div className="pt-2 border-t" style={{ borderColor: '#F0F0F0' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Scope</p>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{project.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Invoice Summary */}
        <Card>
          <SectionTitle icon={FilePlus} title="Invoicing"
            action={
              <button onClick={() => { setActiveProject(project); navigate('/invoices') }}
                className="text-xs font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: RED }}>
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Billed',       value: shortMoney(totalBilled),      color: DARK },
                { label: 'Collected',    value: shortMoney(totalCollected),    color: '#16A34A' },
                { label: 'Outstanding',  value: shortMoney(totalOutstanding),  color: totalOutstanding > 0 ? RED : '#6B7280' },
              ].map(t => (
                <div key={t.label} className="text-center rounded-xl p-2.5" style={{ background: '#FAFAFA' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t.label}</p>
                  <p className="text-sm font-black mt-0.5 leading-none" style={{ color: t.color }}>{t.value}</p>
                </div>
              ))}
            </div>

            {totalBilled > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 font-medium">Collection rate</span>
                  <span className="font-bold" style={{ color: DARK }}>
                    {((totalCollected / totalBilled) * 100).toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={totalCollected} max={totalBilled} color="#16A34A" />
              </div>
            )}

            {overdueInvoices.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#FFF0F0' }}>
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: RED }} />
                <p className="text-xs font-bold" style={{ color: RED }}>
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              {invoices.slice(0, 3).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs"
                  style={{ borderColor: '#F5F5F5' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <InvBadge status={inv.status} />
                    <span className="font-semibold text-gray-600 truncate">{inv.invoice_number}</span>
                  </div>
                  <span className="font-bold shrink-0 ml-2" style={{ color: DARK }}>
                    ₦{fmt(inv.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Budget */}
        <Card>
          <SectionTitle icon={BarChart3} title="Budget" />
          <div className="space-y-5">
            {/* Cost budget */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-500">Cost to Date vs Budget</span>
                <span className="font-bold" style={{ color: budgetUsed > 100 ? RED : DARK }}>
                  {budgetUsed.toFixed(0)}%
                </span>
              </div>
              <ProgressBar value={actCost} max={estCost} color={budgetUsed > 100 ? RED : budgetUsed > 85 ? '#F59E0B' : '#16A34A'} />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Cost to Date: ₦{fmt(actCost)}</span>
                <span>Budgeted: ₦{fmt(estCost)}</span>
              </div>
            </div>

            {/* Revenue target */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-500">Recognised vs Budgeted Revenue</span>
                <span className="font-bold" style={{ color: DARK }}>
                  {estRevenue > 0 ? ((actRevenue / estRevenue) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <ProgressBar value={actRevenue} max={estRevenue} color={RED} bg="#FFF0F0" />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Recognised: ₦{fmt(actRevenue)}</span>
                <span>Budgeted: ₦{fmt(estRevenue)}</span>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#FAFAFA' }}>
              {[
                { label: 'Gross Margin',    value: shortMoney(grossProfit), color: grossProfit >= 0 ? '#16A34A' : RED },
                { label: 'Net Margin %',    value: `${margin.toFixed(1)}%`, color: margin >= 15 ? '#16A34A' : RED },
                { label: 'Net Cash Flow',   value: shortMoney(netCash),     color: netCash >= 0 ? '#16A34A' : RED },
                { label: 'VAT Liability',   value: shortMoney(totalVat),    color: '#1D4ED8' },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">{r.label}</span>
                  <span className="font-black" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Cash Flow + Category Breakdown ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Cash Flow Summary */}
        <Card>
          <SectionTitle icon={TrendingUp} title="Cash Flow"
            action={
              <button onClick={() => { setActiveProject(project); navigate('/cashflow') }}
                className="text-xs font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: RED }}>
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total Inflow',  value: totalInflow,  color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Total Outflow', value: totalOutflow, color: RED,       bg: '#FFF0F0' },
              { label: 'Net Cash',      value: netCash,      color: netCash >= 0 ? '#16A34A' : RED, bg: netCash >= 0 ? '#F0FDF4' : '#FFF0F0' },
            ].map(t => (
              <div key={t.label} className="rounded-xl p-3 text-center" style={{ background: t.bg }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: t.color }}>{t.label}</p>
                <p className="text-sm font-black leading-none" style={{ color: t.color }}>{shortMoney(t.value)}</p>
              </div>
            ))}
          </div>

          {/* Recent entries */}
          <div className="space-y-1">
            {journal.slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor: '#F5F5F5' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: e.type === 'receipt' ? '#F0FDF4' : '#FFF0F0' }}>
                  {e.type === 'receipt'
                    ? <TrendingUp  className="w-3 h-3" style={{ color: '#16A34A' }} />
                    : <TrendingDown className="w-3 h-3" style={{ color: RED }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: DARK }}>{e.description || e.category}</p>
                  <p className="text-[10px] text-gray-400">{e.date ? format(new Date(e.date), 'dd MMM yyyy') : ''}</p>
                </div>
                <span className="text-xs font-black shrink-0"
                  style={{ color: e.type === 'receipt' ? '#16A34A' : RED }}>
                  {e.type === 'receipt' ? '+' : '-'}₦{fmt(e.amount)}
                </span>
              </div>
            ))}
            {journal.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No journal entries yet</p>
            )}
          </div>
        </Card>

        {/* Category breakdown */}
        <Card>
          <SectionTitle icon={Layers} title="Spend by Category" />

          {paymentsByCategory.length > 0 ? (
            <div className="space-y-3">
              {paymentsByCategory.slice(0, 7).map(([cat, val]) => (
                <CategoryBar key={cat} label={cat} value={val}
                  max={totalOutflow} color={RED} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">No payments recorded yet</p>
          )}

          {receiptsByCategory.length > 0 && (
            <>
              <div className="mt-5 mb-3 pt-4 border-t" style={{ borderColor: '#F0F0F0' }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Income by Category</p>
              </div>
              <div className="space-y-3">
                {receiptsByCategory.slice(0, 4).map(([cat, val]) => (
                  <CategoryBar key={cat} label={cat} value={val}
                    max={totalInflow} color="#16A34A" />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 4: Milestones Timeline ───────────────────────────── */}
      <MilestonesSection
        milestones={milestones}
        projectId={id}
        onAdd={() => { setEditingMilestone(null); setShowMilestoneModal(true) }}
        onEdit={m  => { setEditingMilestone(m);   setShowMilestoneModal(true) }}
        onDelete={m => setDeletingMilestone(m)}
      />

      {/* Milestone Add/Edit Modal */}
      {showMilestoneModal && (
        <MilestoneModal
          projectId={id}
          milestone={editingMilestone}
          onClose={() => setShowMilestoneModal(false)}
          onSaved={() => { setShowMilestoneModal(false); refetchMilestones() }}
        />
      )}

      {/* Milestone Delete Confirm */}
      {deletingMilestone && (
        <MilestoneDeleteConfirm
          milestone={deletingMilestone}
          onCancel={() => setDeletingMilestone(null)}
          onConfirm={async () => {
            await supabase.from('milestones').delete().eq('id', deletingMilestone.id)
            setDeletingMilestone(null)
            refetchMilestones()
          }}
        />
      )}

      {/* ── Row 5: Invoices Table ─────────────────────────────────── */}
      {invoices.length > 0 && (
        <Card>
          <SectionTitle icon={Receipt} title="Invoices"
            action={
              <button onClick={() => { setActiveProject(project); navigate('/invoices') }}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                style={{ background: '#FFF0F0', color: RED }}
                onMouseEnter={e => e.currentTarget.style.background = '#FFE0E0'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFF0F0'}
              >
                <FilePlus className="w-3.5 h-3.5" /> New Invoice
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                  {['Invoice #', 'Date', 'Due', 'Client', 'Amount', 'Paid', 'Outstanding', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const outstanding = Number(inv.total_amount) - Number(inv.amount_paid)
                  const isOverdue = inv.due_date && isPast(new Date(inv.due_date)) && inv.status !== 'paid' && inv.status !== 'cancelled'
                  return (
                    <tr key={inv.id} className="border-b hover:bg-gray-50 transition-colors"
                      style={{ borderColor: '#F5F5F5' }}>
                      <td className="py-3 pr-4 font-black" style={{ color: DARK }}>{inv.invoice_number}</td>
                      <td className="py-3 pr-4 text-gray-500">{inv.invoice_date ? format(new Date(inv.invoice_date), 'dd MMM yy') : '—'}</td>
                      <td className="py-3 pr-4" style={{ color: isOverdue ? RED : '#6B7280' }}>
                        {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yy') : '—'}
                        {isOverdue && <span className="ml-1 text-[9px] font-black" style={{ color: RED }}>OVERDUE</span>}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 max-w-[120px] truncate">{inv.client_name || '—'}</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: DARK }}>₦{fmt(inv.total_amount)}</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: '#16A34A' }}>₦{fmt(inv.amount_paid)}</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: outstanding > 0 ? RED : '#6B7280' }}>₦{fmt(outstanding)}</td>
                      <td className="py-3 pr-4"><InvBadge status={inv.status} /></td>
                      <td className="py-3">
                        <button onClick={() => exportInvoicePDF(inv, company)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100">
                          <Download className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Row 6: Documents + Notes ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Documents */}
        <Card>
          <SectionTitle icon={FileText} title="Documents"
            action={
              <button onClick={() => { setActiveProject(project); navigate('/documents') }}
                className="text-xs font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: RED }}>
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FolderOpen className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 6).map(doc => (
                <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-gray-50 group"
                  style={{ border: '1px solid #F0F0F0' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: '#FFF0F0' }}>
                    <FileText className="w-4 h-4" style={{ color: RED }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: DARK }}>{doc.file_name}</p>
                    <p className="text-[10px] text-gray-400">{doc.doc_type} · {doc.created_at ? format(new Date(doc.created_at), 'dd MMM yyyy') : ''}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                </a>
              ))}
              {documents.length > 6 && (
                <p className="text-xs text-center pt-1 text-gray-400">+{documents.length - 6} more</p>
              )}
            </div>
          )}
        </Card>

        {/* Notes & Details */}
        <Card>
          <SectionTitle icon={Activity} title="Project Details" />
          <div className="space-y-4">
            {/* Key details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Project Number', value: project.project_number || '—' },
                { label: 'Status',          value: <StatusBadge status={project.status} /> },
                { label: 'Client',          value: project.client || '—' },
                { label: 'Manager',         value: project.project_manager || '—' },
                { label: 'Location',        value: project.location || '—' },
                { label: 'Contract Value',  value: contractVal ? `₦${fmt(contractVal)}` : '—' },
              ].map(d => (
                <div key={d.label} className="rounded-xl p-3" style={{ background: '#FAFAFA' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{d.label}</p>
                  <div className="text-xs font-bold" style={{ color: DARK }}>{d.value}</div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {project.notes && (
              <div className="rounded-xl p-4" style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Internal Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{project.notes}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Transactions', value: journal.length,   icon: TrendingUp },
                { label: 'Invoices',     value: invoices.length,  icon: Receipt },
                { label: 'Documents',    value: documents.length, icon: FileText },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#FFF0F0' }}>
                  <s.icon className="w-4 h-4 mx-auto mb-1" style={{ color: RED }} />
                  <p className="text-lg font-black leading-none" style={{ color: DARK }}>{s.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

    </div>
  )
}
