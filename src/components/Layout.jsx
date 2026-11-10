import { useState, useMemo, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, TrendingUp, FolderOpen,
  Receipt, LogOut, Menu, X, Users, Bell, ChevronRight,
  FileText, FilePlus, Settings, Layers, ShoppingCart, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { differenceInDays, addMonths, setDate, format } from 'date-fns'

const SIDEBAR_W   = 248
const HEADER_H    = 56

const TOP_NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
]
const BOTTOM_NAV = [
  { to: '/team',     label: 'Team',     icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]
const PROJECT_NAV = [
  { to: '/cashflow',  label: 'Cash Flow',       icon: TrendingUp },
  { to: '/expenses',  label: 'Expenses',         icon: ShoppingCart },
  { to: '/tax',       label: 'Tax & Compliance', icon: Receipt },
  { to: '/documents', label: 'Documents',        icon: FileText },
  { to: '/invoices',  label: 'Invoices',         icon: FilePlus },
]

function useDeadlineAlerts() {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return useMemo(() => {
    const deadlines = [
      { id: `vat-${format(now,  'yyyy-MM')}`, label: 'VAT Return',     due: setDate(now, 21),               link: '/tax' },
      { id: `paye-${format(now, 'yyyy-MM')}`, label: 'PAYE Remittance', due: setDate(addMonths(now, 1), 10), link: '/tax' },
      { id: `wht-${format(now,  'yyyy-MM')}`, label: 'WHT Remittance',  due: setDate(now, 21),               link: '/tax' },
    ]
    return deadlines
      .map(d => ({ ...d, daysLeft: differenceInDays(d.due, today) }))
      .filter(d => d.daysLeft >= 0 && d.daysLeft <= 7)
  }, [today.toDateString()])
}

/* ── Nav item ───────────────────────────────────────────────── */
function NavItem({ to, label, icon: Icon, onClick, end }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className="block">
      {({ isActive }) => (
        <div className="flex items-center gap-3 rounded-xl transition-all duration-150 cursor-pointer"
          style={{ padding: '8px 10px', background: isActive ? '#CC0000' : 'transparent' }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
          <Icon style={{ width: 17, height: 17, flexShrink: 0, color: isActive ? 'white' : '#7A8BA8' }} />
          <span className="text-sm font-semibold whitespace-nowrap overflow-hidden"
            style={{ color: isActive ? 'white' : '#8896B3' }}>
            {label}
          </span>
          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: 'rgba(255,255,255,0.5)' }} />}
        </div>
      )}
    </NavLink>
  )
}

/* ── Project group ──────────────────────────────────────────── */
function ProjectGroup({ project, activeProject, setActiveProject, onNavClick }) {
  const isActive = activeProject?.id === project.id
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  function handleGroupClick() {
    if (isActive) setOpen(o => !o)
    else { setActiveProject(project); setOpen(true) }
  }

  return (
    <div>
      <button onClick={handleGroupClick}
        className="w-full flex items-center gap-2.5 rounded-xl transition-all duration-150"
        style={{ padding: '7px 10px', background: isActive ? 'rgba(204,0,0,0.14)' : 'transparent' }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
        onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(204,0,0,0.14)' : 'transparent' }}>
        <FolderOpen style={{ width: 17, height: 17, flexShrink: 0, color: isActive ? '#FF4D4D' : '#7A8BA8' }} />
        <span className="flex-1 text-sm font-semibold truncate text-left"
          style={{ color: isActive ? 'white' : '#8896B3' }}>
          {project.name}
        </span>
        <ChevronRight style={{
          width: 13, height: 13, flexShrink: 0, color: '#444',
          transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
        }} />
      </button>

      {open && isActive && (
        <div className="mt-0.5 space-y-0.5"
          style={{ marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid rgba(204,0,0,0.25)' }}>

          <NavLink to={`/projects/${project.id}`} onClick={onNavClick} className="block">
            {({ isActive: a }) => (
              <div className="flex items-center gap-2.5 rounded-xl transition-all duration-150"
                style={{ padding: '7px 10px', background: a ? '#CC0000' : 'transparent' }}
                onMouseEnter={e => { if (!a) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (!a) e.currentTarget.style.background = 'transparent' }}>
                <Layers style={{ width: 14, height: 14, flexShrink: 0, color: a ? 'white' : '#7A8BA8' }} />
                <span className="text-xs font-semibold" style={{ color: a ? 'white' : '#8896B3' }}>Summary</span>
                {a && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />}
              </div>
            )}
          </NavLink>

          {PROJECT_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onNavClick} className="block">
              {({ isActive: a }) => (
                <div className="flex items-center gap-2.5 rounded-xl transition-all duration-150"
                  style={{ padding: '7px 10px', background: a ? '#CC0000' : 'transparent' }}
                  onMouseEnter={e => { if (!a) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (!a) e.currentTarget.style.background = 'transparent' }}>
                  <Icon style={{ width: 14, height: 14, flexShrink: 0, color: a ? 'white' : '#7A8BA8' }} />
                  <span className="text-xs font-semibold" style={{ color: a ? 'white' : '#8896B3' }}>{label}</span>
                  {a && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{ padding: '12px 10px 4px' }}>
      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3A3A' }}>
        {label}
      </p>
    </div>
  )
}

/* ── Sidebar panel (shared between desktop overlay and mobile drawer) ── */
function SidebarPanel({ profile, activeProject, setActiveProject, projects, onNavClick, onSignOut }) {
  return (
    <>
      {/* Top accent */}
      <div style={{ height: 3, background: 'linear-gradient(90deg,#CC0000,#FF4D4D)', flexShrink: 0 }} />

      {/* Logo */}
      <div className="flex items-center shrink-0 gap-3"
        style={{ padding: '14px 14px 14px', borderBottom: '1px solid #1F2023', minHeight: HEADER_H }}>
        <img src="/unnamed.jpg" alt="Eldesign"
          style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
        <div>
          <p style={{ color: 'white', fontWeight: 900, fontSize: 11, letterSpacing: '0.14em', lineHeight: 1 }}>ELDESIGN</p>
          <p style={{ color: '#CC0000', fontSize: 9, letterSpacing: '0.14em', marginTop: 3 }}>CONSTRUCTION</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '8px 10px' }}>
        <div className="space-y-0.5">
          {TOP_NAV.map(item => <NavItem key={item.to} {...item} onClick={onNavClick} end />)}
          <NavItem to="/projects" label="Projects" icon={FolderOpen} onClick={onNavClick} end />

          {projects.length > 0 && <SectionLabel label="Projects" />}
          {projects.map(project => (
            <ProjectGroup
              key={project.id}
              project={project}
              activeProject={activeProject}
              setActiveProject={setActiveProject}
              onNavClick={onNavClick}
            />
          ))}

          <SectionLabel label="General" />
          {BOTTOM_NAV.map(item => <NavItem key={item.to} {...item} onClick={onNavClick} end />)}
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: '10px 10px', borderTop: '1px solid #1F2023' }}>
        <div className="flex items-center gap-3 overflow-hidden rounded-xl"
          style={{ padding: '8px 10px', background: '#1E2023', marginBottom: 4 }}>
          <div className="flex items-center justify-center rounded-full text-white font-black shrink-0"
            style={{ width: 30, height: 30, background: '#CC0000', fontSize: 12 }}>
            {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ color: 'white', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? 'User'}
            </p>
            <p style={{ color: '#555', fontSize: 10, textTransform: 'capitalize' }}>{profile?.role ?? 'staff'}</p>
          </div>
        </div>
        <button onClick={onSignOut}
          className="flex items-center gap-3 w-full rounded-xl transition-colors"
          style={{ padding: '8px 10px' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <LogOut style={{ width: 16, height: 16, color: '#555' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Sign Out</span>
        </button>
      </div>
    </>
  )
}

/* ── Breadcrumb ─────────────────────────────────────────────── */
const ROUTE_LABELS = {
  '/overview':  'Overview',
  '/projects':  'Projects',
  '/cashflow':  'Cash Flow',
  '/invoices':  'Invoices',
  '/documents': 'Documents',
  '/expenses':  'Expenses',
  '/tax':       'Tax & Compliance',
  '/team':      'Team',
  '/settings':  'Settings',
}

function PageBreadcrumb() {
  const location = useLocation()
  const path     = location.pathname
  if (path.match(/^\/projects\/[^/]+$/)) {
    return (
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>Projects</span>
        <ChevronRight style={{ width: 12, height: 12, color: '#CCC' }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1C' }}>Summary</span>
      </div>
    )
  }
  const label = ROUTE_LABELS[path]
  if (!label) return null
  return <span style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1C' }}>{label}</span>
}

/* ── Root Layout ────────────────────────────────────────────── */
export default function Layout({ children }) {
  const { profile, signOut }              = useAuth()
  const { activeProject, setActiveProject } = useProject()
  const navigate                          = useNavigate()
  const location                          = useLocation()

  /* Desktop: sidebar open/closed */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  /* Mobile: drawer open/closed */
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const [projects,  setProjects]  = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_alerts') || '[]') } catch { return [] }
  })

  useEffect(() => {
    supabase.from('projects').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  /* Close mobile drawer on navigate */
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const allAlerts = useDeadlineAlerts()
  const alerts    = allAlerts.filter(a => !dismissed.includes(a.id))

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    try { sessionStorage.setItem('dismissed_alerts', JSON.stringify(next)) } catch {}
  }

  async function handleSignOut() { await signOut(); navigate('/login') }


  return (
    <div className="h-screen overflow-hidden" style={{ background: '#F4F5F7', '--sidebar-w': sidebarOpen ? `${SIDEBAR_W}px` : '0px' }}>

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-200 ease-in-out overflow-hidden"
        style={{
          width: SIDEBAR_W,
          background: '#161718',
          borderRight: '1px solid #1F2023',
          transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
        }}>
        <SidebarPanel
          profile={profile}
          activeProject={activeProject}
          setActiveProject={setActiveProject}
          projects={projects}
          onNavClick={() => {}}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── MOBILE DRAWER ───────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={() => setDrawerOpen(false)} />
      )}
      <aside
        className="lg:hidden flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-250 ease-in-out"
        style={{
          width: Math.min(SIDEBAR_W, 300),
          background: '#161718',
          borderRight: '1px solid #1F2023',
          transform: drawerOpen ? 'translateX(0)' : `translateX(-${Math.min(SIDEBAR_W, 300) + 2}px)`,
        }}>
        <div className="flex flex-col h-full">
          {/* Close button row */}
          <div className="flex items-center justify-between shrink-0"
            style={{ padding: '14px 14px', borderBottom: '1px solid #1F2023', height: HEADER_H }}>
            <div className="flex items-center gap-3">
              <img src="/unnamed.jpg" alt="Eldesign"
                style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'cover' }} />
              <div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 11, letterSpacing: '0.14em', lineHeight: 1 }}>ELDESIGN</p>
                <p style={{ color: '#CC0000', fontSize: 9, letterSpacing: '0.14em', marginTop: 3 }}>CONSTRUCTION</p>
              </div>
            </div>
            <button onClick={() => setDrawerOpen(false)}
              className="flex items-center justify-center rounded-xl transition shrink-0"
              style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)', color: '#666' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto" style={{ padding: '8px 10px' }}>
            <div className="space-y-0.5">
              {TOP_NAV.map(item => <NavItem key={item.to} {...item} onClick={() => setDrawerOpen(false)} end />)}
              <NavItem to="/projects" label="Projects" icon={FolderOpen} onClick={() => setDrawerOpen(false)} end />

              {projects.length > 0 && <SectionLabel label="Projects" />}
              {projects.map(project => (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  activeProject={activeProject}
                  setActiveProject={setActiveProject}
                  onNavClick={() => setDrawerOpen(false)}
                />
              ))}

              <SectionLabel label="General" />
              {BOTTOM_NAV.map(item => <NavItem key={item.to} {...item} onClick={() => setDrawerOpen(false)} end />)}
            </div>
          </nav>

          {/* User */}
          <div style={{ padding: '10px 10px', borderTop: '1px solid #1F2023' }}>
            <div className="flex items-center gap-3 overflow-hidden rounded-xl"
              style={{ padding: '8px 10px', background: '#1E2023', marginBottom: 4 }}>
              <div className="flex items-center justify-center rounded-full text-white font-black shrink-0"
                style={{ width: 30, height: 30, background: '#CC0000', fontSize: 12 }}>
                {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'white', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name ?? 'User'}
                </p>
                <p style={{ color: '#555', fontSize: 10, textTransform: 'capitalize' }}>{profile?.role ?? 'staff'}</p>
              </div>
            </div>
            <button onClick={handleSignOut}
              className="flex items-center gap-3 w-full rounded-xl transition-colors"
              style={{ padding: '8px 10px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut style={{ width: 16, height: 16, color: '#555' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────── */}
      <div className="flex flex-col h-screen transition-all duration-200 ease-in-out"
        style={{ marginLeft: 0, paddingLeft: 0 }}>

        {/* ── FIXED TOP HEADER ───────────────────────────────── */}
        <header className="fixed top-0 right-0 z-20 flex items-center shrink-0 transition-all duration-200"
          style={{
            left: 0,
            height: HEADER_H,
            background: 'white',
            borderBottom: '1px solid #EBEBEB',
            padding: '0 16px 0 16px',
            gap: 10,
          }}>

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src="/unnamed.jpg" alt="Eldesign"
              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
            <div>
              <p style={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.14em', color: '#1C1C1C', lineHeight: 1 }}>ELDESIGN</p>
              <p style={{ fontSize: 8, letterSpacing: '0.12em', color: '#CC0000', marginTop: 2 }}>CONSTRUCTION</p>
            </div>
          </div>

          {/* Desktop: spacer that matches sidebar width */}
          <div className="hidden lg:block shrink-0 transition-all duration-200"
            style={{ width: sidebarOpen ? SIDEBAR_W : 0 }} />

          {/* Page label — desktop */}
          <div className="hidden lg:flex items-center flex-1 min-w-0 pl-6">
            <PageBreadcrumb />
          </div>

          {/* Spacer for mobile */}
          <div className="flex-1 lg:hidden" />

          {/* Alert pill */}
          {alerts.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
              style={{ background: '#FFF0F0', border: '1px solid #FECACA' }}>
              <Bell style={{ width: 12, height: 12, color: '#CC0000' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#CC0000' }}>
                {alerts.length} deadline{alerts.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Desktop sidebar toggle — RIGHT */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="hidden lg:flex items-center justify-center rounded-xl transition-all shrink-0"
            style={{ width: 36, height: 36, background: '#F4F5F7' }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onMouseEnter={e => e.currentTarget.style.background = '#EAEBEC'}
            onMouseLeave={e => e.currentTarget.style.background = '#F4F5F7'}>
            {sidebarOpen
              ? <PanelLeftClose style={{ width: 17, height: 17, color: '#555' }} />
              : <PanelLeftOpen  style={{ width: 17, height: 17, color: '#555' }} />}
          </button>

          {/* Mobile hamburger — RIGHT */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden flex items-center justify-center rounded-xl transition-all shrink-0"
            style={{ width: 38, height: 38, background: '#F4F5F7' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EAEBEC'}
            onMouseLeave={e => e.currentTarget.style.background = '#F4F5F7'}>
            <Menu style={{ width: 18, height: 18, color: '#333' }} />
          </button>
        </header>

        {/* ── CONTENT ─────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden" style={{ paddingTop: HEADER_H }}>

          {/* Desktop sidebar spacer */}
          <div className="hidden lg:block shrink-0 transition-all duration-200 ease-in-out"
            style={{ width: sidebarOpen ? SIDEBAR_W : 0 }} />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Alert banners */}
            {alerts.length > 0 && (
              <div className="shrink-0 px-4 pt-3 md:px-6 space-y-2">
                {alerts.map(a => (
                  <div key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
                    style={{
                      background: a.daysLeft <= 2 ? '#FFF0F0' : a.daysLeft <= 5 ? '#FFFBEB' : '#F0FFF4',
                      borderColor: a.daysLeft <= 2 ? '#FECACA' : a.daysLeft <= 5 ? '#FDE68A' : '#BBF7D0',
                    }}>
                    <Bell style={{ width: 14, height: 14, flexShrink: 0, color: a.daysLeft <= 2 ? '#CC0000' : a.daysLeft <= 5 ? '#D97706' : '#16A34A' }} />
                    <span className="flex-1 text-xs font-medium"
                      style={{ color: a.daysLeft <= 2 ? '#991B1B' : a.daysLeft <= 5 ? '#92400E' : '#166534' }}>
                      <strong>{a.label}</strong> due {a.daysLeft === 0 ? 'today' : `in ${a.daysLeft}d`} — {format(a.due, 'dd MMM yyyy')}
                    </span>
                    <button onClick={() => navigate(a.link)}
                      className="text-xs font-bold underline shrink-0 hover:opacity-70 transition"
                      style={{ color: a.daysLeft <= 2 ? '#CC0000' : a.daysLeft <= 5 ? '#D97706' : '#16A34A' }}>
                      View
                    </button>
                    <button onClick={() => dismiss(a.id)} className="shrink-0 ml-1 text-gray-300 hover:text-gray-500 transition">
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <main className="flex-1 overflow-y-auto" style={{ padding: '20px 16px 32px' }}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
