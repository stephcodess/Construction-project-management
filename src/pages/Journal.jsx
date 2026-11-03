import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeVAT } from '../lib/taxRules'
import { exportJournalPDF } from '../lib/pdf'
import { format, endOfMonth, subMonths, startOfMonth } from 'date-fns'
import { Plus, Download, Search, X, TrendingUp, TrendingDown, DollarSign, Paperclip, FileText, Pencil, Trash2 } from 'lucide-react'

const CATEGORIES = [
  'Contract Revenue', 'Labour Cost', 'Materials', 'Equipment Hire',
  'Professional Fees', 'Transport', 'Office Expenses', 'Bank Charges',
  'Tax Payment', 'Other'
]

// ── Helpers ──────────────────────────────────────────────────
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
function Select({ children, ...props }) {
  return (
    <select {...props}
      className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none">
      {children}
    </select>
  )
}

function exportCSV(entries, month) {
  const headers = ['Date', 'Type', 'Description', 'Category', 'VAT Applicable', 'VAT Amount', 'Amount']
  const rows = entries.map(e => [
    e.date, e.type, `"${e.description}"`, e.category,
    e.vat_applicable ? 'Yes' : 'No',
    e.vat_amount ?? 0, e.amount
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `cashflow-${month}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── AP Breakdown horizontal bar chart ────────────────────────
function APBreakdown({ entries }) {
  const byCategory = useMemo(() => {
    const map = {}
    entries.filter(e => e.type === 'payment').forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount)
    })
    return Object.entries(map)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [entries])

  if (byCategory.length === 0) return (
    <p className="text-sm text-gray-400 py-6 text-center">No payment data yet.</p>
  )

  const max = Math.max(...byCategory.map(c => c.total), 1)
  return (
    <div className="space-y-3">
      {byCategory.map(({ cat, total }) => (
        <div key={cat} className="flex items-center gap-3">
          <span className="w-36 text-xs text-gray-500 text-right shrink-0 truncate">{cat}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${(total / max) * 100}%`, background: '#CC0000' }} />
          </div>
          <span className="text-xs font-bold w-28 text-right shrink-0" style={{ color: '#1C1C1C' }}>
            ₦{total.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Cash Movement SVG line chart ─────────────────────────────
function CashMovementChart({ monthlyData }) {
  const W = 600, H = 100
  if (!monthlyData || monthlyData.length < 2) return (
    <p className="text-sm text-gray-400 py-4 text-center">Not enough data to chart.</p>
  )
  const arVals  = monthlyData.map(d => d.ar)
  const apVals  = monthlyData.map(d => d.ap)
  const allVals = [...arVals, ...apVals]
  const max = Math.max(...allVals, 1)
  const stepX = W / (monthlyData.length - 1)

  function toPoints(vals) {
    return vals.map((v, i) => {
      const x = i * stepX
      const y = H - (v / max) * (H - 10) - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: '#CC0000' }} /><span className="text-xs text-gray-500">AR (Inflow)</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: '#1C1C1C' }} /><span className="text-xs text-gray-500">AP (Outflow)</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '100px' }}>
        <polyline points={toPoints(arVals)} fill="none" stroke="#CC0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={toPoints(apVals)} fill="none" stroke="#1C1C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between mt-1">
        {monthlyData.map((d, i) => (
          <span key={i} className="text-xs text-gray-400">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── Add Entry Modal ───────────────────────────────────────────
function AddEntryModal({ projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'), type: 'receipt', description: '',
    category: 'Contract Revenue', amount: '', project_id: '', vat_applicable: false,
  })
  const [saving, setSaving] = useState(false)
  const [vatPreview, setVatPreview] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptDragOver, setReceiptDragOver] = useState(false)

  function handleAmountChange(val) {
    setForm(f => ({ ...f, amount: val }))
    setVatPreview(form.vat_applicable && val ? computeVAT(Number(val)) : null)
  }
  function handleVATToggle(checked) {
    setForm(f => ({ ...f, vat_applicable: checked }))
    setVatPreview(checked && form.amount ? computeVAT(Number(form.amount)) : null)
  }

  function handleFileDrop(e) {
    e.preventDefault()
    setReceiptDragOver(false)
    const file = e.dataTransfer?.files?.[0] ?? e.target.files?.[0]
    if (file) setReceiptFile(file)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const vat = form.vat_applicable ? computeVAT(Number(form.amount)) : null
    const { data: inserted } = await supabase.from('journal_entries').insert([{
      ...form, amount: Number(form.amount),
      vat_amount: vat?.vatAmount ?? 0,
      project_id: form.project_id || null,
    }]).select().single()

    if (receiptFile && inserted) {
      const path = `receipts/${Date.now()}-${receiptFile.name}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, receiptFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        await supabase.from('journal_entries').update({
          receipt_url: urlData.publicUrl,
          receipt_path: path,
          receipt_name: receiptFile.name,
        }).eq('id', inserted.id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white" style={{ borderColor: '#F0F0F0' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">New Journal Entry</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Field label="Project">
              <Select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description *">
                <Input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Purpose of transaction" />
              </Field>
            </div>
            <Field label="Amount (₦) *">
              <Input type="number" required min="0" step="0.01" value={form.amount} onChange={e => handleAmountChange(e.target.value)} />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="w-11 h-6 rounded-full transition-colors relative"
                  style={{ background: form.vat_applicable ? '#CC0000' : '#E5E5E5' }}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.vat_applicable ? 'translate-x-6' : 'translate-x-1'}`} />
                  <input type="checkbox" className="sr-only" checked={form.vat_applicable} onChange={e => handleVATToggle(e.target.checked)} />
                </div>
                <span className="text-sm font-medium text-gray-700">VAT (7.5%)</span>
              </label>
            </div>
          </div>
          {vatPreview && (
            <div className="rounded-xl p-4 text-sm border" style={{ background: '#FFF0F0', borderColor: '#CC0000' }}>
              <p className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#CC0000' }}>VAT Preview</p>
              <div className="space-y-1">
                <p className="text-gray-600">Net: <span className="font-bold text-gray-900">₦{vatPreview.netAmount.toLocaleString()}</span></p>
                <p className="text-gray-600">VAT 7.5%: <span className="font-bold text-gray-900">₦{vatPreview.vatAmount.toLocaleString()}</span></p>
                <p className="text-gray-600">Gross: <span className="font-black" style={{ color: '#CC0000' }}>₦{vatPreview.grossAmount.toLocaleString()}</span></p>
              </div>
            </div>
          )}

          {/* Receipt attachment */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Receipt / Invoice (optional)</label>
            {receiptFile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ borderColor: '#CC0000', background: '#FFF0F0' }}>
                <FileText className="w-5 h-5 shrink-0" style={{ color: '#CC0000' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{receiptFile.name}</p>
                  <p className="text-xs text-gray-400">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => setReceiptFile(null)} className="text-gray-400 hover:text-gray-600 transition shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setReceiptDragOver(true) }}
                onDragLeave={() => setReceiptDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('receipt-upload').click()}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
                style={{ borderColor: receiptDragOver ? '#CC0000' : '#E5E5E5', background: receiptDragOver ? '#FFF0F0' : '#FAFAFA' }}
              >
                <Paperclip className="w-5 h-5 text-gray-300" />
                <p className="text-xs text-gray-400">Drag & drop or <span className="font-semibold" style={{ color: '#CC0000' }}>browse</span></p>
                <p className="text-xs text-gray-300">PDF, JPG, PNG up to 10MB</p>
                <input id="receipt-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileDrop} />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
              {saving ? 'Saving…' : 'Post Entry'}
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

// ── Edit Entry Modal ─────────────────────────────────────────
function EditEntryModal({ entry, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: entry.date ?? format(new Date(), 'yyyy-MM-dd'),
    type: entry.type ?? 'receipt',
    description: entry.description ?? '',
    category: entry.category ?? 'Contract Revenue',
    amount: entry.amount != null ? String(entry.amount) : '',
    project_id: entry.project_id ?? '',
    vat_applicable: entry.vat_applicable ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [vatPreview, setVatPreview] = useState(
    entry.vat_applicable && entry.amount ? computeVAT(Number(entry.amount)) : null
  )
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptDragOver, setReceiptDragOver] = useState(false)

  function handleAmountChange(val) {
    setForm(f => ({ ...f, amount: val }))
    setVatPreview(form.vat_applicable && val ? computeVAT(Number(val)) : null)
  }
  function handleVATToggle(checked) {
    setForm(f => ({ ...f, vat_applicable: checked }))
    setVatPreview(checked && form.amount ? computeVAT(Number(form.amount)) : null)
  }

  function handleFileDrop(e) {
    e.preventDefault()
    setReceiptDragOver(false)
    const file = e.dataTransfer?.files?.[0] ?? e.target.files?.[0]
    if (file) setReceiptFile(file)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const vat = form.vat_applicable ? computeVAT(Number(form.amount)) : null
    const updates = {
      date: form.date,
      type: form.type,
      description: form.description,
      category: form.category,
      amount: Number(form.amount),
      project_id: form.project_id || null,
      vat_applicable: form.vat_applicable,
      vat_amount: vat?.vatAmount ?? 0,
    }

    if (receiptFile) {
      const path = `receipts/${Date.now()}-${receiptFile.name}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, receiptFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        updates.receipt_url = urlData.publicUrl
        updates.receipt_path = path
        updates.receipt_name = receiptFile.name
      }
    }

    await supabase.from('journal_entries').update(updates).eq('id', entry.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg, #1C1C1C 0%, #2E2E2E 100%)', borderColor: '#2E2E2E' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-white">Edit Journal Entry</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date *"><Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Type *">
              <div className="flex gap-2">
                {['receipt', 'payment'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all border-2"
                    style={{
                      background: form.type === t ? (t === 'receipt' ? '#CC0000' : '#1C1C1C') : 'transparent',
                      color: form.type === t ? 'white' : '#888',
                      borderColor: form.type === t ? (t === 'receipt' ? '#CC0000' : '#1C1C1C') : '#E5E5E5',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Category *">
              <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Project">
              <Select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description *">
                <Input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Purpose of transaction" />
              </Field>
            </div>
            <Field label="Amount (₦) *">
              <Input type="number" required min="0" step="0.01" value={form.amount} onChange={e => handleAmountChange(e.target.value)} />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="w-11 h-6 rounded-full transition-colors relative"
                  style={{ background: form.vat_applicable ? '#CC0000' : '#E5E5E5' }}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.vat_applicable ? 'translate-x-6' : 'translate-x-1'}`} />
                  <input type="checkbox" className="sr-only" checked={form.vat_applicable} onChange={e => handleVATToggle(e.target.checked)} />
                </div>
                <span className="text-sm font-medium text-gray-700">VAT (7.5%)</span>
              </label>
            </div>
          </div>
          {vatPreview && (
            <div className="rounded-xl p-4 text-sm border" style={{ background: '#FFF0F0', borderColor: '#CC0000' }}>
              <p className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#CC0000' }}>VAT Preview</p>
              <div className="space-y-1">
                <p className="text-gray-600">Net: <span className="font-bold text-gray-900">₦{vatPreview.netAmount.toLocaleString()}</span></p>
                <p className="text-gray-600">VAT 7.5%: <span className="font-bold text-gray-900">₦{vatPreview.vatAmount.toLocaleString()}</span></p>
                <p className="text-gray-600">Gross: <span className="font-black" style={{ color: '#CC0000' }}>₦{vatPreview.grossAmount.toLocaleString()}</span></p>
              </div>
            </div>
          )}

          {/* Receipt attachment */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Receipt / Invoice (optional)</label>
            {entry.receipt_url && !receiptFile && (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 mb-2" style={{ borderColor: '#E5E5E5', background: '#FAFAFA' }}>
                <FileText className="w-5 h-5 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <a href={entry.receipt_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold truncate block hover:underline" style={{ color: '#CC0000' }}>
                    {entry.receipt_name ?? 'Current receipt'}
                  </a>
                  <p className="text-xs text-gray-400">Click to view · upload below to replace</p>
                </div>
              </div>
            )}
            {receiptFile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ borderColor: '#CC0000', background: '#FFF0F0' }}>
                <FileText className="w-5 h-5 shrink-0" style={{ color: '#CC0000' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{receiptFile.name}</p>
                  <p className="text-xs text-gray-400">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => setReceiptFile(null)} className="text-gray-400 hover:text-gray-600 transition shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setReceiptDragOver(true) }}
                onDragLeave={() => setReceiptDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('edit-receipt-upload').click()}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
                style={{ borderColor: receiptDragOver ? '#CC0000' : '#E5E5E5', background: receiptDragOver ? '#FFF0F0' : '#FAFAFA' }}
              >
                <Paperclip className="w-5 h-5 text-gray-300" />
                <p className="text-xs text-gray-400">
                  {entry.receipt_url ? 'Replace receipt — ' : ''}
                  Drag & drop or <span className="font-semibold" style={{ color: '#CC0000' }}>browse</span>
                </p>
                <p className="text-xs text-gray-300">PDF, JPG, PNG up to 10MB</p>
                <input id="edit-receipt-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileDrop} />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
              {saving ? 'Saving…' : 'Save Changes'}
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

// ── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ profile }) {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [filter, setFilter] = useState({ month: format(new Date(), 'yyyy-MM'), search: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadEntries(); loadProjects(); loadMonthlyData() }, [filter.month])

  async function loadEntries() {
    const start = `${filter.month}-01`
    const end = format(endOfMonth(new Date(filter.month + '-01')), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('journal_entries').select('*, projects(name)')
      .gte('date', start).lte('date', end).order('date', { ascending: false })
    setEntries(data ?? [])
  }

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name').eq('status', 'active')
    setProjects(data ?? [])
  }

  async function loadMonthlyData() {
    const { data } = await supabase.from('journal_entries').select('date, type, amount').order('date')
    if (!data) return
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      const m = format(d, 'yyyy-MM')
      const label = format(d, 'MMM')
      const ar = data.filter(e => e.date?.startsWith(m) && e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
      const ap = data.filter(e => e.date?.startsWith(m) && e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
      return { m, label, ar, ap }
    })
    setMonthlyData(months)
  }

  async function handleDelete(id) {
    await supabase.from('journal_entries').delete().eq('id', id)
    setConfirmDelete(null)
    loadEntries()
    loadMonthlyData()
  }

  const filtered = useMemo(() => entries.filter(e =>
    !filter.search ||
    e.description?.toLowerCase().includes(filter.search.toLowerCase()) ||
    e.category?.toLowerCase().includes(filter.search.toLowerCase())
  ), [entries, filter.search])

  const totalAR = filtered.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
  const totalAP = filtered.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)

  // Beginning cash = sum of all entries before this month
  const [beginCash, setBeginCash] = useState(0)
  useEffect(() => {
    async function loadBegin() {
      const beforeDate = `${filter.month}-01`
      const { data } = await supabase.from('journal_entries').select('type, amount').lt('date', beforeDate)
      if (!data) return
      const r = data.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
      const p = data.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
      setBeginCash(r - p)
    }
    loadBegin()
  }, [filter.month])

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4" style={{ color: '#8896B3' }} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Beginning Cash</p>
          </div>
          <p className="text-2xl font-black" style={{ color: '#1C1C1C' }}>₦{beginCash.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl shadow-sm p-5" style={{ background: '#1C1C1C' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-white/50" />
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">Total AR (Inflow)</p>
          </div>
          <p className="text-2xl font-black text-white">₦{totalAR.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl shadow-sm p-5" style={{ background: '#CC0000' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-white/70" />
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Total AP (Outflow)</p>
          </div>
          <p className="text-2xl font-black text-white">₦{totalAP.toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Timeline Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-bold text-gray-900">Monthly Timeline</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="month" value={filter.month}
              onChange={e => setFilter(f => ({ ...f, month: e.target.value }))}
              className="border-2 border-transparent bg-gray-50 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input placeholder="Search…" value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                className="border-2 border-transparent bg-gray-50 rounded-xl pl-9 pr-3 py-1.5 text-sm focus:outline-none w-36"
                onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
            </div>
            <button onClick={() => exportCSV(filtered, filter.month)}
              className="flex items-center gap-1.5 border-2 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={() => exportJournalPDF(entries, filter.month)}
              className="flex items-center gap-1.5 border-2 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            {(profile?.role === 'admin' || profile?.role === 'accountant') && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition"
                style={{ background: '#CC0000' }}
                onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
                <Plus className="w-3.5 h-3.5" /> Add Entry
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9FAFB' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                {['Date', 'Type', 'Description', 'Category', 'Project', 'VAT', 'Amount', '', 'Actions'].map((h, i) => (
                  <th key={`${h}-${i}`} className={`px-5 py-3.5 font-semibold ${['VAT', 'Amount'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No entries found.</td></tr>
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
                  <td className="px-5 py-3.5 text-center">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        title={e.receipt_name ?? 'View receipt'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                        style={{ background: '#FFF0F0' }}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#FFD7D7'}
                        onMouseLeave={ev => ev.currentTarget.style.background = '#FFF0F0'}>
                        <Paperclip className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
                      </a>
                    ) : <span className="text-gray-200 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {(profile?.role === 'admin' || profile?.role === 'accountant') && (
                      confirmDelete === e.id ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs text-gray-500">Confirm?</span>
                          <button type="button" onClick={() => handleDelete(e.id)}
                            className="text-xs font-bold px-2 py-1 rounded-lg text-white transition"
                            style={{ background: '#CC0000' }}
                            onMouseEnter={ev => ev.currentTarget.style.background = '#AA0000'}
                            onMouseLeave={ev => ev.currentTarget.style.background = '#CC0000'}>
                            Yes
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)}
                            className="text-xs font-bold px-2 py-1 rounded-lg border-2 hover:bg-gray-50 transition"
                            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setEditingEntry(e)}
                            title="Edit entry"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
                            style={{ background: '#F5F5F5' }}
                            onMouseEnter={ev => ev.currentTarget.style.background = '#E5E5E5'}
                            onMouseLeave={ev => ev.currentTarget.style.background = '#F5F5F5'}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(e.id)}
                            title="Delete entry"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                            style={{ background: '#FFF0F0' }}
                            onMouseEnter={ev => ev.currentTarget.style.background = '#FFD7D7'}
                            onMouseLeave={ev => ev.currentTarget.style.background = '#FFF0F0'}>
                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">AP Breakdown by Category</h3>
          </div>
          <APBreakdown entries={entries} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ background: '#1C1C1C' }} />
            <h3 className="font-bold text-gray-900">Cash Movement (6 months)</h3>
          </div>
          <CashMovementChart monthlyData={monthlyData} />
        </div>
      </div>

      {showModal && (
        <AddEntryModal projects={projects} onClose={() => setShowModal(false)} onSaved={() => { loadEntries(); loadMonthlyData() }} />
      )}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} projects={projects}
          onClose={() => setEditingEntry(null)}
          onSaved={() => { setEditingEntry(null); loadEntries(); loadMonthlyData() }} />
      )}
    </div>
  )
}

// ── Forecast Tab ─────────────────────────────────────────────
const PERIOD_FILTERS = ['Monthly', 'Quarterly', 'Yearly']

function getHealth(net, ending) {
  if (ending > 0 && net >= 0) return 'Healthy'
  if (ending > 0 && net < 0)  return 'Warning'
  return 'Danger'
}

const HEALTH_STYLE = {
  Healthy: { bg: '#E8F5E9', color: '#1B5E20', dot: '#4CAF50' },
  Warning: { bg: '#FFF8E1', color: '#E65100', dot: '#FF9800' },
  Danger:  { bg: '#FFF0F0', color: '#CC0000', dot: '#CC0000' },
}

function ForecastTab() {
  const [allEntries, setAllEntries] = useState([])
  const [period, setPeriod] = useState('Monthly')

  useEffect(() => {
    supabase.from('journal_entries').select('date, type, amount').order('date').then(({ data }) => {
      setAllEntries(data ?? [])
    })
  }, [])

  const rows = useMemo(() => {
    const now = new Date()
    let buckets = []

    if (period === 'Monthly') {
      buckets = Array.from({ length: 8 }, (_, i) => {
        const d = subMonths(now, 7 - i)
        return { label: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM'), match: e => e.date?.startsWith(format(d, 'yyyy-MM')) }
      })
    } else if (period === 'Quarterly') {
      for (let q = 3; q >= 0; q--) {
        const months = [0,1,2].map(m => format(subMonths(now, q * 3 + (2 - m)), 'yyyy-MM'))
        buckets.push({ label: `Q${4 - q} ${format(subMonths(now, q * 3), 'yyyy')}`, match: e => months.some(m => e.date?.startsWith(m)) })
      }
    } else {
      buckets = Array.from({ length: 3 }, (_, i) => {
        const yr = now.getFullYear() - (2 - i)
        return { label: String(yr), match: e => e.date?.startsWith(String(yr)) }
      })
    }

    let running = 0
    return buckets.map(b => {
      const ar = allEntries.filter(e => e.type === 'receipt' && b.match(e)).reduce((s, e) => s + Number(e.amount), 0)
      const ap = allEntries.filter(e => e.type === 'payment' && b.match(e)).reduce((s, e) => s + Number(e.amount), 0)
      const net = ar - ap
      running += net
      return { label: b.label, ar, ap, net, ending: running, health: getHealth(net, running) }
    })
  }, [allEntries, period])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-bold text-gray-900">Cash Flow Forecast</h3>
          <div className="flex gap-1 bg-gray-50 rounded-xl p-1 border" style={{ borderColor: '#E5E5E5' }}>
            {PERIOD_FILTERS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: period === p ? '#1C1C1C' : 'transparent',
                  color: period === p ? 'white' : '#888'
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9FAFB' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                {['Period', 'AR (Inflow)', 'AP (Outflow)', 'Net Cash', 'Ending Balance', 'Health'].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 font-semibold ${i > 0 && i < 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => {
                const hs = HEALTH_STYLE[r.health]
                return (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold" style={{ color: '#1C1C1C' }}>{r.label}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{r.ar.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">₦{r.ap.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-bold"
                      style={{ color: r.net >= 0 ? '#1C1C1C' : '#CC0000' }}>
                      {r.net >= 0 ? '+' : ''}₦{r.net.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black" style={{ color: '#1C1C1C' }}>₦{r.ending.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: hs.bg, color: hs.color }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hs.dot }} />
                        {r.health}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const TABS = ['Overview', 'Forecast']

export default function Journal() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('Overview')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Ledger</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Cash Flow</h2>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border" style={{ borderColor: '#E5E5E5' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: tab === t ? '#1C1C1C' : 'transparent',
                color: tab === t ? 'white' : '#888'
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Overview' && <OverviewTab profile={profile} />}
      {tab === 'Forecast' && <ForecastTab />}
    </div>
  )
}
