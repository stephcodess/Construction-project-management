import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeVAT } from '../lib/taxRules'
import { exportJournalPDF } from '../lib/pdf'
import { format, endOfMonth } from 'date-fns'
import { Plus, Download, Search } from 'lucide-react'

const CATEGORIES = [
  'Contract Revenue', 'Labour Cost', 'Materials', 'Equipment Hire',
  'Professional Fees', 'Transport', 'Office Expenses', 'Bank Charges',
  'Tax Payment', 'Other'
]

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
    <input
      {...props}
      className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
      onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
      onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
    />
  )
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none">
      {children}
    </select>
  )
}

export default function Journal() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState({ month: format(new Date(), 'yyyy-MM'), search: '' })
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'), type: 'receipt', description: '',
    category: 'Contract Revenue', amount: '', project_id: '', vat_applicable: false,
  })
  const [saving, setSaving] = useState(false)
  const [vatPreview, setVatPreview] = useState(null)

  useEffect(() => { loadEntries(); loadProjects() }, [filter.month])

  async function loadEntries() {
    const start = `${filter.month}-01`
    const end = format(endOfMonth(new Date(filter.month)), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('journal_entries').select('*, projects(name)')
      .gte('date', start).lte('date', end).order('date', { ascending: false })
    setEntries(data ?? [])
  }

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name').eq('status', 'active')
    setProjects(data ?? [])
  }

  function handleAmountChange(val) {
    setForm(f => ({ ...f, amount: val }))
    setVatPreview(form.vat_applicable && val ? computeVAT(Number(val)) : null)
  }

  function handleVATToggle(checked) {
    setForm(f => ({ ...f, vat_applicable: checked }))
    setVatPreview(checked && form.amount ? computeVAT(Number(form.amount)) : null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const vat = form.vat_applicable ? computeVAT(Number(form.amount)) : null
    await supabase.from('journal_entries').insert([{
      ...form, amount: Number(form.amount),
      vat_amount: vat?.vatAmount ?? 0,
      project_id: form.project_id || null,
    }])
    setSaving(false)
    setShowForm(false)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), type: 'receipt', description: '', category: 'Contract Revenue', amount: '', project_id: '', vat_applicable: false })
    setVatPreview(null)
    loadEntries()
  }

  const filtered = entries.filter(e =>
    e.description?.toLowerCase().includes(filter.search.toLowerCase()) ||
    e.category?.toLowerCase().includes(filter.search.toLowerCase())
  )

  const totalReceipts = filtered.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
  const totalPayments = filtered.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
  const net = totalReceipts - totalPayments

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Ledger</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Receipts & Payments</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportJournalPDF(entries, filter.month)}
            className="flex items-center gap-2 border-2 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
            <Download className="w-4 h-4" /> PDF
          </button>
          {(profile?.role === 'admin' || profile?.role === 'accountant') && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
              <Plus className="w-4 h-4" /> Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="month" value={filter.month}
          onChange={e => setFilter(f => ({ ...f, month: e.target.value }))}
          className="border-2 border-transparent bg-white rounded-xl px-3.5 py-2 text-sm shadow-sm focus:outline-none"
          onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
          onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input placeholder="Search…" value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            className="border-2 border-transparent bg-white rounded-xl pl-10 pr-3.5 py-2 text-sm shadow-sm focus:outline-none w-48"
            onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
            onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 text-center" style={{ background: '#CC0000' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Receipts</p>
          <p className="text-xl font-black text-white">₦{totalReceipts.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: '#1C1C1C' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Payments</p>
          <p className="text-xl font-black text-white">₦{totalPayments.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Net Balance</p>
          <p className="text-xl font-black" style={{ color: net >= 0 ? '#CC0000' : '#1C1C1C' }}>
            ₦{net.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Entry form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">New Journal Entry</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Date *"><Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Type *">
              <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="receipt">Receipt</option>
                <option value="payment">Payment</option>
              </Select>
            </Field>
            <Field label="Category *">
              <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Description *">
              <Input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Purpose of transaction" />
            </Field>
            <Field label="Project">
              <Select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <Field label="Amount (₦) *">
              <Input type="number" required min="0" step="0.01" value={form.amount} onChange={e => handleAmountChange(e.target.value)} />
            </Field>
            <div className="pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`w-11 h-6 rounded-full transition-colors relative ${form.vat_applicable ? '' : 'bg-gray-200'}`}
                  style={form.vat_applicable ? { background: '#CC0000' } : {}}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.vat_applicable ? 'translate-x-6' : 'translate-x-1'}`} />
                  <input type="checkbox" className="sr-only" checked={form.vat_applicable} onChange={e => handleVATToggle(e.target.checked)} />
                </div>
                <span className="text-sm font-medium text-gray-700">VAT Applicable (7.5%)</span>
              </label>
            </div>
          </div>
          {vatPreview && (
            <div className="rounded-xl p-4 text-sm space-y-1 border" style={{ background: '#FFF0F0', borderColor: '#CC0000' }}>
              <p className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#CC0000' }}>VAT Preview</p>
              <p className="text-gray-600">Net: <span className="font-bold text-gray-900">₦{vatPreview.netAmount.toLocaleString()}</span></p>
              <p className="text-gray-600">VAT 7.5%: <span className="font-bold text-gray-900">₦{vatPreview.vatAmount.toLocaleString()}</span></p>
              <p className="text-gray-600">Gross: <span className="font-black" style={{ color: '#CC0000' }}>₦{vatPreview.grossAmount.toLocaleString()}</span></p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
              style={{ background: '#CC0000' }}>
              {saving ? 'Saving…' : 'Post Entry'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9F9F9' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                {['Date','Type','Description','Category','Project','VAT','Amount'].map(h => (
                  <th key={h} className={`px-5 py-3.5 font-semibold ${h === 'Amount' || h === 'VAT' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No entries found.</td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{format(new Date(e.date), 'dd MMM yyyy')}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide text-white"
                      style={{ background: e.type === 'receipt' ? '#CC0000' : '#1C1C1C' }}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 max-w-xs truncate">{e.description}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{e.category}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{e.projects?.name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right text-gray-400 text-xs">{e.vat_applicable ? `₦${Number(e.vat_amount).toLocaleString()}` : '—'}</td>
                  <td className="px-5 py-3.5 text-right font-black" style={{ color: '#1C1C1C' }}>₦{Number(e.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
