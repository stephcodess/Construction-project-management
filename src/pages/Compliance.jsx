import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, subMonths } from 'date-fns'
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react'

function StatusBadge({ status }) {
  const cfg = {
    filed:   { bg: '#1C1C1C', text: 'white',    label: 'Filed',   icon: ShieldCheck },
    pending: { bg: '#F5F5F5', text: '#999',      label: 'Pending', icon: Clock },
    overdue: { bg: '#CC0000', text: 'white',     label: 'Overdue', icon: AlertTriangle },
  }[status] ?? { bg: '#F5F5F5', text: '#999', label: status, icon: Clock }
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.text }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

export default function Compliance() {
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

  const vatFiled = months.filter(m => getVATStatus(m) === 'filed').length
  const vatOverdue = months.filter(m => getVATStatus(m) === 'overdue').length
  const payeFiled = months.filter(m => getPAYEStatus(m) === 'filed').length
  const payeOverdue = months.filter(m => getPAYEStatus(m) === 'overdue').length

  const deadlines = [
    { color: '#CC0000', title: 'VAT Return — 21st of following month', desc: 'File and remit net VAT to FIRS on or before the 21st' },
    { color: '#1C1C1C', title: 'PAYE Remittance — 10th of following month', desc: 'Deduct and remit PAYE to LIRS/SIRS by the 10th' },
    { color: '#CC0000', title: 'WHT Remittance — 21st of following month', desc: 'Remit WHT deducted from consultants/contractors to FIRS by 21st' },
    { color: '#1C1C1C', title: 'Annual Company Tax Return — 6 months after year-end', desc: 'File CIT return within 6 months of financial year end' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Compliance</p>
        <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Tax Compliance Dashboard</h2>
      </div>

      {/* Summary cards */}
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
                const vatStatus = getVATStatus(m)
                const payeStatus = getPAYEStatus(m)
                const bothFiled = vatStatus === 'filed' && payeStatus === 'filed'
                const anyOverdue = vatStatus === 'overdue' || payeStatus === 'overdue'
                const overall = bothFiled ? 'filed' : anyOverdue ? 'overdue' : 'pending'
                return (
                  <tr key={m} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold" style={{ color: '#1C1C1C' }}>
                      {format(new Date(m), 'MMMM yyyy')}
                    </td>
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
