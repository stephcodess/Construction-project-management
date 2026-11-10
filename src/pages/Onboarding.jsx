import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Building2, Mail, Phone, MapPin, Hash, ArrowRight, ArrowLeft, Check, Briefcase } from 'lucide-react'

const RED  = '#CC0000'
const DARK = '#1C1C1C'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />}
      <input
        {...props}
        className="w-full bg-white border-2 border-transparent rounded-xl py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none transition"
        style={{ paddingLeft: Icon ? '2.5rem' : '1rem', paddingRight: '1rem' }}
        onFocus={e => e.currentTarget.style.borderColor = RED}
        onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
      />
    </div>
  )
}

const STEPS = ['Your Organisation', 'Company Details', 'All Set!']

export default function Onboarding() {
  const { completeOnboarding, profile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const [orgName,  setOrgName]  = useState('')
  const [details,  setDetails]  = useState({
    email: '', phone: '', address: '', rc_number: '', tin: '',
    bank_name: '', account_name: '', account_number: '',
  })

  function setD(k) { return e => setDetails(d => ({ ...d, [k]: e.target.value })) }

  async function handleFinish() {
    if (!orgName.trim()) { setError('Organisation name is required.'); return }
    setSaving(true); setError('')
    const { error: err } = await completeOnboarding({
      orgName: orgName.trim(),
      companyDetails: {
        email:          details.email.trim()          || null,
        phone:          details.phone.trim()          || null,
        address:        details.address.trim()        || null,
        rc_number:      details.rc_number.trim()      || null,
        tin:            details.tin.trim()            || null,
        bank_name:      details.bank_name.trim()      || null,
        account_name:   details.account_name.trim()   || null,
        account_number: details.account_number.trim() || null,
      },
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setStep(3)
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#F0F2F8' }}>

      {/* ── Sidebar ── */}
      <div className="hidden lg:flex lg:w-72 xl:w-80 flex-col px-10 py-12" style={{ background: DARK }}>
        <div className="absolute top-0 left-0 h-1 w-72 xl:w-80" style={{ background: RED }} />

        <div className="flex items-center gap-3 mb-16">
          <img src="/unnamed.jpg" alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow" />
          <div>
            <p className="text-white font-black text-sm tracking-widest">ELDESIGN</p>
            <p className="text-xs tracking-widest" style={{ color: RED }}>CONSTRUCTION LTD</p>
          </div>
        </div>

        <div className="space-y-2">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done    = step > n
            const current = step === n
            return (
              <div key={label} className="flex items-center gap-4 py-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 transition-all"
                  style={{
                    background: done ? RED : current ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.08)',
                    color:      done ? '#fff' : current ? RED : 'rgba(255,255,255,0.3)',
                    border:     current ? `2px solid ${RED}` : 'none',
                  }}
                >
                  {done ? <Check className="w-4 h-4" /> : n}
                </div>
                <span
                  className="text-sm font-semibold transition-all"
                  style={{ color: current ? '#fff' : done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-auto">
          <p className="text-gray-600 text-xs">
            Signed in as<br />
            <span className="text-gray-400">{profile?.email ?? profile?.full_name}</span>
          </p>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">

          {/* Mobile step indicator */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all"
                style={{ background: step > i ? RED : step === i + 1 ? RED : '#D1D5DB', opacity: step === i + 1 ? 1 : step > i ? 0.5 : 0.3 }} />
            ))}
          </div>

          {/* ── Step 1: Org name ── */}
          {step === 1 && (
            <div>
              <div className="w-10 h-1 rounded-full mb-6" style={{ background: RED }} />
              <h2 className="text-3xl font-black mb-2" style={{ color: DARK }}>Name your organisation</h2>
              <p className="text-gray-500 text-sm mb-8">This is your workspace name. Your team will see this.</p>

              <Field label="Organisation / Company Name *">
                <Input
                  icon={Building2}
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Okafor Construction Ltd"
                  autoFocus
                />
              </Field>

              {error && (
                <p className="text-sm mt-3 px-4 py-3 rounded-xl" style={{ background: '#FFF0F0', color: RED }}>{error}</p>
              )}

              <button
                onClick={() => { if (!orgName.trim()) { setError('Please enter your organisation name.'); return } setError(''); setStep(2) }}
                className="mt-8 w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-bold text-sm transition"
                style={{ background: RED }}
                onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                onMouseLeave={e => e.currentTarget.style.background = RED}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Company details ── */}
          {step === 2 && (
            <div>
              <div className="w-10 h-1 rounded-full mb-6" style={{ background: RED }} />
              <h2 className="text-3xl font-black mb-2" style={{ color: DARK }}>Company details</h2>
              <p className="text-gray-500 text-sm mb-8">These appear on invoices and reports. All fields optional — you can fill them in Settings later.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email">
                    <Input icon={Mail} type="email" value={details.email} onChange={setD('email')} placeholder="info@company.com" />
                  </Field>
                  <Field label="Phone">
                    <Input icon={Phone} value={details.phone} onChange={setD('phone')} placeholder="+234 800 000 0000" />
                  </Field>
                </div>

                <Field label="Address">
                  <Input icon={MapPin} value={details.address} onChange={setD('address')} placeholder="123 Main St, Lagos" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="RC Number">
                    <Input icon={Hash} value={details.rc_number} onChange={setD('rc_number')} placeholder="RC 123456" />
                  </Field>
                  <Field label="TIN">
                    <Input icon={Hash} value={details.tin} onChange={setD('tin')} placeholder="12345678-0001" />
                  </Field>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Bank Details (for invoices)</p>
                  <div className="space-y-3">
                    <Field label="Bank Name">
                      <Input icon={Briefcase} value={details.bank_name} onChange={setD('bank_name')} placeholder="e.g. Zenith Bank" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Account Name">
                        <Input value={details.account_name} onChange={setD('account_name')} placeholder="Company Name" />
                      </Field>
                      <Field label="Account Number">
                        <Input value={details.account_number} onChange={setD('account_number')} placeholder="0123456789" />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm mt-4 px-4 py-3 rounded-xl" style={{ background: '#FFF0F0', color: RED }}>{error}</p>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => { setError(''); setStep(1) }}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm border-2 transition"
                  style={{ borderColor: '#E5E5E5', color: DARK }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-bold text-sm transition disabled:opacity-60"
                  style={{ background: RED }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
                  onMouseLeave={e => { if (!saving) e.currentTarget.style.background = RED }}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Setting up…
                    </>
                  ) : (
                    <> Finish Setup <ArrowRight className="w-4 h-4" /> </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg"
                style={{ background: RED }}>
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black mb-3" style={{ color: DARK }}>You're all set!</h2>
              <p className="text-gray-500 text-sm mb-10 leading-relaxed max-w-sm mx-auto">
                <strong style={{ color: DARK }}>{orgName}</strong> is ready. Head to your dashboard to start managing projects, invoices, and cash flow.
              </p>
              <button
                onClick={() => navigate('/projects')}
                className="inline-flex items-center gap-2 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition shadow-lg"
                style={{ background: RED }}
                onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
                onMouseLeave={e => e.currentTarget.style.background = RED}
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
