/**
 * Invoice PDF Generator
 * Generates a professional, Zopkit-branded invoice PDF using jsPDF.
 */

import jsPDF from 'jspdf'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoicePayment {
  id: string
  type?: string | null
  status?: string | null
  description?: string | null
  amount: number
  paidAt?: string | Date | null
  createdAt?: string | Date | null
  invoiceNumber?: string | null
  paymentMethod?: string | null
  paymentMethodDetails?: { card?: { last4?: string; brand?: string } } | null
  creditsPurchased?: number | null
  unitPrice?: number | null
  taxAmount?: number | null
  processingFees?: number | null
  netAmount?: number | null
  planDisplayName?: string | null
  billingCycle?: string | null
  expiryDate?: string | Date | null
  stripePaymentIntentId?: string | null
  stripeInvoiceId?: string | null
  currency?: string | null
  [key: string]: unknown
}

export interface InvoiceCustomer {
  name: string
  email: string
  companyName?: string
}

// ─── Color palette ────────────────────────────────────────────────────────────

const C = {
  navy: [27, 46, 90] as [number, number, number],
  navyMid: [36, 61, 115] as [number, number, number],
  navyLight: [235, 240, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [15, 23, 42] as [number, number, number],
  textGray: [100, 116, 139] as [number, number, number],
  textDark: [30, 41, 59] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  greenLight: [209, 250, 229] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setColor(doc: jsPDF, rgb: [number, number, number], fill = true) {
  if (fill) doc.setFillColor(...rgb)
  else doc.setTextColor(...rgb)
  doc.setDrawColor(...rgb)
}

function drawRoundedRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: boolean,
  stroke = false
) {
  const method = fill && stroke ? 'FD' : fill ? 'F' : 'D'
  doc.roundedRect(x, y, w, h, r, r, method)
}

function getPaymentTypeLabel(type?: string | null): string {
  switch (type) {
    case 'credit_purchase': return 'Credit Purchase'
    case 'subscription': return 'Subscription'
    case 'plan_upgrade': return 'Plan Upgrade'
    default: return type ? type.replace(/_/g, ' ') : 'Payment'
  }
}

function getStatusConfig(status?: string | null) {
  switch (status) {
    case 'succeeded': return { label: 'PAID', color: C.green, bg: C.greenLight }
    case 'failed': return { label: 'FAILED', color: C.red, bg: [254, 226, 226] as [number, number, number] }
    case 'refunded': return { label: 'REFUNDED', color: C.orange, bg: [255, 237, 213] as [number, number, number] }
    case 'canceled': return { label: 'CANCELED', color: C.textGray, bg: C.border }
    default: return { label: 'PENDING', color: C.amber, bg: [254, 243, 199] as [number, number, number] }
  }
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export function generateInvoicePDF(payment: InvoicePayment, customer: InvoiceCustomer): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const marginL = 18
  const marginR = pageW - 18
  const contentW = marginR - marginL

  const invoiceRef = payment.invoiceNumber
    ? `INV-${payment.invoiceNumber}`
    : `INV-${payment.id.slice(0, 8).toUpperCase()}`

  const toStr = (v: unknown): string => (v == null ? '' : String(v))
  const issueDate = formatDate(toStr(payment.createdAt || payment.paidAt))
  const paidDate = payment.paidAt ? formatDate(toStr(payment.paidAt)) : issueDate
  const statusCfg = getStatusConfig(payment.status)

  let y = 0

  // ── 1. Header band ─────────────────────────────────────────────────────────

  setColor(doc, C.navy)
  doc.rect(0, 0, pageW, 48, 'F')

  // Z logo box
  setColor(doc, C.navyMid)
  drawRoundedRect(doc, marginL, 9, 18, 18, 3, true)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  setColor(doc, C.white, false)
  doc.text('Z', marginL + 9, 21.5, { align: 'center' })

  // "ZOPKIT" wordmark
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.white, false)
  doc.text('ZOPKIT', marginL + 22, 21)

  // Tagline
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(147, 174, 224)
  doc.text('Enterprise SaaS Platform', marginL + 22, 26.5)

  // "INVOICE" label (right side)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.white, false)
  doc.text('INVOICE', marginR, 19, { align: 'right' })

  // Invoice number under it
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(147, 174, 224)
  doc.text(invoiceRef, marginR, 26.5, { align: 'right' })

  // Status pill
  const statusPillW = 28
  const statusPillX = marginR - statusPillW
  setColor(doc, statusCfg.bg)
  drawRoundedRect(doc, statusPillX, 31, statusPillW, 9, 2, true)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  setColor(doc, statusCfg.color, false)
  doc.text(statusCfg.label, statusPillX + statusPillW / 2, 36.8, { align: 'center' })

  y = 55

  // ── 2. Metadata row ─────────────────────────────────────────────────────────

  const metaCols = [
    { label: 'Invoice Number', value: invoiceRef },
    { label: 'Issue Date', value: issueDate },
    { label: 'Payment Date', value: paidDate },
    { label: 'Currency', value: (payment.currency || 'USD').toUpperCase() },
  ]

  const metaW = contentW / metaCols.length
  metaCols.forEach((col, i) => {
    const x = marginL + i * metaW
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    setColor(doc, C.textGray, false)
    doc.text(col.label.toUpperCase(), x, y)
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    setColor(doc, C.textDark, false)
    doc.text(col.value, x, y + 6)
  })

  y += 18

  // Divider
  setColor(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(marginL, y, marginR, y)

  y += 10

  // ── 3. Bill From / Bill To ───────────────────────────────────────────────────

  const halfW = (contentW - 10) / 2
  const colR = marginL + halfW + 10

  // Bill From
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.navy, false)
  doc.text('BILL FROM', marginL, y)
  y += 5
  doc.setFontSize(10)
  setColor(doc, C.textDark, false)
  doc.text('Zopkit Technologies', marginL, y)
  y += 5.5
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  setColor(doc, C.textGray, false)
  doc.text('support@zopkit.com', marginL, y)
  y += 4.5
  doc.text('www.zopkit.com', marginL, y)
  y += 4.5
  doc.text('Enterprise SaaS Platform', marginL, y)

  // Bill To (right column)
  const billToY = y - 19.5
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.navy, false)
  doc.text('BILL TO', colR, billToY)

  doc.setFontSize(10)
  setColor(doc, C.textDark, false)
  doc.text(customer.name || 'Customer', colR, billToY + 5)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  setColor(doc, C.textGray, false)
  doc.text(customer.email || '', colR, billToY + 10.5)

  if (customer.companyName) {
    doc.text(customer.companyName, colR, billToY + 15)
  }

  y += 14

  // Divider
  setColor(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(marginL, y, marginR, y)

  y += 10

  // ── 4. Line items table ───────────────────────────────────────────────────────

  // Table header
  setColor(doc, C.navy)
  doc.rect(marginL, y, contentW, 9, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.white, false)
  doc.text('DESCRIPTION', marginL + 3, y + 6)
  doc.text('TYPE', marginL + 90, y + 6)
  doc.text('QTY', marginL + 120, y + 6)
  doc.text('UNIT PRICE', marginL + 135, y + 6)
  doc.text('AMOUNT', marginR - 3, y + 6, { align: 'right' })

  y += 9

  // Build line items
  const items: Array<{ desc: string; type: string; qty: number; unit: number; amount: number }> = []

  if (payment.type === 'credit_purchase' && payment.creditsPurchased) {
    items.push({
      desc: `Credit Package (${payment.creditsPurchased.toLocaleString()} credits)`,
      type: 'Credit Purchase',
      qty: 1,
      unit: payment.netAmount || payment.amount,
      amount: payment.netAmount || payment.amount,
    })
  } else if (payment.type === 'plan_upgrade' || payment.type === 'subscription') {
    const planName = payment.planDisplayName || 'Subscription Plan'
    const cycle = payment.billingCycle === 'yearly' ? 'Annual' : 'Monthly'
    items.push({
      desc: `${planName} — ${cycle}`,
      type: 'Subscription',
      qty: 1,
      unit: payment.netAmount || payment.amount,
      amount: payment.netAmount || payment.amount,
    })
  } else {
    items.push({
      desc: toStr(payment.description) || getPaymentTypeLabel(payment.type),
      type: getPaymentTypeLabel(payment.type),
      qty: 1,
      unit: payment.netAmount || payment.amount,
      amount: payment.netAmount || payment.amount,
    })
  }

  items.forEach((item, i) => {
    if (i % 2 === 0) {
      setColor(doc, C.rowAlt)
      doc.rect(marginL, y, contentW, 10, 'F')
    }
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    setColor(doc, C.textDark, false)
    doc.text(item.desc, marginL + 3, y + 6.5)
    doc.setFontSize(7.5)
    setColor(doc, C.textGray, false)
    doc.text(item.type, marginL + 90, y + 6.5)
    doc.text(String(item.qty), marginL + 120 + 5, y + 6.5, { align: 'center' })
    doc.text(formatCurrency(item.unit), marginL + 155, y + 6.5, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    setColor(doc, C.textDark, false)
    doc.text(formatCurrency(item.amount), marginR - 3, y + 6.5, { align: 'right' })
    y += 10
  })

  // Credit expiry note (if applicable)
  if (payment.type === 'credit_purchase' && payment.expiryDate) {
    setColor(doc, C.textGray, false)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`* Credits expire on ${formatDate(payment.expiryDate as string)}`, marginL + 3, y + 5)
    y += 8
  }

  y += 4

  // ── 5. Totals ─────────────────────────────────────────────────────────────────

  const totalsX = marginR - 70
  const totalsW = 70

  // Subtotal
  const subtotal = payment.netAmount || payment.amount
  setColor(doc, C.textGray, false)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal', totalsX, y)
  setColor(doc, C.textDark, false)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(subtotal), marginR - 3, y, { align: 'right' })
  y += 6

  if ((payment.taxAmount ?? 0) > 0) {
    setColor(doc, C.textGray, false)
    doc.setFont('helvetica', 'normal')
    doc.text('Tax', totalsX, y)
    setColor(doc, C.textDark, false)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(payment.taxAmount ?? 0), marginR - 3, y, { align: 'right' })
    y += 6
  }

  if ((payment.processingFees ?? 0) > 0) {
    setColor(doc, C.textGray, false)
    doc.setFont('helvetica', 'normal')
    doc.text('Processing Fees', totalsX, y)
    setColor(doc, C.textDark, false)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(payment.processingFees ?? 0), marginR - 3, y, { align: 'right' })
    y += 6
  }

  // Total row (highlighted)
  y += 2
  setColor(doc, C.navyLight)
  drawRoundedRect(doc, totalsX - 4, y - 3, totalsW + 4, 12, 2, true)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.navy, false)
  doc.text('Total', totalsX, y + 5)
  doc.setFontSize(12)
  doc.text(formatCurrency(payment.amount), marginR - 3, y + 5.5, { align: 'right' })

  y += 18

  // ── 6. Payment Details ────────────────────────────────────────────────────────

  setColor(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(marginL, y, marginR, y)
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.navy, false)
  doc.text('PAYMENT DETAILS', marginL, y)
  y += 7

  const payDetailCols = [
    {
      label: 'Payment Method',
      value: payment.paymentMethodDetails?.card
        ? `${payment.paymentMethodDetails.card.brand?.toUpperCase()} •••• ${payment.paymentMethodDetails.card.last4}`
        : (payment.paymentMethod
          ? String(payment.paymentMethod).charAt(0).toUpperCase() + String(payment.paymentMethod).slice(1)
          : 'Card')
    },
    { label: 'Payment Type', value: getPaymentTypeLabel(payment.type) },
    { label: 'Transaction Date', value: paidDate },
    {
      label: 'Status',
      value: statusCfg.label
    },
  ]

  const detailColW = contentW / 2
  payDetailCols.forEach((col, i) => {
    const x = marginL + (i % 2) * detailColW
    const rowY = y + Math.floor(i / 2) * 12
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    setColor(doc, C.textGray, false)
    doc.text(col.label.toUpperCase(), x, rowY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    setColor(doc, C.textDark, false)
    doc.text(col.value, x, rowY + 5.5)
  })

  y += 24

  // Transaction IDs (if available)
  if (payment.stripePaymentIntentId) {
    setColor(doc, C.border)
    doc.setLineWidth(0.2)
    doc.rect(marginL, y, contentW, payment.stripeInvoiceId ? 17 : 10, 'D')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    setColor(doc, C.textGray, false)
    doc.text('TRANSACTION REFERENCE', marginL + 3, y + 4)
    doc.setFont('helvetica', 'bold')
    setColor(doc, C.textDark, false)
    doc.setFontSize(7.5)
    doc.text(payment.stripePaymentIntentId, marginL + 50, y + 4)

    if (payment.stripeInvoiceId) {
      setColor(doc, C.textGray, false)
      doc.setFont('helvetica', 'normal')
      doc.text('STRIPE INVOICE ID', marginL + 3, y + 12)
      doc.setFont('helvetica', 'bold')
      setColor(doc, C.textDark, false)
      doc.text(payment.stripeInvoiceId, marginL + 50, y + 12)
    }

    y += payment.stripeInvoiceId ? 22 : 15
  }

  // ── 7. Footer ─────────────────────────────────────────────────────────────────

  const footerY = pageH - 30

  setColor(doc, C.navy)
  doc.rect(0, footerY, pageW, 30, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  setColor(doc, C.white, false)
  doc.text('Thank you for your business!', pageW / 2, footerY + 9, { align: 'center' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(147, 174, 224)
  doc.text(
    'For support or billing enquiries: support@zopkit.com  |  www.zopkit.com',
    pageW / 2, footerY + 16, { align: 'center' }
  )

  doc.setFontSize(6.5)
  doc.setTextColor(100, 130, 180)
  doc.text(
    'This is a computer-generated invoice and does not require a physical signature.',
    pageW / 2, footerY + 23, { align: 'center' }
  )

  // ── Save ──────────────────────────────────────────────────────────────────────

  const filename = `Zopkit-Invoice-${invoiceRef}.pdf`
  doc.save(filename)
}
