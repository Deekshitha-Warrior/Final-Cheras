import { jsPDF } from 'jspdf'
import { BRAND_ADDRESS, BRAND_EN, BRAND_PHONE_DISPLAY, BRAND_PRIMARY_PHONE_DISPLAY, BRAND_GSTIN } from './brand'
import { LOGO_BASE64 } from './logoBase64'
import { formatCurrency } from './retail'
import { formatPaymentLabel } from './payments'
import type { AdvanceOrder } from '../services/advanceOrderService'
import { formatPhoneDisplay } from './phone'
import { printHtmlDocument } from './printHtml'

const esc = (value: string) =>
  value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))

// jsPDF's built-in Helvetica font does not include the ₹ Unicode glyph (U+20B9).
// Using the Intl formatter directly causes the ₹ character to render as "1" or a
// replacement box in PDF viewers. This PDF-safe formatter outputs "Rs." instead.
const pdfMoney = (value: number): string => {
  const formatted = formatCurrency(value)
  return formatted.replace(/^[₹\u20b9]\s*/, 'Rs. ')
}

export function advanceReceiptPdf(order: AdvanceOrder) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor('#111111')
  doc.rect(0, 0, 210, 5, 'F')
  try {
    doc.addImage(LOGO_BASE64, 'PNG', 16, 9, 16, 16)
  } catch (_err) {
    /* ignore missing logo */
  }
  doc.setTextColor('#111111')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(BRAND_EN.toUpperCase(), 38, 20)
  doc.setTextColor('#6B7280')
  doc.setFontSize(8)
  doc.text('ADVANCE RECEIPT - NOT A TAX INVOICE', 38, 26)

  doc.setFont('helvetica', 'normal')
  doc.text(BRAND_ADDRESS, 194, 20, { align: 'right', maxWidth: 76 })
  doc.text(`GSTIN: ${BRAND_GSTIN}  |  Ph: ${BRAND_PRIMARY_PHONE_DISPLAY}`, 194, 30, { align: 'right' })
  doc.setDrawColor('#B8B8B8')
  doc.line(16, 38, 194, 38)
  doc.setTextColor('#1F1F1F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(order.deposit_id, 16, 48)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#6B7280')
  doc.text(`Created: ${new Date(order.created_at).toLocaleString('en-IN')}`, 194, 48, { align: 'right' })

  const deliveryFormatted = order.expected_delivery_date
    ? new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN')
    : '-'

  const rows = [
    ['Customer', order.customer_name],
    ['Phone', formatPhoneDisplay(order.phone)],
    ['Address', order.address || '-'],
    ['Product', order.product_name],
    ['Category', order.category || '-'],
    ['Expected delivery', deliveryFormatted],
  ]
  let y = 60
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#6B7280')
    doc.text(label.toUpperCase(), 16, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#1F1F1F')
    doc.text(String(value), 64, y, { maxWidth: 126 })
    y += 8
  })

  // Financial breakdown calculation
  const subtotal = Number(order.subtotal ?? (
    order.products && order.products.length > 0
      ? order.products.reduce((acc, p) => acc + (Number(p.quantity ?? p.qty ?? 1) * Number(p.base_price ?? p.price ?? 0)), 0)
      : order.total_amount
  )) || order.total_amount

  const deliveryCharge = Number(order.delivery_charge || 0)
  const couponDiscount = Number(order.coupon_discount || (order.coupon_code ? order.discount_amount : 0) || 0)
  const manualDiscount = Number(order.manual_discount || (!order.coupon_code && !order.coupon_discount ? order.discount_amount : 0) || 0)

  let totalGst = Number(order.total_gst || 0)
  let cgstAmount = Number(order.cgst_amount || 0)
  let sgstAmount = Number(order.sgst_amount || 0)
  let gstRate = Number(order.gst_rate || 0)

  if (totalGst === 0 && cgstAmount === 0 && sgstAmount === 0) {
    const diff = Math.round((order.total_amount - (subtotal + deliveryCharge - couponDiscount - manualDiscount)) * 100) / 100
    if (diff > 0) {
      totalGst = diff
      cgstAmount = Math.round((diff / 2) * 100) / 100
      sgstAmount = Math.round((diff / 2) * 100) / 100
      const baseForGst = Math.max(1, subtotal - couponDiscount - manualDiscount)
      gstRate = Math.round((totalGst / baseForGst) * 10000) / 100
    }
  } else if (totalGst > 0 && cgstAmount === 0 && sgstAmount === 0) {
    cgstAmount = Math.round((totalGst / 2) * 100) / 100
    sgstAmount = Math.round((totalGst / 2) * 100) / 100
  }

  const cgstRate = gstRate > 0 ? (gstRate / 2).toFixed(gstRate % 2 === 0 ? 1 : 2).replace(/\.0$/, '') : '2.5'
  const sgstRate = gstRate > 0 ? (gstRate / 2).toFixed(gstRate % 2 === 0 ? 1 : 2).replace(/\.0$/, '') : '2.5'

  const moneyRows: Array<{ label: string; value: string; isBold?: boolean; isHighlight?: boolean }> = [
    { label: 'Subtotal', value: pdfMoney(subtotal) },
  ]
  if (couponDiscount > 0) {
    moneyRows.push({ label: `Coupon Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, value: `-${pdfMoney(couponDiscount)}` })
  }
  if (manualDiscount > 0) {
    moneyRows.push({ label: 'Manual Discount', value: `-${pdfMoney(manualDiscount)}` })
  }
  if (cgstAmount > 0) {
    moneyRows.push({ label: `CGST (${cgstRate}%)`, value: `+${pdfMoney(cgstAmount)}` })
  }
  if (sgstAmount > 0) {
    moneyRows.push({ label: `SGST (${sgstRate}%)`, value: `+${pdfMoney(sgstAmount)}` })
  }
  if (deliveryCharge > 0) {
    moneyRows.push({ label: 'Delivery Charges', value: `+${pdfMoney(deliveryCharge)}` })
  }
  moneyRows.push(
    { label: 'Total Amount', value: pdfMoney(order.total_amount), isBold: true },
    { label: 'Deposit Paid', value: pdfMoney(order.deposit_amount) },
    { label: 'Balance Due', value: pdfMoney(order.remaining_balance), isBold: true, isHighlight: true }
  )

  y += 4
  const boxHeight = 12 + moneyRows.length * 8.5
  doc.setFillColor('#FBFAF6')
  doc.roundedRect(16, y, 178, boxHeight, 3, 3, 'F')

  moneyRows.forEach((row, index) => {
    const rowY = y + 8 + index * 8.5
    doc.setFont('helvetica', row.isBold ? 'bold' : 'normal')
    doc.setFontSize(row.isHighlight ? 11 : 9.5)
    doc.setTextColor(row.isHighlight ? '#B48811' : row.isBold ? '#111111' : '#4B5563')
    doc.text(row.label, 22, rowY)
    doc.text(row.value, 188, rowY, { align: 'right' })
  })

  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#b45309')
  doc.setFontSize(9)
  doc.text('ADVANCE PAYMENT ONLY — NOT A FINAL INVOICE', 105, y + boxHeight + 12, { align: 'center' })

  return new File([doc.output('blob')], `Advance-Receipt-${order.deposit_id}.pdf`, { type: 'application/pdf' })
}

export function printAdvanceReceipt(order: AdvanceOrder) {
  try {
    const paymentLabel = order.final_payment_method
      ? (order.final_payment_method === 'upi' ? 'UPI / QR' : order.final_payment_method === 'split' ? formatPaymentLabel('split', order.split_details) : order.final_payment_method.toUpperCase())
      : ''
    const depositPayment = paymentLabel || 'Cash'

    const dateStr = (() => {
      try {
        return new Date(order.created_at).toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } catch {
        return new Date(order.created_at).toLocaleDateString('en-IN')
      }
    })()

    const deliveryDateFormatted = (() => {
      try {
        if (!order.expected_delivery_date) return '-'
        return new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN')
      } catch {
        return order.expected_delivery_date || '-'
      }
    })()

    const formatCustomerPhone = (phone?: string): string => {
      if (!phone) return ''
      const trimmed = phone.trim()
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length === 12 && digits.startsWith('91')) {
        return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
      }
      if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      }
      return trimmed
    }

    // Financial breakdown calculation
    const subtotal = Number(order.subtotal ?? (
      order.products && order.products.length > 0
        ? order.products.reduce((acc, p) => acc + (Number(p.quantity ?? p.qty ?? 1) * Number(p.base_price ?? p.price ?? 0)), 0)
        : order.total_amount
    )) || order.total_amount

    const deliveryCharge = Number(order.delivery_charge || 0)
    const couponDiscount = Number(order.coupon_discount || (order.coupon_code ? order.discount_amount : 0) || 0)
    const manualDiscount = Number(order.manual_discount || (!order.coupon_code && !order.coupon_discount ? order.discount_amount : 0) || 0)

    let totalGst = Number(order.total_gst || 0)
    let cgstAmount = Number(order.cgst_amount || 0)
    let sgstAmount = Number(order.sgst_amount || 0)
    let gstRate = Number(order.gst_rate || 0)

    // Fallback: If GST amounts were not stored explicitly, derive difference between total and subtotal + delivery - discount
    if (totalGst === 0 && cgstAmount === 0 && sgstAmount === 0) {
      const diff = Math.round((order.total_amount - (subtotal + deliveryCharge - couponDiscount - manualDiscount)) * 100) / 100
      if (diff > 0) {
        totalGst = diff
        cgstAmount = Math.round((diff / 2) * 100) / 100
        sgstAmount = Math.round((diff / 2) * 100) / 100
        const baseForGst = Math.max(1, subtotal - couponDiscount - manualDiscount)
        gstRate = Math.round((totalGst / baseForGst) * 10000) / 100
      }
    } else if (totalGst > 0 && cgstAmount === 0 && sgstAmount === 0) {
      cgstAmount = Math.round((totalGst / 2) * 100) / 100
      sgstAmount = Math.round((totalGst / 2) * 100) / 100
    }

    const cgstRate = gstRate > 0 ? (gstRate / 2).toFixed(gstRate % 2 === 0 ? 1 : 2).replace(/\.0$/, '') : '2.5'
    const sgstRate = gstRate > 0 ? (gstRate / 2).toFixed(gstRate % 2 === 0 ? 1 : 2).replace(/\.0$/, '') : '2.5'

    const html = `<!doctype html>
<html lang="en" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellcheck="false">
<head>
  <meta charset="utf-8">
  <meta name="grammarly" content="off">
  <meta name="robots" content="noindex,nofollow">
  <title>Advance Receipt - ${esc(order.deposit_id)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
      margin-left: 0;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
        margin-left: 0;
      }
      html, body {
        width: 76mm !important;
        max-width: 76mm !important;
        margin: 0 !important;
        margin-left: 0 !important;
        margin-right: auto !important;
        padding: 2mm 1.5mm !important;
        float: left !important;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      color: #000;
      margin: 0;
      margin-left: 0;
      margin-right: auto;
      padding: 3mm 2mm;
      width: 76mm;
      max-width: 76mm;
      box-sizing: border-box;
      line-height: 1.35;
      background: #fff;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-align: left;
      float: left;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .dashed-divider {
      border-bottom: 1.5px dashed #000;
      margin: 8px 0 7px 0;
      width: 100%;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      padding: 1.5px 0;
    }
    .row span:first-child {
      color: #333;
      flex-shrink: 0;
    }
    .row span:last-child {
      text-align: right;
      color: #000;
      word-break: break-word;
    }
    .bold-row {
      font-weight: 700;
    }
    .bold-row span:first-child,
    .bold-row span:last-child {
      color: #000;
    }
  </style>
</head>
<body>
  <div class="receipt-container" style="width: 76mm; max-width: 76mm; margin: 0; margin-left: 0; margin-right: auto; text-align: left;">
  <!-- Header / Logo -->
  <div class="text-center" style="margin-bottom: 4px;">
    <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 6px;">
      <img src="${LOGO_BASE64}" alt="${esc(BRAND_EN)}" style="height: 48px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" />
    </div>
    <div style="font-size: 17px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">${esc(BRAND_EN)}</div>
    <div style="font-size: 10px; margin-top: 3px; color: #222; line-height: 1.35; padding: 0 4px;">${esc(BRAND_ADDRESS)}</div>
    <div style="font-size: 10.5px; margin-top: 3px; font-weight: 600;">+91 ${esc(BRAND_PHONE_DISPLAY.replace(/^\+91\s*/, ''))}</div>
    ${BRAND_GSTIN ? `<div style="font-size: 9.5px; margin-top: 2px; color: #333;">GSTIN: ${esc(BRAND_GSTIN)}</div>` : ''}
  </div>

  <div class="dashed-divider"></div>

  <!-- Title -->
  <div class="text-center">
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">ADVANCE RECEIPT</div>
    <div style="font-size: 9.5px; color: #444; margin-top: 1px; font-weight: 500;">Not a final tax invoice</div>
  </div>

  <div class="dashed-divider"></div>

  <!-- Receipt ID & Timestamp -->
  <div>
    <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.3px;">${esc(order.deposit_id)}</div>
    <div style="font-size: 10px; color: #333; margin-top: 2px;">${dateStr}</div>
  </div>

  <div class="dashed-divider"></div>

  <!-- Customer & Order Information -->
  <div style="font-size: 11px; line-height: 1.55;">
    <div class="row"><span>Customer</span><span style="font-weight: 700;">${esc(order.customer_name)}</span></div>
    <div class="row"><span>Phone</span><span>${esc(formatCustomerPhone(order.phone))}</span></div>
    <div class="row"><span>Product</span><span style="font-weight: 600; max-width: 65%; text-align: right;">${esc(order.product_name)}</span></div>
    ${order.category ? `<div class="row"><span>Category</span><span>${esc(order.category)}</span></div>` : ''}
    <div class="row"><span>Delivery</span><span>${esc(deliveryDateFormatted)}</span></div>
    <div class="row"><span>Payment</span><span>${esc(depositPayment)}</span></div>
    ${order.address ? `<div class="row"><span>Address</span><span style="max-width: 65%;">${esc(order.address)}</span></div>` : ''}
  </div>

  <div class="dashed-divider"></div>

  <!-- Enabled Financial Breakdown (Subtotal, Delivery, Discounts, Taxes) -->
  <div style="font-size: 11.5px; line-height: 1.6;">
    <div class="row"><span>Subtotal</span><span>${esc(formatCurrency(subtotal))}</span></div>
    ${couponDiscount > 0 ? `<div class="row"><span>Coupon Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</span><span>-${esc(formatCurrency(couponDiscount))}</span></div>` : ''}
    ${manualDiscount > 0 ? `<div class="row"><span>Manual Discount</span><span>-${esc(formatCurrency(manualDiscount))}</span></div>` : ''}
    ${cgstAmount > 0 ? `<div class="row"><span>CGST (${cgstRate}%)</span><span>+${esc(formatCurrency(cgstAmount))}</span></div>` : ''}
    ${sgstAmount > 0 ? `<div class="row"><span>SGST (${sgstRate}%)</span><span>+${esc(formatCurrency(sgstAmount))}</span></div>` : ''}
    ${deliveryCharge > 0 ? `<div class="row"><span>Delivery Charges</span><span>+${esc(formatCurrency(deliveryCharge))}</span></div>` : ''}
  </div>

  <div class="dashed-divider"></div>

  <!-- Totals & Balances -->
  <div style="font-size: 12px; line-height: 1.65;">
    <div class="row bold-row" style="font-size: 13px;"><span>Total Amount</span><span>${esc(formatCurrency(order.total_amount))}</span></div>
    <div class="row bold-row" style="font-size: 12px; margin-top: 1px;"><span>Deposit Paid</span><span>${esc(formatCurrency(order.deposit_amount))}</span></div>
    <div class="row bold-row" style="font-size: 14.5px; margin-top: 2px;"><span>Balance Due</span><span>${esc(formatCurrency(order.remaining_balance))}</span></div>
  </div>

  <div class="dashed-divider" style="margin-top: 9px; margin-bottom: 8px;"></div>

  <!-- Footer Notice -->
  <div class="text-center" style="font-size: 9.5px; font-weight: 900; letter-spacing: 0.3px; line-height: 1.3;">
    ADVANCE PAYMENT ONLY — NOT A FINAL INVOICE
  </div>
  </div>
</body>
</html>`

    printHtmlDocument(html)
  } catch (err) {
    console.warn('[advanceReceipt] Failed to print advance receipt:', err)
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
