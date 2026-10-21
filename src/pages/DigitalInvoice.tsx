import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Invoice } from '../components/Invoice'
import { Printer, ArrowLeft, MessageCircle } from 'lucide-react'
import { printThermalReceipt } from '../lib/thermalPrint'
import { invoicePdfFile, invoicePdfFileFromElement } from '../lib/invoicePdf'
import { uploadInvoicePdf } from '../lib/storage'
import { isUuid, normalizeStructuredOrderItem, formatInvoiceNo } from '../lib/retail'
import { buildProfessionalWhatsAppMessage } from '../lib/whatsappMessage'
import { toWhatsAppUrl } from '../lib/phone'
import { formatPaymentLabel } from '../lib/payments'

function buildLookupCandidates(id: string): string[] {
  let raw = decodeURIComponent(id || '').trim()
  if (!raw) return []
  // Strip leading '#' if present (e.g. #INV26000010)
  raw = raw.replace(/^#+/, '').trim()

  const candidates = new Set<string>()

  // 1. Raw and uppercase
  candidates.add(raw)
  candidates.add(raw.toUpperCase())

  // 2. Stripped prefix (e.g. "INV00000030" -> "00000030")
  const stripped = raw.replace(/^(INV|UL)[-_ ]*/i, '').trim()
  if (stripped) candidates.add(stripped)

  // 3. Numeric digits extraction
  const digits = raw.replace(/\D/g, '')
  if (digits) {
    candidates.add(digits)
    candidates.add(digits.padStart(8, '0'))
    const unpadded = digits.replace(/^0+/, '')
    if (unpadded) {
      candidates.add(unpadded)
      candidates.add(unpadded.padStart(8, '0'))
      candidates.add(unpadded.padStart(6, '0'))
    }

    // 4. Handle year-prefixed sequences like "INV26000010" or "26000010" -> "UL-2026-000010"
    const matchYr = digits.match(/^(2[4-9])(\d{4,8})$/)
    if (matchYr) {
      const yr = '20' + matchYr[1]
      const seq = matchYr[2]
      const num = parseInt(seq, 10)
      candidates.add(`UL-${yr}-${seq.padStart(6, '0')}`)
      candidates.add(`UL-${yr}-${String(num).padStart(6, '0')}`)
      candidates.add(`UL-${yr}-${num}`)
      candidates.add(`${yr}-${seq.padStart(6, '0')}`)
      candidates.add(seq.padStart(8, '0'))
      candidates.add(String(num).padStart(8, '0'))
    }
  }

  // 5. Formatted with INV prefix
  candidates.add(formatInvoiceNo(raw))

  return Array.from(candidates).filter(Boolean)
}

export default function DigitalInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const invoiceElementRef = useRef<HTMLDivElement>(null)

  const handleBack = () => {
    const currentPath = window.location.pathname
    const hasInternalHistory =
      (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) ||
      (Boolean(document.referrer) && document.referrer.startsWith(window.location.origin))

    if (hasInternalHistory && window.history.length > 1) {
      navigate(-1)
      // Fallback in case navigate(-1) had no effect
      setTimeout(() => {
        if (window.location.pathname === currentPath) {
          navigate('/dashboard')
        }
      }, 200)
    } else {
      navigate('/dashboard')
    }
  }

  useEffect(() => {
    async function loadInvoice() {
      if (!isSupabaseConfigured) {
        setError('Database connection not configured')
        setLoading(false)
        return
      }
      try {
        const rawId = decodeURIComponent(id || '').trim()
        if (!rawId) {
          throw new Error('Invoice not found')
        }

        const candidates = buildLookupCandidates(rawId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let row: any = null

        // 1. Try public RPC with candidates in priority order (00000030 tried first)
        for (const candidate of candidates) {
          try {
            const { data, error: rpcErr } = await supabase.rpc('get_public_invoice_by_number', { p_invoice_no: candidate })
            if (!rpcErr && data) {
              const matched = Array.isArray(data) ? data[0] : data
              if (matched && typeof matched === 'object' && ('id' in matched || 'invoice_no' in matched)) {
                row = matched
                break
              }
            }
          } catch {
            // continue
          }
        }

        // 2. Direct table query fallback on orders table (supports unauthenticated anon query)
        if (!row) {
          try {
            const { data: tableData } = await supabase
              .from('orders')
              .select('*')
              .in('invoice_no', candidates)
              .limit(1)

            if (tableData && tableData[0]) {
              row = tableData[0]
            } else {
              // Suffix fallback: if rawId has digits, match invoice_no ending with the sequence
              const digits = rawId.replace(/\D/g, '')
              const unpadded = digits.replace(/^0+/, '')
              if (unpadded) {
                const { data: suffixData } = await supabase
                  .from('orders')
                  .select('*')
                  .ilike('invoice_no', `%${unpadded}`)
                  .order('created_at', { ascending: false })
                  .limit(1)

                if (suffixData && suffixData[0]) {
                  row = suffixData[0]
                }
              }
            }
          } catch {
            // continue
          }
        }

        // 3. Fallback to UUID lookup if rawId is a valid UUID (e.g. opened from dashboard)
        if (!row && isUuid(rawId)) {
          try {
            const { data: idData } = await supabase
              .from('orders')
              .select('*')
              .eq('id', rawId)
              .maybeSingle()

            if (idData) {
              row = idData
            }
          } catch {
            // continue
          }
        }

        // 4. Fallback to advance_orders table if referenced by deposit_id or invoice_number
        if (!row) {
          try {
            const { data: advData } = await supabase
              .from('advance_orders')
              .select('*')
              .or(`invoice_number.in.(${candidates.map(c => `"${c}"`).join(',')}),deposit_id.in.(${candidates.map(c => `"${c}"`).join(',')})`)
              .limit(1)

            if (advData && advData[0]) {
              const adv = advData[0]
              const advItems = Array.isArray(adv.products) && adv.products.length > 0
                ? adv.products
                : [{
                    name: adv.product_name || 'Advance Order Item',
                    quantity: 1,
                    unit: 'piece',
                    unit_type: 'unit',
                    base_price: adv.total_amount,
                    line_total: adv.total_amount,
                  }]
              row = {
                id: adv.completed_order_id || adv.id,
                invoice_no: adv.invoice_number || adv.deposit_id,
                customer_name: adv.customer_name,
                phone: adv.phone,
                address: adv.address || '',
                items: advItems,
                total: adv.total_amount,
                subtotal: adv.total_amount,
                delivery_charge: 0,
                discount_amount: 0,
                manual_discount_amount: 0,
                total_gst: 0,
                gst_amount: 0,
                status: adv.status,
                payment_mode: adv.final_payment_method || 'Advance Payment',
                created_at: adv.completed_at || adv.created_at,
              }
            }
          } catch {
            // continue
          }
        }

        if (!row) throw new Error('Invoice not found')

        setInvoice(row)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Invoice not found')
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) loadInvoice()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-sand border-t-sageDark rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-2xl font-bold text-sageDark mb-2">Invoice Not Found</h1>
        <p className="text-gray-500 mb-6">The requested invoice could not be found.</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-6 py-2 bg-sage text-white rounded-full font-bold hover:bg-sageDark transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    )
  }

  const invoiceItems = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item: Record<string, unknown>) => normalizeStructuredOrderItem(item))
  const subtotal = invoiceItems.reduce((sum: number, item: ReturnType<typeof normalizeStructuredOrderItem>) => sum + item.line_total, 0)

  const downloadPdf = async () => {
    if (!invoiceElementRef.current || downloadingPdf) return

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    setDownloadingPdf(true)
    try {
      // Direct vector PDF data
      const rawGst = Number(invoice.total_gst || invoice.gst_amount || 0)
      const rawCgst = Number(invoice.cgst_amount || (rawGst > 0 ? rawGst / 2 : 0))
      const rawSgst = Number(invoice.sgst_amount || (rawGst > 0 ? rawGst / 2 : 0))
      const pdfData = {
        invoiceNo: invoice.invoice_no,
        date: invoice.created_at,
        customerName: invoice.customer_name,
        phone: invoice.phone,
        address: invoice.address,
        items: invoiceItems,
        subtotal,
        shipping: invoice.delivery_charge || 0,
        discountAmount: invoice.discount_amount || 0,
        manualDiscountAmount: invoice.manual_discount_amount || 0,
        gstAmount: rawGst,
        cgstAmount: rawCgst,
        sgstAmount: rawSgst,
        gstRate: Number(invoice.gst_rate || 0),
        couponCode: invoice.coupon_code,
        paymentMode: formatPaymentLabel(invoice.payment_mode || invoice.payment_method, invoice.split_details) || invoice.payment_mode,
        total: invoice.total > 0 ? invoice.total : (subtotal + (invoice.delivery_charge || 0) + rawGst - (invoice.discount_amount || 0) - (invoice.manual_discount_amount || 0)),
      }

      // On iOS Safari: WebKit blocks blob: URL downloads and shows a blank white page.
      // Use synchronous vector PDF to preserve the transient user click gesture for Web Share API,
      // and fall back to native AirPrint/PDF preview via window.print().
      if (isIOS) {
        const file = invoicePdfFile(pdfData)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Invoice #${formatInvoiceNo(invoice.invoice_no)}`,
            })
            return
          } catch (shareErr: unknown) {
            if (shareErr instanceof Error && shareErr.name === 'AbortError') {
              return
            }
          }
        }
        // Native iOS AirPrint / PDF preview fallback (never opens blank blob page)
        window.print()
        return
      }

      // Non-iOS (Desktop, Android): generate matching PDF and download
      let file: File
      try {
        if (invoiceElementRef.current) {
          file = await invoicePdfFileFromElement(invoiceElementRef.current, invoice.invoice_no)
        } else {
          file = invoicePdfFile(pdfData)
        }
      } catch {
        file = invoicePdfFile(pdfData)
      }

      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      console.error('Failed to download invoice PDF:', err)
      alert('Unable to generate PDF. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const shareViaWhatsApp = () => {
    // Synchronously prepare message to guarantee execution within user click gesture
    const items = invoiceItems.map((item: ReturnType<typeof normalizeStructuredOrderItem>) => ({
      name: item.name,
      qty: item.quantity,
      unit: item.unit,
      unitType: item.unit_type,
      rate: item.base_price,
      lineTotal: item.line_total,
    }))
    const message = buildProfessionalWhatsAppMessage({
      customerName: invoice.customer_name,
      phone: invoice.phone,
      invoiceNumber: invoice.invoice_no,
      invoiceDate: invoice.created_at,
      items,
      subtotal,
      couponDiscount: invoice.discount_amount,
      manualDiscountAmount: invoice.manual_discount_amount,
      shipping: invoice.delivery_charge,
      gstAmount: invoice.total_gst || invoice.gst_amount || 0,
      total: invoice.total,
      paymentMode: formatPaymentLabel(invoice.payment_mode || invoice.payment_method, invoice.split_details) || invoice.payment_mode || invoice.payment_method,
    })

    const invoiceUrl = window.location.href
    const pdfUrl = invoice.pdf_url || invoice.invoice_pdf_url
    const linkSection = pdfUrl
      ? `\n\n📄 View Invoice: ${invoiceUrl}\n📥 Download PDF: ${pdfUrl}`
      : `\n\n📄 View Invoice: ${invoiceUrl}`

    const whatsappMessage = `${message}${linkSection}`
    const waUrl = toWhatsAppUrl(invoice.phone, whatsappMessage)

    // Open WhatsApp synchronously in user click gesture to avoid iOS Safari popup blocking
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    if (isMobile) {
      window.location.href = waUrl
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    }

    // Proactively upload invoice PDF in background if needed
    if (!pdfUrl && invoiceElementRef.current) {
      void (async () => {
        try {
          const file = await invoicePdfFileFromElement(invoiceElementRef.current!, invoice.invoice_no)
          await uploadInvoicePdf(file, invoice.invoice_no)
        } catch { /* best-effort background upload */ }
      })()
    }
  }

  const printReceipt = () => {
    const rawGst = Number(invoice.total_gst || invoice.gst_amount || 0)
    const rawCgst = Number(invoice.cgst_amount || (rawGst > 0 ? rawGst / 2 : 0))
    const rawSgst = Number(invoice.sgst_amount || (rawGst > 0 ? rawGst / 2 : 0))
    const subtotal = invoice.total - (invoice.delivery_charge || 0) - rawGst + (invoice.discount_amount || 0) + (invoice.manual_discount_amount || 0)
    printThermalReceipt({
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at,
      customerName: invoice.customer_name,
      phone: invoice.phone,
      items: (invoice.items || []).map((item: Record<string, unknown>) => ({
        name: String(item.name || item.product_name || ''),
        qty: Number(item.qty || item.quantity || 1),
        unit: item.unit ? String(item.unit) : undefined,
        price: Number(item.price || item.base_price || 0),
        line_total: item.line_total !== undefined ? Number(item.line_total) : undefined
      })),
      subtotal,
      shipping: Number(invoice.delivery_charge || 0),
      couponDiscount: Number(invoice.discount_amount || 0),
      manualDiscount: Number(invoice.manual_discount_amount || 0),
      totalGst: rawGst,
      cgstAmount: rawCgst,
      sgstAmount: rawSgst,
      gstRate: Number(invoice.gst_rate || 0),
      total: invoice.total > 0 ? invoice.total : (subtotal + Number(invoice.delivery_charge || 0) + rawGst - Number(invoice.discount_amount || 0) - Number(invoice.manual_discount_amount || 0))
    })
  }

  return (
    <div className="digital-invoice-page bg-white font-sans print:bg-white print:overflow-visible print:m-0 print:p-0">
      {/* Top action bar — uses position fixed so it always works on iOS regardless of scroll context */}
      <div className="bg-white/95 backdrop-blur-sm p-4 fixed top-0 left-0 right-0 z-50 print:hidden flex items-center justify-between safe-area-inset-top" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            handleBack()
          }}
          className="flex items-center gap-2 text-[#111111] hover:text-[#B8B8B8] font-semibold text-sm transition-colors bg-white border border-[#F3F4F6] px-4 py-2 rounded-full shadow-sm cursor-pointer active:scale-95"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              void downloadPdf()
            }}
            disabled={downloadingPdf}
            className="flex items-center gap-2 bg-[#B8B8B8] text-[#222222] border border-[#A3A3A3] px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-[#A3A3A3] transition-colors cursor-pointer active:scale-95 disabled:opacity-70"
          >
            <Printer size={16} /> {downloadingPdf ? 'Generating...' : <><span className="hidden sm:inline">PDF Invoice</span><span className="sm:hidden">PDF</span></>}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              shareViaWhatsApp()
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-emerald-700 transition-colors cursor-pointer active:scale-95"
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>
      </div>

      {/* Spacer to push content below fixed bar */}
      <div className="h-16 print:hidden" style={{ height: 'max(64px, calc(64px + env(safe-area-inset-top)))' }} />

      <div className="max-w-3xl mx-auto pb-12 print:mt-0 print:mb-0 print:p-0 print:max-w-full px-2 sm:px-0">
        <div ref={invoiceElementRef} className="bg-white shadow-xl rounded-2xl print:shadow-none print:rounded-none border border-sand/20 print:border-none print:m-0 print:p-0">
          <Invoice
            invoiceNo={invoice.invoice_no}
            date={invoice.created_at}
            customerName={invoice.customer_name}
            phone={invoice.phone}
            address={invoice.address}
            items={invoice.items || []}
            subtotal={subtotal}
            shipping={Number(invoice.delivery_charge || 0)}
            deliveryCharge={Number(invoice.delivery_charge || 0)}
            discountAmount={Number(invoice.discount_amount || 0)}
            manualDiscountAmount={Number(invoice.manual_discount_amount || 0)}
            gstAmount={Number(invoice.total_gst || invoice.gst_amount || 0)}
            cgstAmount={Number(invoice.cgst_amount || ((invoice.total_gst || invoice.gst_amount) ? Number(invoice.total_gst || invoice.gst_amount) / 2 : 0))}
            sgstAmount={Number(invoice.sgst_amount || ((invoice.total_gst || invoice.gst_amount) ? Number(invoice.total_gst || invoice.gst_amount) / 2 : 0))}
            gstRate={Number(invoice.gst_rate || 0)}
            couponCode={invoice.coupon_code}
            total={invoice.total > 0 ? invoice.total : (subtotal + Number(invoice.delivery_charge || 0) + Number(invoice.total_gst || invoice.gst_amount || 0) - Number(invoice.discount_amount || 0) - Number(invoice.manual_discount_amount || 0))}
            status={invoice.status}
            paymentMode={formatPaymentLabel(invoice.payment_mode || invoice.payment_method, invoice.split_details) || invoice.payment_mode || invoice.payment_method}
          />
        </div>
      </div>
    </div>
  )
}
