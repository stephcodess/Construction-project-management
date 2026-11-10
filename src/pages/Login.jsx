import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col" style={{ background: '#1C1C1C' }}>

        {/* Red accent bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: '#CC0000' }} />

        {/* Geometric shapes */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-5" style={{ background: '#CC0000' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-5" style={{ background: '#CC0000' }} />
        <div className="absolute top-1/2 left-0 right-0 h-px opacity-10" style={{ background: 'white' }} />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* House silhouette illustration */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center opacity-[0.06] pointer-events-none select-none">
          <svg viewBox="0 0 600 300" className="w-full" fill="white">
            <polygon points="300,20 520,160 80,160" />
            <rect x="120" y="160" width="360" height="140" />
            <rect x="260" y="200" width="80" height="100" />
            <rect x="150" y="180" width="70" height="60" />
            <rect x="380" y="180" width="70" height="60" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-14 py-12">

          {/* Logo mark */}
          <div className="flex items-center gap-4">
            <img src="/unnamed.jpg" alt="Eldesign Logo" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
            <div>
              <p className="text-white font-black text-lg tracking-widest">ELDESIGN</p>
              <p className="text-xs tracking-widest" style={{ color: '#CC0000' }}>CONSTRUCTION LTD</p>
            </div>
          </div>

          {/* Main text */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="w-12 h-1 rounded-full mb-8" style={{ background: '#CC0000' }} />
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tight">
              Build more.<br />
              <span style={{ color: '#CC0000' }}>Worry less.</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-xs">
              Complete accounting and tax compliance for Nigerian construction businesses — receipts, VAT, PAYE, and contracts in one place.
            </p>

            {/* Stats row */}
            <div className="mt-12 grid grid-cols-3 gap-4">
              {[
                { value: '7.5%', label: 'VAT Rate' },
                { value: '5–10%', label: 'WHT Rate' },
                { value: '21st', label: 'FIRS Deadline' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: '#2A2A2A' }}>
                  <p className="text-xl font-black" style={{ color: '#CC0000' }}>{s.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Feature list */}
            <div className="mt-8 space-y-3">
              {[
                'Monthly receipts & payments journal',
                'Auto VAT computation (Finance Act 2020)',
                'PAYE & Withholding Tax payroll',
                'Contract letter document store',
              ].map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#CC0000' }} />
                  <span className="text-gray-400 text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Eldesign Construction Ltd.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F5F5] px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src="/unnamed.jpg" alt="Eldesign Logo" className="w-11 h-11 rounded-xl object-cover shadow" />
            <div>
              <p className="font-black text-sm tracking-widest" style={{ color: '#1C1C1C' }}>ELDESIGN</p>
              <p className="text-xs tracking-widest" style={{ color: '#CC0000' }}>CONSTRUCTION LTD</p>
            </div>
          </div>

          {/* Red accent line */}
          <div className="w-10 h-1 rounded-full mb-6" style={{ background: '#CC0000' }} />

          {/* Heading */}
          <h2 className="text-3xl font-black mb-1" style={{ color: '#1C1C1C' }}>Sign in</h2>
          <p className="text-gray-500 text-sm mb-8">
            New here?{' '}
            <Link to="/signup" className="font-bold transition" style={{ color: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              Create a free account
            </Link>
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#1C1C1C' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@eldesign.com"
                  className="w-full bg-white border-2 border-transparent rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
                  style={{ '--tw-ring-color': '#CC0000' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#1C1C1C' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border-2 border-transparent rounded-xl pl-11 pr-12 py-3.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
                  onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 border rounded-xl px-4 py-3 text-sm"
                style={{ background: '#FFF0F0', borderColor: '#CC0000', color: '#CC0000' }}>
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-bold text-sm tracking-wide transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#CC0000' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ELDESIGN ACCOUNTING</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Sign up CTA */}
          <div className="rounded-xl p-4 text-center" style={{ background: '#1C1C1C' }}>
            <p className="text-gray-400 text-xs leading-relaxed mb-2">
              Setting up for the first time?
            </p>
            <Link
              to="/signup"
              className="text-xs font-bold transition"
              style={{ color: '#CC0000' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Create your organisation →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
