import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, User, Building2, ArrowRight, Check } from 'lucide-react'

const RED  = '#CC0000'
const DARK = '#1C1C1C'

function InputField({ label, icon: Icon, type = 'text', value, onChange, placeholder, required, minLength, hint }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DARK }}>
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />}
        <input
          type={isPassword && show ? 'text' : type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-white border-2 border-transparent rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
          onFocus={e => e.currentTarget.style.borderColor = RED}
          onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
          style={{ paddingRight: isPassword ? '3rem' : undefined }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()

  const [form, setForm] = useState({ fullName: '', orgName: '', email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')

    const { error } = await signUp({
      email:    form.email,
      password: form.password,
      fullName: form.fullName,
      orgName:  form.orgName,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col" style={{ background: DARK }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: RED }} />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-5" style={{ background: RED }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-5" style={{ background: RED }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center opacity-[0.06] pointer-events-none select-none">
          <svg viewBox="0 0 600 300" className="w-full" fill="white">
            <polygon points="300,20 520,160 80,160" />
            <rect x="120" y="160" width="360" height="140" />
            <rect x="260" y="200" width="80" height="100" />
            <rect x="150" y="180" width="70" height="60" />
            <rect x="380" y="180" width="70" height="60" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          <div className="flex items-center gap-4">
            <img src="/unnamed.jpg" alt="Logo" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
            <div>
              <p className="text-white font-black text-lg tracking-widest">ELDESIGN</p>
              <p className="text-xs tracking-widest" style={{ color: RED }}>CONSTRUCTION LTD</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="w-12 h-1 rounded-full mb-8" style={{ background: RED }} />
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tight">
              Set up your<br />
              <span style={{ color: RED }}>workspace.</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-xs">
              Create a free account for your organisation. Invite your team once you're in.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Check, text: 'Full project & invoice management' },
                { icon: Check, text: 'Cash flow, VAT & payroll tracking' },
                { icon: Check, text: 'Invite unlimited team members' },
                { icon: Check, text: 'Professional PDF reports & invoices' },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: RED }}>
                    <f.icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-gray-400 text-sm">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Eldesign Construction Ltd.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F5F5F5] px-6 py-12">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src="/unnamed.jpg" alt="Logo" className="w-11 h-11 rounded-xl object-cover shadow" />
            <div>
              <p className="font-black text-sm tracking-widest" style={{ color: DARK }}>ELDESIGN</p>
              <p className="text-xs tracking-widest" style={{ color: RED }}>CONSTRUCTION LTD</p>
            </div>
          </div>

          {done ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#DCFCE7' }}>
                <Check className="w-8 h-8" style={{ color: '#16A34A' }} />
              </div>
              <h2 className="text-2xl font-black mb-2" style={{ color: DARK }}>Account created!</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Check your email for a confirmation link, then sign in to access your dashboard.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-xl font-bold text-sm transition"
                style={{ background: RED }}
                onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                onMouseLeave={e => e.currentTarget.style.background = RED}
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="w-10 h-1 rounded-full mb-6" style={{ background: RED }} />
              <h2 className="text-3xl font-black mb-1" style={{ color: DARK }}>Create account</h2>
              <p className="text-gray-500 text-sm mb-8">
                Already have an account?{' '}
                <Link to="/login" className="font-bold transition" style={{ color: RED }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  Sign in
                </Link>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">

                <InputField
                  label="Your Full Name *"
                  icon={User}
                  value={form.fullName}
                  onChange={set('fullName')}
                  placeholder="e.g. Amara Okafor"
                  required
                />

                <InputField
                  label="Organisation / Company Name *"
                  icon={Building2}
                  value={form.orgName}
                  onChange={set('orgName')}
                  placeholder="e.g. Okafor Construction Ltd"
                  required
                  hint="This creates your workspace. You can change it in Settings later."
                />

                <InputField
                  label="Email Address *"
                  icon={Mail}
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@company.com"
                  required
                />

                <InputField
                  label="Password *"
                  icon={Lock}
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />

                {error && (
                  <div className="flex items-start gap-3 border rounded-xl px-4 py-3 text-sm"
                    style={{ background: '#FFF0F0', borderColor: RED, color: RED }}>
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-bold text-sm tracking-wide transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  style={{ background: RED }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#AA0000' }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = RED }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
                By creating an account you agree to our terms of service.<br />
                You can invite team members after signing in.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
