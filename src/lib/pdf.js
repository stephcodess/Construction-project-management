import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

// ── Brand ─────────────────────────────────────────────────────
const RED   = [204, 0, 0]
const DARK  = [28, 28, 28]
const GRAY  = [100, 100, 100]
const LIGHT = [245, 245, 245]
const WHITE = [255, 255, 255]
const LINE  = [230, 230, 230]

// ── Load logo as base64 data URL ──────────────────────────────
async function loadLogoBase64() {
  try {
    const res = await fetch('/unnamed.jpg')
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

// ── Branded page header ───────────────────────────────────────
function drawHeader(doc, logoData, docTitle, docSubtitle, pageW) {
  // Dark header band
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 38, 'F')

  // Red left accent bar
  doc.setFillColor(...RED)
  doc.rect(0, 0, 5, 38, 'F')

  // Logo
  if (logoData) {
    doc.addImage(logoData, 'JPEG', 12, 6, 26, 26)
  }

  // Company name
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('ELDESIGN CONSTRUCTION', logoData ? 44 : 12, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...RED)
  doc.text('CONSTRUCTION & PROJECT MANAGEMENT', logoData ? 44 : 12, 23)

  // Document title — right aligned
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(docTitle.toUpperCase(), pageW - 14, 16, { align: 'right' })
  if (docSubtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(200, 200, 200)
    doc.text(docSubtitle, pageW - 14, 23, { align: 'right' })
  }

  // Generated date
  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageW - 14, 34, { align: 'right' })
}

// ── Footer on every page ──────────────────────────────────────
function addFooters(doc, pageW, pageH) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 14, pageW - 14, pageH - 14)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('Eldesign Construction Ltd · Confidential', 14, pageH - 8)
    doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 8, { align: 'right' })
  }
}

// ── Shared autoTable style ────────────────────────────────────
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
  }
}

// ── Summary box ───────────────────────────────────────────────
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

// ── Section label ─────────────────────────────────────────────
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
export async function exportJournalPDF(entries, month) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64()

  drawHeader(doc, logo, 'Cash Flow Journal', `Period: ${month}`, pageW)

  // Summary row
  const receipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
  const payments  = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)
  const net = receipts - payments
  const bw = (pageW - 28) / 3
  drawSummaryBox(doc, 14,      44, bw - 3, 22, 'Total Inflow (AR)',  `N${receipts.toLocaleString()}`, DARK)
  drawSummaryBox(doc, 14 + bw, 44, bw - 3, 22, 'Total Outflow (AP)', `N${payments.toLocaleString()}`, RED)
  drawSummaryBox(doc, 14 + bw * 2, 44, bw - 3, 22, 'Net Cash',       `N${net.toLocaleString()}`, net >= 0 ? [22, 163, 74] : RED)

  let y = sectionLabel(doc, 72, 'Transaction Ledger')

  const rows = entries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Receipt' : 'Payment',
    e.description ?? '',
    e.category ?? '',
    e.projects?.name ?? e.project_name ?? '—',
    e.vat_applicable ? `N${Number(e.vat_amount).toLocaleString()}` : '—',
    `N${Number(e.amount).toLocaleString()}`,
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
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = data.cell.raw === 'Receipt' ? RED : DARK
        data.cell.styles.fontStyle = 'bold'
      }
    },
    ...tableStyle(),
  })

  addFooters(doc, pageW, pageH)
  doc.save(`cashflow-journal-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// VAT RETURN PDF
// ═══════════════════════════════════════════════════════════════
export async function exportVATPDF(entries, month) {
  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64()

  drawHeader(doc, logo, 'VAT Return', `Period: ${month}`, pageW)

  const outputVAT = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.vat_amount), 0)
  const inputVAT  = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.vat_amount), 0)
  const netVAT    = outputVAT - inputVAT
  const bw = (pageW - 28) / 3
  drawSummaryBox(doc, 14,          44, bw - 3, 22, 'Output VAT (Sales)',    `N${outputVAT.toLocaleString()}`, RED)
  drawSummaryBox(doc, 14 + bw,     44, bw - 3, 22, 'Input VAT (Purchases)', `N${inputVAT.toLocaleString()}`, DARK)
  drawSummaryBox(doc, 14 + bw * 2, 44, bw - 3, 22, 'Net VAT Payable',       `N${netVAT.toLocaleString()}`, netVAT > 0 ? RED : [22, 163, 74])

  let y = sectionLabel(doc, 72, 'VAT-Applicable Transactions')

  const rows = entries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Output VAT' : 'Input VAT',
    e.description ?? '',
    e.projects?.name ?? '—',
    `N${Number(e.amount).toLocaleString()}`,
    '7.5%',
    `N${Number(e.vat_amount).toLocaleString()}`,
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
      `N${entries.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}`,
      '',
      `N${netVAT.toLocaleString()}`,
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
  doc.setFillColor(...LIGHT)
  doc.roundedRect(14, fy, pageW - 28, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text('Filing Note:', 19, fy + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(`VAT returns are due by the 21st of the following month. File with FIRS via TaxPro Max.`, 42, fy + 6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...RED)
  doc.text(`Net VAT Payable: N${netVAT.toLocaleString()}`, 19, fy + 11)

  addFooters(doc, pageW, pageH)
  doc.save(`vat-return-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// PAYROLL PDF
// ═══════════════════════════════════════════════════════════════
export async function exportPayrollPDF(payroll, month) {
  const doc   = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64()

  drawHeader(doc, logo, 'Payroll Summary', `Period: ${month}`, pageW)

  const totalGross = payroll.reduce((s, p) => s + Number(p.gross_amount), 0)
  const totalTax   = payroll.reduce((s, p) => s + Number(p.type === 'staff' ? p.monthly_paye : p.wht_amount), 0)
  const totalNet   = payroll.reduce((s, p) => s + Number(p.net_payable), 0)
  const staffCount = payroll.filter(p => p.type === 'staff').length
  const bw = (pageW - 28) / 4
  drawSummaryBox(doc, 14,           44, bw - 3, 22, 'Total Gross',      `N${totalGross.toLocaleString()}`, DARK)
  drawSummaryBox(doc, 14 + bw,      44, bw - 3, 22, 'Total Tax / WHT',  `N${totalTax.toLocaleString()}`,  RED)
  drawSummaryBox(doc, 14 + bw * 2,  44, bw - 3, 22, 'Total Net Payable',`N${totalNet.toLocaleString()}`,  [22, 163, 74])
  drawSummaryBox(doc, 14 + bw * 3,  44, bw - 3, 22, 'Headcount',        `${staffCount} staff`, LIGHT)

  let y = sectionLabel(doc, 72, 'Payroll Register')

  const rows = payroll.map(p => [
    p.name ?? '',
    p.type === 'staff' ? 'Staff (PAYE)' : `Consultant (WHT)`,
    p.type === 'staff' ? `${(p.paye_rate * 100 || 0).toFixed(0)}%` : `${(p.wht_rate * 100 || 0).toFixed(0)}%`,
    `N${Number(p.gross_amount).toLocaleString()}`,
    p.type === 'staff'
      ? `N${Number(p.monthly_paye).toLocaleString()}`
      : `N${Number(p.wht_amount).toLocaleString()}`,
    `N${Number(p.net_payable).toLocaleString()}`,
    p.remitted ? 'Remitted' : 'Pending',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Type', 'Rate', 'Gross Amount', 'Tax / WHT', 'Net Payable', 'Status']],
    body: rows,
    foot: [['', '', 'TOTALS',
      `N${totalGross.toLocaleString()}`,
      `N${totalTax.toLocaleString()}`,
      `N${totalNet.toLocaleString()}`,
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

  addFooters(doc, pageW, pageH)
  doc.save(`payroll-${month}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// INVOICE PDF
// ═══════════════════════════════════════════════════════════════
export async function exportInvoicePDF(project) {
  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64()

  // ── Full dark header band ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 50, 'F')
  doc.setFillColor(...RED)
  doc.rect(0, 0, 5, 50, 'F')

  if (logo) doc.addImage(logo, 'JPEG', 12, 8, 28, 28)

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ELDESIGN CONSTRUCTION', logo ? 46 : 12, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...RED)
  doc.text('CONSTRUCTION & PROJECT MANAGEMENT', logo ? 46 : 12, 27)
  doc.setTextColor(170, 170, 170)
  doc.setFontSize(7.5)
  doc.text('Lagos, Nigeria  ·  eldesignconstruction.com', logo ? 46 : 12, 34)

  // INVOICE label — top right
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('INVOICE', pageW - 14, 22, { align: 'right' })

  const invoiceNo = `INV-${project.project_number || String(Date.now()).slice(-6)}`
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 180)
  doc.text(`No: ${invoiceNo}`, pageW - 14, 30, { align: 'right' })
  doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, pageW - 14, 37, { align: 'right' })

  // ── Bill To / Project Info row ──
  const contractValue = Number(project.contract_value) || Number(project.estimated_revenue) || 0

  doc.setFillColor(...LIGHT)
  doc.rect(14, 56, 86, 38, 'F')
  doc.setFillColor(237, 237, 237)
  doc.rect(106, 56, 90, 38, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...RED)
  doc.text('BILL TO', 19, 64)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(project.client || 'Client Name', 19, 72)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Nigeria', 19, 79)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...RED)
  doc.text('PROJECT DETAILS', 111, 64)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text(`Project:  ${project.name || '—'}`, 111, 71)
  doc.text(`Ref:      ${project.project_number || '—'}`, 111, 78)
  doc.text(`Location: ${project.location || '—'}`, 111, 85)

  // ── Line items table ──
  let y = sectionLabel(doc, 102, 'Invoice Items')

  const items = [
    [
      '1',
      `Construction Services — ${project.name || 'Project'}`,
      project.description ? project.description.slice(0, 80) : 'As per contract agreement',
      '1',
      `N${contractValue.toLocaleString()}`,
      `N${contractValue.toLocaleString()}`,
    ],
  ]

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'Description', 'Qty', 'Unit Price', 'Amount']],
    body: items,
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 62, textColor: GRAY },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    ...tableStyle(),
  })

  // ── Totals block ──
  const fy = doc.lastAutoTable.finalY + 6
  const vatAmt   = contractValue * 0.075
  const grossAmt = contractValue + vatAmt

  // right-aligned totals
  const tx = pageW - 14
  const lx = pageW - 75

  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)

  const rows2 = [
    ['Subtotal',   `N${contractValue.toLocaleString()}`],
    ['VAT (7.5%)', `N${vatAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
  ]
  rows2.forEach(([label, val], i) => {
    const ry = fy + i * 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text(label, lx, ry)
    doc.setTextColor(...DARK)
    doc.text(val, tx, ry, { align: 'right' })
  })

  // Total due — prominent box
  const totalY = fy + rows2.length * 8 + 2
  doc.setFillColor(...RED)
  doc.roundedRect(lx - 5, totalY, tx - lx + 19, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL DUE', lx, totalY + 9)
  doc.setFontSize(11)
  doc.text(`N${grossAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, tx, totalY + 9, { align: 'right' })

  // ── Payment instructions ──
  const piY = totalY + 22
  doc.setFillColor(...LIGHT)
  doc.roundedRect(14, piY, pageW - 28, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text('Payment Instructions', 19, piY + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.setFontSize(7.5)
  doc.text('Bank: First Bank of Nigeria  ·  Account Name: Eldesign Construction Ltd', 19, piY + 13)
  doc.text('Payment due within 30 days of invoice date. Quote invoice number on all payments.', 19, piY + 19)

  // ── Status watermark if completed ──
  if (project.status === 'completed') {
    doc.setTextColor(22, 163, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(48)
    doc.setGState(new doc.GState({ opacity: 0.07 }))
    doc.text('PAID', pageW / 2, pageH / 2, { align: 'center', angle: 30 })
    doc.setGState(new doc.GState({ opacity: 1 }))
  }

  addFooters(doc, pageW, pageH)
  doc.save(`invoice-${invoiceNo}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// PROJECT P&L REPORT PDF
// ═══════════════════════════════════════════════════════════════
export async function exportProjectPLPDF(project, entries) {
  const doc   = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logo  = await loadLogoBase64()

  drawHeader(doc, logo, 'Project P&L Report', `${project.name} · ${project.client || ''}`, pageW)

  const estRev  = Number(project.estimated_revenue)  || 0
  const actRev  = Number(project.actual_revenue)      || 0
  const estCost = Number(project.estimated_cost)      || 0
  const actCost = Number(project.actual_cost)         || 0
  const grossProfit = actRev - actCost
  const margin = actRev > 0 ? ((grossProfit / actRev) * 100).toFixed(1) : '0.0'
  const variance = estCost - actCost

  const bw = (pageW - 28) / 4
  drawSummaryBox(doc, 14,          44, bw - 3, 22, 'Contract Value',  `N${(Number(project.contract_value)||0).toLocaleString()}`, DARK)
  drawSummaryBox(doc, 14 + bw,     44, bw - 3, 22, 'Gross Profit',    `N${grossProfit.toLocaleString()}`, grossProfit >= 0 ? [22, 163, 74] : RED)
  drawSummaryBox(doc, 14 + bw * 2, 44, bw - 3, 22, 'Profit Margin',   `${margin}%`, LIGHT)
  drawSummaryBox(doc, 14 + bw * 3, 44, bw - 3, 22, 'Budget Variance', `N${variance.toLocaleString()}`, variance >= 0 ? [22, 163, 74] : RED)

  // Revenue vs Cost comparison table
  let y = sectionLabel(doc, 72, 'Revenue & Cost Analysis')
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Estimated', 'Actual', 'Variance', 'Performance']],
    body: [
      ['Revenue',
        `N${estRev.toLocaleString()}`,
        `N${actRev.toLocaleString()}`,
        `N${(actRev - estRev).toLocaleString()}`,
        actRev >= estRev ? 'Above Target' : 'Below Target',
      ],
      ['Cost',
        `N${estCost.toLocaleString()}`,
        `N${actCost.toLocaleString()}`,
        `N${(actCost - estCost).toLocaleString()}`,
        actCost <= estCost ? 'Under Budget' : 'Over Budget',
      ],
      ['Gross Profit',
        `N${(estRev - estCost).toLocaleString()}`,
        `N${grossProfit.toLocaleString()}`,
        `N${(grossProfit - (estRev - estCost)).toLocaleString()}`,
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
        const num = parseFloat(data.cell.raw.replace(/[^0-9.-]/g, ''))
        if (!isNaN(num)) data.cell.styles.textColor = num >= 0 ? [22, 163, 74] : RED
      }
    },
    ...tableStyle(),
  })

  // Journal entries
  if (entries && entries.length > 0) {
    y = sectionLabel(doc, doc.lastAutoTable.finalY + 10, 'Linked Journal Entries')
    const jRows = entries.map(e => [
      format(new Date(e.date), 'dd/MM/yyyy'),
      e.type === 'receipt' ? 'Receipt' : 'Payment',
      e.description ?? '',
      e.category ?? '',
      `N${Number(e.amount).toLocaleString()}`,
    ])
    const totalIn  = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + Number(e.amount), 0)
    const totalOut = entries.filter(e => e.type === 'payment').reduce((s, e) => s + Number(e.amount), 0)

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Description', 'Category', 'Amount']],
      body: jRows,
      foot: [['', '', '', 'Net Cash Flow', `N${(totalIn - totalOut).toLocaleString()}`]],
      footStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'Receipt' ? [22, 163, 74] : RED
          data.cell.styles.fontStyle = 'bold'
        }
      },
      ...tableStyle(),
    })
  }

  addFooters(doc, pageW, pageH)
  doc.save(`pl-report-${project.project_number || project.id}.pdf`)
}
