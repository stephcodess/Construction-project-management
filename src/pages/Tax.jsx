import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computePAYE, computeWHT } from '../lib/taxRules'
import { exportVATPDF } from '../lib/pdf'
import { exportPayrollPDF } from '../lib/pdf'
import { format, endOfMonth, subMonths } from 'date-fns'
import { Download, Receipt, CheckCircle2, ShieldCheck, Clock, AlertTriangle, X, Plus } from 'lucide-react'

// ── Shared input helpers ──────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">{label}</label>
      {children}
    </div>
  )
}
function SI({ ...props }) {
  return (
    <input {...props}
      className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
      onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
      onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
  )
}
function SS({ children, ...props }) {
  return (
    <select {...props} className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none">
      {children}
    </select>
  )
}

// ════════════════════════════════════════════════════════════════
// VAT TAB
// ════════════════════════════════════════════════════════════════
function VATTab() {
  const [entries, setEntries] = useState([])
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [vatReturns, setVatReturns] = useState([])

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    const start = `${month}-01`
    const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd')
    const [journalRes, returnsRes] = await Promise.all([
      supabase.from('journal_entries').select('*, projects(name)').gte('date', start).lte('date', end).eq('vat_applicable', true),
      supabase.from('vat_returns').select('*').order('period', { ascending: false }),
    ])
    setEntries(journalRes.data ?? [])
    setVatReturns(returnsRes.data ?? [])
  }

  const outputVAT = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.vat_amount), 0)
  const inputVAT  = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.vat_amount), 0)
  const netVAT = outputVAT - inputVAT
  const currentReturn = vatReturns.find(r => r.period === month)

  async function markFiled() {
    if (!confirm(`Mark VAT return for ${month} as filed?`)) return
    await supabase.from('vat_returns').upsert([{
      period: month, output_vat: outputVAT, input_vat: inputVAT,
      net_vat: netVAT, status: 'filed', filed_at: new Date().toISOString(),
    }], { onConflict: 'period' })
    loadData()
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border-2 border-transparent bg-white rounded-xl px-3.5 py-2 text-sm shadow-sm focus:outline-none"
            onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
            onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          <button onClick={() => exportVATPDF(entries, month)}
            className="flex items-center gap-2 border-2 px-3 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#1C1C1C' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Output VAT (Sales)</p>
          <p className="text-3xl font-black text-white">₦{outputVAT.toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-2">{entries.filter(e => e.type === 'receipt').length} taxable receipts</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Input VAT (Purchases)</p>
          <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>₦{inputVAT.toLocaleString()}</p>
          <p className="text-xs text-gray-300 mt-2">{entries.filter(e => e.type === 'payment').length} taxable payments</p>
        </div>
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#CC0000' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Net VAT Payable</p>
          <p className="text-3xl font-black text-white">₦{netVAT.toLocaleString()}</p>
          <div className="mt-auto pt-3">
            {currentReturn?.status === 'filed' ? (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-bold">Filed</span>
              </div>
            ) : (
              <button onClick={markFiled}
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-xs font-bold hover:bg-gray-100 transition"
                style={{ color: '#CC0000' }}>
                Mark as Filed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-bold text-gray-900">VAT-Applicable Transactions</h3>
        </div>
        {entries.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No VAT-applicable transactions this month.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F9F9F9' }}>
                <tr className="text-xs text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                  <th className="px-5 py-3.5 text-left font-semibold">VAT Type</th>
                  <th className="px-5 py-3.5 text-left font-semibold">Description</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Taxable Amt</th>
                  <th className="px-5 py-3.5 text-right font-semibold">VAT 7.5%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{format(new Date(e.date), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase text-white"
                        style={{ background: e.type === 'receipt' ? '#CC0000' : '#1C1C1C' }}>
                        {e.type === 'receipt' ? 'Output' : 'Input'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{e.description}</td>
                    <td className="px-5 py-3.5 text-right">₦{Number(e.amount).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-black" style={{ color: '#CC0000' }}>₦{Number(e.vat_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: '#F9F9F9' }}>
                <tr>
                  <td colSpan={4} className="px-5 py-3.5 text-right font-bold text-gray-700 text-sm">Net VAT Payable:</td>
                  <td className="px-5 py-3.5 text-right font-black text-base" style={{ color: '#CC0000' }}>₦{netVAT.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Filing History */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <div className="w-1 h-5 rounded-full" style={{ background: '#1C1C1C' }} />
          <h3 className="font-bold text-gray-900">VAT Filing History</h3>
        </div>
        {vatReturns.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No filed returns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F9F9F9' }}>
                <tr className="text-xs text-gray-400 uppercase tracking-widest">
                  {['Period','Output VAT','Input VAT','Net VAT','Status','Filed Date'].map((h, i) => (
                    <th key={h} className={`px-5 py-3.5 font-semibold ${i > 0 && i < 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vatReturns.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-bold">{r.period}</td>
                    <td className="px-5 py-3.5 text-right">₦{Number(r.output_vat).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">₦{Number(r.input_vat).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-black" style={{ color: '#CC0000' }}>₦{Number(r.net_vat).toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: r.status === 'filed' ? '#1C1C1C' : '#CC0000' }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">{r.filed_at ? format(new Date(r.filed_at), 'dd MMM yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PAYROLL TAB
// ════════════════════════════════════════════════════════════════
function PayrollTab() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'staff', gross_amount: '', entity_type: 'individual', project_id: '' })
  const [preview, setPreview] = useState(null)
  const [projects, setProjects] = useState([])

  useEffect(() => { loadEntries(); loadProjects() }, [month])

  async function loadEntries() {
    const start = `${month}-01`
    const { data } = await supabase.from('payroll_entries').select('*, projects(name)')
      .gte('period_start', start).lte('period_start', start).order('created_at', { ascending: false })
    setEntries(data ?? [])
  }
  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name').eq('status', 'active')
    setProjects(data ?? [])
  }

  function computePreview(type, gross, entityType) {
    if (!gross) return null
    if (type === 'staff') {
      const p = computePAYE(Number(gross) * 12)
      return { ...p, type: 'staff', net_payable: Number(gross) - p.monthlyPAYE }
    }
    const w = computeWHT(Number(gross), entityType)
    return { ...w, type: 'consultant', monthly_paye: 0 }
  }

  function handleFormChange(field, value) {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setPreview(computePreview(updated.type, updated.gross_amount, updated.entity_type))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const p = computePreview(form.type, form.gross_amount, form.entity_type)
    await supabase.from('payroll_entries').insert([{
      name: form.name, type: form.type,
      gross_amount: Number(form.gross_amount),
      entity_type: form.type === 'consultant' ? form.entity_type : null,
      monthly_paye: form.type === 'staff' ? p.monthlyPAYE : 0,
      wht_rate: form.type === 'consultant' ? p.whtRate : 0,
      wht_amount: form.type === 'consultant' ? p.whtAmount : 0,
      net_payable: p.net_payable ?? p.netPayable,
      period_start: `${month}-01`,
      project_id: form.project_id || null,
      remitted: false,
    }])
    setSaving(false); setShowModal(false)
    setForm({ name: '', type: 'staff', gross_amount: '', entity_type: 'individual', project_id: '' })
    setPreview(null); loadEntries()
  }

  async function markRemitted(id) {
    await supabase.from('payroll_entries').update({ remitted: true, remitted_at: new Date().toISOString() }).eq('id', id)
    loadEntries()
  }

  const totalPAYE = entries.filter(e => e.type === 'staff').reduce((s, e) => s + Number(e.monthly_paye), 0)
  const totalWHT  = entries.filter(e => e.type === 'consultant').reduce((s, e) => s + Number(e.wht_amount), 0)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border-2 border-transparent bg-white rounded-xl px-3.5 py-2 text-sm shadow-sm focus:outline-none"
            onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
            onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          <button onClick={() => exportPayrollPDF(entries, month)}
            className="flex items-center gap-2 border-2 px-3 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'accountant') && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#CC0000' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">PAYE (Staff)</p>
          <p className="text-3xl font-black text-white">₦{totalPAYE.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#1C1C1C' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">WHT (Consultants)</p>
          <p className="text-3xl font-black text-white">₦{totalWHT.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Total Tax Obligation</p>
          <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>₦{(totalPAYE + totalWHT).toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9F9F9' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                {['Name','Type','Gross','Tax / WHT','Net Pay','Status',''].map((h, i) => (
                  <th key={i} className={`px-5 py-3.5 font-semibold ${['Gross','Tax / WHT','Net Pay'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No entries this month.</td></tr>
              )}
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-bold text-gray-900">{e.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                      style={{ background: e.type === 'staff' ? '#1C1C1C' : '#CC0000' }}>
                      {e.type === 'staff' ? 'Staff/PAYE' : `WHT ${(e.wht_rate * 100).toFixed(0)}%`}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">₦{Number(e.gross_amount).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right font-bold" style={{ color: '#CC0000' }}>
                    ₦{Number(e.type === 'staff' ? e.monthly_paye : e.wht_amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-black" style={{ color: '#1C1C1C' }}>₦{Number(e.net_payable).toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    {e.remitted ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" style={{ color: '#1C1C1C' }} />
                        <span className="text-xs font-bold text-gray-500">Remitted</span>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: '#CC0000' }}>Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {!e.remitted && profile?.role === 'admin' && (
                      <button onClick={() => markRemitted(e.id)} className="text-xs font-bold underline" style={{ color: '#1C1C1C' }}>
                        Mark Remitted
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white" style={{ borderColor: '#F0F0F0' }}>
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
                <h3 className="font-bold text-gray-900">New Payroll Entry</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Full Name *"><SI type="text" required value={form.name} onChange={e => handleFormChange('name', e.target.value)} /></Field>
                </div>
                <Field label="Type *">
                  <SS value={form.type} onChange={e => handleFormChange('type', e.target.value)}>
                    <option value="staff">Staff (PAYE)</option>
                    <option value="consultant">Consultant / Contractor (WHT)</option>
                  </SS>
                </Field>
                <Field label={form.type === 'staff' ? 'Monthly Gross (₦) *' : 'Invoice Amount (₦) *'}>
                  <SI type="number" required min="0" step="0.01" value={form.gross_amount} onChange={e => handleFormChange('gross_amount', e.target.value)} />
                </Field>
                {form.type === 'consultant' && (
                  <>
                    <Field label="Entity Type">
                      <SS value={form.entity_type} onChange={e => handleFormChange('entity_type', e.target.value)}>
                        <option value="individual">Individual (5% WHT)</option>
                        <option value="company">Company (10% WHT)</option>
                      </SS>
                    </Field>
                    <Field label="Project">
                      <SS value={form.project_id} onChange={e => handleFormChange('project_id', e.target.value)}>
                        <option value="">— None —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </SS>
                    </Field>
                  </>
                )}
              </div>
              {preview && (
                <div className="rounded-xl p-4 border" style={{ background: '#FFF0F0', borderColor: '#CC0000' }}>
                  <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#CC0000' }}>Tax Preview</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {preview.type === 'staff' ? (
                      <>
                        <div><p className="text-gray-400 text-xs">Monthly PAYE</p><p className="font-black" style={{ color: '#CC0000' }}>₦{preview.monthlyPAYE?.toLocaleString()}</p></div>
                        <div><p className="text-gray-400 text-xs">Net Monthly Pay</p><p className="font-black">₦{preview.net_payable?.toLocaleString()}</p></div>
                      </>
                    ) : (
                      <>
                        <div><p className="text-gray-400 text-xs">WHT Rate</p><p className="font-bold">{(preview.whtRate * 100).toFixed(0)}%</p></div>
                        <div><p className="text-gray-400 text-xs">WHT Deduction</p><p className="font-black" style={{ color: '#CC0000' }}>₦{preview.whtAmount?.toLocaleString()}</p></div>
                        <div><p className="text-gray-400 text-xs">Net Payable</p><p className="font-black">₦{preview.netPayable?.toLocaleString()}</p></div>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition"
                  style={{ background: '#CC0000' }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
                  onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
                  {saving ? 'Saving…' : 'Save Entry'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="border-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                  style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// COMPLIANCE TAB
// ════════════════════════════════════════════════════════════════
function StatusBadge({ status }) {
  const cfg = {
    filed:   { bg: '#1C1C1C', text: 'white',  label: 'Filed',   icon: ShieldCheck },
    pending: { bg: '#F5F5F5', text: '#999',   label: 'Pending', icon: Clock },
    overdue: { bg: '#CC0000', text: 'white',  label: 'Overdue', icon: AlertTriangle },
  }[status] ?? { bg: '#F5F5F5', text: '#999', label: status, icon: Clock }
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.text }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

function ComplianceTab() {
  const [months, setMonths] = useState([])
  const [vatReturns, setVatReturns] = useState([])
  const [payrollData, setPayrollData] = useState([])
  const now = new Date()

  useEffect(() => {
    const last6 = Array.from({ length: 6 }, (_, i) => format(subMonths(now, i), 'yyyy-MM')).reverse()
    setMonths(last6)
    async function load() {
      const [vatRes, payrollRes] = await Promise.all([
        supabase.from('vat_returns').select('*'),
        supabase.from('payroll_entries').select('period_start, remitted'),
      ])
      setVatReturns(vatRes.data ?? [])
      setPayrollData(payrollRes.data ?? [])
    }
    load()
  }, [])

  function getVATStatus(month) {
    const r = vatReturns.find(v => v.period === month)
    if (r?.status === 'filed') return 'filed'
    const d = new Date(month)
    const deadline = new Date(d.getFullYear(), d.getMonth() + 1, 21)
    return now > deadline ? 'overdue' : 'pending'
  }

  function getPAYEStatus(month) {
    const entries = payrollData.filter(p => p.period_start?.startsWith(month))
    if (entries.length === 0) return 'pending'
    if (entries.every(p => p.remitted)) return 'filed'
    const d = new Date(month)
    const deadline = new Date(d.getFullYear(), d.getMonth() + 1, 10)
    return now > deadline ? 'overdue' : 'pending'
  }

  const vatFiled   = months.filter(m => getVATStatus(m)  === 'filed').length
  const vatOverdue = months.filter(m => getVATStatus(m)  === 'overdue').length
  const payeFiled  = months.filter(m => getPAYEStatus(m) === 'filed').length
  const payeOverdue= months.filter(m => getPAYEStatus(m) === 'overdue').length

  const deadlines = [
    { color: '#CC0000', title: 'VAT Return — 21st of following month', desc: 'File and remit net VAT to FIRS on or before the 21st' },
    { color: '#1C1C1C', title: 'PAYE Remittance — 10th of following month', desc: 'Deduct and remit PAYE to LIRS/SIRS by the 10th' },
    { color: '#CC0000', title: 'WHT Remittance — 21st of following month', desc: 'Remit WHT deducted from consultants/contractors to FIRS by 21st' },
    { color: '#1C1C1C', title: 'Annual Company Tax Return — 6 months after year-end', desc: 'File CIT return within 6 months of financial year end' },
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#1C1C1C' }}>
          <p className="text-3xl font-black text-white">{vatFiled}<span className="text-lg text-white/40">/6</span></p>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mt-1">VAT Filed</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: vatOverdue > 0 ? '#CC0000' : '#F5F5F5' }}>
          <p className="text-3xl font-black" style={{ color: vatOverdue > 0 ? 'white' : '#1C1C1C' }}>{vatOverdue}</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: vatOverdue > 0 ? 'rgba(255,255,255,0.6)' : '#999' }}>VAT Overdue</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#1C1C1C' }}>
          <p className="text-3xl font-black text-white">{payeFiled}<span className="text-lg text-white/40">/6</span></p>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mt-1">PAYE Remitted</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: payeOverdue > 0 ? '#CC0000' : '#F5F5F5' }}>
          <p className="text-3xl font-black" style={{ color: payeOverdue > 0 ? 'white' : '#1C1C1C' }}>{payeOverdue}</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: payeOverdue > 0 ? 'rgba(255,255,255,0.6)' : '#999' }}>PAYE Overdue</p>
        </div>
      </div>

      {/* Deadlines */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-bold text-gray-900">Nigerian Tax Filing Deadlines</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {deadlines.map(d => (
            <div key={d.title} className="flex gap-4 p-4 rounded-xl" style={{ background: '#F9F9F9' }}>
              <div className="w-1 rounded-full shrink-0 mt-1" style={{ background: d.color }} />
              <div>
                <p className="font-bold text-sm" style={{ color: '#1C1C1C' }}>{d.title}</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly tracker */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <div className="w-1 h-5 rounded-full" style={{ background: '#1C1C1C' }} />
          <h3 className="font-bold text-gray-900">Monthly Compliance Tracker — Last 6 Months</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9F9F9' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-3.5 text-left font-semibold">Month</th>
                <th className="px-6 py-3.5 text-left font-semibold">VAT Return</th>
                <th className="px-6 py-3.5 text-left font-semibold">PAYE / WHT</th>
                <th className="px-6 py-3.5 text-left font-semibold">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {months.map(m => {
                const vatStatus  = getVATStatus(m)
                const payeStatus = getPAYEStatus(m)
                const bothFiled  = vatStatus === 'filed' && payeStatus === 'filed'
                const anyOverdue = vatStatus === 'overdue' || payeStatus === 'overdue'
                const overall    = bothFiled ? 'filed' : anyOverdue ? 'overdue' : 'pending'
                return (
                  <tr key={m} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold" style={{ color: '#1C1C1C' }}>{format(new Date(m), 'MMMM yyyy')}</td>
                    <td className="px-6 py-4"><StatusBadge status={vatStatus} /></td>
                    <td className="px-6 py-4"><StatusBadge status={payeStatus} /></td>
                    <td className="px-6 py-4"><StatusBadge status={overall} /></td>
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

// ════════════════════════════════════════════════════════════════
// MAIN TAX PAGE
// ════════════════════════════════════════════════════════════════
const TABS = ['VAT Returns', 'Payroll / WHT', 'Compliance']

export default function Tax() {
  const [tab, setTab] = useState('VAT Returns')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Finance</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Tax & Compliance</h2>
        </div>
        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border" style={{ borderColor: '#E5E5E5' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
              style={{
                background: tab === t ? '#1C1C1C' : 'transparent',
                color: tab === t ? 'white' : '#888'
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'VAT Returns'   && <VATTab />}
      {tab === 'Payroll / WHT' && <PayrollTab />}
      {tab === 'Compliance'    && <ComplianceTab />}
    </div>
  )
}
