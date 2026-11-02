import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportVATPDF } from '../lib/pdf'
import { format, endOfMonth } from 'date-fns'
import { Download, Receipt, CheckCircle2 } from 'lucide-react'

export default function VAT() {
  const [entries, setEntries] = useState([])
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [vatReturns, setVatReturns] = useState([])

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    const start = `${month}-01`
    const end = format(endOfMonth(new Date(month)), 'yyyy-MM-dd')
    const [journalRes, returnsRes] = await Promise.all([
      supabase.from('journal_entries').select('*, projects(name)').gte('date', start).lte('date', end).eq('vat_applicable', true),
      supabase.from('vat_returns').select('*').order('period', { ascending: false }),
    ])
    setEntries(journalRes.data ?? [])
    setVatReturns(returnsRes.data ?? [])
  }

  const outputVAT = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.vat_amount), 0)
  const inputVAT = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.vat_amount), 0)
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

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Tax</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>VAT Returns</h2>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border-2 border-transparent bg-white rounded-xl px-3.5 py-2 text-sm shadow-sm focus:outline-none"
            onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
            onBlur={e => e.currentTarget.style.borderColor = 'transparent'} />
          <button onClick={() => exportVATPDF(entries, month)}
            className="flex items-center gap-2 border-2 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
            style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}>
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* VAT Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#1C1C1C' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Output VAT (Sales)</p>
          <p className="text-3xl font-black text-white">₦{outputVAT.toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-2">{entries.filter(e => e.type === 'receipt').length} taxable receipts</p>
        </div>
        <div className="rounded-2xl p-5 bg-white shadow-sm">
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
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-gray-100"
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
            <p className="text-xs text-gray-300 mt-1">Mark transactions as "VAT Applicable" in the Journal.</p>
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
                  <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{format(new Date(e.date), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide text-white"
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
                    <th key={h} className={`px-5 py-3.5 font-semibold ${i > 0 ? 'text-right' : 'text-left'}`}
                      style={i === 4 || i === 5 ? { textAlign: 'left' } : {}}>{h}</th>
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
