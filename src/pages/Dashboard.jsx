import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { TrendingUp, TrendingDown, Receipt, Users, AlertTriangle, Info } from 'lucide-react'

function StatCard({ label, value, icon: Icon, variant }) {
  const styles = {
    red:   { card: '#CC0000', icon: 'text-white', iconBg: 'bg-white/20' },
    dark:  { card: '#1C1C1C', icon: 'text-white', iconBg: 'bg-white/10' },
    white: { card: '#FFFFFF', icon: 'text-[#CC0000]', iconBg: 'bg-red-50' },
  }[variant] ?? { card: '#FFFFFF', icon: 'text-[#1C1C1C]', iconBg: 'bg-gray-100' }

  const isLight = variant === 'white'

  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm" style={{ background: styles.card }}>
      <div className={`p-2.5 rounded-xl ${styles.iconBg} shrink-0`}>
        <Icon className={`w-5 h-5 ${styles.icon}`} />
      </div>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-0.5 ${isLight ? 'text-gray-400' : 'text-white/60'}`}>{label}</p>
        <p className={`text-xl font-black ${isLight ? 'text-[#1C1C1C]' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ receipts: 0, payments: 0, vatDue: 0, pendingPayroll: 0 })
  const [recentEntries, setRecentEntries] = useState([])
  const [alerts, setAlerts] = useState([])
  const now = new Date()

  useEffect(() => {
    async function load() {
      const start = format(startOfMonth(now), 'yyyy-MM-dd')
      const end = format(endOfMonth(now), 'yyyy-MM-dd')

      const [journalRes, payrollRes] = await Promise.all([
        supabase.from('journal_entries').select('*').gte('date', start).lte('date', end),
        supabase.from('payroll_entries').select('*').gte('period_start', start).lte('period_start', end),
      ])

      const entries = journalRes.data ?? []
      const receipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
      const payments = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
      const outputVAT = entries.filter(e => e.type === 'receipt' && e.vat_applicable).reduce((s, e) => s + Number(e.vat_amount), 0)
      const inputVAT = entries.filter(e => e.type === 'payment' && e.vat_applicable).reduce((s, e) => s + Number(e.vat_amount), 0)
      const payrollItems = payrollRes.data ?? []
      const pendingTax = payrollItems.filter(p => !p.remitted).reduce((s, p) => s + Number(p.type === 'staff' ? p.monthly_paye : p.wht_amount), 0)

      setStats({ receipts, payments, vatDue: outputVAT - inputVAT, pendingPayroll: pendingTax })
      setRecentEntries(entries.slice(0, 8))

      const day = now.getDate()
      const alertList = []
      if (day >= 20) alertList.push({ type: 'warn', msg: 'VAT return due by the 21st of this month' })
      if (day >= 7)  alertList.push({ type: 'warn', msg: 'PAYE remittance due by the 10th of next month' })
      if (outputVAT - inputVAT > 0) alertList.push({ type: 'info', msg: `Net VAT payable this month: ₦${(outputVAT - inputVAT).toLocaleString()}` })
      setAlerts(alertList)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Financial</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Overview</h2>
        </div>
        <p className="text-sm text-gray-400">{format(now, 'MMMM yyyy')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Receipts"   value={`₦${stats.receipts.toLocaleString()}`}       icon={TrendingUp}   variant="red"   />
        <StatCard label="Total Payments"   value={`₦${stats.payments.toLocaleString()}`}       icon={TrendingDown} variant="dark"  />
        <StatCard label="Net VAT Due"      value={`₦${stats.vatDue.toLocaleString()}`}         icon={Receipt}      variant="white" />
        <StatCard label="Pending Tax/WHT"  value={`₦${stats.pendingPayroll.toLocaleString()}`} icon={Users}        variant="white" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium border ${
              a.type === 'warn' ? 'border-[#CC0000]/30 text-[#CC0000]' : 'border-gray-200 text-gray-600'
            }`} style={{ background: a.type === 'warn' ? '#FFF0F0' : '#F9F9F9' }}>
              {a.type === 'warn'
                ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#CC0000' }} />
                : <Info className="w-4 h-4 shrink-0 text-gray-400" />}
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Recent entries */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-bold text-gray-900">Recent Journal Entries</h3>
        </div>
        {recentEntries.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No entries this month yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F9F9F9' }}>
                <tr className="text-xs text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-6 py-3 text-left font-semibold">Type</th>
                  <th className="px-6 py-3 text-left font-semibold">Description</th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentEntries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{format(new Date(e.date), 'dd MMM')}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide text-white"
                        style={{ background: e.type === 'receipt' ? '#CC0000' : '#1C1C1C' }}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">{e.description}</td>
                    <td className="px-6 py-3.5 text-right font-black" style={{ color: '#1C1C1C' }}>
                      ₦{Number(e.amount).toLocaleString()}
                    </td>
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
