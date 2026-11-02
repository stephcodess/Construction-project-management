import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, BookOpen, FolderOpen, FileText,
  Receipt, Users, ShieldCheck, LogOut, Menu, X
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects / Contracts', icon: FolderOpen },
  { to: '/journal', label: 'Receipts & Payments', icon: BookOpen },
  { to: '/contracts', label: 'Contract Letters', icon: FileText },
  { to: '/vat', label: 'VAT Returns', icon: Receipt },
  { to: '/payroll', label: 'Payroll / WHT', icon: Users },
  { to: '/compliance', label: 'Tax Compliance', icon: ShieldCheck },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#F5F5F5]">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `} style={{ background: '#1C1C1C' }}>

        {/* Red accent top bar */}
        <div className="h-1 w-full shrink-0" style={{ background: '#CC0000' }} />

        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: '#2A2A2A' }}>
          <img src="/unnamed.jpg" alt="Eldesign Logo" className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-md" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm tracking-widest leading-none">ELDESIGN</p>
            <p className="text-xs tracking-widest mt-0.5" style={{ color: '#CC0000' }}>CONSTRUCTION</p>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-white transition" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav label */}
        <p className="px-5 pt-5 pb-2 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">
          Navigation
        </p>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`
              }
              style={({ isActive }) => isActive ? { background: '#CC0000' } : {}}
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'}`} />
                  {label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 mt-2 border-t" style={{ borderColor: '#2A2A2A' }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg mb-1" style={{ background: '#2A2A2A' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: '#CC0000' }}>
              {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-gray-500 text-[10px] capitalize">{profile?.role ?? 'staff'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors group"
            style={{}}
            onMouseEnter={e => e.currentTarget.style.background = '#2A2A2A'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="bg-white border-b px-4 py-2.5 flex items-center gap-3 lg:hidden"
          style={{ borderColor: '#E5E5E5' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900 transition">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/unnamed.jpg" alt="Eldesign Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
            <span className="font-black text-sm tracking-widest" style={{ color: '#1C1C1C' }}>ELDESIGN</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
