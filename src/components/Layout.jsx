import { useState, useMemo, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, TrendingUp, FolderOpen,
  Receipt, LogOut, Menu, X, Users, Bell, ChevronRight,
  FileText, FilePlus, Settings, Layers, ShoppingCart
} from 'lucide-react'
import { differenceInDays, addMonths, setDate, format } from 'date-fns'

const SIDEBAR_W  = 256
const COLLAPSED_W = 64

// Global nav items (not project-scoped)
const TOP_NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
]
const BOTTOM_NAV = [
  { to: '/team',     label: 'Team',     icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Per-project sub-links
const PROJECT_NAV = [
  { to: '/cashflow',  label: 'Cash Flow',        icon: TrendingUp },
  { to: '/expenses',  label: 'Expenses',          icon: ShoppingCart },
  { to: '/tax',       label: 'Tax & Compliance',  icon: Receipt },
  { to: '/documents', label: 'Documents',         icon: FileText },
  { to: '/invoices',  label: 'Invoices',          icon: FilePlus },
]

function useDeadlineAlerts() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return useMemo(() => {
    const deadlines = [
      { id: `vat-${format(now,  'yyyy-MM')}`, label: 'VAT Return',       due: setDate(now, 21),               link: '/tax' },
      { id: `paye-${format(now, 'yyyy-MM')}`, label: 'PAYE Remittance',   due: setDate(addMonths(now, 1), 10), link: '/tax' },
      { id: `wht-${format(now,  'yyyy-MM')}`, label: 'WHT Remittance',    due: setDate(now, 21),               link: '/tax' },
    ]
    return deadlines
      .map(d => ({ ...d, daysLeft: differenceInDays(d.due, today) }))
      .filter(d => d.daysLeft >= 0 && d.daysLeft <= 7)
  }, [today.toDateString()])
}

function NavItem({ to, label, icon: Icon, expanded, onClick, end }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className="block">
      {({ isActive }) => (
        <div
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer"
          style={{ background: isActive ? '#CC0000' : 'transparent' }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
        >
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] shrink-0" style={{ color: isActive ? 'white' : '#8896B3' }} />
          {expanded && (
            <span className="text-sm font-semibold whitespace-nowrap overflow-hidden animate-fadeIn"
              style={{ color: isActive ? 'white' : '#8896B3' }}>
              {label}
            </span>
          )}
          {isActive && expanded && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />}
        </div>
      )}
    </NavLink>
  )
}

function ProjectGroup({ project, expanded, activeProject, setActiveProject, onNavClick }) {
  const location = useLocation()
  const isActive = activeProject?.id === project.id

  // Auto-open group when it's the active project
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  // Check if any child route is currently active
  const childActive = PROJECT_NAV.some(n => location.pathname.startsWith(n.to))
  const highlight = isActive && childActive

  function handleGroupClick() {
    if (!expanded) return  // collapsed: do nothing, hover will expand
    if (isActive) {
      setOpen(o => !o)
    } else {
      setActiveProject(project)
      setOpen(true)
    }
  }

  return (
    <div>
      {/* Project row */}
      <button
        onClick={handleGroupClick}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer"
        style={{ background: isActive ? 'rgba(204,0,0,0.15)' : 'transparent' }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(204,0,0,0.15)' : 'transparent' }}
        title={!expanded ? project.name : undefined}
      >
        <FolderOpen
          className="w-[18px] h-[18px] shrink-0"
          style={{ color: isActive ? '#CC0000' : '#8896B3' }}
        />
        {expanded && (
          <>
            <span className="flex-1 text-sm font-semibold truncate text-left animate-fadeIn"
              style={{ color: isActive ? 'white' : '#8896B3' }}>
              {project.name}
            </span>
            <ChevronRight
              className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
              style={{ color: '#555', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </>
        )}
      </button>

      {/* Sub-links */}
      {expanded && open && isActive && (
        <div className="ml-3 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid rgba(204,0,0,0.3)' }}>
          {/* Dynamic summary link */}
          <NavLink to={`/projects/${project.id}`} onClick={onNavClick} className="block">
            {({ isActive: linkActive }) => (
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer"
                style={{ background: linkActive ? '#CC0000' : 'transparent' }}
                onMouseEnter={e => { if (!linkActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!linkActive) e.currentTarget.style.background = 'transparent' }}
              >
                <Layers className="w-[15px] h-[15px] shrink-0" style={{ color: linkActive ? 'white' : '#8896B3' }} />
                <span className="text-xs font-semibold whitespace-nowrap"
                  style={{ color: linkActive ? 'white' : '#8896B3' }}>
                  Summary
                </span>
                {linkActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />}
              </div>
            )}
          </NavLink>

          {PROJECT_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onNavClick} className="block">
              {({ isActive: linkActive }) => (
                <div
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{ background: linkActive ? '#CC0000' : 'transparent' }}
                  onMouseEnter={e => { if (!linkActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!linkActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon className="w-[15px] h-[15px] shrink-0" style={{ color: linkActive ? 'white' : '#8896B3' }} />
                  <span className="text-xs font-semibold whitespace-nowrap"
                    style={{ color: linkActive ? 'white' : '#8896B3' }}>
                    {label}
                  </span>
                  {linkActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const { activeProject, setActiveProject } = useProject()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hovered, setHovered]         = useState(false)
  const [projects, setProjects]       = useState([])
  const [dismissed, setDismissed]     = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_alerts') || '[]') } catch { return [] }
  })

  useEffect(() => {
    supabase.from('projects').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const allAlerts = useDeadlineAlerts()
  const alerts    = allAlerts.filter(a => !dismissed.includes(a.id))

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    try { sessionStorage.setItem('dismissed_alerts', JSON.stringify(next)) } catch {}
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const expanded = hovered || sidebarOpen

  return (
    <div className="flex h-screen bg-[#F5F5F5]"
      style={{ '--sidebar-w': expanded ? `${SIDEBAR_W}px` : `${COLLAPSED_W}px` }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200 ease-in-out"
        style={{
          background: '#1C1C1C',
          width: expanded ? `${SIDEBAR_W}px` : `${COLLAPSED_W}px`,
          transform: (sidebarOpen || window.innerWidth >= 1024) ? 'translateX(0)' : 'translateX(-100%)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Red accent bar */}
        <div className="h-1 w-full shrink-0" style={{ background: '#CC0000' }} />

        {/* Logo */}
        <div className="flex items-center overflow-hidden border-b px-3 py-4"
          style={{ borderColor: '#2A2A2A', minHeight: '64px' }}>
          <img src="/unnamed.jpg" alt="Eldesign"
            className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-md" />
          {expanded && (
            <div className="ml-3 overflow-hidden animate-fadeIn">
              <p className="text-white font-black text-xs tracking-widest leading-none whitespace-nowrap">ELDESIGN</p>
              <p className="text-[10px] tracking-widest mt-0.5 whitespace-nowrap" style={{ color: '#CC0000' }}>CONSTRUCTION</p>
            </div>
          )}
          <button className="ml-auto lg:hidden text-gray-400 hover:text-white transition shrink-0"
            onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

          {/* Top global nav */}
          {TOP_NAV.map(item => (
            <NavItem key={item.to} {...item} expanded={expanded} onClick={() => setSidebarOpen(false)} end />
          ))}

          {/* Projects link (goes to the projects list) */}
          <NavItem to="/projects" label="Projects" icon={FolderOpen} expanded={expanded} onClick={() => setSidebarOpen(false)} end />

          {/* Divider + section label */}
          {expanded && projects.length > 0 && (
            <div className="pt-3 pb-1 px-1">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#444' }}>Projects</p>
            </div>
          )}
          {!expanded && projects.length > 0 && (
            <div className="my-2 mx-auto w-5" style={{ borderTop: '1px solid #2A2A2A' }} />
          )}

          {/* Per-project groups */}
          {projects.map(project => (
            <ProjectGroup
              key={project.id}
              project={project}
              expanded={expanded}
              activeProject={activeProject}
              setActiveProject={setActiveProject}
              onNavClick={() => setSidebarOpen(false)}
            />
          ))}

          {/* Bottom global nav */}
          {expanded && <div className="pt-3 pb-1 px-1"><p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#444' }}>General</p></div>}
          {!expanded && <div className="my-2 mx-auto w-5" style={{ borderTop: '1px solid #2A2A2A' }} />}

          {BOTTOM_NAV.map(item => (
            <NavItem key={item.to} {...item} expanded={expanded} onClick={() => setSidebarOpen(false)} end />
          ))}
        </nav>

        {/* User + Sign out */}
        <div className="px-2 py-3 border-t" style={{ borderColor: '#2A2A2A' }}>
          <div className="flex items-center overflow-hidden gap-3 px-2 py-2 rounded-xl mb-1"
            style={{ background: '#2A2A2A', minHeight: '44px' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: '#CC0000' }}>
              {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
            </div>
            {expanded && (
              <div className="flex-1 min-w-0 animate-fadeIn">
                <p className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-[10px] capitalize" style={{ color: '#888888' }}>{profile?.role ?? 'staff'}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-2.5 py-2.5 rounded-xl transition-colors"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="w-5 h-5 shrink-0" style={{ color: '#888888' }} />
            {expanded && (
              <span className="text-sm font-semibold animate-fadeIn whitespace-nowrap" style={{ color: '#888888' }}>
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-200 ease-in-out">

        {/* Mobile top bar */}
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3 lg:hidden"
          style={{ borderColor: '#E5E5E5' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900 transition">
            <Menu className="w-5 h-5" />
          </button>
          <img src="/unnamed.jpg" alt="Eldesign" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
          <span className="font-black text-sm tracking-widest" style={{ color: '#1C2340' }}>ELDESIGN</span>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar spacer */}
          <div className="hidden lg:block shrink-0 transition-all duration-200 ease-in-out"
            style={{ width: expanded ? `${SIDEBAR_W}px` : `${COLLAPSED_W}px` }} />

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Deadline alert banners */}
            {alerts.length > 0 && (
              <div className="shrink-0 px-4 pt-4 md:px-6 lg:px-8 space-y-2">
                {alerts.map(a => (
                  <div key={a.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium"
                    style={{
                      background: a.daysLeft <= 2 ? '#FFF0F0' : a.daysLeft <= 5 ? '#FFFBEB' : '#F0FFF4',
                      borderColor: a.daysLeft <= 2 ? '#FECACA' : a.daysLeft <= 5 ? '#FDE68A' : '#BBF7D0',
                    }}>
                    <Bell className="w-4 h-4 shrink-0"
                      style={{ color: a.daysLeft <= 2 ? '#CC0000' : a.daysLeft <= 5 ? '#D97706' : '#16A34A' }} />
                    <span style={{ color: a.daysLeft <= 2 ? '#991B1B' : a.daysLeft <= 5 ? '#92400E' : '#166534' }}>
                      <span className="font-black">{a.label}</span> due in{' '}
                      {a.daysLeft === 0 ? <span className="font-black">today</span> : `${a.daysLeft} day${a.daysLeft !== 1 ? 's' : ''}`}
                      {' '}— {format(a.due, 'dd MMM yyyy')}
                    </span>
                    <button onClick={() => navigate(a.link)}
                      className="ml-auto text-xs font-bold underline shrink-0 hover:opacity-70 transition"
                      style={{ color: a.daysLeft <= 2 ? '#CC0000' : a.daysLeft <= 5 ? '#D97706' : '#16A34A' }}>
                      Go to Tax
                    </button>
                    <button onClick={() => dismiss(a.id)}
                      className="text-gray-400 hover:text-gray-600 transition shrink-0 ml-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
