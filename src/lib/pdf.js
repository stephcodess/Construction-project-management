import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

// ── Brand ──────────────────────────────────────────────────────
const RED   = [204, 0, 0]
const DARK  = [28, 28, 28]
const GRAY  = [100, 100, 100]
const LIGHT = [245, 245, 245]
const WHITE = [255, 255, 255]
const LINE  = [230, 230, 230]
const LGRAY = [220, 220, 220]

// ── Load logo as base64 data URL ───────────────────────────────
async function loadLogoBase64(url = '/unnamed.jpg') {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── Resolve company settings ───────────────────────────────────
function resolveCompany(co) {
  return {
    name:           co?.name           ?? 'Eldesign Construction',
    tagline:        co?.tagline        ?? 'Construction & Project Management',
    address:        co?.address        ?? 'Lagos, Nigeria',
    email:          co?.email          ?? '',
    phone:          co?.phone          ?? '',
    website:        co?.website        ?? '',
    tin:            co?.tin            ?? '',
    vat_number:     co?.vat_number     ?? '',
    rc_number:      co?.rc_number      ?? '',
    bank_name:      co?.bank_name      ?? 'First Bank of Nigeria',
    account_name:   co?.account_name   ?? 'Eldesign Construction Ltd',
    account_number: co?.account_number ?? '',
    payment_terms:  co?.payment_terms  ?? 'Payment due within 30 days of invoice date.',
    invoice_notes:  co?.invoice_notes  ?? '',
    logo_url:       co?.logo_url       ?? '/unnamed.jpg',
  }
}

// ═══════════════════════════════════════════════════════════════
// LETTERHEAD — full first-page cover (portrait or landscape)
// ═══════════════════════════════════════════════════════════════
function drawLetterhead(doc, logoData, docTitle, docSubtitle, meta, pageW, pageH, co) {
  const c = resolveCompany(co)
  const isLandscape = pageW > pageH

  // ── Dark header band (top 25% of page) ──
  const bandH = isLandscape ? 58 : 72
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, bandH, 'F')

  // Red left accent bar
  doc.setFillColor(...RED)
  doc.rect(0, 0, 6, bandH, 'F')

  // Decorative circles (top-right corner, like the edit modal)
  doc.setFillColor(204, 0, 0)
  doc.setGState(new doc.GState({ opacity: 0.12 }))
  doc.circle(pageW - 10, -10, 50, 'F')
  doc.circle(pageW - 40, 15, 25, 'F')
  doc.setGState(new doc.GState({ opacity: 1 }))

  // Logo
  const logoSize = isLandscape ? 36 : 44
  const logoX = 16
  const logoY = (bandH - logoSize) / 2
  if (logoData) {
    // White circle behind logo
    doc.setFillColor(...WHITE)
    doc.setGState(new doc.GState({ opacity: 0.1 }))
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 'F')
    doc.setGState(new doc.GState({ opacity: 1 }))
    doc.addImage(logoData, 'JPEG', logoX, logoY, logoSize, logoSize)
  }

  const tx = logoData ? (logoX + logoSize + 10) : 16

  // Company name
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(isLandscape ? 16 : 18)
  doc.text(c.name.toUpperCase(), tx, isLandscape ? 20 : 25)

  // Red rule under name
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.5)
  doc.line(tx, isLandscape ? 23 : 29, tx + doc.getTextWidth(c.name.toUpperCase()) + 2, isLandscape ? 23 : 29)

  // Tagline
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 180, 180)
  doc.text(c.tagline.toUpperCase(), tx, isLandscape ? 29 : 36)

  // Contact line
  const contactParts = [c.address, c.phone, c.email, c.website].filter(Boolean)
  if (contactParts.length) {
    doc.setFontSize(6.5)
    doc.setTextColor(140, 140, 140)
    doc.text(contactParts.join('   ·   '), tx, isLandscape ? 36 : 44)
  }

  // RC / TIN line
  const regParts = [
    c.rc_number  && `RC: ${c.rc_number}`,
    c.tin        && `TIN: ${c.tin}`,
    c.vat_number && `VAT: ${c.vat_number}`,
  ].filter(Boolean)
  if (regParts.length) {
    doc.setFontSize(6.5)
    doc.setTextColor(120, 120, 120)
    doc.text(regParts.join('   ·   '), tx, isLandscape ? 43 : 52)
  }

  // ── Document title block — right side ──
  const rightX = pageW - 14
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(isLandscape ? 18 : 22)
  doc.text(docTitle.toUpperCase(), rightX, isLandscape ? 22 : 26, { align: 'right' })

  if (docSubtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(200, 200, 200)
    doc.text(docSubtitle, rightX, isLandscape ? 30 : 36, { align: 'right' })
  }

  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, rightX, isLandscape ? 50 : 62, { align: 'right' })

  // ── Meta info row (grey band below header) ──
  if (meta && meta.length > 0) {
    const metaY = bandH
    const metaBandH = isLandscape ? 16 : 18
    doc.setFillColor(240, 240, 240)
    doc.rect(0, metaY, pageW, metaBandH, 'F')
    doc.setFillColor(...RED)
    doc.rect(0, metaY, 6, metaBandH, 'F')

    const colW   = (pageW - 20) / meta.length
    meta.forEach((item, i) => {
      const mx = 14 + i * colW
      const my = metaY + 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...GRAY)
      doc.text((item.label ?? '').toUpperCase(), mx, my)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(String(item.value ?? '—'), mx, my + 7)
    })

    return bandH + metaBandH + 8  // return Y where content should start
  }

  return bandH + 8
}

// ═══════════════════════════════════════════════════════════════
// COMPACT HEADER — subsequent pages (not page 1)
// ═══════════════════════════════════════════════════════════════
function drawCompactHeader(doc, logoData, docTitle, pageW, co) {
  const c = resolveCompany(co)

  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setFillColor(...RED)
  doc.rect(0, 0, 4, 18, 'F')

  if (logoData) doc.addImage(logoData, 'JPEG', 8, 3, 12, 12)
  const tx = logoData ? 24 : 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text(c.name.toUpperCase(), tx, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(160, 160, 160)
  doc.text(docTitle.toUpperCase(), pageW - 10, 11, { align: 'right' })

  return 22  // content starts at Y=22
}

// ═══════════════════════════════════════════════════════════════
// RICH FOOTER — every page
// ═══════════════════════════════════════════════════════════════
function addFooters(doc, pageW, pageH, co) {
  const c     = resolveCompany(co)
  const total = doc.getNumberOfPages()

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // Top rule
    doc.setDrawColor(...LGRAY)
    doc.setLineWidth(0.4)
    doc.line(0, pageH - 20, pageW, pageH - 20)

    // Red accent left bar in footer
    doc.setFillColor(...RED)
    doc.rect(0, pageH - 20, 4, 20, 'F')

    // Footer background
    doc.setFillColor(248, 248, 248)
    doc.rect(4, pageH - 20, pageW - 4, 20, 'F')

    // Left: company name + address
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...DARK)
    doc.text(c.name, 10, pageH - 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    const footerLeft = [c.address, c.phone, c.email].filter(Boolean).join('  ·  ')
    doc.text(footerLeft || 'Confidential', 10, pageH - 7)

    // Centre: RC / TIN
    const regLine = [
      c.rc_number  && `RC: ${c.rc_number}`,
      c.tin        && `TIN: ${c.tin}`,
    ].filter(Boolean).join('  ·  ')
    if (regLine) {
      doc.setFontSize(6)
      doc.setTextColor(...GRAY)
      doc.text(regLine, pageW / 2, pageH - 10, { align: 'center' })
    }

    // Right: website + page
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    if (c.website) doc.text(c.website, pageW - 10, pageH - 13, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...DARK)
    doc.text(`${i} / ${total}`, pageW - 10, pageH - 7, { align: 'right' })
  }
}

// ── autoTable with compact-header on new pages ─────────────────
function tableStyle(extraHeadStyles = {}) {
  return {
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      textColor: DARK,
      lineColor: LINE,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      ...extraHeadStyles,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    tableLineColor: LINE,
    tableLineWidth: 0.2,
    // leave 22mm at top (compact header) and 24mm at bottom (footer) on new pages
    margin: { top: 24, bottom: 24 },
  }
}

// ── drawCompactHeaders on all pages > 1 ───────────────────────
function addContinuationHeaders(doc, logoData, docTitle, pageW, co) {
  const total = doc.getNumberOfPages()
  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    drawCompactHeader(doc, logoData, docTitle, pageW, co)
  }
}

// ── Summary box ────────────────────────────────────────────────
function drawSummaryBox(doc, x, y, w, h, label, value, bgColor = LIGHT) {
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(label.toUpperCase(), x + 5, y + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...(bgColor === RED ? WHITE : DARK))
  doc.text(value, x + 5, y + 16)
}

// ── Section label ──────────────────────────────────────────────
function sectionLabel(doc, y, text) {
  doc.setFillColor(...RED)
  doc.rect(14, y, 3, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text(text, 20, y + 4)
  return y + 10
}

// ═══════════════════════════════════════════════════════════════
// JOURNAL PDF
// ═══════════════════════════════════════════════════════════════
export async function exportJournalPDF(entries, month, company) {
  const co    = resolveCompany(company)
  const doc   = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64(co.logo_url)

  const receipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
  const payments = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
  const net      = receipts - payments

  const contentY = drawLetterhead(doc, logo, 'Cash Flow Journal', `Period: ${month}`, [
    { label: 'Period',        value: month },
    { label: 'Total Inflow',  value: `₦${receipts.toLocaleString()}` },
    { label: 'Total Outflow', value: `₦${payments.toLocaleString()}` },
    { label: 'Net Cash',      value: `₦${net.toLocaleString()}` },
    { label: 'Transactions',  value: entries.length },
  ], pageW, pageH, co)

  let y = sectionLabel(doc, contentY, 'Transaction Ledger')

  const rows = entries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Receipt' : 'Payment',
    e.description ?? '',
    e.category ?? '',
    e.projects?.name ?? e.project_name ?? '—',
    e.vat_applicable ? `₦${Number(e.vat_amount).toLocaleString()}` : '—',
    `₦${Number(e.amount).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Description', 'Category', 'Project', 'VAT', 'Amount']],
    body: rows,
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 22 },
      6: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
    },
    foot: [[
      '', '', '', '', '', 'NET CASH',
      `₦${net.toLocaleString()}`,
    ]],
    footStyles: { fillColor: net >= 0 ? [22, 163, 74] : RED, textColor: WHITE, fontStyle: 'bold' },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = data.cell.raw === 'Receipt' ? [22, 163, 74] : RED
        data.cell.styles.fontStyle = 'bold'
      }
    },
    ...tableStyle(),
  })

  addContinuationHeaders(doc, logo, 'Cash Flow Journal', pageW, co)
  addFooters(doc, pageW, pageH, co)
  doc.save(`cashflow-journal-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// VAT RETURN PDF
// ═══════════════════════════════════════════════════════════════
export async function exportVATPDF(entries, month, company) {
  const co    = resolveCompany(company)
  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64(co.logo_url)

  const outputVAT = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.vat_amount), 0)
  const inputVAT  = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.vat_amount), 0)
  const netVAT    = outputVAT - inputVAT

  const contentY = drawLetterhead(doc, logo, 'VAT Return', `Period: ${month}`, [
    { label: 'Period',       value: month },
    { label: 'Output VAT',   value: `₦${outputVAT.toLocaleString()}` },
    { label: 'Input VAT',    value: `₦${inputVAT.toLocaleString()}` },
    { label: 'Net Payable',  value: `₦${netVAT.toLocaleString()}` },
  ], pageW, pageH, co)

  let y = sectionLabel(doc, contentY, 'VAT-Applicable Transactions')

  const rows = entries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Output VAT' : 'Input VAT',
    e.description ?? '',
    e.projects?.name ?? '—',
    `₦${Number(e.amount).toLocaleString()}`,
    '7.5%',
    `₦${Number(e.vat_amount).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: y,
    head: [['Date', 'VAT Type', 'Description', 'Project', 'Taxable Amount', 'Rate', 'VAT Amount']],
    body: rows,
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold', textColor: RED },
    },
    foot: [[
      '', '', '', 'TOTALS',
      `₦${entries.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}`,
      '',
      `₦${netVAT.toLocaleString()}`,
    ]],
    footStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold' },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = data.cell.raw === 'Output VAT' ? RED : DARK
        data.cell.styles.fontStyle = 'bold'
      }
    },
    ...tableStyle(),
  })

  // FIRS filing note
  const fy = doc.lastAutoTable.finalY + 8
  if (fy < pageH - 50) {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(14, fy, pageW - 28, 20, 2, 2, 'F')
    doc.setFillColor(...RED)
    doc.roundedRect(14, fy, 4, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    doc.text('Filing Note:', 22, fy + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text('VAT returns are due by the 21st of the following month. File with FIRS via TaxPro Max.', 22, fy + 13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...RED)
    doc.text(`Net VAT Payable: ₦${netVAT.toLocaleString()}`, pageW - 18, fy + 13, { align: 'right' })
  }

  addContinuationHeaders(doc, logo, 'VAT Return', pageW, co)
  addFooters(doc, pageW, pageH, co)
  doc.save(`vat-return-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// PAYROLL PDF
// ═══════════════════════════════════════════════════════════════
export async function exportPayrollPDF(payroll, month, company) {
  const co    = resolveCompany(company)
  const doc   = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64(co.logo_url)

  const totalGross = payroll.reduce((s, p) => s + Number(p.gross_amount), 0)
  const totalTax   = payroll.reduce((s, p) => s + Number(p.type === 'staff' ? p.monthly_paye : p.wht_amount), 0)
  const totalNet   = payroll.reduce((s, p) => s + Number(p.net_payable), 0)
  const staffCount = payroll.filter(p => p.type === 'staff').length

  const contentY = drawLetterhead(doc, logo, 'Payroll Summary', `Period: ${month}`, [
    { label: 'Period',        value: month },
    { label: 'Headcount',     value: `${staffCount} staff` },
    { label: 'Total Gross',   value: `₦${totalGross.toLocaleString()}` },
    { label: 'Total Tax/WHT', value: `₦${totalTax.toLocaleString()}` },
    { label: 'Net Payable',   value: `₦${totalNet.toLocaleString()}` },
  ], pageW, pageH, co)

  let y = sectionLabel(doc, contentY, 'Payroll Register')

  const rows = payroll.map(p => [
    p.name ?? '',
    p.type === 'staff' ? 'Staff (PAYE)' : 'Consultant (WHT)',
    p.type === 'staff' ? `${(p.paye_rate * 100 || 0).toFixed(0)}%` : `${(p.wht_rate * 100 || 0).toFixed(0)}%`,
    `₦${Number(p.gross_amount).toLocaleString()}`,
    p.type === 'staff'
      ? `₦${Number(p.monthly_paye).toLocaleString()}`
      : `₦${Number(p.wht_amount).toLocaleString()}`,
    `₦${Number(p.net_payable).toLocaleString()}`,
    p.remitted ? 'Remitted' : 'Pending',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Type', 'Rate', 'Gross Amount', 'Tax / WHT', 'Net Payable', 'Status']],
    body: rows,
    foot: [['', '', 'TOTALS',
      `₦${totalGross.toLocaleString()}`,
      `₦${totalTax.toLocaleString()}`,
      `₦${totalNet.toLocaleString()}`,
      '',
    ]],
    footStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right', textColor: RED },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = data.cell.raw === 'Remitted' ? [22, 163, 74] : [217, 119, 6]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    ...tableStyle(),
  })

  addContinuationHeaders(doc, logo, 'Payroll Summary', pageW, co)
  addFooters(doc, pageW, pageH, co)
  doc.save(`payroll-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// INVOICE PDF  (full professional invoice)
// ═══════════════════════════════════════════════════════════════
export async function exportInvoicePDF(invoice, company) {
  const co    = resolveCompany(company)
  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64(co.logo_url)

  // ── Page 1 letterhead ──────────────────────────────────────
  const bandH = 72
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, bandH, 'F')
  doc.setFillColor(...RED)
  doc.rect(0, 0, 6, bandH, 'F')

  // Decorative circles
  doc.setFillColor(...RED)
  doc.setGState(new doc.GState({ opacity: 0.12 }))
  doc.circle(pageW + 5, -5, 55, 'F')
  doc.circle(pageW - 20, 25, 20, 'F')
  doc.setGState(new doc.GState({ opacity: 1 }))

  // Logo
  if (logo) {
    doc.setFillColor(...WHITE)
    doc.setGState(new doc.GState({ opacity: 0.08 }))
    doc.circle(30, 36, 22, 'F')
    doc.setGState(new doc.GState({ opacity: 1 }))
    doc.addImage(logo, 'JPEG', 14, 14, 36, 36)
  }

  const hx = logo ? 58 : 14
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(co.name.toUpperCase(), hx, 26)

  doc.setDrawColor(...RED)
  doc.setLineWidth(0.5)
  doc.line(hx, 29, hx + doc.getTextWidth(co.name.toUpperCase()) + 2, 29)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 180, 180)
  doc.text(co.tagline.toUpperCase(), hx, 36)

  const contactLine = [co.address, co.phone, co.email].filter(Boolean).join('   ·   ')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text(contactLine, hx, 43)

  const regLine = [
    co.rc_number  && `RC: ${co.rc_number}`,
    co.tin        && `TIN: ${co.tin}`,
    co.vat_number && `VAT Reg: ${co.vat_number}`,
  ].filter(Boolean).join('   ·   ')
  if (regLine) {
    doc.setFontSize(6)
    doc.setTextColor(110, 110, 110)
    doc.text(regLine, hx, 50)
  }

  // INVOICE title — right
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('INVOICE', pageW - 14, 28, { align: 'right' })

  // Invoice number chip
  const invNo = invoice.invoice_number || `INV-${String(Date.now()).slice(-6)}`
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  doc.text(`No: ${invNo}`, pageW - 14, 38, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text(`Date: ${invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')}`, pageW - 14, 46, { align: 'right' })
  if (invoice.due_date) {
    doc.text(`Due: ${format(new Date(invoice.due_date), 'dd MMM yyyy')}`, pageW - 14, 53, { align: 'right' })
  }

  // ── Meta band ──────────────────────────────────────────────
  const metaY = bandH
  doc.setFillColor(240, 240, 240)
  doc.rect(0, metaY, pageW, 14, 'F')
  doc.setFillColor(...RED)
  doc.rect(0, metaY, 6, 14, 'F')

  const metaItems = [
    { label: 'Status',  value: (invoice.status ?? 'draft').toUpperCase() },
    { label: 'Project', value: invoice.projects?.name ?? '—' },
    { label: 'Ref',     value: invoice.projects?.project_number ? `#${invoice.projects.project_number}` : '—' },
    { label: 'Terms',   value: invoice.payment_terms ? invoice.payment_terms.split('.')[0] : '30 days' },
  ]
  const colW = (pageW - 20) / metaItems.length
  metaItems.forEach((item, i) => {
    const mx = 12 + i * colW
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text(item.label.toUpperCase(), mx, metaY + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...DARK)
    doc.text(item.value, mx, metaY + 11)
  })

  let contentY = metaY + 20

  // ── Bill To / Project ──────────────────────────────────────
  const halfW = (pageW - 28) / 2
  doc.setFillColor(...LIGHT)
  doc.roundedRect(14, contentY, halfW, 36, 2, 2, 'F')
  doc.setFillColor(237, 237, 237)
  doc.roundedRect(14 + halfW + 4, contentY, halfW, 36, 2, 2, 'F')

  // Bill To
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text('BILL TO', 19, contentY + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text(invoice.client_name || 'Client', 19, contentY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  if (invoice.client_address) doc.text(invoice.client_address, 19, contentY + 23)
  if (invoice.client_email)   doc.text(invoice.client_email,   19, contentY + 29)
  if (invoice.client_phone)   doc.text(invoice.client_phone,   19, contentY + 35)

  // Project details
  const px = 14 + halfW + 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text('PROJECT', px, contentY + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  if (invoice.projects?.name)            doc.text(`${invoice.projects.name}`, px, contentY + 16)
  if (invoice.projects?.location)        doc.text(`📍 ${invoice.projects.location}`, px, contentY + 23)
  if (invoice.projects?.project_number)  doc.text(`Ref: #${invoice.projects.project_number}`, px, contentY + 30)

  contentY += 42

  // ── Line items ─────────────────────────────────────────────
  let y = sectionLabel(doc, contentY, 'Invoice Items')

  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : []
  const tableRows = lineItems.length > 0 ? lineItems.map((it, idx) => [
    String(idx + 1),
    it.description ?? '',
    String(it.qty ?? 1),
    `₦${Number(it.unit_price ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    `₦${Number(it.amount ?? (it.qty * it.unit_price) ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
  ]) : [['1', invoice.projects?.name ?? 'Construction Services', '1',
    `₦${Number(invoice.total_amount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    `₦${Number(invoice.total_amount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`]]

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableRows,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { fontStyle: 'bold' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    margin: { top: 24, bottom: 26 },
    ...tableStyle(),
  })

  // ── Totals block ───────────────────────────────────────────
  const fy    = doc.lastAutoTable.finalY + 6
  const sub   = Number(invoice.subtotal      ?? invoice.total_amount ?? 0)
  const disc  = Number(invoice.discount_pct  ?? 0)
  const vat   = Number(invoice.vat_amount    ?? 0)
  const total = Number(invoice.total_amount  ?? 0)
  const paid  = Number(invoice.amount_paid   ?? 0)
  const bal   = total - paid

  const lx = pageW - 80
  const rx = pageW - 14

  const totRows = [
    ['Subtotal',                     `₦${sub.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`],
    disc > 0 ? [`Discount (${disc}%)`, `-₦${(sub * disc / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`] : null,
    [`VAT (7.5%)`,                   `₦${vat.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`],
  ].filter(Boolean)

  totRows.forEach(([label, val], i) => {
    const ry = fy + i * 9
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text(label, lx, ry)
    doc.setTextColor(...DARK)
    doc.text(val, rx, ry, { align: 'right' })
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(lx, ry + 2, rx, ry + 2)
  })

  const totalY = fy + totRows.length * 9 + 3
  doc.setFillColor(...RED)
  doc.roundedRect(lx - 4, totalY, rx - lx + 18, 15, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL DUE', lx, totalY + 10)
  doc.setFontSize(12)
  doc.text(`₦${total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, rx, totalY + 10, { align: 'right' })

  if (paid > 0) {
    const balY = totalY + 19
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(lx - 4, balY, rx - lx + 18, 12, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(22, 163, 74)
    doc.text(`Amount Paid: ₦${paid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, lx, balY + 8)
    doc.text(`Balance: ₦${bal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, rx, balY + 8, { align: 'right' })
  }

  // ── Payment instructions ───────────────────────────────────
  const piY = totalY + (paid > 0 ? 36 : 22)
  if (piY < pageH - 50) {
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(14, piY, (pageW - 28) * 0.55, 28, 2, 2, 'F')
    doc.setFillColor(...RED)
    doc.roundedRect(14, piY, 4, 28, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...DARK)
    doc.text('PAYMENT DETAILS', 22, piY + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    const bk = invoice.bank_name || co.bank_name
    const an = invoice.account_name || co.account_name
    const ac = invoice.account_number || co.account_number
    if (bk) doc.text(`Bank: ${bk}`, 22, piY + 15)
    if (an) doc.text(`Account Name: ${an}`, 22, piY + 21)
    if (ac) doc.text(`Account No: ${ac}`, 22, piY + 27)

    if (invoice.payment_terms || co.payment_terms) {
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      const terms = invoice.payment_terms || co.payment_terms
      doc.text(terms.length > 80 ? terms.slice(0, 80) + '…' : terms, 22, piY + 34)
    }
  }

  // Notes
  if (invoice.notes) {
    const nY = piY + 38
    if (nY < pageH - 40) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      doc.text(`Note: ${invoice.notes}`, 14, nY)
    }
  }

  // PAID watermark
  if (invoice.status === 'paid') {
    doc.setTextColor(22, 163, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(60)
    doc.setGState(new doc.GState({ opacity: 0.06 }))
    doc.text('PAID', pageW / 2, pageH / 2, { align: 'center', angle: 30 })
    doc.setGState(new doc.GState({ opacity: 1 }))
  }

  addContinuationHeaders(doc, logo, `Invoice ${invNo}`, pageW, co)
  addFooters(doc, pageW, pageH, co)
  doc.save(`invoice-${invNo}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// PROJECT P&L REPORT PDF
// ═══════════════════════════════════════════════════════════════
export async function exportProjectPLPDF(project, entries, company) {
  const co    = resolveCompany(company)
  const doc   = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64(co.logo_url)

  const estRev      = Number(project.estimated_revenue) || 0
  const actRev      = Number(project.actual_revenue)    || 0
  const estCost     = Number(project.estimated_cost)    || 0
  const actCost     = Number(project.actual_cost)       || 0
  const grossProfit = actRev - actCost
  const margin      = actRev > 0 ? ((grossProfit / actRev) * 100).toFixed(1) : '0.0'
  const variance    = estCost - actCost

  const contentY = drawLetterhead(doc, logo, 'P&L Report', `${project.name}  ·  ${project.client || ''}`, [
    { label: 'Project',        value: project.name },
    { label: 'Client',         value: project.client || '—' },
    { label: 'Contract Value', value: `₦${(Number(project.contract_value) || 0).toLocaleString()}` },
    { label: 'Gross Profit',   value: `₦${grossProfit.toLocaleString()}` },
    { label: 'Margin',         value: `${margin}%` },
    { label: 'Status',         value: (project.status ?? '—').toUpperCase() },
  ], pageW, pageH, co)

  let y = sectionLabel(doc, contentY, 'Revenue & Cost Analysis')

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Estimated', 'Actual', 'Variance', 'Performance']],
    body: [
      ['Revenue',
        `₦${estRev.toLocaleString()}`,
        `₦${actRev.toLocaleString()}`,
        `₦${(actRev - estRev).toLocaleString()}`,
        actRev >= estRev ? 'Above Target' : 'Below Target',
      ],
      ['Cost',
        `₦${estCost.toLocaleString()}`,
        `₦${actCost.toLocaleString()}`,
        `₦${(actCost - estCost).toLocaleString()}`,
        actCost <= estCost ? 'Under Budget' : 'Over Budget',
      ],
      ['Gross Profit',
        `₦${(estRev - estCost).toLocaleString()}`,
        `₦${grossProfit.toLocaleString()}`,
        `₦${(grossProfit - (estRev - estCost)).toLocaleString()}`,
        grossProfit >= 0 ? 'Profitable' : 'Loss-Making',
      ],
    ],
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const v = data.cell.raw
        data.cell.styles.textColor =
          v === 'Above Target' || v === 'Under Budget' || v === 'Profitable'
            ? [22, 163, 74] : RED
      }
      if (data.section === 'body' && data.column.index === 3) {
        const num = parseFloat(String(data.cell.raw).replace(/[^0-9.-]/g, ''))
        if (!isNaN(num)) data.cell.styles.textColor = num >= 0 ? [22, 163, 74] : RED
      }
    },
    ...tableStyle(),
  })

  if (entries && entries.length > 0) {
    y = sectionLabel(doc, doc.lastAutoTable.finalY + 10, 'Linked Journal Entries')
    const jRows     = entries.map(e => [
      format(new Date(e.date), 'dd/MM/yyyy'),
      e.type === 'receipt' ? 'Receipt' : 'Payment',
      e.description ?? '',
      e.category ?? '',
      `₦${Number(e.amount).toLocaleString()}`,
    ])
    const totalIn  = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
    const totalOut = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Description', 'Category', 'Amount']],
      body: jRows,
      foot: [['', '', '', 'Net Cash Flow', `₦${(totalIn - totalOut).toLocaleString()}`]],
      footStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'Receipt' ? [22, 163, 74] : RED
          data.cell.styles.fontStyle = 'bold'
        }
      },
      ...tableStyle(),
    })
  }

  addContinuationHeaders(doc, logo, 'P&L Report', pageW, co)
  addFooters(doc, pageW, pageH, co)
  doc.save(`pl-report-${project.project_number || project.id}.pdf`)
}
