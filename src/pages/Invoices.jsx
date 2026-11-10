import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { useCompany } from '../context/CompanyContext'
import { logActivity } from '../lib/activity'
import { format, addDays, isPast, isToday } from 'date-fns'
import {
  Plus, X, FileText, Download, Search, Trash2, CheckCircle2,
  Clock, AlertTriangle, DollarSign, Receipt, Eye, Send,
  Building2, User, CreditCard, StickyNote, ChevronRight,
  Banknote, Hash, Link
} from 'lucide-react'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import Pagination, { usePagination } from '../components/Pagination'
import { exportInvoicePDF } from '../lib/pdf'

// ── Status config ─────────────────────────────────────────────
const STATUS_CFG = {
  draft:          { label: 'Draft',      bg: '#F3F4F6', color: '#6B7280',  dot: '#9CA3AF',  icon: FileText },
  sent:           { label: 'Sent',       bg: '#EFF6FF', color: '#2563EB',  dot: '#3B82F6',  icon: Send },
  partially_paid: { label: 'Part Paid',  bg: '#FFFBEB', color: '#D97706',  dot: '#F59E0B',  icon: DollarSign },
  paid:           { label: 'Paid',       bg: '#F0FDF4', color: '#16A34A',  dot: '#22C55E',  icon: CheckCircle2 },
  overdue:        { label: 'Overdue',    bg: '#FFF0F0', color: '#CC0000',  dot: '#EF4444',  icon: AlertTriangle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function computeStatus(invoice) {
  if (invoice.status === 'paid') return 'paid'
  if (invoice.status === 'draft') return 'draft'
  const totalPaid = Number(invoice.amount_paid ?? 0)
  const total     = Number(invoice.total_amount ?? 0)
  if (totalPaid >= total && total > 0) return 'paid'
  if (totalPaid > 0) return 'partially_paid'
  if (invoice.due_date && isPast(new Date(invoice.due_date)) && !isToday(new Date(invoice.due_date))) return 'overdue'
  return invoice.status ?? 'draft'
}

const fmt = n => Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Shared form primitives ────────────────────────────────────
function Label({ children }) {
  return <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#888' }}>{children}</p>
}
function FInput({ className = '', ...props }) {
  return (
    <input {...props}
      className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all duration-150 ${className}`}
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }} />
  )
}
function FSelect({ children, ...props }) {
  return (
    <select {...props}
      className="w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none transition-all duration-150 appearance-none"
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }}>
      {children}
    </select>
  )
}
function FTextarea({ ...props }) {
  return (
    <textarea {...props}
      className="w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all duration-150 resize-none"
      style={{ borderColor: '#E8E8E8' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.boxShadow = 'none' }} />
  )
}

// ── Section header inside the form ───────────────────────────
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

// ── Live Invoice Preview (right panel) ───────────────────────
function InvoicePreview({ form, items, projects, lineSubtotal, discountAmt, subtotal, vatAmt, total, invoiceNum }) {
  const proj = projects.find(p => p.id === form.project_id)
  const validItems = items.filter(it => it.description || Number(it.unit_price) > 0)

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7]">
      {/* Preview label */}
      <div className="px-6 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#CC0000' }} />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Preview</p>
        </div>
      </div>

      {/* Invoice paper */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ minHeight: '520px' }}>

          {/* Invoice header stripe */}
          <div className="px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #1C1C1C 0%, #2A2A2A 100%)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <img src="/unnamed.jpg" alt="Eldesign" className="w-7 h-7 rounded-lg object-cover" />
                  <div>
                    <p className="text-white font-black text-xs tracking-widest leading-none">ELDESIGN</p>
                    <p className="text-[9px] tracking-widest" style={{ color: '#CC0000' }}>CONSTRUCTION</p>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] leading-relaxed">
                  Lagos, Nigeria<br />info@eldesign.ng
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-black text-xl tracking-tight">INVOICE</p>
                <p className="font-mono text-xs mt-1" style={{ color: '#CC0000' }}>
                  {invoiceNum || '#INV-0001'}
                </p>
                <div className="mt-2 space-y-0.5">
                  <p className="text-white/40 text-[10px]">
                    Issued: <span className="text-white/70">{form.invoice_date ? format(new Date(form.invoice_date), 'dd MMM yyyy') : '—'}</span>
                  </p>
                  <p className="text-white/40 text-[10px]">
                    Due: <span className="text-white/70">{form.due_date ? format(new Date(form.due_date), 'dd MMM yyyy') : '—'}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bill to + Project */}
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <div className="bg-white px-6 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
              <p className="font-bold text-sm text-gray-800 leading-tight">{form.client_name || <span className="text-gray-300">Client Name</span>}</p>
              {form.client_address && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{form.client_address}</p>}
              {form.client_email && <p className="text-xs text-gray-400 mt-0.5">{form.client_email}</p>}
              {form.client_phone && <p className="text-xs text-gray-400">{form.client_phone}</p>}
            </div>
            <div className="bg-white px-6 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Project</p>
              <p className="font-bold text-sm text-gray-800 leading-tight">{proj?.name || <span className="text-gray-300">Project Name</span>}</p>
              {proj?.location && <p className="text-xs text-gray-400 mt-0.5">{proj.location}</p>}
            </div>
          </div>

          {/* Line items */}
          <div className="px-6 py-4">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <th className="text-left pb-2 font-black uppercase tracking-widest text-gray-400">Description</th>
                  <th className="text-center pb-2 font-black uppercase tracking-widest text-gray-400 w-10">Qty</th>
                  <th className="text-right pb-2 font-black uppercase tracking-widest text-gray-400 w-24">Unit Price</th>
                  <th className="text-right pb-2 font-black uppercase tracking-widest text-gray-400 w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {validItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-300 italic">Add deliverables to see them here…</td>
                  </tr>
                ) : validItems.map((it, i) => {
                  const amt = (Number(it.qty) || 1) * (Number(it.unit_price) || 0)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #FAFAFA' }}>
                      <td className="py-2 pr-4 text-gray-700">{it.description || `Item ${i + 1}`}</td>
                      <td className="py-2 text-center text-gray-500">{it.qty || 1}</td>
                      <td className="py-2 text-right text-gray-500">₦{fmt(it.unit_price)}</td>
                      <td className="py-2 text-right font-semibold text-gray-800">₦{fmt(amt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 pb-4">
            <div className="ml-auto max-w-[200px] space-y-1.5 pt-3" style={{ borderTop: '1px solid #F0F0F0' }}>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span><span>₦{fmt(lineSubtotal)}</span>
              </div>
              {Number(form.discount) > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Discount ({form.discount}%)</span><span>−₦{fmt(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500">
                <span>VAT ({form.vat_rate}%)</span><span>₦{fmt(vatAmt)}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-2" style={{ borderTop: '2px solid #1C1C1C', color: '#1C1C1C' }}>
                <span>Total Due</span><span>₦{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          {(form.bank_name || form.payment_terms || form.notes) && (
            <div className="mx-6 mb-5 rounded-xl p-4 space-y-2" style={{ background: '#F7F7F7' }}>
              {form.bank_name && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Bank Details</p>
                  <p className="text-xs text-gray-600">{form.bank_name} · {form.account_number}</p>
                  {form.account_name && <p className="text-xs text-gray-500">{form.account_name}</p>}
                </div>
              )}
              {form.payment_terms && <p className="text-[10px] text-gray-400 leading-relaxed">{form.payment_terms}</p>}
              {form.notes && <p className="text-[10px] text-gray-400 italic">{form.notes}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Invoice Modal ──────────────────────────────────────
function CreateInvoiceModal({ projects, defaultProjectId, company, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_id:     defaultProjectId || '',
    invoice_date:   format(new Date(), 'yyyy-MM-dd'),
    due_date:       format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    client_name:    '',
    client_address: '',
    client_email:   '',
    client_phone:   '',
    vat_rate:       7.5,
    discount:       0,
    notes:          company?.invoice_notes  || '',
    payment_terms:  company?.payment_terms  || 'Payment due within 30 days of invoice date.',
    bank_name:      company?.bank_name      || '',
    account_name:   company?.account_name   || '',
    account_number: company?.account_number || '',
  })
  const [items, setItems]   = useState([{ description: '', qty: 1, unit_price: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleProjectChange(id) {
    const proj = projects.find(p => p.id === id)
    setForm(f => ({
      ...f,
      project_id:     id,
      client_name:    proj?.client ?? f.client_name,
      client_address: proj?.location ?? f.client_address,
    }))
  }

  function updateItem(i, key, val) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }
  function addItem() { setItems(prev => [...prev, { description: '', qty: 1, unit_price: '' }]) }
  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  const lineSubtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const discountAmt  = lineSubtotal * ((Number(form.discount) || 0) / 100)
  const subtotal     = lineSubtotal - discountAmt
  const vatAmt       = subtotal * (Number(form.vat_rate) / 100)
  const total        = subtotal + vatAmt

  const previewNum = useMemo(() => {
    const proj = projects.find(p => p.id === form.project_id)
    return proj?.project_number ? `INV-${proj.project_number}-XXXX` : 'INV-XXXX'
  }, [form.project_id, projects])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.project_id) { setError('Please select a project.'); return }
    const validItems = items.filter(it => it.description.trim() && Number(it.unit_price) > 0)
    if (validItems.length === 0) { setError('Add at least one deliverable with a price.'); return }
    setSaving(true); setError('')

    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
    const seq  = String((count ?? 0) + 1).padStart(4, '0')
    const proj = projects.find(p => p.id === form.project_id)
    const invoiceNumber = proj?.project_number ? `INV-${proj.project_number}-${seq}` : `INV-${seq}`

    const lineItemsJson = validItems.map(it => ({
      description: it.description.trim(),
      qty:         Number(it.qty) || 1,
      unit_price:  Number(it.unit_price),
      amount:      (Number(it.qty) || 1) * Number(it.unit_price),
    }))

    const { error: err } = await supabase.from('invoices').insert([{
      project_id:     form.project_id,
      invoice_number: invoiceNumber,
      invoice_date:   form.invoice_date,
      due_date:       form.due_date || null,
      client_name:    form.client_name.trim() || null,
      client_address: form.client_address.trim() || null,
      client_email:   form.client_email.trim() || null,
      client_phone:   form.client_phone.trim() || null,
      line_items:     lineItemsJson,
      discount_pct:   Number(form.discount) || 0,
      subtotal,
      vat_amount:     vatAmt,
      total_amount:   total,
      amount_paid:    0,
      status:         'draft',
      notes:          form.notes.trim() || null,
      payment_terms:  form.payment_terms.trim() || null,
      bank_name:      form.bank_name.trim() || null,
      account_name:   form.account_name.trim() || null,
      account_number: form.account_number.trim() || null,
    }])

    setSaving(false)
    if (err) { setError(err.message); return }
    logActivity({ action: 'invoice_created', entity_type: 'invoice', entity_name: invoiceNumber, meta: { amount: total, project: proj?.name } })
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: '1000px', height: 'min(96vh, 760px)' }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: '#1C1C1C', borderBottom: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(204,0,0,0.2)' }}>
              <Receipt className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">New Invoice</p>
              <p className="text-white/40 text-[10px] mt-0.5">Fill in the details to generate a professional invoice</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* ── Body: form left + preview right ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — form */}
          <div className="flex flex-col w-full md:w-[420px] shrink-0 overflow-hidden md:border-r" style={{ borderColor: '#F0F0F0' }}>
            <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold"
                    style={{ background: '#FFF0F0', color: '#CC0000', border: '1px solid #FECACA' }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
                  </div>
                )}

                {/* Project & dates */}
                <div>
                  <SectionHead icon={Building2} title="Project & Dates" />
                  <div className="space-y-3">
                    <div>
                      <Label>Project *</Label>
                      <FSelect value={form.project_id} onChange={e => handleProjectChange(e.target.value)}>
                        <option value="">— Select a project —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </FSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Invoice Date *</Label>
                        <FInput type="date" required value={form.invoice_date} onChange={e => setF('invoice_date', e.target.value)} />
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <FInput type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill to */}
                <div>
                  <SectionHead icon={User} title="Bill To" />
                  <div className="space-y-3">
                    <div>
                      <Label>Client / Company Name</Label>
                      <FInput value={form.client_name} onChange={e => setF('client_name', e.target.value)} placeholder="e.g. Acme Properties Ltd" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email</Label>
                        <FInput type="email" value={form.client_email} onChange={e => setF('client_email', e.target.value)} placeholder="client@example.com" />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <FInput value={form.client_phone} onChange={e => setF('client_phone', e.target.value)} placeholder="+234…" />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <FTextarea rows={2} value={form.client_address} onChange={e => setF('client_address', e.target.value)} placeholder="Street, City, State" />
                    </div>
                  </div>
                </div>

                {/* Deliverables */}
                <div>
                  <SectionHead icon={FileText} title="Deliverables" />
                  <div className="space-y-2">
                    {/* Column labels */}
                    <div className="grid text-[9px] font-black uppercase tracking-widest text-gray-400 px-3"
                      style={{ gridTemplateColumns: '1fr 52px 100px 28px' }}>
                      <span>Description</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Price (₦)</span>
                      <span />
                    </div>
                    {items.map((item, i) => (
                      <div key={i} className="grid gap-1.5 items-center"
                        style={{ gridTemplateColumns: '1fr 52px 100px 28px' }}>
                        <FInput
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          placeholder={`Item ${i + 1}`} />
                        <FInput
                          type="number" min="0" step="1"
                          value={item.qty}
                          onChange={e => updateItem(i, 'qty', e.target.value)}
                          className="text-center" />
                        <FInput
                          type="number" min="0" step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(i, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="text-right" />
                        <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition text-gray-300 disabled:opacity-20"
                          onMouseEnter={e => { if (items.length > 1) e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#CC0000' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addItem}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ border: '1.5px dashed #E0E0E0', color: '#999' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.color = '#CC0000'; e.currentTarget.style.background = 'rgba(204,0,0,0.03)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0E0E0'; e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent' }}>
                      <Plus className="w-3.5 h-3.5" /> Add Line Item
                    </button>
                  </div>
                </div>

                {/* Tax & discounts */}
                <div>
                  <SectionHead icon={Hash} title="Tax & Discount" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>VAT Rate (%)</Label>
                      <FInput type="number" min="0" max="100" step="0.5" value={form.vat_rate}
                        onChange={e => setF('vat_rate', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Discount (%)</Label>
                      <FInput type="number" min="0" max="100" step="0.5" value={form.discount}
                        onChange={e => setF('discount', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>

                {/* Bank details */}
                <div>
                  <SectionHead icon={Banknote} title="Bank Details" />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Bank Name</Label>
                        <FInput value={form.bank_name} onChange={e => setF('bank_name', e.target.value)} placeholder="Zenith Bank" />
                      </div>
                      <div>
                        <Label>Account Number</Label>
                        <FInput value={form.account_number} onChange={e => setF('account_number', e.target.value)} placeholder="0000000000" />
                      </div>
                    </div>
                    <div>
                      <Label>Account Name</Label>
                      <FInput value={form.account_name} onChange={e => setF('account_name', e.target.value)} placeholder="Eldesign Construction Ltd" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <SectionHead icon={StickyNote} title="Notes & Terms" />
                  <div className="space-y-3">
                    <div>
                      <Label>Payment Terms</Label>
                      <FTextarea rows={2} value={form.payment_terms} onChange={e => setF('payment_terms', e.target.value)} />
                    </div>
                    <div>
                      <Label>Additional Notes</Label>
                      <FTextarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any remarks or instructions…" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 px-6 py-4 border-t flex items-center justify-between gap-3"
                style={{ borderColor: '#F0F0F0', background: '#FAFAFA' }}>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold">Total</p>
                  <p className="text-lg font-black" style={{ color: '#1C1C1C' }}>₦{fmt(total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold border transition"
                    style={{ borderColor: '#E5E5E5', color: '#666' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition"
                    style={{ background: '#CC0000' }}
                    onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
                    onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
                    {saving ? 'Creating…' : <><Receipt className="w-4 h-4" /> Create Invoice</>}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT — live preview */}
          <div className="hidden md:flex flex-col flex-1 overflow-hidden">
            <InvoicePreview
              form={form} items={items} projects={projects}
              lineSubtotal={lineSubtotal} discountAmt={discountAmt}
              subtotal={subtotal} vatAmt={vatAmt} total={total}
              invoiceNum={previewNum}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Record Payment Modal ──────────────────────────────────────
function RecordPaymentModal({ invoice, onClose, onSaved }) {
  const remaining = Number(invoice.total_amount) - Number(invoice.amount_paid ?? 0)
  const paidPct   = Number(invoice.total_amount) > 0
    ? Math.min((Number(invoice.amount_paid ?? 0) / Number(invoice.total_amount)) * 100, 100) : 0

  const [form, setForm] = useState({
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    amount:       String(remaining > 0 ? remaining : ''),
    method:       'Bank Transfer',
    reference:    '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave(e) {
    e.preventDefault()
    const amt = Number(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid payment amount.'); return }
    if (amt > remaining + 0.01) { setError(`Amount exceeds outstanding balance of ₦${fmt(remaining)}.`); return }
    setSaving(true); setError('')

    const newPaid   = Number(invoice.amount_paid ?? 0) + amt
    const newStatus = newPaid >= Number(invoice.total_amount) - 0.01 ? 'paid' : 'partially_paid'

    const [, payErr] = await Promise.all([
      supabase.from('invoices').update({ amount_paid: newPaid, status: newStatus }).eq('id', invoice.id),
      supabase.from('invoice_payments').insert([{
        invoice_id:   invoice.id,
        payment_date: form.payment_date,
        amount:       amt,
        method:       form.method,
        reference:    form.reference.trim() || null,
      }]).then(({ error }) => error),
    ])

    setSaving(false)
    if (payErr) { setError(payErr.message); return }
    logActivity({ action: 'payment_recorded', entity_type: 'invoice', entity_name: invoice.invoice_number, meta: { amount: amt } })
    onSaved(); onClose()
  }

  const pctAfter = Number(invoice.total_amount) > 0
    ? Math.min(((Number(invoice.amount_paid ?? 0) + Number(form.amount || 0)) / Number(invoice.total_amount)) * 100, 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5" style={{ background: '#1C1C1C' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Record Payment</p>
              <p className="text-white font-black text-base leading-tight">{invoice.invoice_number}</p>
              <p className="text-white/50 text-xs mt-0.5">{invoice.projects?.name ?? ''}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
              <span>Collected</span>
              <span>{pctAfter.toFixed(0)}% after this payment</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${paidPct}%`, background: '#CC0000' }} />
              <div className="h-full rounded-full -mt-2 transition-all duration-500 opacity-30"
                style={{ width: `${pctAfter}%`, background: '#CC0000' }} />
            </div>
          </div>
        </div>

        {/* Balance pill */}
        <div className="mx-6 -mt-4 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-lg"
          style={{ background: '#FFF5F5', border: '1px solid #FECACA' }}>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Outstanding Balance</p>
            <p className="text-2xl font-black" style={{ color: '#CC0000' }}>₦{fmt(remaining)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Total Invoice</p>
            <p className="text-sm font-bold text-gray-700">₦{fmt(invoice.total_amount)}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold"
              style={{ background: '#FFF0F0', color: '#CC0000', border: '1px solid #FECACA' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Date *</Label>
              <FInput type="date" required value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (₦) *</Label>
              <FInput type="number" required min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Payment Method</Label>
            <FSelect value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
              {['Bank Transfer', 'Cash', 'Cheque', 'Mobile Money', 'Other'].map(m => <option key={m}>{m}</option>)}
            </FSelect>
          </div>

          <div>
            <Label>Reference / Narration</Label>
            <FInput value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. TXN-20241105" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border transition flex-1"
              style={{ borderColor: '#E5E5E5', color: '#666' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
              {saving ? 'Saving…' : <><CheckCircle2 className="w-4 h-4" /> Record Payment</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Invoice Detail Drawer ─────────────────────────────────────
function InvoiceDrawer({ invoice, onClose, onUpdated }) {
  const [payments, setPayments]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [markingSent, setMarkingSent]   = useState(false)
  const [linkCopied, setLinkCopied]     = useState(false)

  async function copyInvoiceLink() {
    const url = `${window.location.origin}/invoice/${invoice.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const status    = computeStatus(invoice)
  const cfg       = STATUS_CFG[status] ?? STATUS_CFG.draft
  const totalPaid = Number(invoice.amount_paid ?? 0)
  const total     = Number(invoice.total_amount ?? 0)
  const remaining = total - totalPaid
  const paidPct   = total > 0 ? Math.min((totalPaid / total) * 100, 100) : 0
  const lineItems = invoice.line_items ?? []

  useEffect(() => {
    setLoading(true)
    supabase.from('invoice_payments').select('*').eq('invoice_id', invoice.id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => { setPayments(data ?? []); setLoading(false) })
  }, [invoice.id])

  async function markSent() {
    setMarkingSent(true)
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    setMarkingSent(false)
    onUpdated()
  }

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-hidden bg-white shadow-2xl"
        style={{ width: 'min(500px, 100vw)' }}>

        {/* ── Drawer header ── */}
        <div className="shrink-0" style={{ background: '#1C1C1C' }}>
          <div className="flex items-start justify-between px-6 pt-6 pb-4 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: 'rgba(204,0,0,0.2)', color: '#CC0000' }}>
                  {invoice.invoice_number}
                </span>
                <StatusBadge status={status} />
              </div>
              <h3 className="text-white font-black text-xl leading-tight truncate">
                {invoice.projects?.name ?? '—'}
              </h3>
              {invoice.client_name && (
                <p className="text-white/40 text-sm mt-0.5">{invoice.client_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Share link button */}
              <button
                onClick={copyInvoiceLink}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition"
                style={{
                  background: linkCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
                  color: linkCopied ? '#4ADE80' : 'rgba(255,255,255,0.75)',
                }}
                onMouseEnter={e => { if (!linkCopied) e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
                onMouseLeave={e => { if (!linkCopied) e.currentTarget.style.background = linkCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)' }}
                title="Copy shareable client link">
                {linkCopied
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</>
                  : <><Link className="w-3.5 h-3.5" /> Share</>
                }
              </button>
              <button
                onClick={() => exportInvoicePDF(invoice)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* Amount tiles */}
          <div className="grid grid-cols-3 gap-px mx-6 mb-5" style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Total',   val: total,     color: 'white' },
              { label: 'Paid',    val: totalPaid, color: '#4ADE80' },
              { label: 'Balance', val: remaining, color: remaining > 0 ? '#FF6B6B' : '#4ADE80' },
            ].map(({ label, val, color }) => (
              <div key={label} className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
                <p className="text-sm font-black leading-tight" style={{ color }}>₦{fmt(val)}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="px-6 pb-5">
            <div className="flex justify-between text-[10px] text-white/30 mb-1.5">
              <span>{paidPct.toFixed(0)}% collected</span>
              <span>₦{fmt(remaining)} remaining</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${paidPct}%`, background: paidPct >= 100 ? '#4ADE80' : '#CC0000' }} />
            </div>
          </div>
        </div>

        {/* ── Drawer body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Invoice details */}
          <div className="px-6 py-5 border-b" style={{ borderColor: '#F5F5F5' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Invoice Details</p>
            <div className="space-y-2.5">
              {[
                ['Invoice Date', invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd MMM yyyy') : '—'],
                ['Due Date',     invoice.due_date     ? format(new Date(invoice.due_date),     'dd MMM yyyy') : '—'],
                invoice.client_name    && ['Client',    invoice.client_name],
                invoice.client_email   && ['Email',     invoice.client_email],
                invoice.client_phone   && ['Phone',     invoice.client_phone],
                invoice.client_address && ['Address',   invoice.client_address],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{k}</span>
                  <span className="text-xs font-semibold text-gray-700 flex-1 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="px-6 py-5 border-b" style={{ borderColor: '#F5F5F5' }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Deliverables</p>
              <div className="space-y-2">
                {lineItems.map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: '#FAFAFA' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{it.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{it.qty} × ₦{fmt(it.unit_price)}</p>
                    </div>
                    <span className="text-xs font-black text-gray-800 shrink-0">₦{fmt(it.amount)}</span>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid #F0F0F0' }}>
                {invoice.vat_amount > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>VAT</span><span>₦{fmt(invoice.vat_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black" style={{ color: '#1C1C1C' }}>
                  <span>Total</span><span>₦{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bank details */}
          {(invoice.bank_name || invoice.payment_terms) && (
            <div className="px-6 py-5 border-b" style={{ borderColor: '#F5F5F5' }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Payment Info</p>
              {invoice.bank_name && (
                <div className="rounded-xl p-3.5 mb-3" style={{ background: '#F7F7F7' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-600">{invoice.bank_name}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{invoice.account_number}</p>
                  {invoice.account_name && <p className="text-xs text-gray-400">{invoice.account_name}</p>}
                </div>
              )}
              {invoice.payment_terms && <p className="text-xs text-gray-400 leading-relaxed">{invoice.payment_terms}</p>}
              {invoice.notes && <p className="text-xs text-gray-400 italic mt-1">{invoice.notes}</p>}
            </div>
          )}

          {/* Action buttons */}
          {status !== 'paid' && (
            <div className="px-6 py-4 border-b flex gap-2.5" style={{ borderColor: '#F5F5F5' }}>
              {status === 'draft' && (
                <button onClick={markSent} disabled={markingSent}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 transition disabled:opacity-60"
                  style={{ borderColor: '#2563EB', color: '#2563EB' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Send className="w-3.5 h-3.5" />
                  {markingSent ? 'Updating…' : 'Mark as Sent'}
                </button>
              )}
              <button onClick={() => setShowPayModal(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition"
                style={{ background: '#CC0000' }}
                onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
                <CreditCard className="w-3.5 h-3.5" /> Record Payment
              </button>
            </div>
          )}

          {/* Payment history */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Payment History</p>
            {loading ? (
              <div className="text-center py-6">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 rounded-2xl" style={{ background: '#FAFAFA' }}>
                <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-xs text-gray-400 font-medium">No payments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                    style={{ background: '#F7FFF9', border: '1px solid #D1FAE5' }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: '#D1FAE5' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-700">{p.method}</p>
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(p.payment_date), 'dd MMM yyyy')}
                          {p.reference && ` · ${p.reference}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black shrink-0" style={{ color: '#16A34A' }}>
                      +₦{fmt(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPayModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPayModal(false)}
          onSaved={() => { setShowPayModal(false); onUpdated() }}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const FILTER_TABS = ['All', 'Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue']

export default function Invoices() {
  const { profile }                           = useAuth()
  const { activeProject }                     = useProject()
  const { company }                           = useCompany()
  const [invoices, setInvoices]               = useState([])
  const [projects, setProjects]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [search, setSearch]                   = useState('')
  const [statusFilter, setStatusFilter]       = useState('All')
  const [showCreate, setShowCreate]           = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [confirmDelete, setConfirmDelete]     = useState(null)
  const [deleting, setDeleting]               = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'accountant'

  useEffect(() => {
    supabase.from('projects').select('id, name, project_number, contract_value, location, client')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  useEffect(() => { loadInvoices() }, [activeProject?.id])

  async function loadInvoices() {
    setLoading(true)
    let q = supabase.from('invoices')
      .select('*, projects(name, client, location, project_number)')
      .order('invoice_date', { ascending: false })
    if (activeProject) q = q.eq('project_id', activeProject.id)
    const { data } = await q
    setInvoices(data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    await supabase.from('invoice_payments').delete().eq('invoice_id', confirmDelete.id)
    await supabase.from('invoices').delete().eq('id', confirmDelete.id)
    setDeleting(false); setConfirmDelete(null); loadInvoices()
  }

  const enriched = useMemo(() => invoices.map(inv => ({ ...inv, _status: computeStatus(inv) })), [invoices])

  const filtered = useMemo(() => enriched.filter(inv => {
    const statusMap = { Draft: 'draft', Sent: 'sent', 'Part Paid': 'partially_paid', Paid: 'paid', Overdue: 'overdue' }
    const matchStatus = statusFilter === 'All' || inv._status === statusMap[statusFilter]
    const matchSearch = !search ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.projects?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.client_name?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  }), [enriched, statusFilter, search])

  const { page, setPage, totalPages, paginated, total } = usePagination(filtered, 15)

  const kpi = useMemo(() => {
    const totalInvoiced   = enriched.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const totalCollected  = enriched.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0)
    const totalOutstanding = totalInvoiced - totalCollected
    const overdueCount    = enriched.filter(i => i._status === 'overdue').length
    return { totalInvoiced, totalCollected, totalOutstanding, overdueCount }
  }, [enriched])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Billing</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>
            Invoices
            {activeProject && <span className="text-base font-semibold ml-2" style={{ color: '#999' }}>— {activeProject.name}</span>}
          </h2>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition shadow-sm"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced',  val: `₦${kpi.totalInvoiced.toLocaleString()}`,   dark: true },
          { label: 'Collected',       val: `₦${kpi.totalCollected.toLocaleString()}`,   green: true },
          { label: 'Outstanding',     val: `₦${kpi.totalOutstanding.toLocaleString()}`, red: kpi.totalOutstanding > 0 },
          { label: 'Overdue',         val: `${kpi.overdueCount}`,  unit: 'invoices',    warn: kpi.overdueCount > 0 },
        ].map(({ label, val, unit, dark, green, red, warn }) => (
          <div key={label} className="rounded-2xl p-5 shadow-sm"
            style={{ background: dark ? '#1C1C1C' : green ? '#F0FDF4' : red ? '#FFF5F5' : warn ? '#FFFBEB' : 'white' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: dark ? 'rgba(255,255,255,0.4)' : green ? '#16A34A' : red ? '#CC0000' : warn ? '#D97706' : '#9CA3AF' }}>
              {label}
            </p>
            <p className="text-2xl font-black"
              style={{ color: dark ? 'white' : green ? '#16A34A' : red ? '#CC0000' : warn ? '#D97706' : '#1C1C1C' }}>
              {val}
              {unit && <span className="text-xs font-semibold ml-1 opacity-70">{unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl shadow-sm" style={{ background: 'white', border: '1px solid #EEEEEE' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => { setStatusFilter(tab); setPage(1) }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: statusFilter === tab ? '#1C1C1C' : 'transparent',
                color:      statusFilter === tab ? 'white'   : '#888',
              }}>
              {tab}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search invoices…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition shadow-sm"
            style={{ background: 'white', border: '1px solid #EEEEEE' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)' }} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#FFF5F5' }}>
            <FileText className="w-8 h-8" style={{ color: '#FECACA' }} />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-700">No invoices found</p>
            <p className="text-sm text-gray-400 mt-1">Create your first invoice to get started</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition mt-2"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
              onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                  {['Invoice #', 'Project', 'Client', 'Date', 'Due', 'Amount', 'Balance', 'Status', ''].map(h => (
                    <th key={h} className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400 ${['Amount','Balance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(inv => {
                  const paid = Number(inv.amount_paid ?? 0)
                  const ttl  = Number(inv.total_amount ?? 0)
                  const bal  = ttl - paid
                  return (
                    <tr key={inv.id} onClick={() => setSelectedInvoice(inv)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid #FAFAFA' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold" style={{ color: '#CC0000' }}>{inv.invoice_number}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800 text-sm truncate max-w-[140px]">{inv.projects?.name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-gray-500 truncate max-w-[120px]">{inv.client_name ?? inv.projects?.client ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {inv.invoice_date ? format(new Date(inv.invoice_date), 'dd MMM yy') : '—'}
                      </td>
                      <td className="px-5 py-4 text-xs whitespace-nowrap"
                        style={{ color: inv._status === 'overdue' ? '#CC0000' : '#6B7280', fontWeight: inv._status === 'overdue' ? 700 : 400 }}>
                        {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yy') : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-gray-800">₦{ttl.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold" style={{ color: bal > 0 ? '#CC0000' : '#16A34A' }}>
                          ₦{bal.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={inv._status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedInvoice(inv)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition text-gray-400"
                            onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#2563EB' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setConfirmDelete(inv)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition text-gray-400"
                              onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#CC0000' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}>
                              <Trash2 className="w-3.5 h-3.5" />
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

      {showCreate && (
        <CreateInvoiceModal
          projects={projects}
          defaultProjectId={activeProject?.id ?? ''}
          company={company}
          onClose={() => setShowCreate(false)}
          onSaved={loadInvoices}
        />
      )}

      {selectedInvoice && (
        <InvoiceDrawer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={() => { loadInvoices(); setSelectedInvoice(null) }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          title="Delete Invoice?"
          description={`Invoice ${confirmDelete.invoice_number} and all its payment records will be permanently deleted.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
