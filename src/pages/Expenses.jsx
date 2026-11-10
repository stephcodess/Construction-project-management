import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { logActivity } from '../lib/activity'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  Plus, X, Search, Trash2, Edit2, ShoppingCart,
  AlertTriangle, Package, Briefcase, DollarSign, FileCheck
} from 'lucide-react'
import Pagination, { usePagination } from '../components/Pagination'

// ── Extendable list hook ──────────────────────────────────────
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
      const extra = newList.filter(i => !defaults.includes(i))
      localStorage.setItem(storageKey, JSON.stringify(extra))
    } catch {}
  }
  return [list, addItem]
}

// ── Constants ─────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  'Materials', 'Labour', 'Equipment', 'Transport',
  'Utilities', 'Professional Fees', 'Other'
]

const TYPE_CFG = {
  purchase_order:   { label: 'Purchase Order',    bg: '#F3E8FF', color: '#7C3AED', dot: '#A855F7' },
  supplier_invoice: { label: 'Supplier Invoice',  bg: '#F3F4F6', color: '#1C1C1C', dot: '#6B7280' },
  petty_cash:       { label: 'Petty Cash',         bg: '#FFF7ED', color: '#C2410C', dot: '#F97316' },
}

const STATUS_CFG = {
  pending:   { label: 'Pending',   bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  approved:  { label: 'Approved',  bg: '#EFF6FF', color: '#2563EB', dot: '#3B82F6' },
  paid:      { label: 'Paid',      bg: '#F0FDF4', color: '#16A34A', dot: '#22C55E' },
  cancelled: { label: 'Cancelled', bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
}

const fmt = n => Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Shared form primitives ────────────────────────────────────
function Label({ children }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#888' }}>
      {children}
    </p>
  )
}

function FInput({ ...props }) {
  return (
    <input
      {...props}
      className="w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all duration-150"
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function FSelect({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none transition-all duration-150 appearance-none"
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {children}
    </select>
  )
}

function FTextarea({ ...props }) {
  return (
    <textarea
      {...props}
      className="w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all duration-150 resize-none"
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function SectionHead({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(204,0,0,0.08)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#1C1C1C' }}>{title}</p>
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.supplier_invoice
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ── Add / Edit Modal ──────────────────────────────────────────
function ExpenseModal({ expense, projects, defaultProjectId, onClose, onSaved }) {
  const isEdit = !!expense

  const [categories, addCategory] = useExtendableList('expense_categories', DEFAULT_CATEGORIES)
  const [newCat, setNewCat]       = useState('')
  const [showCatInput, setShowCatInput] = useState(false)

  const [form, setForm] = useState({
    project_id:       expense?.project_id       ?? defaultProjectId ?? '',
    type:             expense?.type             ?? 'supplier_invoice',
    supplier_name:    expense?.supplier_name    ?? '',
    reference_number: expense?.reference_number ?? '',
    description:      expense?.description      ?? '',
    amount:           expense?.amount           ?? '',
    currency:         expense?.currency         ?? 'NGN',
    expense_date:     expense?.expense_date     ?? format(new Date(), 'yyyy-MM-dd'),
    due_date:         expense?.due_date         ?? '',
    status:           expense?.status           ?? 'pending',
    category:         expense?.category         ?? 'Materials',
    notes:            expense?.notes            ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleAddCategory() {
    if (!newCat.trim()) return
    addCategory(newCat)
    setF('category', newCat.trim())
    setNewCat('')
    setShowCatInput(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.project_id) { setError('Please select a project.'); return }
    if (!form.supplier_name.trim()) { setError('Supplier name is required.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true); setError('')

    const payload = {
      project_id:       form.project_id,
      type:             form.type,
      supplier_name:    form.supplier_name.trim(),
      reference_number: form.reference_number.trim() || null,
      description:      form.description.trim() || null,
      amount:           Number(form.amount),
      currency:         form.currency,
      expense_date:     form.expense_date,
      due_date:         form.due_date || null,
      status:           form.status,
      category:         form.category,
      notes:            form.notes.trim() || null,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('expenses').update(payload).eq('id', expense.id))
    } else {
      ;({ error: err } = await supabase.from('expenses').insert([payload]))
    }

    setSaving(false)
    if (err) { setError(err.message); return }

    if (!isEdit) {
      logActivity({
        action:      'expense_created',
        entity_type: 'expense',
        entity_name: form.reference_number.trim() || form.supplier_name.trim(),
        meta:        { amount: Number(form.amount), type: form.type },
      })
    }

    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: '640px', maxHeight: '94vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: '#1C1C1C', borderBottom: '1px solid #2A2A2A' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(204,0,0,0.2)' }}>
              <ShoppingCart className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">
                {isEdit ? 'Edit Expense' : 'New Expense'}
              </p>
              <p className="text-white/40 text-[10px] mt-0.5">
                {isEdit ? 'Update expense details' : 'Record a purchase order, supplier invoice, or petty cash'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold"
                style={{ background: '#FFF0F0', color: '#CC0000', border: '1px solid #FECACA' }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
              </div>
            )}

            {/* Basic info */}
            <div>
              <SectionHead icon={FileCheck} title="Basic Information" />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type *</Label>
                    <FSelect value={form.type} onChange={e => setF('type', e.target.value)}>
                      <option value="purchase_order">Purchase Order</option>
                      <option value="supplier_invoice">Supplier Invoice</option>
                      <option value="petty_cash">Petty Cash</option>
                    </FSelect>
                  </div>
                  <div>
                    <Label>Status *</Label>
                    <FSelect value={form.status} onChange={e => setF('status', e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                    </FSelect>
                  </div>
                </div>
                <div>
                  <Label>Project *</Label>
                  <FSelect value={form.project_id} onChange={e => setF('project_id', e.target.value)}>
                    <option value="">— Select a project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </FSelect>
                </div>
              </div>
            </div>

            {/* Supplier */}
            <div>
              <SectionHead icon={Briefcase} title="Supplier Details" />
              <div className="space-y-3">
                <div>
                  <Label>Supplier Name *</Label>
                  <FInput
                    value={form.supplier_name}
                    onChange={e => setF('supplier_name', e.target.value)}
                    placeholder="e.g. Dangote Cement Ltd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Reference Number</Label>
                    <FInput
                      value={form.reference_number}
                      onChange={e => setF('reference_number', e.target.value)}
                      placeholder="e.g. PO-2024-001"
                    />
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <div className="space-y-2">
                      <FSelect value={form.category} onChange={e => setF('category', e.target.value)}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </FSelect>
                      {showCatInput ? (
                        <div className="flex gap-2">
                          <FInput
                            value={newCat}
                            onChange={e => setNewCat(e.target.value)}
                            placeholder="New category…"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
                          />
                          <button
                            type="button"
                            onClick={handleAddCategory}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 transition"
                            style={{ background: '#CC0000' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowCatInput(false); setNewCat('') }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition text-gray-400 shrink-0"
                            style={{ border: '1px solid #E8E8E8' }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCatInput(true)}
                          className="flex items-center gap-1.5 text-xs font-bold transition"
                          style={{ color: '#CC0000' }}
                        >
                          <Plus className="w-3 h-3" /> Add Category
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <FInput
                    value={form.description}
                    onChange={e => setF('description', e.target.value)}
                    placeholder="Brief description of the expense…"
                  />
                </div>
              </div>
            </div>

            {/* Amount & dates */}
            <div>
              <SectionHead icon={DollarSign} title="Amount & Dates" />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (₦) *</Label>
                    <FInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={e => setF('amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <FSelect value={form.currency} onChange={e => setF('currency', e.target.value)}>
                      <option value="NGN">NGN — Nigerian Naira</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="GBP">GBP — British Pound</option>
                    </FSelect>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Expense Date *</Label>
                    <FInput
                      type="date"
                      required
                      value={form.expense_date}
                      onChange={e => setF('expense_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <FInput
                      type="date"
                      value={form.due_date}
                      onChange={e => setF('due_date', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <SectionHead icon={Package} title="Notes" />
              <FTextarea
                rows={3}
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                placeholder="Any additional remarks, approval notes, or references…"
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="shrink-0 px-6 py-4 border-t flex items-center justify-between gap-3"
            style={{ borderColor: '#F0F0F0', background: '#FAFAFA' }}
          >
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">Total</p>
              <p className="text-lg font-black" style={{ color: '#1C1C1C' }}>
                ₦{fmt(form.amount)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border transition"
                style={{ borderColor: '#E5E5E5', color: '#666' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition"
                style={{ background: '#CC0000' }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}
              >
                {saving
                  ? (isEdit ? 'Saving…' : 'Creating…')
                  : <><ShoppingCart className="w-4 h-4" />{isEdit ? 'Save Changes' : 'Create Expense'}</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, dark, green, amber, red }) {
  const bg    = dark ? '#1C1C1C' : green ? '#F0FDF4' : amber ? '#FFFBEB' : red ? '#FFF5F5' : 'white'
  const clr   = dark ? 'white' : green ? '#16A34A' : amber ? '#D97706' : red ? '#CC0000' : '#1C1C1C'
  const lClr  = dark ? 'rgba(255,255,255,0.4)' : green ? '#16A34A' : amber ? '#D97706' : red ? '#CC0000' : '#9CA3AF'

  return (
    <div className="rounded-2xl p-5 shadow-sm" style={{ background: bg, border: dark ? 'none' : '1px solid #EBEBEB' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: lClr }}>{label}</p>
      <p className="text-2xl font-black leading-none" style={{ color: clr }}>{value}</p>
      {sub && <p className="text-xs mt-1.5 font-semibold" style={{ color: dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }}>{sub}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const TYPE_CHIPS = [
  { key: 'All',              label: 'All' },
  { key: 'purchase_order',   label: 'PO' },
  { key: 'supplier_invoice', label: 'Supplier Invoice' },
  { key: 'petty_cash',       label: 'Petty Cash' },
]
const STATUS_CHIPS = ['All', 'pending', 'approved', 'paid', 'cancelled']

export default function Expenses() {
  const { profile }                       = useAuth()
  const { activeProject }                 = useProject()

  const [expenses, setExpenses]           = useState([])
  const [projects, setProjects]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('All')
  const [statusFilter, setStatusFilter]   = useState('All')
  const [projectFilter, setProjectFilter] = useState('')
  const [showModal, setShowModal]         = useState(false)
  const [editTarget, setEditTarget]       = useState(null)   // expense being edited

  const isAdmin = profile?.role === 'admin' || profile?.role === 'accountant'

  // Load projects list once
  useEffect(() => {
    supabase.from('projects').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  // Reload expenses when active project changes
  useEffect(() => { loadExpenses() }, [activeProject?.id])

  async function loadExpenses() {
    setLoading(true)
    let q = supabase.from('expenses')
      .select('*, projects(name)')
      .order('expense_date', { ascending: false })
    if (activeProject) q = q.eq('project_id', activeProject.id)
    const { data } = await q
    setExpenses(data ?? [])
    setLoading(false)
  }

  async function handleDelete(exp) {
    if (!window.confirm(`Delete expense "${exp.reference_number || exp.supplier_name}"? This cannot be undone.`)) return
    await supabase.from('expenses').delete().eq('id', exp.id)
    loadExpenses()
  }

  // ── Filters ──
  const filtered = useMemo(() => expenses.filter(exp => {
    const matchType    = typeFilter === 'All'   || exp.type === typeFilter
    const matchStatus  = statusFilter === 'All' || exp.status === statusFilter
    const matchProject = !projectFilter         || exp.project_id === projectFilter
    const q = search.toLowerCase()
    const matchSearch  = !q ||
      exp.supplier_name?.toLowerCase().includes(q) ||
      exp.reference_number?.toLowerCase().includes(q) ||
      exp.description?.toLowerCase().includes(q) ||
      exp.category?.toLowerCase().includes(q)
    return matchType && matchStatus && matchProject && matchSearch
  }), [expenses, typeFilter, statusFilter, projectFilter, search])

  const { page, setPage, totalPages, paginated, total, reset } = usePagination(filtered, 12)

  // ── KPIs ──
  const kpi = useMemo(() => {
    const now   = new Date()
    const start = startOfMonth(now)
    const end   = endOfMonth(now)

    const totalAmt     = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const pendingItems = expenses.filter(e => e.status === 'pending')
    const approvedItems= expenses.filter(e => e.status === 'approved')
    const paidThisMonth= expenses.filter(e => {
      if (e.status !== 'paid') return false
      const d = new Date(e.expense_date)
      return d >= start && d <= end
    })
    return {
      totalAmt,
      pendingCount: pendingItems.length,
      pendingAmt:   pendingItems.reduce((s, e) => s + Number(e.amount || 0), 0),
      approvedCount: approvedItems.length,
      approvedAmt:  approvedItems.reduce((s, e) => s + Number(e.amount || 0), 0),
      paidMonthAmt: paidThisMonth.reduce((s, e) => s + Number(e.amount || 0), 0),
    }
  }, [expenses])

  function openCreate() { setEditTarget(null); setShowModal(true) }
  function openEdit(exp) { setEditTarget(exp); setShowModal(true) }

  function handleFilter(setter, val) {
    setter(val)
    reset()
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>
            Procurement
          </p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>
            Expenses & Purchase Orders
            {activeProject && (
              <span className="text-base font-semibold ml-2" style={{ color: '#999' }}>
                — {activeProject.name}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Track supplier invoices, purchase orders, and petty cash
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-sm"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}
          >
            <Plus className="w-4 h-4" /> New Expense
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Expenses"
          value={`₦${kpi.totalAmt.toLocaleString()}`}
          dark
        />
        <KpiCard
          label="Pending Approval"
          value={`₦${kpi.pendingAmt.toLocaleString()}`}
          sub={`${kpi.pendingCount} item${kpi.pendingCount !== 1 ? 's' : ''}`}
          amber
        />
        <KpiCard
          label="Approved / Unpaid"
          value={`₦${kpi.approvedAmt.toLocaleString()}`}
          sub={`${kpi.approvedCount} item${kpi.approvedCount !== 1 ? 's' : ''}`}
          red={kpi.approvedAmt > 0}
        />
        <KpiCard
          label="Paid This Month"
          value={`₦${kpi.paidMonthAmt.toLocaleString()}`}
          green
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); reset() }}
            placeholder="Search expenses…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition shadow-sm"
            style={{ background: 'white', border: '1px solid #EEEEEE' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)' }}
          />
        </div>

        {/* Type chips */}
        <div className="flex gap-1 p-1 rounded-xl shadow-sm" style={{ background: 'white', border: '1px solid #EEEEEE' }}>
          {TYPE_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleFilter(setTypeFilter, key)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: typeFilter === key ? '#1C1C1C' : 'transparent',
                color:      typeFilter === key ? 'white'   : '#888',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 p-1 rounded-xl shadow-sm" style={{ background: 'white', border: '1px solid #EEEEEE' }}>
          {STATUS_CHIPS.map(s => (
            <button
              key={s}
              onClick={() => handleFilter(setStatusFilter, s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
              style={{
                background: statusFilter === s ? '#1C1C1C' : 'transparent',
                color:      statusFilter === s ? 'white'   : '#888',
              }}
            >
              {s === 'All' ? 'All' : STATUS_CFG[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Project dropdown — only when no activeProject */}
        {!activeProject && projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={e => handleFilter(setProjectFilter, e.target.value)}
            className="px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition shadow-sm appearance-none"
            style={{ background: 'white', border: '1px solid #EEEEEE', color: '#555' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center py-24 gap-4"
          style={{ border: '1px solid #EBEBEB' }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#FFF5F5' }}>
            <ShoppingCart className="w-8 h-8" style={{ color: '#FECACA' }} />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-700">No expenses found</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || typeFilter !== 'All' || statusFilter !== 'All'
                ? 'Try adjusting your filters'
                : 'Record your first expense to get started'}
            </p>
          </div>
          {isAdmin && !search && typeFilter === 'All' && statusFilter === 'All' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition mt-2"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}
            >
              <Plus className="w-4 h-4" /> New Expense
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                  {['Date', 'Reference', 'Supplier', 'Description', 'Category', 'Type', 'Amount', 'Status', ''].map(h => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400 ${h === 'Amount' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(exp => (
                  <tr
                    key={exp.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #FAFAFA' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                      {exp.expense_date ? format(new Date(exp.expense_date), 'dd MMM yy') : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold" style={{ color: '#CC0000' }}>
                        {exp.reference_number || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-800 text-sm truncate max-w-[140px]">
                        {exp.supplier_name}
                      </p>
                      {!activeProject && exp.projects?.name && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">
                          {exp.projects.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">
                        {exp.description || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ background: '#F3F4F6', color: '#555' }}
                      >
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <TypeBadge type={exp.type} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-gray-800">₦{fmt(exp.amount)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(exp)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition text-gray-400"
                              onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#2563EB' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition text-gray-400"
                              onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#CC0000' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={12} onPageChange={setPage} />
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <ExpenseModal
          expense={editTarget}
          projects={projects}
          defaultProjectId={activeProject?.id ?? ''}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSaved={loadExpenses}
        />
      )}
    </div>
  )
}
