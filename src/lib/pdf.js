import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

function addHeader(doc, title, subtitle = '') {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ELDESIGN CONSTRUCTION', 14, 20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 28)
  if (subtitle) doc.text(subtitle, 14, 35)
  doc.setLineWidth(0.5)
  doc.line(14, 38, 196, 38)
}

export function exportJournalPDF(entries, month) {
  const doc = new jsPDF()
  addHeader(doc, 'Receipts & Payments Journal', `Period: ${month}`)

  const rows = entries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Receipt' : 'Payment',
    e.description,
    e.category,
    e.project_name ?? '-',
    e.vat_applicable ? `₦${Number(e.vat_amount).toLocaleString()}` : '-',
    `₦${Number(e.amount).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: 42,
    head: [['Date', 'Type', 'Description', 'Category', 'Project', 'VAT', 'Amount']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  })

  doc.save(`journal-${month}.pdf`)
}

export function exportVATPDF(entries, month) {
  const doc = new jsPDF()
  addHeader(doc, 'Monthly VAT Return', `Period: ${month}`)

  const vatEntries = entries.filter(e => e.vat_applicable)
  const totalVat = vatEntries.reduce((s, e) => s + Number(e.vat_amount), 0)
  const totalTaxable = vatEntries.reduce((s, e) => s + Number(e.amount), 0)

  const rows = vatEntries.map(e => [
    format(new Date(e.date), 'dd/MM/yyyy'),
    e.type === 'receipt' ? 'Output VAT' : 'Input VAT',
    e.description,
    `₦${Number(e.amount).toLocaleString()}`,
    '7.5%',
    `₦${Number(e.vat_amount).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: 42,
    head: [['Date', 'VAT Type', 'Description', 'Taxable Amount', 'Rate', 'VAT Amount']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  })

  const finalY = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Taxable Amount: ₦${totalTaxable.toLocaleString()}`, 14, finalY)
  doc.text(`Total VAT: ₦${totalVat.toLocaleString()}`, 14, finalY + 8)

  doc.save(`vat-return-${month}.pdf`)
}

export function exportPayrollPDF(payroll, month) {
  const doc = new jsPDF()
  addHeader(doc, 'Payroll Summary', `Period: ${month}`)

  const rows = payroll.map(p => [
    p.name,
    p.type === 'staff' ? 'Staff (PAYE)' : `Consultant (WHT ${p.wht_rate * 100}%)`,
    `₦${Number(p.gross_amount).toLocaleString()}`,
    p.type === 'staff'
      ? `₦${Number(p.monthly_paye).toLocaleString()}`
      : `₦${Number(p.wht_amount).toLocaleString()}`,
    `₦${Number(p.net_payable).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: 42,
    head: [['Name', 'Type', 'Gross', 'Tax/WHT', 'Net Payable']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  })

  const totalNet = payroll.reduce((s, p) => s + Number(p.net_payable), 0)
  const totalTax = payroll.reduce((s, p) => s + Number(p.type === 'staff' ? p.monthly_paye : p.wht_amount), 0)
  const finalY = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Tax/WHT Deducted: ₦${totalTax.toLocaleString()}`, 14, finalY)
  doc.text(`Total Net Payable: ₦${totalNet.toLocaleString()}`, 14, finalY + 8)

  doc.save(`payroll-${month}.pdf`)
}
