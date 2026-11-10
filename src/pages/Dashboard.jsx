import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCompany } from '../context/CompanyContext'
import Pagination, { usePagination } from '../components/Pagination'
import {
  format, startOfMonth, endOfMonth, subMonths, differenceInDays,
  parseISO, isToday, isYesterday, addDays
} from 'date-fns'
import {
  TrendingUp, TrendingDown, Receipt, AlertTriangle,
  FolderOpen, ArrowRight, ArrowUpRight, ArrowDownRight, DollarSign,
  Calendar, FileText, Users, CreditCard, Upload, PlusCircle,
  Banknote, Info, Activity, Bell, ChevronRight, CheckCircle2,
  FilePlus, Settings, Flag, Clock, Send
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
const naira = n => `₦${Number(n || 0).toLocaleString()}`
function pctChange(cur, prev) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}
function shortMoney(v) {
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `₦${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `₦${(v / 1_000).toFixed(0)}K`
  return `₦${v}`
}

// ── Delta chip ────────────────────────────────────────────────
function Delta({ pct, inverted = false }) {
  if (pct === null || pct === undefined) return <span className="text-[10px] text-gray-400">No prior data</span>
  const good = inverted ? pct <= 0 : pct >= 0
  const color = good ? '#16A34A' : '#CC0000'
  const Arrow = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color }}>
      <Arrow className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}% vs last month
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, delta, invertDelta, icon: Icon, variant = 'white', onClick }) {
  const isDark = variant === 'dark'
  const isRed  = variant === 'red'
  const bg    = isDark ? '#1C1C1C' : isRed ? '#CC0000' : 'white'
  const fg    = isDark || isRed ? 'white' : '#1C1C1C'
  const muted = isDark || isRed ? 'rgba(255,255,255,0.45)' : '#9CA3AF'
  const iconBg = isDark ? 'rgba(255,255,255,0.08)' : isRed ? 'rgba(255,255,255,0.18)' : '#FEF2F2'
  const iconFg = isDark || isRed ? 'white' : '#CC0000'

  return (
    <div onClick={onClick}
      className={`rounded-2xl p-5 shadow-sm flex flex-col gap-2.5 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ background: bg }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.opacity = '0.9' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest leading-tight" style={{ color: muted }}>{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
            <Icon className="w-4 h-4" style={{ color: iconFg }} />
          </div>
        )}
      </div>
      <p className="text-2xl font-black leading-none" style={{ color: fg }}>{value}</p>
      {sub   && <p className="text-xs" style={{ color: muted }}>{sub}</p>}
      {delta !== undefined && <Delta pct={delta} inverted={invertDelta} />}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────
function Bar({ value, max, color = '#CC0000', bg = '#F0F0F0' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: bg }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── Deadline badge ────────────────────────────────────────────
function DeadlineBadge({ days }) {
  if (days === null) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Annual</span>
  if (days < 0)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF0F0', color: '#CC0000' }}>Overdue</span>
  if (days <= 2) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF0F0', color: '#CC0000' }}>{days}d left</span>
  if (days <= 7) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#D97706' }}>{days}d left</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#16A34A' }}>{days}d left</span>
}

// ── SVG Cash Flow Chart ───────────────────────────────────────
function CashFlowChart({ months }) {
  const W = 600; const H = 170
  const PL = 52; const PB = 24; const PT = 12; const PR = 8
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const hasData = months.some(m => m.inflow > 0 || m.outflow > 0)
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-xl gap-2" style={{ background: '#FAFAFA' }}>
        <Info className="w-5 h-5 text-gray-200" />
        <p className="text-xs text-gray-400">No data yet — add journal entries to see the chart</p>
      </div>
    )
  }

  const maxVal = Math.max(...months.flatMap(m => [m.inflow, m.outflow]), 1)
  const step   = chartW / (months.length - 1)
  const toX    = i => PL + i * step
  const toY    = v => PT + chartH - (v / maxVal) * chartH

  const inflowD  = months.map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(m.inflow)}`).join(' ')
  const outflowD = months.map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(m.outflow)}`).join(' ')

  // Fill areas
  const inflowFill  = `${inflowD} L${toX(months.length - 1)},${PT + chartH} L${toX(0)},${PT + chartH} Z`
  const outflowFill = `${outflowD} L${toX(months.length - 1)},${PT + chartH} L${toX(0)},${PT + chartH} Z`

  const yTicks = [0, 0.5, 1].map(r => ({ v: r * maxVal, y: toY(r * maxVal) }))

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        {[{ c: '#CC0000', l: 'Inflow' }, { c: '#1C1C1C', l: 'Outflow' }].map(({ c, l }) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span className="text-[10px] font-semibold text-gray-400">{l}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto', maxHeight: `${H}px`, minHeight: '100px' }}>
        <defs>
          <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CC0000" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#CC0000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1C1C1C" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#1C1C1C" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#F0F0F0" strokeWidth="1" />
        ))}

        {/* Y labels */}
        {yTicks.map(({ v, y }, i) => (
          <text key={i} x={PL - 5} y={y + 4} fontSize="9" fill="#C0C0C0" textAnchor="end" fontFamily="sans-serif">
            {shortMoney(v)}
          </text>
        ))}

        {/* Fill areas */}
        <path d={outflowFill} fill="url(#outflowGrad)" />
        <path d={inflowFill}  fill="url(#inflowGrad)" />

        {/* Lines */}
        <path d={outflowD} fill="none" stroke="#1C1C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={inflowD}  fill="none" stroke="#CC0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {months.map((m, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(m.outflow)} r="3" fill="#1C1C1C" stroke="white" strokeWidth="1.5" />
            <circle cx={toX(i)} cy={toY(m.inflow)}  r="3.5" fill="#CC0000" stroke="white" strokeWidth="1.5" />
          </g>
        ))}

        {/* X labels */}
        {months.map((m, i) => (
          <text key={i} x={toX(i)} y={H - 4} fontSize="9" fill="#C0C0C0" textAnchor="middle" fontFamily="sans-serif">
            {m.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Activity icon config ──────────────────────────────────────
const ACTIVITY_CFG = {
  invoice_created:    { icon: FilePlus,    color: '#CC0000',  bg: '#FFF0F0',  label: 'Invoice created' },
  invoice_sent:       { icon: Send,        color: '#2563EB',  bg: '#EFF6FF',  label: 'Invoice marked sent' },
  payment_recorded:   { icon: CreditCard,  color: '#16A34A',  bg: '#F0FDF4',  label: 'Payment recorded' },
  project_created:    { icon: FolderOpen,  color: '#7C3AED',  bg: '#F5F3FF',  label: 'Project created' },
  project_updated:    { icon: FolderOpen,  color: '#D97706',  bg: '#FFFBEB',  label: 'Project updated' },
  document_uploaded:  { icon: Upload,      color: '#0284C7',  bg: '#F0F9FF',  label: 'Document uploaded' },
  journal_entry:      { icon: Receipt,     color: '#1C1C1C',  bg: '#F9FAFB',  label: 'Journal entry added' },
  payroll_added:      { icon: Users,       color: '#D97706',  bg: '#FFFBEB',  label: 'Payroll entry added' },
  settings_updated:   { icon: Settings,    color: '#6B7280',  bg: '#F9FAFB',  label: 'Settings updated' },
  default:            { icon: Activity,    color: '#6B7280',  bg: '#F9FAFB',  label: 'Activity' },
}

function activityCfg(action) {
  return ACTIVITY_CFG[action] ?? ACTIVITY_CFG.default
}

function timeAgo(dateStr) {
  try {
    const d = parseISO(dateStr)
    if (isToday(d))     return `Today ${format(d, 'HH:mm')}`
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`
    return format(d, 'dd MMM, HH:mm')
  } catch { return '' }
}

// ── Activity Feed ─────────────────────────────────────────────
function ActivityFeed({ activities, loading }) {
  const navigate = useNavigate()

  const entityLink = (type) => {
    if (type === 'invoice')  return '/invoices'
    if (type === 'project')  return '/projects'
    if (type === 'document') return '/documents'
    if (type === 'journal')  return '/cashflow'
    if (type === 'payroll')  return '/tax'
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-gray-100 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F7F7F7' }}>
            <Activity className="w-6 h-6 text-gray-200" />
          </div>
          <p className="text-xs text-gray-400 font-medium">No activity yet</p>
          <p className="text-[10px] text-gray-300 text-center max-w-[160px]">
            Actions like creating invoices and projects will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ divideColor: '#FAFAFA' }}>
          {activities.map((a, i) => {
            const cfg  = activityCfg(a.action)
            const Icon = cfg.icon
            const link = entityLink(a.entity_type)
            return (
              <div key={a.id ?? i}
                onClick={() => link && navigate(link)}
                className={`flex items-start gap-3 py-3 px-1 rounded-xl transition-colors ${link ? 'cursor-pointer' : ''}`}
                onMouseEnter={e => { if (link) e.currentTarget.style.background = '#FAFAFA' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.bg }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 leading-tight">
                    {a.entity_name
                      ? <><span className="font-black">{a.entity_name}</span> — {cfg.label.toLowerCase()}</>
                      : cfg.label}
                  </p>
                  {a.meta?.amount && (
                    <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>
                      {naira(a.meta.amount)}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
                {link && <ChevronRight className="w-3.5 h-3.5 text-gray-200 shrink-0 mt-1" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Invoices outstanding summary ──────────────────────────────
function InvoiceSummaryBar({ invoices }) {
  const total       = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
  const collected   = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0)
  const outstanding = total - collected
  const overdue     = invoices.filter(i => {
    if (i.amount_paid >= i.total_amount) return false
    return i.due_date && new Date(i.due_date) < new Date()
  }).length

  if (invoices.length === 0) return null

  return (
    <div className="rounded-2xl p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-black text-sm text-gray-900">Invoice Summary</h3>
        </div>
        <span className="text-[10px] font-bold text-gray-400">{invoices.length} invoices</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Total Billed', val: total,       dark: true },
          { label: 'Collected',    val: collected,    green: true },
          { label: 'Outstanding',  val: outstanding,  red: outstanding > 0 },
        ].map(({ label, val, dark, green, red }) => (
          <div key={label} className="rounded-xl p-3"
            style={{ background: dark ? '#1C1C1C' : green ? '#F0FDF4' : red ? '#FFF5F5' : '#F9FAFB' }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1"
              style={{ color: dark ? 'rgba(255,255,255,0.4)' : green ? '#16A34A' : red ? '#CC0000' : '#9CA3AF' }}>
              {label}
            </p>
            <p className="text-sm font-black leading-tight"
              style={{ color: dark ? 'white' : green ? '#16A34A' : red ? '#CC0000' : '#1C1C1C' }}>
              {shortMoney(val)}
            </p>
          </div>
        ))}
      </div>
      <Bar value={collected} max={total} color="#CC0000" />
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-400">{total > 0 ? ((collected / total) * 100).toFixed(0) : 0}% collected</span>
        {overdue > 0 && (
          <span className="text-[10px] font-bold" style={{ color: '#CC0000' }}>{overdue} overdue</span>
        )}
      </div>
    </div>
  )
}

// ── Upcoming Milestones Widget ────────────────────────────────
const MS_STATUS_COLOR = {
  pending:     '#9CA3AF',
  in_progress: '#3B82F6',
  completed:   '#22C55E',
  delayed:     '#CC0000',
}

function UpcomingMilestonesWidget({ milestones, onNavigate }) {
  return (
    <div className="rounded-2xl p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
          <h3 className="font-black text-sm text-gray-900">Upcoming Milestones</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#FFF0F0', color: '#CC0000' }}>
            Next 30 days
          </span>
        </div>
        <button
          onClick={() => onNavigate('/projects')}
          className="text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition"
          style={{ color: '#CC0000' }}>
          View projects <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {milestones.map(m => {
          const daysLeft = m.expected_date
            ? differenceInDays(new Date(m.expected_date), new Date())
            : null
          const isOverdue  = daysLeft !== null && daysLeft < 0
          const isUrgent   = daysLeft !== null && daysLeft <= 3 && !isOverdue
          const dotColor   = MS_STATUS_COLOR[m.status] ?? '#9CA3AF'
          const cardBg     = isOverdue ? '#FFF5F5' : isUrgent ? '#FFFBEB' : '#F9FAFB'
          const cardBorder = isOverdue ? '#FECACA' : isUrgent ? '#FDE68A' : '#F0F0F0'

          return (
            <div
              key={m.id}
              onClick={() => m.project_id && onNavigate(`/projects/${m.project_id}`)}
              className="rounded-xl p-3 cursor-pointer transition-all"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                  style={{ background: dotColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate" style={{ color: '#1C1C1C' }}>{m.name}</p>
                  {m.projects?.name && (
                    <p className="text-[10px] text-gray-400 truncate">{m.projects.name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-gray-400">
                  {m.expected_date ? format(new Date(m.expected_date), 'dd MMM') : '—'}
                </span>
                {daysLeft !== null && (
                  <span className="text-[10px] font-black"
                    style={{
                      color: isOverdue ? '#CC0000' : isUrgent ? '#D97706' : '#16A34A',
                    }}>
                    {isOverdue
                      ? `${Math.abs(daysLeft)}d overdue`
                      : daysLeft === 0 ? 'Today'
                      : `${daysLeft}d`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { company } = useCompany()
  const now = new Date()

  const [allEntries,       setAllEntries]       = useState([])
  const [monthEntries,     setMonthEntries]     = useState([])
  const [prevEntries,      setPrevEntries]      = useState([])
  const [projects,         setProjects]         = useState([])
  const [payroll,          setPayroll]          = useState([])
  const [invoices,         setInvoices]         = useState([])
  const [activities,       setActivities]       = useState([])
  const [upcomingMilestones, setUpcomingMilestones] = useState([])
  const [loading,          setLoading]          = useState(true)
  const [activityLoading,  setActivityLoading]  = useState(true)

  useEffect(() => {
    const thisStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const thisEnd   = format(endOfMonth(now),   'yyyy-MM-dd')
    const prevStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
    const prevEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd')

    Promise.all([
      supabase.from('journal_entries').select('*').order('date', { ascending: false }),
      supabase.from('journal_entries').select('*').gte('date', thisStart).lte('date', thisEnd),
      supabase.from('journal_entries').select('*').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('projects').select('*'),
      supabase.from('payroll_entries').select('*').gte('period_start', thisStart).lte('period_start', thisEnd),
      supabase.from('invoices').select('*, projects(name)').order('invoice_date', { ascending: false }),
    ]).then(([allJ, monthJ, prevJ, proj, pay, inv]) => {
      setAllEntries(allJ.data   ?? [])
      setMonthEntries(monthJ.data ?? [])
      setPrevEntries(prevJ.data  ?? [])
      setProjects(proj.data      ?? [])
      setPayroll(pay.data        ?? [])
      setInvoices(inv.data       ?? [])
      setLoading(false)
    })

    // Load activity separately so it doesn't block the main data
    supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => { setActivities(data ?? []); setActivityLoading(false) })

    // Upcoming milestones — next 30 days
    supabase.from('milestones')
      .select('*, projects(name)')
      .in('status', ['pending', 'in_progress', 'delayed'])
      .lte('expected_date', format(addDays(new Date(), 30), 'yyyy-MM-dd'))
      .order('expected_date')
      .limit(5)
      .then(({ data }) => setUpcomingMilestones(data ?? []))
  }, [])

  // ── KPIs ─────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const allIn   = allEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const allOut  = allEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)
    const thisIn  = monthEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const thisOut = monthEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)
    const prevIn  = prevEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount || 0), 0)
    const prevOut = prevEntries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount || 0), 0)

    const active    = projects.filter(p => p.status === 'active')
    const completed = projects.filter(p => p.status === 'completed')
    const contractTotal = projects.reduce((s, p) => s + Number(p.contract_value || 0), 0)

    const pendingTax = payroll.filter(p => !p.remitted)
      .reduce((s, p) => s + Number(p.type === 'staff' ? (p.monthly_paye || 0) : (p.wht_amount || 0)), 0)

    const totalOutstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)), 0)

    return {
      netCash: allIn - allOut, thisIn, thisOut, prevIn, prevOut,
      activeCount: active.length, completedCount: completed.length,
      activeProjects: active, contractTotal, pendingTax, totalOutstanding,
    }
  }, [allEntries, monthEntries, prevEntries, projects, payroll, invoices])

  // ── 6-month chart ─────────────────────────────────────────────
  const chartMonths = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d    = subMonths(now, 5 - i)
    const mStr = format(d, 'yyyy-MM')
    return {
      label:   format(d, 'MMM'),
      inflow:  allEntries.filter(e => e.type === 'receipt' && e.date?.startsWith(mStr)).reduce((s, e) => s + Number(e.amount || 0), 0),
      outflow: allEntries.filter(e => e.type === 'payment' && e.date?.startsWith(mStr)).reduce((s, e) => s + Number(e.amount || 0), 0),
    }
  }), [allEntries])

  // ── Tax deadlines ─────────────────────────────────────────────
  const taxDeadlines = useMemo(() => {
    const vatDue  = new Date(now.getFullYear(), now.getMonth(), 21)
    const payeDue = new Date(now.getFullYear(), now.getMonth() + 1, 10)
    const whtDue  = new Date(now.getFullYear(), now.getMonth(), 21)
    const dl = d => d ? differenceInDays(d, now) : null
    return [
      { name: 'VAT Return',        due: vatDue,  daysLeft: dl(vatDue),  dueLabel: format(vatDue, 'dd MMM yyyy') },
      { name: 'PAYE Remittance',   due: payeDue, daysLeft: dl(payeDue), dueLabel: format(payeDue, 'dd MMM yyyy') },
      { name: 'WHT Remittance',    due: whtDue,  daysLeft: dl(whtDue),  dueLabel: format(whtDue, 'dd MMM yyyy') },
      { name: 'CIT Annual Return', due: null,    daysLeft: null,         dueLabel: 'Annual — check FIRS' },
    ]
  }, [])

  // ── Recent transactions (paginated) ───────────────────────────
  const recent = useMemo(() => allEntries.slice(0, 60), [allEntries])
  const { page, setPage, totalPages, paginated, total } = usePagination(recent, 8)

  const topProjects = useMemo(() => kpi.activeProjects.slice(0, 5), [kpi.activeProjects])
  const inDelta     = pctChange(kpi.thisIn,  kpi.prevIn)
  const outDelta    = pctChange(kpi.thisOut, kpi.prevOut)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#CC0000' }}>
            {company?.name ?? 'Eldesign Construction'}
          </p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Overview</h2>
          <p className="text-xs text-gray-400 mt-0.5">{format(now, 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/cashflow')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition"
            style={{ borderColor: '#E8E8E8', color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <PlusCircle className="w-3.5 h-3.5" /> Add Entry
          </button>
          <button onClick={() => navigate('/invoices')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}>
            <FilePlus className="w-3.5 h-3.5" /> New Invoice
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 xl:col-span-2">
          <KpiCard label="Net Cash Position" value={naira(kpi.netCash)}
            sub="All-time inflow minus outflow"
            icon={Banknote} variant="dark" />
        </div>
        <KpiCard label="This Month Inflow" value={naira(kpi.thisIn)}
          delta={inDelta} icon={TrendingUp} variant="red" />
        <KpiCard label="This Month Outflow" value={naira(kpi.thisOut)}
          delta={outDelta} invertDelta icon={TrendingDown} />
        <KpiCard label="Active Projects" value={kpi.activeCount}
          sub={`${kpi.completedCount} completed`} icon={FolderOpen}
          onClick={() => navigate('/projects')} />
        <KpiCard label="Outstanding Invoices" value={naira(kpi.totalOutstanding)}
          sub={kpi.pendingTax > 0 ? `Tax pending: ${naira(kpi.pendingTax)}` : 'All tax remitted'}
          icon={Receipt}
          onClick={() => navigate('/invoices')} />
      </div>

      {/* ── Invoice summary bar ── */}
      {!loading && invoices.length > 0 && <InvoiceSummaryBar invoices={invoices} />}

      {/* ── Upcoming Milestones widget ── */}
      {upcomingMilestones.length > 0 && (
        <UpcomingMilestonesWidget milestones={upcomingMilestones} onNavigate={navigate} />
      )}

      {/* ── Chart + Activity Feed ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* Chart */}
        <div className="md:col-span-3 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-black text-sm text-gray-900">Cash Flow — 6 Months</h3>
            </div>
            <button onClick={() => navigate('/cashflow')}
              className="text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition"
              style={{ color: '#CC0000' }}>
              Full report <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {loading
            ? <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-gray-100 border-t-red-600 rounded-full animate-spin" /></div>
            : <CashFlowChart months={chartMonths} />}
        </div>

        {/* Activity Feed */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-5 flex flex-col" style={{ maxHeight: '340px' }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-black text-sm text-gray-900">Activity Feed</h3>
            </div>
            {activities.length > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                style={{ background: '#CC0000' }}>
                {Math.min(activities.length, 99)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <ActivityFeed activities={activities} loading={activityLoading} />
          </div>
        </div>
      </div>

      {/* ── Projects + Tax + Recent Transactions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Active Projects */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-black text-sm text-gray-900">Active Projects</h3>
            </div>
            <button onClick={() => navigate('/projects')}
              className="text-[10px] font-bold flex items-center gap-1 hover:opacity-70 transition"
              style={{ color: '#CC0000' }}>
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {topProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <FolderOpen className="w-8 h-8 text-gray-100" />
              <p className="text-xs text-gray-400">No active projects</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProjects.map(p => {
                const actCost = Number(p.actual_cost || 0)
                const estCost = Number(p.estimated_cost || 0)
                const actRev  = Number(p.actual_revenue || 0)
                const profit  = actRev - actCost
                const pct     = estCost > 0 ? Math.min((actCost / estCost) * 100, 100) : 0
                const over    = actCost > estCost
                return (
                  <div key={p.id} onClick={() => navigate('/projects')}
                    className="p-3 rounded-xl cursor-pointer transition-colors border border-transparent"
                    onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = '#F0F0F0' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: '#1C1C1C' }}>{p.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{p.client || '—'}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: profit >= 0 ? '#F0FDF4' : '#FFF0F0', color: profit >= 0 ? '#16A34A' : '#CC0000' }}>
                        {profit >= 0 ? '+' : ''}{shortMoney(profit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bar value={actCost} max={estCost} color={over ? '#CC0000' : '#1C1C1C'} />
                      <span className="text-[10px] text-gray-400 shrink-0 font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tax Deadlines */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
            <h3 className="font-black text-sm text-gray-900">Tax Deadlines</h3>
          </div>
          <div className="space-y-2.5">
            {taxDeadlines.map((d, i) => {
              const urgent = d.daysLeft !== null && d.daysLeft <= 7
              return (
                <div key={i} onClick={() => navigate('/tax')}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                  style={{ background: urgent && d.daysLeft <= 2 ? '#FFF5F5' : '#F9FAFB' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: urgent ? '#FFF0F0' : '#F3F4F6' }}>
                      <Calendar className="w-3.5 h-3.5" style={{ color: urgent ? '#CC0000' : '#9CA3AF' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#1C1C1C' }}>{d.name}</p>
                      <p className="text-[10px] text-gray-400">{d.dueLabel}</p>
                    </div>
                  </div>
                  <DeadlineBadge days={d.daysLeft} />
                </div>
              )
            })}
          </div>
          <button onClick={() => navigate('/tax')}
            className="mt-4 w-full py-2 rounded-xl text-xs font-bold border transition"
            style={{ borderColor: '#F0F0F0', color: '#888' }}
            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            View Tax & Compliance →
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: '#CC0000' }} />
              <h3 className="font-black text-sm text-gray-900">Recent Transactions</h3>
            </div>
            <button onClick={() => navigate('/cashflow')}
              className="text-[10px] font-bold hover:opacity-70 transition" style={{ color: '#CC0000' }}>
              View all →
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-gray-100 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Receipt className="w-8 h-8 text-gray-100" />
              <p className="text-xs text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {paginated.map(e => (
                  <div key={e.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: '#FAFAFA' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: e.type === 'receipt' ? '#FFF0F0' : '#F3F4F6' }}>
                      {e.type === 'receipt'
                        ? <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
                        : <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#1C1C1C' }}>{e.description || '—'}</p>
                      <p className="text-[10px] text-gray-400">{e.date ? format(new Date(e.date), 'dd MMM') : '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black" style={{ color: e.type === 'receipt' ? '#CC0000' : '#1C1C1C' }}>
                        {e.type === 'receipt' ? '+' : '-'}{naira(e.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={8} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
