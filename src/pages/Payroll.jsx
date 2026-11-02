import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computePAYE, computeWHT } from '../lib/taxRules'
import { exportPayrollPDF } from '../lib/pdf'
import { format } from 'date-fns'
import { Plus, Download, CheckCircle2 } from 'lucide-react'

export default function Payroll() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showForm, setShowForm] = useState(false)
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
    setSaving(false); setShowForm(false)
    setForm({ name: '', type: 'staff', gross_amount: '', entity_type: 'individual', project_id: '' })
    setPreview(null); loadEntries()
  }

  async function markRemitted(id) {
    await supabase.from('payroll_entries').update({ remitted: true, remitted_at: new Date().toISOString() }).eq('id', id)
    loadEntries()
  }

  const totalPAYE = entries.filter(e => e.type === 'staff').reduce((s, e) => s + Number(e.monthly_paye), 0)
  const totalWHT = entries.filter(e => e.type === 'consultant').reduce((s, e) => s + Number(e.wht_amount), 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Tax</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Payroll / WHT</h2>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border-2 border-transparent bg-white rounded-xl px-3.5 py-2 text-sm shadow-sm focus:outline-none"
            onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
            onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          <button onClick={() => exportPayrollPDF(entries, month)}
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

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-bold text-gray-900">New Payroll Entry</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Full Name *', key: 'name', type: 'text', required: true },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">{f.label}</label>
                <input type={f.type} required={f.required} value={form[f.key]}
                  onChange={e => handleFormChange(f.key, e.target.value)}
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Type *</label>
              <select value={form.type} onChange={e => handleFormChange('type', e.target.value)}
                className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm">
                <option value="staff">Staff (PAYE)</option>
                <option value="consultant">Consultant / Contractor (WHT)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">
                {form.type === 'staff' ? 'Monthly Gross (₦) *' : 'Invoice Amount (₦) *'}
              </label>
              <input type="number" required min="0" step="0.01" value={form.gross_amount}
                onChange={e => handleFormChange('gross_amount', e.target.value)}
                className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
            </div>
          </div>
          {form.type === 'consultant' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Entity Type</label>
                <select value={form.entity_type} onChange={e => handleFormChange('entity_type', e.target.value)}
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm">
                  <option value="individual">Individual (5% WHT)</option>
                  <option value="company">Company (10% WHT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">Project</label>
                <select value={form.project_id} onChange={e => handleFormChange('project_id', e.target.value)}
                  className="w-full border-2 border-transparent bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm">
                  <option value="">— None —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          {preview && (
            <div className="rounded-xl p-4 border" style={{ background: '#FFF0F0', borderColor: '#CC0000' }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#CC0000' }}>Tax Preview</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {preview.type === 'staff' ? (
                  <>
                    <div><p className="text-gray-400 text-xs">Annual Gross</p><p className="font-bold">₦{preview.annualGross?.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 text-xs">CRA Relief</p><p className="font-bold">₦{preview.cra?.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 text-xs">Annual PAYE</p><p className="font-bold">₦{preview.annualPAYE?.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 text-xs">Monthly PAYE</p><p className="font-black text-base" style={{ color: '#CC0000' }}>₦{preview.monthlyPAYE?.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 text-xs">Net Monthly Pay</p><p className="font-black text-base">₦{preview.net_payable?.toLocaleString()}</p></div>
                  </>
                ) : (
                  <>
                    <div><p className="text-gray-400 text-xs">WHT Rate</p><p className="font-bold">{(preview.whtRate * 100).toFixed(0)}%</p></div>
                    <div><p className="text-gray-400 text-xs">WHT Deduction</p><p className="font-black text-base" style={{ color: '#CC0000' }}>₦{preview.whtAmount?.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 text-xs">Net Payable</p><p className="font-black text-base">₦{preview.netPayable?.toLocaleString()}</p></div>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
              style={{ background: '#CC0000' }}>
              {saving ? 'Saving…' : 'Save Entry'}
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
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
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
                      <button onClick={() => markRemitted(e.id)}
                        className="text-xs font-bold underline" style={{ color: '#1C1C1C' }}>
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
    </div>
  )
}
