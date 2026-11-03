import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, TrendingUp, FolderOpen,
  Receipt, LogOut, Menu, X
} from 'lucide-react'

const navItems = [
  { to: '/overview',  label: 'Overview',          icon: LayoutDashboard },
  { to: '/projects',  label: 'Projects',           icon: FolderOpen },
  { to: '/cashflow',  label: 'Cash Flow',          icon: TrendingUp },
  { to: '/tax',       label: 'Tax & Compliance',   icon: Receipt },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const expanded = hovered || sidebarOpen

  return (
    <div className="flex h-screen bg-[#F5F5F5]">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200 ease-in-out -translate-x-full lg:translate-x-0"
        style={{
          background: '#1C1C1C',
          width: expanded ? '220px' : '64px',
          transform: sidebarOpen ? 'translateX(0)' : undefined,
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
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/projects'}
              onClick={() => setSidebarOpen(false)}
              className="block"
            >
              {({ isActive }) => (
                <div
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer"
                  style={{ background: isActive ? '#CC0000' : 'transparent' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#263055' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon
                    className="w-5 h-5 shrink-0 transition-colors"
                    style={{ color: isActive ? 'white' : '#8896B3' }}
                  />
                  {expanded && (
                    <span
                      className="text-sm font-semibold whitespace-nowrap overflow-hidden animate-fadeIn"
                      style={{ color: isActive ? 'white' : '#8896B3' }}
                    >
                      {label}
                    </span>
                  )}
                  {isActive && expanded && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign out */}
        <div className="px-2 py-3 border-t" style={{ borderColor: '#2A2A2A' }}>
          <div className="flex items-center overflow-hidden gap-3 px-2 py-2 rounded-xl mb-1"
            style={{ background: '#2A2A2A', minHeight: '44px' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: '#CC0000' }}
            >
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
            className="flex items-center gap-3 w-full px-2.5 py-2.5 rounded-xl transition-colors group"
            onMouseEnter={e => e.currentTarget.style.background = '#263055'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="w-5 h-5 shrink-0 transition-colors" style={{ color: '#888888' }} />
            {expanded && (
              <span className="text-sm font-semibold animate-fadeIn whitespace-nowrap" style={{ color: '#888888' }}>
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-200 ease-in-out"
        style={{ marginLeft: 0 }}
      >
        {/* Desktop spacer — pushes content right based on sidebar width */}
        <div className="hidden lg:block shrink-0 transition-all duration-200"
          style={{ marginLeft: expanded ? '220px' : '64px' }} />

        {/* Mobile top bar */}
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3 lg:hidden"
          style={{ borderColor: '#E5E5E5' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900 transition">
            <Menu className="w-5 h-5" />
          </button>
          <img src="/unnamed.jpg" alt="Eldesign" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
          <span className="font-black text-sm tracking-widest" style={{ color: '#1C2340' }}>ELDESIGN</span>
        </header>

        <div className="flex flex-1 overflow-hidden lg:ml-0 transition-all duration-200"
          style={{ marginLeft: 0 }}>
          {/* Sidebar space placeholder on desktop */}
          <div className="hidden lg:block shrink-0 transition-all duration-200 ease-in-out"
            style={{ width: hovered ? '220px' : '64px' }} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
