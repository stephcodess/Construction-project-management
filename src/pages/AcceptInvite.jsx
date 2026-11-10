import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff, User, ArrowRight, AlertCircle, Check, Building2 } from 'lucide-react'

const RED  = '#CC0000'
const DARK = '#1C1C1C'

export default function AcceptInvite() {
  const { token }  = useParams()
  const navigate   = useNavigate()

  const [invite,   setInvite]   = useState(null)
  const [checking, setChecking] = useState(true)
  const [invalid,  setInvalid]  = useState(false)
  const [form,     setForm]     = useState({ fullName: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    async function checkToken() {
      const { data } = await supabase
        .from('organisation_invites')
        .select('*, organisations(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (!data) { setInvalid(true) }
      else { setInvite(data) }
      setChecking(false)
    }
    checkToken()
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')

    // 1. Create auth user
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    })
    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

    const userId = data?.user?.id
    if (!userId) { setError('Signup failed. Please try again.'); setLoading(false); return }

    // 2. Create profile linked to the org with invited role
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: form.fullName,
        email: invite.email,
        role: invite.role,
        organisation_id: invite.organisation_id,
      }, { onConflict: 'id' })
    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    // 3. Mark invite as accepted
    await supabase
      .from('organisation_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token)

    setDone(true)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-gray-400 text-sm">Checking invite…</div>
      </div>
    )
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#FFF0F0' }}>
            <AlertCircle className="w-7 h-7" style={{ color: RED }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: DARK }}>Invalid Invite</h2>
          <p className="text-sm text-gray-400 mb-6">
            This invite link is invalid, has already been used, or has expired.
          </p>
          <Link to="/login" className="text-sm font-bold" style={{ color: RED }}>Back to Sign In</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#DCFCE7' }}>
            <Check className="w-7 h-7" style={{ color: '#16A34A' }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: DARK }}>You're in!</h2>
          <p className="text-sm text-gray-400 mb-6">
            Your account has been created. Check your email to confirm it, then sign in.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition"
            style={{ background: RED }}
            onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
            onMouseLeave={e => e.currentTarget.style.background = RED}
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-6 py-12">
      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src="/unnamed.jpg" alt="Logo" className="w-11 h-11 rounded-xl object-cover shadow" />
          <div>
            <p className="font-black text-sm tracking-widest" style={{ color: DARK }}>ELDESIGN</p>
            <p className="text-xs tracking-widest" style={{ color: RED }}>CONSTRUCTION LTD</p>
          </div>
        </div>

        {/* Org badge */}
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl" style={{ background: '#F0F0F0' }}>
          <Building2 className="w-4 h-4 shrink-0" style={{ color: RED }} />
          <p className="text-sm font-semibold text-gray-700">
            You've been invited to join <span className="font-black" style={{ color: DARK }}>{invite?.organisations?.name}</span>
          </p>
        </div>

        <div className="w-10 h-1 rounded-full mb-6" style={{ background: RED }} />
        <h2 className="text-3xl font-black mb-1" style={{ color: DARK }}>Accept invite</h2>
        <p className="text-gray-500 text-sm mb-8">
          Joining as <span className="font-semibold">{invite?.email}</span> with role{' '}
          <span className="font-semibold capitalize">{invite?.role}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DARK }}>
              Your Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                required
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="e.g. Amara Okafor"
                className="w-full bg-white border-2 border-transparent rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DARK }}>
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
                className="w-full bg-white border-2 border-transparent rounded-xl pl-11 pr-12 py-3.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 border rounded-xl px-4 py-3 text-sm"
              style={{ background: '#FFF0F0', borderColor: RED, color: RED }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-bold text-sm tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
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
                Join {invite?.organisations?.name}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
