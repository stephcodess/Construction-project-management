import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportInvoicePDF } from '../lib/pdf'
import { format } from 'date-fns'

// ── Money formatter ───────────────────────────────────────────
const fmtMoney = n =>
  `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Status badge config ───────────────────────────────────────
function getStatusStyle(status) {
  switch (status) {
    case 'paid':
      return { background: '#F0FDF4', color: '#16A34A', dot: '#22C55E', label: 'Paid' }
    case 'sent':
      return { background: '#EFF6FF', color: '#2563EB', dot: '#3B82F6', label: 'Sent' }
    case 'partially_paid':
    case 'partial':
      return { background: '#FFFBEB', color: '#D97706', dot: '#F59E0B', label: 'Partially Paid' }
    case 'overdue':
      return { background: '#FFF0F0', color: '#CC0000', dot: '#EF4444', label: 'Overdue' }
    default:
      return { background: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'Draft' }
  }
}

function StatusBadge({ status }) {
  const s = getStatusStyle(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px', borderRadius: '999px',
      background: s.background, color: s.color,
      fontSize: '12px', fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Divider ───────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: '#F0F0F0', margin: '0 0' }} />
}

// ── Section label inside invoice ─────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 10px',
    }}>
      {children}
    </p>
  )
}

// ── Main public invoice page ──────────────────────────────────
export default function InvoicePublic() {
  const { token } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: inv, error: invErr }, { data: co }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, projects(name, client, location)')
          .eq('id', token)
          .single(),
        supabase
          .from('company_settings')
          .select('*')
          .eq('id', 1)
          .single(),
      ])
      if (invErr || !inv) {
        setNotFound(true)
      } else {
        setInvoice(inv)
        setCompany(co ?? null)
      }
      setLoading(false)
    }
    load()
  }, [token])

  async function handleDownload() {
    setDownloading(true)
    try {
      await exportInvoicePDF(invoice, company)
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E5E5E5',
            borderTopColor: '#CC0000', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 500 }}>Loading invoice…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: 20, padding: '48px 40px',
          textAlign: 'center', maxWidth: 400, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: '#FFF5F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CC0000" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1C', margin: '0 0 8px' }}>Invoice Not Found</p>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
            This invoice link is invalid or the invoice no longer exists.
          </p>
        </div>
      </div>
    )
  }

  // ── Resolved data ──
  const co = {
    name:           company?.name           ?? 'Eldesign Construction',
    tagline:        company?.tagline        ?? 'Construction & Project Management',
    address:        company?.address        ?? 'Lagos, Nigeria',
    email:          company?.email          ?? '',
    phone:          company?.phone          ?? '',
    logo_url:       company?.logo_url       ?? '/unnamed.jpg',
    bank_name:      company?.bank_name      ?? invoice.bank_name ?? '',
    account_name:   company?.account_name   ?? invoice.account_name ?? '',
    account_number: company?.account_number ?? invoice.account_number ?? '',
    payment_terms:  company?.payment_terms  ?? invoice.payment_terms ?? '',
  }

  const lineItems  = Array.isArray(invoice.line_items) ? invoice.line_items : []
  const subtotal   = Number(invoice.subtotal      ?? 0)
  const vatAmt     = Number(invoice.vat_amount    ?? 0)
  const total      = Number(invoice.total_amount  ?? 0)
  const discountPct = Number(invoice.discount_pct ?? 0)
  const discountAmt = subtotal > 0 && discountPct > 0
    ? (subtotal / (1 - discountPct / 100)) * (discountPct / 100)
    : 0

  const bankName      = invoice.bank_name      ?? co.bank_name
  const accountName   = invoice.account_name   ?? co.account_name
  const accountNumber = invoice.account_number ?? co.account_number
  const paymentTerms  = invoice.payment_terms  ?? co.payment_terms

  // ── Render ──
  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        @media (max-width: 640px) {
          .invoice-grid { grid-template-columns: 1fr !important; }
          .invoice-actions { flex-direction: column !important; align-items: stretch !important; }
          .invoice-actions button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{
        background: '#1C1C1C', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={co.logo_url}
            alt="Logo"
            onError={e => { e.currentTarget.src = '/unnamed.jpg' }}
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
          />
          <div>
            <p style={{ color: 'white', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
              {co.name.toUpperCase()}
            </p>
            <p style={{ color: '#CC0000', fontSize: 9, letterSpacing: '0.1em', marginTop: 1 }}>
              {co.tagline.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="invoice-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Copy link */}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
              color: copied ? '#4ADE80' : 'rgba(255,255,255,0.75)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Copy Link
              </>
            )}
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: downloading ? '#AA0000' : '#CC0000',
              color: 'white', fontSize: 12, fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.8 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = '#AA0000' }}
            onMouseLeave={e => { if (!downloading) e.currentTarget.style.background = '#CC0000' }}
          >
            {downloading ? (
              <>
                <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Invoice body */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px 64px' }}>
        <div style={{
          background: 'white', borderRadius: 20,
          boxShadow: '0 2px 32px rgba(0,0,0,0.10)', overflow: 'hidden',
        }}>

          {/* ── Invoice header band ── */}
          <div style={{ background: 'linear-gradient(135deg, #1C1C1C 0%, #2A2A2A 100%)', padding: '32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>

              {/* Company info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <img
                    src={co.logo_url}
                    alt={co.name}
                    onError={e => { e.currentTarget.src = '/unnamed.jpg' }}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', lineHeight: 1 }}>
                      {co.name.toUpperCase()}
                    </p>
                    <p style={{ color: '#CC0000', fontSize: 10, letterSpacing: '0.1em', marginTop: 3 }}>
                      {co.tagline.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.7 }}>
                  {co.address && <div>{co.address}</div>}
                  {co.email   && <div>{co.email}</div>}
                  {co.phone   && <div>{co.phone}</div>}
                </div>
              </div>

              {/* Invoice number & dates */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: 'white', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  INVOICE
                </p>
                <p style={{ color: '#CC0000', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
                  {invoice.invoice_number}
                </p>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.05em' }}>ISSUED</span>
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600 }}>
                      {invoice.invoice_date
                        ? format(new Date(invoice.invoice_date), 'dd MMM yyyy')
                        : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.05em' }}>DUE</span>
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600 }}>
                      {invoice.due_date
                        ? format(new Date(invoice.due_date), 'dd MMM yyyy')
                        : '—'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <StatusBadge status={invoice.status ?? 'draft'} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Bill To + Project ── */}
          <div className="invoice-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#F3F3F3',
          }}>
            {/* Bill To */}
            <div style={{ background: 'white', padding: '24px 36px' }}>
              <SectionLabel>Bill To</SectionLabel>
              {invoice.client_name ? (
                <>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1C', marginBottom: 4 }}>
                    {invoice.client_name}
                  </p>
                  {invoice.client_address && (
                    <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 2 }}>
                      {invoice.client_address}
                    </p>
                  )}
                  {invoice.client_email && (
                    <p style={{ fontSize: 12, color: '#6B7280' }}>{invoice.client_email}</p>
                  )}
                  {invoice.client_phone && (
                    <p style={{ fontSize: 12, color: '#6B7280' }}>{invoice.client_phone}</p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: '#D1D5DB' }}>No client information</p>
              )}
            </div>

            {/* Project */}
            <div style={{ background: 'white', padding: '24px 36px' }}>
              <SectionLabel>Project</SectionLabel>
              {invoice.projects?.name ? (
                <>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1C', marginBottom: 4 }}>
                    {invoice.projects.name}
                  </p>
                  {invoice.projects.location && (
                    <p style={{ fontSize: 12, color: '#6B7280' }}>{invoice.projects.location}</p>
                  )}
                  {invoice.projects.client && (
                    <p style={{ fontSize: 12, color: '#9CA3AF' }}>{invoice.projects.client}</p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: '#D1D5DB' }}>—</p>
              )}
            </div>
          </div>

          <Divider />

          {/* ── Line items ── */}
          <div style={{ padding: '28px 36px' }}>
            <SectionLabel>Deliverables</SectionLabel>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F0F0F0' }}>
                    {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                      <th key={h} style={{
                        padding: '8px 12px 10px', textAlign: i === 0 ? 'left' : 'right',
                        fontSize: 10, fontWeight: 800, color: '#9CA3AF',
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                        ...(i === 1 && { textAlign: 'center' }),
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', color: '#D1D5DB', fontSize: 13, fontStyle: 'italic' }}>
                        No line items on this invoice
                      </td>
                    </tr>
                  ) : lineItems.map((item, i) => {
                    const amt = Number(item.amount) || (Number(item.qty) || 1) * (Number(item.unit_price) || 0)
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid #FAFAFA',
                        background: i % 2 === 1 ? '#FAFAFA' : 'white',
                      }}>
                        <td style={{ padding: '13px 12px', color: '#374151', fontWeight: 500 }}>
                          {item.description}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'center', color: '#6B7280' }}>
                          {item.qty ?? 1}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right', color: '#6B7280' }}>
                          {fmtMoney(item.unit_price)}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right', fontWeight: 700, color: '#1C1C1C' }}>
                          {fmtMoney(amt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals block */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <div style={{ minWidth: 240, maxWidth: 320, width: '100%' }}>
                <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#6B7280' }}>Subtotal</span>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{fmtMoney(subtotal)}</span>
                  </div>

                  {discountPct > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#16A34A' }}>Discount ({discountPct}%)</span>
                      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>−{fmtMoney(discountAmt)}</span>
                    </div>
                  )}

                  {vatAmt > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#6B7280' }}>VAT</span>
                      <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{fmtMoney(vatAmt)}</span>
                    </div>
                  )}

                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: '2px solid #1C1C1C', paddingTop: 10, marginTop: 4,
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1C' }}>Total Due</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#CC0000' }}>{fmtMoney(total)}</span>
                  </div>

                  {Number(invoice.amount_paid ?? 0) > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: '#16A34A' }}>Amount Paid</span>
                        <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
                          −{fmtMoney(invoice.amount_paid)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>Balance</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
                          {fmtMoney(total - Number(invoice.amount_paid))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Divider />

          {/* ── Payment instructions ── */}
          {(bankName || paymentTerms) && (
            <>
              <div style={{ padding: '24px 36px' }}>
                <SectionLabel>Payment Instructions</SectionLabel>
                {bankName && (
                  <div style={{
                    background: '#F7F7F7', borderRadius: 12, padding: '14px 18px',
                    marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{bankName}</span>
                    </div>
                    {accountNumber && (
                      <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1C1C1C', letterSpacing: '0.05em' }}>
                        {accountNumber}
                      </p>
                    )}
                    {accountName && (
                      <p style={{ fontSize: 12, color: '#6B7280' }}>{accountName}</p>
                    )}
                  </div>
                )}
                {paymentTerms && (
                  <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>{paymentTerms}</p>
                )}
              </div>
              <Divider />
            </>
          )}

          {/* ── Notes ── */}
          {invoice.notes && (
            <>
              <div style={{ padding: '24px 36px' }}>
                <SectionLabel>Notes</SectionLabel>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, fontStyle: 'italic' }}>
                  {invoice.notes}
                </p>
              </div>
              <Divider />
            </>
          )}

          {/* ── Footer strip ── */}
          <div style={{
            background: '#1C1C1C', padding: '18px 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            flexWrap: 'wrap',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              {co.name} · Thank you for your business.
            </p>
            <p style={{ color: '#CC0000', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
              {invoice.invoice_number}
            </p>
          </div>
        </div>

        {/* Powered-by note */}
        <p className="no-print" style={{
          textAlign: 'center', marginTop: 20, fontSize: 11, color: '#C4C4C4',
        }}>
          Generated by Eldesign Construction Management
        </p>
      </div>
    </div>
  )
}
