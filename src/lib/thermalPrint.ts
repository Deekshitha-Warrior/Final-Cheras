import { BRAND_ADDRESS, BRAND_EMAIL, BRAND_EN, BRAND_PRIMARY_PHONE_DISPLAY, BRAND_GSTIN } from './brand'
import { LOGO_BASE64 } from './logoBase64'
import { formatCurrency, formatInvoiceNo } from './retail'
import { printHtmlDocument } from './printHtml'

export interface ThermalReceiptData {
  invoiceNo: string
  date: string
  customerName?: string
  phone?: string
  items: Array<{
    name: string
    qty: number
    unit?: string
    price: number
    line_total?: number
  }>
  subtotal: number
  shipping: number
  couponDiscount?: number
  couponCode?: string | null
  manualDiscount?: number
  totalGst?: number
  cgstAmount?: number
  sgstAmount?: number
  gstRate?: number
  total: number
  storeName?: string
  storePhone?: string
  storeAddress?: string
  storeEmail?: string
  storeGstin?: string
}

export function printThermalReceipt(data: ThermalReceiptData) {
  try {
    const dateStr = (() => {
      try { return new Date(data.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
      catch { return new Date().toLocaleString('en-IN') }
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

    const html = `
      <!DOCTYPE html>
      <html lang="en" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellcheck="false">
        <head>
          <meta charset="UTF-8">
          <meta name="grammarly" content="off">
          <meta name="robots" content="noindex,nofollow">
          <title>Receipt - ${data.invoiceNo}</title>
        <style>
          @page {
            margin: 0;
            margin-left: 0;
            size: 80mm auto;
          }
          @media print {
            @page {
              margin: 0;
              margin-left: 0;
              size: 80mm auto;
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
          * {
            box-sizing: border-box;
          }
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
            text-align: left;
            float: left;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .border-bottom { border-bottom: 1.5px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .border-top { border-top: 1.5px dashed #000; padding-top: 4px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 2px 0; vertical-align: top; }
          .item-name { font-size: 11px; padding-right: 4px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="receipt-container" style="width: 76mm; max-width: 76mm; margin: 0; margin-left: 0; margin-right: auto; text-align: left;">
        <div class="text-center mb-2">
          <div style="display: flex; justify-content: center; align-items: center; margin: 0 auto 6px auto; text-align: center;">
            <img src="${LOGO_BASE64}" alt="CHERAS CLOTHING" style="width: 120px; max-height: 60px; object-fit: contain; margin: 0 auto; display: block;" />
          </div>
          <div style="font-size: 15px; letter-spacing: 1px; font-weight: 800; margin-bottom: 2px;">${(data.storeName || BRAND_EN).toUpperCase()}</div>
          <div style="font-size: 9.5px; margin-top: 2px; line-height: 1.3;">${data.storeAddress || BRAND_ADDRESS}</div>
          <div class="mt-1" style="font-size: 10px;">GSTIN: ${data.storeGstin || BRAND_GSTIN}</div>
          <div style="font-size: 10px;">Ph: ${BRAND_PRIMARY_PHONE_DISPLAY}</div>
          <div style="font-size: 9px; color: #333;">${data.storeEmail || BRAND_EMAIL}</div>
        </div>

        <div class="border-bottom border-top" style="font-size: 11px;">
          <div>Inv: #${formatInvoiceNo(data.invoiceNo)}</div>
          <div>Date: ${dateStr}</div>
          ${data.customerName ? `<div>Name: ${data.customerName}</div>` : ''}
          ${data.phone ? `<div>Tel: ${formatCustomerPhone(data.phone)}</div>` : ''}
        </div>

        <table class="border-bottom" style="width: 100%; table-layout: fixed; border-collapse: collapse;">
          <thead>
            <tr style="font-size: 10px; border-bottom: 1px dashed #000;">
              <th style="width: 50%; text-align: left; padding: 4px 0;">Item Name</th>
              <th style="width: 18%; text-align: center; padding: 4px 0;">Qty</th>
              <th style="width: 32%; text-align: right; padding: 4px 0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => {
              const lineTotal = item.line_total ?? (item.qty * item.price)
              const unit = item.unit && item.unit !== 'unit' && item.unit !== 'piece' ? item.unit : ''
              const rateDisplay = `${formatCurrency(item.price)}${unit ? `/${unit}` : ''}`
              return `
                <tr>
                  <td style="text-align: left; padding: 3px 2px 3px 0; vertical-align: top; word-break: break-word;">
                    <div style="font-size: 11px; line-height: 1.25;">${item.name}</div>
                    <div style="font-size: 9px; color: #444; margin-top: 1px;">@ ${rateDisplay}</div>
                  </td>
                  <td style="text-align: center; vertical-align: top; padding: 3px 0; font-size: 11px;">
                    ${item.qty}
                  </td>
                  <td style="text-align: right; vertical-align: top; padding: 3px 0; font-size: 11px;">
                    ${formatCurrency(lineTotal)}
                  </td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <div class="border-bottom" style="font-size: 11.5px;">
          <table style="width: 100%;">
            ${data.subtotal > 0 ? `
              <tr>
                <td class="text-left">Subtotal</td>
                <td class="text-right" style="font-weight: 700;">${formatCurrency(data.subtotal)}</td>
              </tr>
            ` : ''}
            ${(data.couponDiscount || 0) > 0 ? `
              <tr>
                <td class="text-left">Coupon Disc.${data.couponCode ? ` (${data.couponCode})` : ''}</td>
                <td class="text-right">-${formatCurrency(data.couponDiscount || 0)}</td>
              </tr>
            ` : ''}
            ${(data.manualDiscount || 0) > 0 ? `
              <tr>
                <td class="text-left">Manual Disc.</td>
                <td class="text-right">-${formatCurrency(data.manualDiscount || 0)}</td>
              </tr>
            ` : ''}
            ${(() => {
              const cgst = data.cgstAmount ?? ((data.totalGst || 0) > 0 ? Math.round(((data.totalGst || 0) / 2) * 100) / 100 : 0)
              const sgst = data.sgstAmount ?? ((data.totalGst || 0) > 0 ? Math.round(((data.totalGst || 0) / 2) * 100) / 100 : 0)
              const totalTax = (cgst + sgst) || Number(data.totalGst || 0)
              const couponDisc = data.couponDiscount || 0
              const manualDisc = data.manualDiscount || 0
              const taxableBase = Number(data.subtotal || 0) - couponDisc - manualDisc
              const resolvedGstRate = Number(data.gstRate || 0) || (totalTax > 0 && taxableBase > 0 ? Math.round((totalTax / taxableBase) * 1000) / 10 : 0)
              const halfRateStr = resolvedGstRate > 0
                ? (resolvedGstRate / 2).toFixed(1).replace(/\.0$/, '')
                : (totalTax > 0 ? '2.5' : '')
              const rate = halfRateStr ? ` (${halfRateStr}%)` : ''
              if (cgst > 0 || sgst > 0) {
                return `
                  <tr>
                    <td class="text-left">CGST${rate}</td>
                    <td class="text-right">+${formatCurrency(cgst)}</td>
                  </tr>
                  <tr>
                    <td class="text-left">SGST${rate}</td>
                    <td class="text-right">+${formatCurrency(sgst)}</td>
                  </tr>
                `
              }
              if ((data.totalGst || 0) > 0) {
                return `
                  <tr>
                    <td class="text-left">GST</td>
                    <td class="text-right">+${formatCurrency(data.totalGst || 0)}</td>
                  </tr>
                `
              }
              return ''
            })()}
            ${(data.shipping || 0) > 0 ? `
              <tr>
                <td class="text-left">Delivery</td>
                <td class="text-right">+${formatCurrency(data.shipping)}</td>
              </tr>
            ` : ''}
            <tr style="font-size: 13px; font-weight: 900;">
              <td class="text-left" style="padding-top: 3px;">Total</td>
              <td class="text-right" style="padding-top: 3px;">${formatCurrency(data.total)}</td>
            </tr>
          </table>
        </div>

        <div class="text-center mt-2" style="font-size: 11px;">
          <div>Thank you for shopping at ${(data.storeName || BRAND_EN).toUpperCase()}!</div>
        </div>
        </div>
      </body>
    </html>
  `

    printHtmlDocument(html)
  } catch (err) {
    console.warn('[thermalPrint] Failed to print receipt:', err)
  }
}
