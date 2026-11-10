import { useState, useRef, useEffect } from 'react'
import { useCompany } from '../context/CompanyContext'
import { supabase } from '../lib/supabase'
import {
  Building2, Mail, Phone, Globe, MapPin, Hash,
  Banknote, Camera, Check, AlertTriangle, Upload,
  FileText, Shield, CreditCard, Loader2, ExternalLink
} from 'lucide-react'

// ── Shared primitives ──────────────────────────────────────────
function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: '#F0F0F0' }}>
      <div className="px-6 py-4 border-b flex items-start gap-4" style={{ borderColor: '#F7F7F7', background: '#FAFAFA' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(204,0,0,0.08)' }}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" style={{ color: '#CC0000' }} />
        </div>
        <div>
          <p className="font-black text-sm" style={{ color: '#1C1C1C' }}>{title}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function FieldGroup({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}

function Field({ label, hint, full, children }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#888' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function FInput({ ...props }) {
  return (
    <input {...props}
      className="w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all"
      style={{ borderColor: '#EEEEEE' }}
      onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.07)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = 'none' }} />
  )
}

// ── Logo uploader ──────────────────────────────────────────────
function LogoUploader({ currentUrl, onUploaded }) {
  const ref            = useRef()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState(currentUrl)
  const [err, setErr]             = useState('')

  useEffect(() => { setPreview(currentUrl) }, [currentUrl])

  async function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024)    { setErr('Image must be under 5 MB.'); return }
    setErr(''); setUploading(true)

    const ext  = file.name.split('.').pop()
    const path = `company/logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) { setErr(upErr.message); setUploading(false); return }

    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    const url = data.publicUrl + `?t=${Date.now()}`
    setPreview(url)
    onUploaded(url)
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-6">
      {/* Logo preview */}
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: '#E8E8E8', background: '#F7F7F7' }}>
          {preview
            ? <img src={preview} alt="Logo" className="w-full h-full object-cover" />
            : <Building2 className="w-10 h-10 text-gray-200" />}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.85)' }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#CC0000' }} />
          </div>
        )}
      </div>

      {/* Upload controls */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-700 mb-1">Company Logo</p>
        <p className="text-xs text-gray-400 mb-3">PNG, JPG or SVG · Max 5 MB · Recommended: 256×256 px</p>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <button type="button" onClick={() => ref.current.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border-2 transition disabled:opacity-50"
          style={{ borderColor: '#CC0000', color: '#CC0000' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,0,0,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Upload New Logo'}
        </button>
        {err && <p className="text-xs mt-2" style={{ color: '#CC0000' }}>{err}</p>}
      </div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ message, type }) {
  if (!message) return null
  const isErr = type === 'error'
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white animate-fadeIn"
      style={{ background: isErr ? '#CC0000' : '#16A34A', minWidth: '220px' }}>
      {isErr
        ? <AlertTriangle className="w-4 h-4 shrink-0" />
        : <Check className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function Settings() {
  const { company, loading, saveCompany } = useCompany()
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState({ message: '', type: '' })

  // Initialise form from loaded company
  useEffect(() => {
    if (company && !form) setForm({ ...company })
  }, [company])

  // Sync when company reloads
  useEffect(() => {
    if (company && form) setForm(f => ({ ...company, ...f }))
  }, [company])

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: '' }), 3000)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name?.trim()) { showToast('Company name is required.', 'error'); return }
    setSaving(true)
    try {
      await saveCompany(form)
      showToast('Settings saved successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>Configuration</p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Company Settings</h2>
          <p className="text-sm text-gray-400 mt-1">These details appear on all invoices, PDFs and reports.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition shadow-sm"
          style={{ background: '#CC0000' }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Check className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Logo & Identity ── */}
        <SectionCard icon={Camera} title="Logo & Brand" description="Upload your company logo to appear on all printed documents.">
          <LogoUploader
            currentUrl={form.logo_url}
            onUploaded={url => setF('logo_url', url)} />
        </SectionCard>

        {/* ── Company Info ── */}
        <SectionCard icon={Building2} title="Company Information" description="Basic legal and trading details.">
          <FieldGroup>
            <Field label="Company Name *" full>
              <FInput value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Eldesign Construction Ltd" required />
            </Field>
            <Field label="Tagline / Subtitle">
              <FInput value={form.tagline} onChange={e => setF('tagline', e.target.value)} placeholder="Construction & Project Management" />
            </Field>
            <Field label="RC Number" hint="CAC Registration Number">
              <FInput value={form.rc_number} onChange={e => setF('rc_number', e.target.value)} placeholder="RC 000000" />
            </Field>
          </FieldGroup>
        </SectionCard>

        {/* ── Contact ── */}
        <SectionCard icon={Mail} title="Contact Details" description="How clients and partners can reach you.">
          <FieldGroup>
            <Field label="Email Address">
              <FInput type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="info@eldesign.ng" />
            </Field>
            <Field label="Phone Number">
              <FInput type="tel" value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="+234 800 000 0000" />
            </Field>
            <Field label="Website">
              <FInput type="url" value={form.website} onChange={e => setF('website', e.target.value)} placeholder="https://eldesign.ng" />
            </Field>
          </FieldGroup>
          <div className="mt-4">
            <Field label="Office Address" full>
              <textarea value={form.address} onChange={e => setF('address', e.target.value)}
                rows={2} placeholder="123 Victoria Island, Lagos, Nigeria"
                className="w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all resize-none"
                style={{ borderColor: '#EEEEEE' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.07)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = 'none' }} />
            </Field>
          </div>
        </SectionCard>

        {/* ── Tax & Compliance ── */}
        <SectionCard icon={Shield} title="Tax & Compliance" description="Used on VAT returns, payroll submissions, and official filings.">
          <FieldGroup>
            <Field label="Tax Identification Number (TIN)">
              <FInput value={form.tin} onChange={e => setF('tin', e.target.value)} placeholder="00000000-0001" />
            </Field>
            <Field label="VAT Registration Number">
              <FInput value={form.vat_number} onChange={e => setF('vat_number', e.target.value)} placeholder="NG0000000000" />
            </Field>
          </FieldGroup>
        </SectionCard>

        {/* ── Bank Details ── */}
        <SectionCard icon={Banknote} title="Bank Details" description="Default bank account shown on all invoices and payment instructions.">
          <FieldGroup>
            <Field label="Bank Name">
              <FInput value={form.bank_name} onChange={e => setF('bank_name', e.target.value)} placeholder="Zenith Bank" />
            </Field>
            <Field label="Account Number">
              <FInput value={form.account_number} onChange={e => setF('account_number', e.target.value)} placeholder="0000000000" />
            </Field>
            <Field label="Account Name" full>
              <FInput value={form.account_name} onChange={e => setF('account_name', e.target.value)} placeholder="Eldesign Construction Ltd" />
            </Field>
          </FieldGroup>
        </SectionCard>

        {/* ── Invoice defaults ── */}
        <SectionCard icon={FileText} title="Invoice Defaults" description="Pre-filled text that appears on every new invoice.">
          <div className="space-y-4">
            <Field label="Default Payment Terms" full>
              <textarea value={form.payment_terms ?? ''} onChange={e => setF('payment_terms', e.target.value)}
                rows={2} placeholder="Payment due within 30 days of invoice date."
                className="w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all resize-none"
                style={{ borderColor: '#EEEEEE' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.07)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = 'none' }} />
            </Field>
            <Field label="Default Invoice Notes / Footer" full>
              <textarea value={form.invoice_notes ?? ''} onChange={e => setF('invoice_notes', e.target.value)}
                rows={2} placeholder="Thank you for your business."
                className="w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all resize-none"
                style={{ borderColor: '#EEEEEE' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#CC0000'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.07)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#EEEEEE'; e.currentTarget.style.boxShadow = 'none' }} />
            </Field>
          </div>
        </SectionCard>

        {/* ── Preview card ── */}
        <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: '#F0F0F0' }}>
          <div className="px-6 py-4 border-b" style={{ background: '#FAFAFA', borderColor: '#F0F0F0' }}>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Document Header Preview</p>
          </div>
          <div className="p-6">
            <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1C1C1C, #2A2A2A)' }}>
              <div className="flex items-center gap-4 px-5 py-5">
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}>
                  {form.logo_url
                    ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    : <Building2 className="w-6 h-6 text-white/20" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm tracking-wide truncate">
                    {form.name || 'Company Name'}
                  </p>
                  <p className="text-xs tracking-widest truncate" style={{ color: '#CC0000' }}>
                    {form.tagline || 'Tagline'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                    {form.email && (
                      <span className="text-white/40 text-[10px] flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5" />{form.email}
                      </span>
                    )}
                    {form.phone && (
                      <span className="text-white/40 text-[10px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />{form.phone}
                      </span>
                    )}
                    {form.address && (
                      <span className="text-white/40 text-[10px] flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />{form.address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {form.tin && (
                    <p className="text-white/30 text-[10px]">TIN: <span className="text-white/50">{form.tin}</span></p>
                  )}
                  {form.vat_number && (
                    <p className="text-white/30 text-[10px]">VAT: <span className="text-white/50">{form.vat_number}</span></p>
                  )}
                  {form.rc_number && (
                    <p className="text-white/30 text-[10px]">RC: <span className="text-white/50">{form.rc_number}</span></p>
                  )}
                </div>
              </div>
              {/* Bank details strip */}
              {form.bank_name && (
                <div className="flex items-center gap-3 px-5 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                  <Banknote className="w-3 h-3 text-white/20 shrink-0" />
                  <p className="text-white/30 text-[10px]">
                    {form.bank_name}
                    {form.account_number && ` · ${form.account_number}`}
                    {form.account_name && ` · ${form.account_name}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile save button */}
        <div className="flex justify-end pb-4">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition shadow-sm"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Check className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>

      <Toast message={toast.message} type={toast.type} />
    </div>
  )
}
