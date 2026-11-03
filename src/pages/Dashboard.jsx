import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  format, startOfMonth, endOfMonth, subMonths, addMonths, differenceInDays
} from 'date-fns'
import {
  TrendingUp, TrendingDown, Receipt, Users, AlertTriangle, Info,
  FolderOpen, ArrowRight, ArrowUpRight, ArrowDownRight, DollarSign,
  Calendar, CheckCircle2
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
const fmt = n => `₦${Number(n || 0).toLocaleString()}`

function pctChange(current, previous) {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

// ── Section Header ─────────────────────────────────────────────
function SectionHeader({ title, accent = '#CC0000' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full shrink-0" style={{ background: accent }} />
      <h3 className="font-bold text-gray-900">{title}</h3>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, variant = 'white', icon: Icon }) {
  const isDark  = variant === 'dark'
  const isRed   = variant === 'red'
  const isLight = variant === 'white'

  const bg    = isDark ? '#1C1C1C' : isRed ? '#CC0000' : '#FFFFFF'
  const textC = isLight ? '#1C1C1C' : '#FFFFFF'
  const labelC = isLight ? '#9CA3AF' : 'rgba(255,255,255,0.6)'
  const iconBg  = isDark ? 'rgba(255,255,255,0.08)' : isRed ? 'rgba(255,255,255,0.2)' : '#FEF2F2'
  const iconCol = isLight ? '#CC0000' : '#FFFFFF'

  return (
    <div className="rounded-2xl p-5 shadow-sm flex flex-col gap-3" style={{ background: bg }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest leading-tight" style={{ color: labelC }}>
          {label}
        </p>
        {Icon && (
          <div className="p-2 rounded-xl shrink-0" style={{ background: iconBg }}>
            <Icon className="w-4 h-4" style={{ color: iconCol }} />
          </div>
        )}
      </div>
      <p className="text-2xl font-black leading-none" style={{ color: textC }}>{value}</p>
      {sub && (
        <p className="text-xs font-semibold" style={{ color: subColor || (isLight ? '#6B7280' : 'rgba(255,255,255,0.6)') }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Delta chip ────────────────────────────────────────────────
function DeltaChip({ pct, light = true }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-gray-400">No prior data</span>
  const up = pct >= 0
  const color = up ? '#16a34a' : '#CC0000'
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color }}>
      <Arrow className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}% vs last month
    </span>
  )
}

// ── Cash Flow SVG Chart ───────────────────────────────────────
function CashFlowChart({ months }) {
  const W = 100   // viewBox percentage units
  const H = 160
  const PAD_L = 48
  const PAD_B = 24
  const PAD_T = 10
  const PAD_R = 8
  const innerW = W * 6 - PAD_L - PAD_R   // we'll use absolute px from parent

  const dataMonths = months.filter(m => m.inflow > 0 || m.outflow > 0)
  if (dataMonths.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl bg-gray-50 text-sm text-gray-400 gap-2">
        <Info className="w-4 h-4 shrink-0" />
        Not enough data to show chart yet
      </div>
    )
  }

  const allVals = months.flatMap(m => [m.inflow, m.outflow])
  const maxVal  = Math.max(...allVals, 1)
  const midVal  = maxVal / 2

  const chartW = 600
  const chartH = H - PAD_T - PAD_B
  const stepX  = (chartW - PAD_L - PAD_R) / (months.length - 1)

  function toX(i) { return PAD_L + i * stepX }
  function toY(v) { return PAD_T + chartH - (v / maxVal) * chartH }

  const inflowPts  = months.map((m, i) => `${toX(i)},${toY(m.inflow)}`).join(' ')
  const outflowPts = months.map((m, i) => `${toX(i)},${toY(m.outflow)}`).join(' ')

  const yLabels = [
    { v: 0,      y: toY(0) },
    { v: midVal, y: toY(midVal) },
    { v: maxVal, y: toY(maxVal) },
  ]

  function shortMoney(v) {
    if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}K`
    return `₦${v}`
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#CC0000' }} />
          <span className="text-xs font-semibold text-gray-500">Inflow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1C1C1C' }} />
          <span className="text-xs font-semibold text-gray-500">Outflow</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartW} ${H}`} className="w-full" style={{ height: `${H}px` }}>
        {/* Grid lines */}
        {yLabels.map(({ v, y }) => (
          <line key={v}
            x1={PAD_L} y1={y} x2={chartW - PAD_R} y2={y}
            stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 4" />
        ))}

        {/* Y labels */}
        {yLabels.map(({ v, y }) => (
          <text key={v} x={PAD_L - 4} y={y + 4}
            fontSize="10" fill="#9CA3AF" textAnchor="end" fontFamily="sans-serif">
            {shortMoney(v)}
          </text>
        ))}

        {/* X labels */}
        {months.map((m, i) => (
          <text key={m.label} x={toX(i)} y={H - 4}
            fontSize="10" fill="#9CA3AF" textAnchor="middle" fontFamily="sans-serif">
            {m.label}
          </text>
        ))}

        {/* Outflow line */}
        <polyline
          points={outflowPts}
          fill="none"
          stroke="#1C1C1C"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inflow line */}
        <polyline
          points={inflowPts}
          fill="none"
          stroke="#CC0000"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots — inflow */}
        {months.map((m, i) => (
          <circle key={`in-${i}`}
            cx={toX(i)} cy={toY(m.inflow)} r="3.5"
            fill="#CC0000" stroke="white" strokeWidth="1.5" />
        ))}

        {/* Dots — outflow */}
        {months.map((m, i) => (
          <circle key={`out-${i}`}
            cx={toX(i)} cy={toY(m.outflow)} r="3.5"
            fill="#1C1C1C" stroke="white" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ value, max, color = '#CC0000' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Deadline Badge ────────────────────────────────────────────
function DeadlineBadge({ days }) {
  if (days < 0) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#FFF0F0', color: '#CC0000' }}>
      Overdue
    </span>
  )
  if (days <= 2) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#FFF0F0', color: '#CC0000' }}>
      {days}d left
    </span>
  )
  if (days <= 7) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#FFFBEB', color: '#D97706' }}>
      {days}d left
    </span>
  )
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#F0FDF4', color: '#16a34a' }}>
      {days}d left
    </span>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const now = new Date()

  const [allEntries,      setAllEntries]      = useState([])
  const [monthEntries,    setMonthEntries]     = useState([])
  const [prevEntries,     setPrevEntries]      = useState([])
  const [projects,        setProjects]         = useState([])
  const [payrollEntries,  setPayrollEntries]   = useState([])
  const [loading,         setLoading]          = useState(true)

  useEffect(() => {
    async function load() {
      const thisStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const thisEnd   = format(endOfMonth(now),   'yyyy-MM-dd')
      const prevStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
      const prevEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd')

      const [allJournalRes, monthJournalRes, prevJournalRes, projectsRes, payrollRes] =
        await Promise.all([
          supabase.from('journal_entries').select('*').order('date', { ascending: false }),
          supabase.from('journal_entries').select('*').gte('date', thisStart).lte('date', thisEnd),
          supabase.from('journal_entries').select('*').gte('date', prevStart).lte('date', prevEnd),
          supabase.from('projects').select('*'),
          supabase.from('payroll_entries').select('*').gte('period_start', thisStart).lte('period_start', thisEnd),
        ])

      setAllEntries(allJournalRes.data     ?? [])
      setMonthEntries(monthJournalRes.data ?? [])
      setPrevEntries(prevJournalRes.data   ?? [])
      setProjects(projectsRes.data         ?? [])
      setPayrollEntries(payrollRes.data    ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived KPIs ──────────────────────────────────────────────
  const kpi = useMemo(() => {
    const allReceipts  = allEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const allPayments  = allEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)
    const netCash      = allReceipts - allPayments

    const thisReceipts = monthEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const thisPayments = monthEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)
    const prevReceipts = prevEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const prevPayments = prevEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)

    const activeProjects    = projects.filter(p => p.status === 'active')
    const completedProjects = projects.filter(p => p.status === 'completed')
    const totalContractVal  = projects.reduce((s, p) => s + Number(p.contract_value || 0), 0)

    const pendingTax = payrollEntries
      .filter(p => !p.remitted)
      .reduce((s, p) => s + Number(p.type === 'staff' ? (p.monthly_paye || 0) : (p.wht_amount || 0)), 0)

    return {
      netCash,
      thisReceipts,
      thisPayments,
      prevReceipts,
      prevPayments,
      activeCount:    activeProjects.length,
      completedCount: completedProjects.length,
      activeProjects,
      totalContractVal,
      pendingTax,
    }
  }, [allEntries, monthEntries, prevEntries, projects, payrollEntries])

  // ── 6-Month chart data ────────────────────────────────────────
  const chartMonths = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d     = subMonths(now, 5 - i)
      const label = format(d, 'MMM')
      const mStr  = format(d, 'yyyy-MM')
      const inflow  = allEntries
        .filter(e => e.type === 'receipt' && e.date?.startsWith(mStr))
        .reduce((s, e) => s + Number(e.amount || 0), 0)
      const outflow = allEntries
        .filter(e => e.type === 'payment' && e.date?.startsWith(mStr))
        .reduce((s, e) => s + Number(e.amount || 0), 0)
      return { label, inflow, outflow }
    })
  }, [allEntries])

  // ── Recent 6 journal entries ──────────────────────────────────
  const recentEntries = useMemo(() => allEntries.slice(0, 6), [allEntries])

  // ── Top 5 active projects ─────────────────────────────────────
  const topProjects = useMemo(() => kpi.activeProjects.slice(0, 5), [kpi.activeProjects])

  // ── Tax deadlines ─────────────────────────────────────────────
  const taxDeadlines = useMemo(() => {
    const vatDue  = new Date(now.getFullYear(), now.getMonth(), 21)
    const payeDue = new Date(now.getFullYear(), now.getMonth() + 1, 10)
    const whtDue  = new Date(now.getFullYear(), now.getMonth(), 21)

    function daysLeft(d) { return differenceInDays(d, now) }

    return [
      { name: 'VAT Return',        due: vatDue,  daysLeft: daysLeft(vatDue),  dueLabel: format(vatDue, 'dd MMM yyyy') },
      { name: 'PAYE Remittance',   due: payeDue, daysLeft: daysLeft(payeDue), dueLabel: format(payeDue, 'dd MMM yyyy') },
      { name: 'CIT Annual Return', due: null,    daysLeft: null,              dueLabel: 'Annual — check FIRS' },
      { name: 'WHT Remittance',    due: whtDue,  daysLeft: daysLeft(whtDue),  dueLabel: format(whtDue, 'dd MMM yyyy') },
    ]
  }, [now])

  const inflowDelta  = pctChange(kpi.thisReceipts, kpi.prevReceipts)
  const outflowDelta = pctChange(kpi.thisPayments, kpi.prevPayments)

  return (
    <div className="space-y-6" style={{ background: '#F5F5F5', minHeight: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>
            Financial
          </p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Overview</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-500">{format(now, 'MMMM yyyy')}</p>
          <p className="text-xs text-gray-400 mt-0.5">Last updated: just now</p>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

        {/* 1. Net Cash Position — dark */}
        <div className="sm:col-span-2 xl:col-span-2 rounded-2xl p-5 shadow-sm flex flex-col gap-2" style={{ background: '#1C1C1C' }}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Net Cash Position
            </p>
            <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-white leading-none">{fmt(kpi.netCash)}</p>
            {kpi.netCash >= 0
              ? <ArrowUpRight className="w-5 h-5 mb-0.5" style={{ color: '#4ade80' }} />
              : <ArrowDownRight className="w-5 h-5 mb-0.5" style={{ color: '#f87171' }} />
            }
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>All-time receipts minus payments</p>
        </div>

        {/* 2. This Month Inflow — red */}
        <div className="rounded-2xl p-5 shadow-sm flex flex-col gap-2" style={{ background: '#CC0000' }}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
              This Month Inflow
            </p>
            <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-black text-white leading-none">{fmt(kpi.thisReceipts)}</p>
          <DeltaChip pct={inflowDelta} light={false} />
        </div>

        {/* 3. This Month Outflow — white */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">This Month Outflow</p>
            <div className="p-2 rounded-xl bg-red-50">
              <TrendingDown className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
          </div>
          <p className="text-2xl font-black leading-none" style={{ color: '#1C1C1C' }}>{fmt(kpi.thisPayments)}</p>
          <DeltaChip pct={outflowDelta} />
        </div>

        {/* 4. Active Projects — white */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Active Projects</p>
            <div className="p-2 rounded-xl bg-red-50">
              <FolderOpen className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
          </div>
          <p className="text-2xl font-black leading-none" style={{ color: '#1C1C1C' }}>{kpi.activeCount}</p>
          <p className="text-xs text-gray-400">
            <span className="font-bold text-gray-600">{kpi.completedCount}</span> completed
          </p>
        </div>

        {/* 5. Total Project Value — white */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Project Value</p>
            <div className="p-2 rounded-xl bg-red-50">
              <Receipt className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
          </div>
          <p className="text-2xl font-black leading-none" style={{ color: '#1C1C1C' }}>{fmt(kpi.totalContractVal)}</p>
          <p className="text-xs text-gray-400">All contracts combined</p>
        </div>

        {/* 6. Pending Tax — white */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pending Tax</p>
            <div className="p-2 rounded-xl bg-red-50">
              <AlertTriangle className="w-4 h-4" style={{ color: '#CC0000' }} />
            </div>
          </div>
          <p
            className="text-2xl font-black leading-none"
            style={{ color: kpi.pendingTax > 0 ? '#CC0000' : '#1C1C1C' }}
          >
            {fmt(kpi.pendingTax)}
          </p>
          <p className="text-xs text-gray-400">Unremitted payroll tax</p>
        </div>
      </div>

      {/* ── Middle: Chart + Projects ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: Cash Flow Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader title="Monthly Cash Flow (6 months)" />
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading chart…</div>
          ) : (
            <CashFlowChart months={chartMonths} />
          )}
        </div>

        {/* Right: Active Projects */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-bold text-gray-900">Active Projects</h3>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70"
              style={{ color: '#CC0000' }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {topProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <FolderOpen className="w-8 h-8 opacity-20" />
              <p className="text-sm">No active projects</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProjects.map(p => {
                const estCost  = Number(p.estimated_cost  || 0)
                const actCost  = Number(p.actual_cost     || 0)
                const actRev   = Number(p.actual_revenue  || 0)
                const profit   = actRev - actCost
                const progPct  = estCost > 0 ? Math.min((actCost / estCost) * 100, 100) : 0
                const positive = profit >= 0

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate('/projects')}
                    className="p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 border border-transparent hover:border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: '#1C1C1C' }}>{p.name}</p>
                        <p className="text-xs text-gray-400 truncate">{p.client || '—'}</p>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                        style={{
                          background: positive ? '#F0FDF4' : '#FFF0F0',
                          color: positive ? '#16a34a' : '#CC0000',
                        }}
                      >
                        {positive ? '+' : ''}{fmt(profit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={actCost} max={estCost} color={progPct >= 100 ? '#CC0000' : '#1C1C1C'} />
                      <span className="text-xs text-gray-400 shrink-0">{progPct.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Tax Deadlines + Recent Transactions ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tax Deadline Reminders */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader title="Tax Deadline Reminders" />
          <div className="space-y-3">
            {taxDeadlines.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ background: '#F9FAFB' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#FFF0F0' }}
                  >
                    <Calendar className="w-4 h-4" style={{ color: '#CC0000' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#1C1C1C' }}>{d.name}</p>
                    <p className="text-xs text-gray-400">{d.dueLabel}</p>
                  </div>
                </div>
                {d.daysLeft !== null ? (
                  <DeadlineBadge days={d.daysLeft} />
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 shrink-0">
                    Annual
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-bold text-gray-900">Recent Transactions</h3>
            </div>
            <button
              onClick={() => navigate('/cashflow')}
              className="text-xs font-bold transition-colors hover:opacity-70"
              style={{ color: '#CC0000' }}
            >
              View all →
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <Receipt className="w-8 h-8 opacity-20" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEntries.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  {/* Type dot */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: e.type === 'receipt' ? '#FFF0F0' : '#F3F4F6' }}
                  >
                    {e.type === 'receipt'
                      ? <ArrowDownRight className="w-4 h-4" style={{ color: '#CC0000' }} />
                      : <ArrowUpRight className="w-4 h-4 text-gray-500" />
                    }
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1C1C1C' }}>
                      {e.description || '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {e.date ? format(new Date(e.date), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>

                  {/* Type badge + amount */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#1C1C1C' }}>
                      {fmt(e.amount)}
                    </p>
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: e.type === 'receipt' ? '#CC0000' : '#1C1C1C',
                        color: 'white',
                      }}
                    >
                      {e.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
