import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CheckCircle2, Clock3, Download, Edit2, Eye, FileText, MessageCircle, PackageCheck, Printer, RefreshCw, Search, X, Trash2 } from 'lucide-react'
import { formatCurrency, formatInvoiceNo } from '../lib/retail'
import SplitPaymentInputs from '../components/common/SplitPaymentInputs'
import { emptySplitInput, formatPaymentLabel, splitInputToDetails, splitTotal, type SplitInputValue } from '../lib/payments'
import { invoicePdfFile } from '../lib/invoicePdf'
import { printThermalReceipt } from '../lib/thermalPrint'
import { buildAdvanceDepositWhatsAppMessage, buildProfessionalWhatsAppMessage, publicInvoiceUrl } from '../lib/whatsappMessage'
import { formatPhoneDisplay, normalizePhone, toWhatsAppUrl } from '../lib/phone'
import { advanceReceiptPdf, downloadFile, printAdvanceReceipt } from '../lib/advanceReceipt'
import { useAdminAuthStore, useProductStore, useVariantStore } from '../store/store'
import {
  addAdvanceEvent, completeAdvanceOrder, createAdvanceOrder, getAdvanceOrderHistory, listAdvanceOrders, updateAdvanceStatus, deleteAdvanceOrder, updateAdvanceOrder,
  type AdvanceOrder, type AdvancePayment, type AdvancePaymentMethod, type AdvanceStatus, type AdvanceTimeline,
} from '../services/advanceOrderService'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { lookupCustomerByPhone, saveCustomerBirthday, getLocalBirthdaysMap } from '../services/birthdayService'
import { useTheme } from '../store/themeStore'

// Custom Malaysian Ringgit icon
const RMIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Malaysian Ringgit">
    <rect x="2" y="2" width="20" height="20" rx="4" />
    <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" stroke="none" fill="currentColor" fontFamily="Arial, sans-serif">₹</text>
  </svg>
)

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom'
type StatusFilter = 'all' | 'pending' | 'ready' | 'completed' | 'cancelled'

const STATUS_LABELS: Record<AdvanceStatus, string> = {
  pending_deposit: 'Pending Deposit', ready_for_delivery: 'Ready for Delivery', waiting_final_payment: 'Waiting for Final Payment', completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_STYLES: Record<AdvanceStatus, string> = {
  pending_deposit: 'bg-amber-50 text-amber-700 border-amber-200', ready_for_delivery: 'bg-gray-50 text-gray-700 border-gray-200',
  waiting_final_payment: 'bg-gray-50 text-gray-700 border-gray-200', completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
}
const initialForm = { customerName: '', phone: '', birthday: '', address: '', productName: '', category: '', description: '', totalAmount: '', depositAmount: '', expectedDeliveryDate: '', status: 'pending_deposit' as AdvanceStatus, remarks: '', reference_number: '', paymentMethod: 'cash' as AdvancePaymentMethod }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

type AdvanceOrdersProps = {
  onOrderCompleted?: (order?: AdvanceOrder) => void
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) { return <label htmlFor={htmlFor} className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#6B7280]">{label}</span>{children}</label> }
const inputClass = 'w-full rounded-xl border border-[#F3F4F6] bg-white px-3.5 py-2.5 text-sm text-[#1F1F1F] outline-none transition focus:border-[#6B7280] focus:ring-2 focus:ring-gray-100'

export default function AdvanceOrders({ onOrderCompleted }: AdvanceOrdersProps = {}) {
  const role = useAdminAuthStore(state => state.role)
  const { themeColor, textColor, hoverColor, lightBg, subtleBorder } = useTheme()
  const products = useProductStore(state => state.products)
  const [orders, setOrders] = useState<AdvanceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selected, setSelected] = useState<AdvanceOrder | null>(null)
  const [timeline, setTimeline] = useState<AdvanceTimeline[]>([])
  const [payments, setPayments] = useState<AdvancePayment[]>([])
  const [paymentOrder, setPaymentOrder] = useState<AdvanceOrder | null>(null)
  const [paymentForm, setPaymentForm] = useState({ method: 'cash' as AdvancePaymentMethod, remarks: '' })
  const [depositSplit, setDepositSplit] = useState<SplitInputValue>(emptySplitInput())
  const [finalSplit, setFinalSplit] = useState<SplitInputValue>(emptySplitInput())
  const [completionModalOrder, setCompletionModalOrder] = useState<AdvanceOrder | null>(null)
  const [createdDepositModal, setCreatedDepositModal] = useState<AdvanceOrder | null>(null)

  // Edit Advance Order state
  const [editingOrder, setEditingOrder] = useState<AdvanceOrder | null>(null)
  const [editForm, setEditForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    productName: '',
    category: '',
    description: '',
    totalAmount: '',
    depositAmount: '',
    expectedDeliveryDate: '',
    status: 'pending_deposit' as AdvanceStatus,
    referenceNumber: '',
    remarks: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const startEditAdvance = (order: AdvanceOrder) => {
    setEditingOrder(order)
    setEditForm({
      customerName: order.customer_name,
      phone: order.phone,
      address: order.address,
      productName: order.product_name,
      category: order.category || '',
      description: order.description || '',
      totalAmount: String(order.total_amount),
      depositAmount: String(order.deposit_amount),
      expectedDeliveryDate: order.expected_delivery_date ? order.expected_delivery_date.slice(0, 10) : '',
      status: order.status,
      referenceNumber: order.reference_number || '',
      remarks: order.remarks || '',
    })
  }

  const saveEditAdvance = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    setSavingEdit(true)
    setError('')
    try {
      const total = Number(editForm.totalAmount)
      const deposit = Number(editForm.depositAmount)
      if (!Number.isFinite(total) || total <= 0) {
        setError('Total amount must be greater than RM0.')
        setSavingEdit(false)
        return
      }
      if (!Number.isFinite(deposit) || deposit < 0 || deposit >= total) {
        setError('Deposit must be greater than or equal to RM0 and less than total amount.')
        setSavingEdit(false)
        return
      }
      const updated = await updateAdvanceOrder(editingOrder.id, {
        customerName: editForm.customerName,
        phone: editForm.phone,
        address: editForm.address,
        productName: editForm.productName,
        category: editForm.category,
        description: editForm.description,
        totalAmount: total,
        depositAmount: deposit,
        expectedDeliveryDate: editForm.expectedDeliveryDate,
        referenceNumber: editForm.referenceNumber,
        remarks: editForm.remarks,
        status: editForm.status,
      })
      setOrders(current => current.map(o => o.id === updated.id ? updated : o))
      if (selected?.id === updated.id) {
        setSelected(updated)
      }
      setEditingOrder(null)
      setNotice(`Advance order ${updated.deposit_id} updated successfully.`)
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update advance order')
    } finally {
      setSavingEdit(false)
      document.body.style.overflow = ''
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setOrders(await listAdvanceOrders()) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load advance orders') } finally { setLoading(false) }
  }, [])

  const handleManualRefresh = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const fresh = await listAdvanceOrders(true)
      setOrders(fresh)
      setNotice('Advance orders updated successfully.')
      setTimeout(() => setNotice(''), 2500)
    } catch (err) {
      const fallback = await listAdvanceOrders(false)
      setOrders(fallback)
      setError(err instanceof Error ? `Refresh warning: ${err.message}` : 'Network error refreshing advance orders')
      setTimeout(() => setError(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    if (!isSupabaseConfigured) return
    const ch = supabase.channel('advance-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advance_orders' }, () => {
        void load()
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [load])

  // Universal customer lookup when typing customer phone in Advance Orders
  useEffect(() => {
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 10) return

    const timer = setTimeout(async () => {
      try {
        const found = await lookupCustomerByPhone(form.phone)
        if (found) {
          setForm(prev => ({
            ...prev,
            customerName: prev.customerName.trim() ? prev.customerName : (found.name || prev.customerName),
            birthday: prev.birthday ? prev.birthday : (found.birthday || prev.birthday),
            address: prev.address.trim() ? prev.address : (found.address || prev.address),
          }))
        }
      } catch (err) {
        console.warn('Customer lookup in advance orders caught:', err)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [form.phone])

  const handleDeleteOrder = async (orderId: string, orderName: string) => {
    if (!window.confirm(`Are you sure you want to delete advance order "${orderName}"? This action cannot be undone.`)) return
    try {
      await deleteAdvanceOrder(orderId)
      setOrders(orders => orders.filter(o => o.id !== orderId))
      setNotice('Order deleted successfully')
      setTimeout(() => setNotice(''), 3000)
      void useProductStore.getState().fetchProducts(true)
      void useVariantStore.getState().fetchVariants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order')
    }
  }

  // Close modals or drawer on Escape key
  useEffect(() => {
    if (!selected && !createOpen && !paymentOrder && !editingOrder && !completionModalOrder && !createdDepositModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (completionModalOrder) setCompletionModalOrder(null)
        else if (createdDepositModal) setCreatedDepositModal(null)
        else if (editingOrder) setEditingOrder(null)
        else if (selected) setSelected(null)
        else if (paymentOrder) setPaymentOrder(null)
        else if (createOpen) setCreateOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, createOpen, paymentOrder, editingOrder, completionModalOrder, createdDepositModal])

  // Prevent background scroll when modal or drawer is open
  useEffect(() => {
    const isAnyOpen = !!(selected || createOpen || paymentOrder || editingOrder || completionModalOrder || createdDepositModal)
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected, createOpen, paymentOrder, editingOrder, completionModalOrder, createdDepositModal])

  const openDetails = async (order: AdvanceOrder) => {
    setSelected(order); setTimeline([]); setPayments([])
    try { const history = await getAdvanceOrderHistory(order.id); setTimeline(history.timeline); setPayments(history.payments) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load order details') }
  }

  const dateFilteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders

    if (dateFilter === 'custom') {
      const start = customStartDate ? customStartDate : null
      const end = customEndDate ? customEndDate : null
      if (!start && !end) return orders
      const matchesCustom = (dKey: string) => {
        if (!dKey) return false
        if (start && end) return dKey >= start && dKey <= end
        if (start) return dKey >= start
        if (end) return dKey <= end
        return true
      }
      return orders.filter(order => {
        const createdKey = dateKey(new Date(order.created_at))
        const deliveryKey = order.expected_delivery_date ? order.expected_delivery_date.slice(0, 10) : ''
        return matchesCustom(deliveryKey) || matchesCustom(createdKey)
      })
    }

    const now = new Date()
    const todayKeyStr = dateKey(now)

    // Calendar week: Monday to Sunday
    const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0)
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999)
    const mondayKey = dateKey(monday)
    const sundayKey = dateKey(sunday)

    // Calendar month: entire month from 1st to last day (including future dates in this month)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const matchesDate = (dKey: string, dObj: Date | null) => {
      if (!dKey || !dObj || Number.isNaN(dObj.getTime())) return false
      if (dateFilter === 'today') {
        return dKey === todayKeyStr
      }
      if (dateFilter === 'week') {
        return dKey >= mondayKey && dKey <= sundayKey
      }
      if (dateFilter === 'month') {
        return dObj.getFullYear() === currentYear && dObj.getMonth() === currentMonth
      }
      return false
    }

    return orders.filter(order => {
      const createdDate = new Date(order.created_at)
      const createdKey = dateKey(createdDate)
      const deliveryKey = order.expected_delivery_date ? order.expected_delivery_date.slice(0, 10) : ''
      const deliveryDate = deliveryKey ? new Date(`${deliveryKey}T00:00:00`) : null

      // Matches if either delivery date OR creation date falls in the selected filter window
      return matchesDate(deliveryKey, deliveryDate) || matchesDate(createdKey, createdDate)
    })
  }, [orders, dateFilter, customStartDate, customEndDate])

  const analytics = useMemo(() => {
    const activeOrders = dateFilteredOrders.filter(o => !['completed', 'cancelled'].includes(o.status))
    const completedOrders = dateFilteredOrders.filter(o => o.status === 'completed')

    // Active deposits currently held as advance liability for unfulfilled/unsettled orders
    const activeDeposits = activeOrders.reduce((sum, o) => sum + o.deposit_amount, 0)

    // Outstanding remaining balance to be collected on active orders upon fulfillment
    const outstanding = activeOrders.reduce((sum, o) => sum + o.remaining_balance, 0)

    // Total settled value recognized from completed advance orders
    const completedRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0)

    // Total money collected across all orders (active deposits + completed full payments)
    const totalCollected = activeDeposits + completedRevenue

    return {
      total: dateFilteredOrders.length,
      activeCount: activeOrders.length,
      pending: dateFilteredOrders.filter(o => o.status === 'pending_deposit' || o.status === 'waiting_final_payment').length,
      activeDeposits,
      totalCollected,
      completedRevenue,
      outstanding,
      ready: dateFilteredOrders.filter(o => o.status === 'ready_for_delivery').length,
      completed: completedOrders.length,
    }
  }, [dateFilteredOrders])

  const filtered = useMemo(() => dateFilteredOrders.filter(order => {
    const query = search.trim().toLowerCase()
    const searchable = [order.deposit_id, order.customer_name, order.phone, order.product_name, STATUS_LABELS[order.status]].join(' ').toLowerCase()
    if (query && !searchable.includes(query)) return false
    if (statusFilter === 'pending' && !['pending_deposit', 'waiting_final_payment'].includes(order.status)) return false
    if (statusFilter === 'ready' && order.status !== 'ready_for_delivery') return false
    if (statusFilter === 'completed' && order.status !== 'completed') return false
    if (statusFilter === 'cancelled' && order.status !== 'cancelled') return false
    return true
  }), [dateFilteredOrders, search, statusFilter])

  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    const total = Number(form.totalAmount); const deposit = Number(form.depositAmount)
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(deposit) || deposit <= 0 || deposit >= total) { setError('Deposit must be greater than RM0 and less than the total order amount.'); setSaving(false); return }
    if (form.paymentMethod === 'split' && Math.abs(splitTotal(splitInputToDetails(depositSplit)) - deposit) >= 0.01) { setError(`Split amounts must add up to the deposit of ${formatCurrency(deposit)}.`); setSaving(false); return }
    try {
      const matchedProd = products.find(p => p.name.trim().toLowerCase() === form.productName.trim().toLowerCase())
      const created = await createAdvanceOrder({
        ...form,
        splitDetails: form.paymentMethod === 'split' ? splitInputToDetails(depositSplit) : undefined,
        totalAmount: total,
        depositAmount: deposit,
        referenceNumber: form.reference_number,
        createdByName: role || 'Staff',
        products: [{
          product_id: matchedProd ? String(matchedProd.id) : null,
          name: form.productName,
          category: form.category,
          description: form.description,
          quantity: 1,
          base_price: total,
          line_total: total,
          unit: 'piece',
          unit_type: 'unit',
          source: matchedProd ? 'catalogue' : 'advance_order'
        }]
      })
      if (form.phone && form.birthday) {
        void saveCustomerBirthday(form.phone, form.birthday, form.customerName)
      }
      setOrders(current => [created, ...current]); setForm(initialForm); setDepositSplit(emptySplitInput()); setCreateOpen(false); setNotice(`${created.deposit_id} created. Deposit is tracked separately and stock has been reserved.`)
      void useProductStore.getState().fetchProducts(true)
      void useVariantStore.getState().fetchVariants()

      // Show deposit created popup with options for Print Receipt, WhatsApp, and PDF download
      setCreatedDepositModal(created)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create advance order') } finally { setSaving(false) }
  }

  const changeStatus = async (order: AdvanceOrder, status: AdvanceStatus) => {
    if (order.status === 'cancelled') {
      setError('A cancelled order cannot be modified.')
      return
    }
    if (order.status === 'completed' || order.invoice_number || order.completed_order_id) {
      setError('This order is already completed and has an official invoice.')
      return
    }
    if (status === 'completed') { setPaymentOrder(order); return }
    try {
      const updated = await updateAdvanceStatus(order.id, status)
      setOrders(rows => rows.map(row => row.id === order.id ? updated : row))
      if (selected?.id === order.id) void openDetails(updated)
      void useProductStore.getState().fetchProducts(true)
      void useVariantStore.getState().fetchVariants()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update status') }
  }

  const finalAmountFor = (order: AdvanceOrder) => order.remaining_balance

  const receivePayment = async (event: FormEvent) => {
    event.preventDefault(); if (!paymentOrder) return; setSaving(true); setError('')
    try {
      const finalAmount = paymentOrder.remaining_balance
      if (paymentForm.method === 'split' && Math.abs(splitTotal(splitInputToDetails(finalSplit)) - finalAmount) >= 0.01) {
        setError(`Split amounts must add up to the remaining balance of ${formatCurrency(finalAmount)}.`); setSaving(false); return
      }
      const result = await completeAdvanceOrder(
        paymentOrder.id,
        paymentForm.method,
        finalAmount,
        paymentOrder.coupon_code || null,
        0,
        paymentOrder.manual_discount || 0,
        paymentForm.remarks || paymentOrder.remarks || '',
        paymentForm.method === 'split' ? splitInputToDetails(finalSplit) : undefined
      )
      const completed: AdvanceOrder = { ...paymentOrder, status: 'completed', remaining_balance: 0, completed_at: result.completed_at, completed_order_id: result.order_id, invoice_number: result.invoice_no, final_payment_method: paymentForm.method, split_details: result.split_details }
      setOrders(rows => rows.map(row => row.id === completed.id ? completed : row))
      if (selected?.id === completed.id) setSelected(completed)
      onOrderCompleted?.(completed)
      setPaymentOrder(null)
      setPaymentForm({ method: 'cash', remarks: '' })
      setFinalSplit(emptySplitInput())
      setNotice(`${result.invoice_no} generated once. The full ${formatCurrency(completed.total_amount)} is now recognized as revenue.`)

      // Open completion popup with Print Receipt, WhatsApp, and Download PDF options
      setCompletionModalOrder(completed)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete payment') } finally { setSaving(false) }
  }

  const productRows = (order: AdvanceOrder) => order.products.length ? order.products : [{ name: order.product_name, quantity: 1, base_price: order.total_amount, line_total: order.total_amount, unit: 'piece', unit_type: 'unit' }]
  const invoiceFile = (order: AdvanceOrder) => invoicePdfFile({
    invoiceNo: order.invoice_number || order.deposit_id,
    date: order.completed_at || new Date().toISOString(),
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address,
    items: productRows(order),
    subtotal: order.subtotal ?? order.total_amount,
    shipping: order.delivery_charge ?? 0,
    couponDiscount: order.coupon_discount ?? 0,
    couponCode: order.coupon_code,
    manualDiscount: order.manual_discount ?? 0,
    cgstAmount: order.cgst_amount,
    sgstAmount: order.sgst_amount,
    gstRate: order.gst_rate,
    total: order.total_amount,
    paymentMode: order.final_payment_method || 'Paid'
  })
  const printFinal = (order: AdvanceOrder) => printThermalReceipt({
    invoiceNo: order.invoice_number || order.deposit_id,
    date: order.completed_at || new Date().toISOString(),
    customerName: order.customer_name,
    phone: order.phone,
    items: productRows(order).map(item => ({
      name: String(item.name || 'Product'),
      qty: Number(item.quantity || 1),
      unit: String(item.unit || 'piece'),
      price: Number(item.base_price || 0),
      line_total: Number(item.line_total || 0)
    })),
    subtotal: order.subtotal ?? order.total_amount,
    shipping: order.delivery_charge ?? 0,
    couponDiscount: order.coupon_discount ?? 0,
    couponCode: order.coupon_code,
    manualDiscount: order.manual_discount ?? 0,
    cgstAmount: order.cgst_amount,
    sgstAmount: order.sgst_amount,
    gstRate: order.gst_rate,
    total: order.total_amount
  })

  const whatsappDepositReceipt = (order: AdvanceOrder) => {
    const message = buildAdvanceDepositWhatsAppMessage({
      customerName: order.customer_name,
      depositId: order.deposit_id,
      productName: order.product_name,
      totalAmount: order.total_amount,
      depositAmount: order.deposit_amount,
      remainingBalance: order.remaining_balance,
      expectedDeliveryDate: order.expected_delivery_date,
    })
    window.open(toWhatsAppUrl(order.phone, message), '_blank', 'noopener,noreferrer')
  }

  const whatsappInvoice = (order: AdvanceOrder) => {
    const invNum = order.invoice_number || order.deposit_id
    const message = buildProfessionalWhatsAppMessage({
      customerName: order.customer_name,
      phone: order.phone,
      invoiceNumber: invNum,
      invoiceUrl: publicInvoiceUrl(invNum),
    })
    window.open(toWhatsAppUrl(order.phone, message), '_blank', 'noopener,noreferrer')
  }

  const addEvent = async (order: AdvanceOrder, eventType: string, label: string) => {
    try { await addAdvanceEvent(order.id, eventType, label); await openDetails(order); setNotice(`${label} added to ${order.deposit_id}.`) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add timeline event') }
  }

  const cards = [
    ['Total Advance Orders', analytics.total, FileText, 'text-[#111111] bg-[#F9FAFB] border border-[#E5E7EB]', `${analytics.activeCount} active • ${analytics.completed} completed`],
    ['Pending Orders', analytics.pending, Clock3, 'text-amber-700 bg-amber-50 border border-amber-200', 'Awaiting processing/pickup'],
    ['Active Deposits Held', formatCurrency(analytics.activeDeposits), RMIcon, 'text-[#B38018] bg-amber-50 border border-amber-200', `Total collected: ${formatCurrency(analytics.totalCollected)}`],
    ['Outstanding Balance', formatCurrency(analytics.outstanding), RMIcon, 'text-red-700 bg-red-50 border border-red-200', analytics.outstanding > 0 ? 'Remaining on pending orders' : 'All balances cleared'],
    ['Ready For Collection', analytics.ready, PackageCheck, 'text-gray-700 bg-gray-50 border border-gray-200', 'Ready for customer'],
    ['Completed Orders', analytics.completed, CheckCircle2, 'text-emerald-700 bg-emerald-50 border border-emerald-200', `${formatCurrency(analytics.completedRevenue)} settled as revenue`],
  ] as const

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: themeColor }}>Separate from sales</p>
        <h2 className="text-2xl font-black text-[#111111]">Advance Orders</h2>
        <p className="mt-1 text-sm text-gray-500">Deposits never count as revenue. Full order value is recognized only after final payment.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setForm(initialForm)
            setDepositSplit(emptySplitInput())
            setCreateOpen(true)
          }}
          style={{ backgroundColor: themeColor, color: textColor, borderColor: themeColor }}
          className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black shadow-md cursor-pointer transition active:scale-95 hover:opacity-90"
        >
          + New Advance Order
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleManualRefresh()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 active:scale-95 transition-all cursor-pointer disabled:opacity-60 min-h-[42px] min-w-[42px] touch-manipulation"
          title="Refresh Advance Orders"
          aria-label="Refresh Advance Orders"
        >
          <RefreshCw size={16} className={`shrink-0 ${loading ? 'animate-spin' : 'text-gray-600'}`} style={loading ? { color: themeColor } : undefined} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, Icon, color, subtext]) => <div key={label} className="rounded-2xl border border-[#F3F4F6] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value}</p><p className="mt-1 text-xs font-semibold text-gray-400">{subtext}</p></div><div className={`rounded-xl p-3 ${color}`}><Icon size={21}/></div></div></div>)}</div>
    <div className="rounded-2xl border border-[#F3F4F6] bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-[#9CA3AF]" size={17}/>
          <input className={`${inputClass} pl-10`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Deposit ID, customer, phone, product or status"/>
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all','pending','ready','completed','cancelled'] as StatusFilter[]).map(value => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              style={statusFilter === value ? { backgroundColor: themeColor, color: textColor } : undefined}
              className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition-all cursor-pointer ${
                statusFilter === value
                  ? 'shadow-xs'
                  : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <select className={inputClass} value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)}>
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-xs font-bold text-gray-700">Custom Date Range:</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]/20"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]/20"
              />
            </label>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => { setCustomStartDate(''); setCustomEndDate('') }}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-200 hover:text-red-600 transition-colors cursor-pointer"
              >
                Reset Dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    <div className="overflow-hidden rounded-2xl border border-[#F3F4F6] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-600">
            <tr>
              {['Deposit ID / Created','Customer','Product','Total / Deposit / Balance','Delivery','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading advance orders...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No advance orders match these filters.</td></tr>
            ) : (
              filtered.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <p className="font-black text-[#111111]">{order.deposit_id}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-IN')} • {new Date(order.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <p className="font-bold text-gray-900">{order.customer_name}</p>
                    <p className="text-xs text-gray-500">{formatPhoneDisplay(order.phone)}</p>
                  </td>
                  <td className="max-w-[180px] px-4 py-3.5 align-middle">
                    <p className="truncate font-semibold text-gray-900">{order.product_name}</p>
                    <p className="truncate text-xs text-gray-500">{order.category || 'Uncategorised'}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs align-middle whitespace-nowrap">
                    <p className="text-gray-700">Total: <b>{formatCurrency(order.total_amount)}</b></p>
                    {order.status === 'completed' ? (
                      <>
                        <p className="text-emerald-700 font-semibold">Paid: <b>{formatCurrency(order.total_amount)}</b></p>
                        <p className="text-emerald-600 font-bold">Balance: <b>₹0.00 (Settled)</b></p>
                      </>
                    ) : (
                      <>
                        <p className="text-[#111111]">Deposit: <b>{formatCurrency(order.deposit_amount)}</b></p>
                        <p className="text-red-600 font-bold">Balance: <b>{formatCurrency(order.remaining_balance)}</b></p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <CalendarDays size={14} className="text-gray-400 shrink-0" />
                      <span>{new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <select
                      value={order.status}
                      disabled={order.status === 'completed' || order.status === 'cancelled'}
                      onChange={e => void changeStatus(order, e.target.value as AdvanceStatus)}
                      className={`rounded-xl border px-2.5 py-1.5 text-xs font-black outline-none shadow-xs transition-colors cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed ${STATUS_STYLES[order.status]}`}
                    >
                      <option value="pending_deposit">Pending Deposit</option>
                      <option value="waiting_final_payment">Waiting for Final Payment</option>
                      <option value="completed">Completed (receive payment)</option>
                      <option value="ready_for_delivery">Ready to Collect</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {/* Receive Balance Button (strictly when not completed, not cancelled, and pending/ready) */}
                      {order.status !== 'completed' &&
                        order.status !== 'cancelled' &&
                        ['pending_deposit', 'waiting_final_payment', 'ready_for_delivery'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => setPaymentOrder(order)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                          title="Receive Remaining Balance"
                        >
                          <span>Receive Balance</span>
                        </button>
                      )}

                      {/* Edit Advance Order Icon (when not completed or cancelled) */}
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => startEditAdvance(order)}
                          style={{ backgroundColor: lightBg, color: themeColor }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 hover:opacity-80"
                          title="Edit Advance Order"
                        >
                          <Edit2 size={15}/>
                        </button>
                      )}

                      {/* View Details Icon */}
                      <button
                        type="button"
                        onClick={() => void openDetails(order)}
                        className="w-8 h-8 rounded-lg bg-[#F9FAFB] hover:bg-gray-100 text-[#111111] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="View Details"
                      >
                        <Eye size={15}/>
                      </button>

                      {/* Delete Icon */}
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(order.id, order.customer_name)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Delete Order"
                      >
                        <Trash2 size={15}/>
                      </button>

                      {/* Print Receipt / Invoice */}
                      <button
                        type="button"
                        onClick={() => order.status === 'completed' ? printFinal(order) : printAdvanceReceipt(order)}
                        className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#B38018] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title={order.status === 'completed' ? "Print Final Receipt" : "Print Advance Receipt"}
                      >
                        <Printer size={15}/>
                      </button>

                      {/* Download PDF Receipt / Invoice */}
                      <button
                        type="button"
                        onClick={() => downloadFile(order.status === 'completed' ? invoiceFile(order) : advanceReceiptPdf(order))}
                        className="w-8 h-8 rounded-lg bg-[#F9FAFB] hover:bg-gray-100 text-[#111111] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title={order.status === 'completed' ? "Download PDF Invoice" : "Download PDF Receipt"}
                      >
                        <Download size={15}/>
                      </button>

                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={() => order.status === 'completed' ? whatsappInvoice(order) : whatsappDepositReceipt(order)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title={order.status === 'completed' ? "Share Final Invoice via WhatsApp" : "Share Advance Receipt via WhatsApp"}
                      >
                        <MessageCircle size={15}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {createOpen && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <form onSubmit={create} className="max-h-full w-full max-w-4xl overflow-hidden overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#F3F4F6]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-[#111111]">Create Advance Order</h3>
              <p className="text-xs text-amber-700">Creates an advance receipt only - no revenue or final invoice.</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer Name *" htmlFor="adv-customer-name"><input id="adv-customer-name" name="customerName" autoComplete="name" required className={inputClass} value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></Field>
            <Field label="Phone Number *" htmlFor="adv-phone-number"><input id="adv-phone-number" name="phone" autoComplete="tel" required className={inputClass} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
            <Field label="Customer Birthday (DOB)" htmlFor="adv-customer-birthday"><input id="adv-customer-birthday" name="customerBirthday" type="date" className={inputClass} value={form.birthday} onChange={e=>setForm({...form,birthday:e.target.value})}/></Field>
            <Field label="Address" htmlFor="adv-address"><textarea id="adv-address" name="address" autoComplete="street-address" className={inputClass} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
            <Field label="Product Name *" htmlFor="adv-product-name"><input id="adv-product-name" name="productName" required list="advance-products" className={inputClass} value={form.productName} onChange={e=>{const product=products.find(p=>p.name===e.target.value);setForm({...form,productName:e.target.value,category:product?.category||form.category})}}/><datalist id="advance-products">{products.map(p=><option key={p.id} value={p.name}/>)}</datalist></Field>
            <Field label="Category" htmlFor="adv-category"><input id="adv-category" name="category" className={inputClass} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></Field>
            <Field label="Description" htmlFor="adv-description"><textarea id="adv-description" name="description" className={inputClass} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
            <Field label="Total Order Amount *" htmlFor="adv-total-amount"><input id="adv-total-amount" name="totalAmount" required min="0.01" step="0.01" type="number" className={inputClass} value={form.totalAmount} onFocus={(e) => e.target.select()} onChange={e=>setForm({...form,totalAmount:e.target.value})}/></Field>
            <Field label="Deposit Amount Received *" htmlFor="adv-deposit-amount"><input id="adv-deposit-amount" name="depositAmount" required min="0" step="0.01" type="number" className={inputClass} value={form.depositAmount} onFocus={(e) => e.target.select()} onChange={e=>setForm({...form,depositAmount:e.target.value})}/></Field>
            <Field label="Remaining Balance (automatic)"><div className="rounded-xl bg-[#F9FAFB] px-4 py-3 font-black text-[#111111] border border-[#F3F4F6]">{formatCurrency(Math.max(0, Number(form.totalAmount||0)-Number(form.depositAmount||0)))}</div></Field>
            <Field label="Deposit Payment Method" htmlFor="adv-payment-method"><select id="adv-payment-method" name="paymentMethod" className={inputClass} value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value as AdvancePaymentMethod})}><option value="cash">Cash</option><option value="upi">QR</option><option value="card">Card</option><option value="split">Split (Cash + QR)</option></select></Field>
            {form.paymentMethod === 'split' && (<div className="md:col-span-2"><SplitPaymentInputs idPrefix="adv-deposit-split" total={Number(form.depositAmount) || 0} value={depositSplit} onChange={setDepositSplit} /></div>)}
            <Field label="Expected Delivery Date *" htmlFor="adv-delivery-date"><input id="adv-delivery-date" name="deliveryDate" required type="date" className={inputClass} value={form.expectedDeliveryDate} onChange={e=>setForm({...form,expectedDeliveryDate:e.target.value})}/></Field>
            <Field label="Order Status" htmlFor="adv-status"><select id="adv-status" name="orderStatus" disabled className={inputClass} value="pending_deposit"><option value="pending_deposit">Pending Deposit</option></select></Field>
            <div className="md:col-span-2"><Field label="Reference Number" htmlFor="adv-reference-number"><input id="adv-reference-number" name="referenceNumber" className={inputClass} value={form.reference_number} onChange={e=>setForm({...form,reference_number:e.target.value})} placeholder="e.g. PO-001, booking ref (optional)"/></Field></div>
            <div className="md:col-span-2"><Field label="Remarks" htmlFor="adv-remarks"><textarea id="adv-remarks" name="remarks" className={inputClass} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})} placeholder="e.g. special instructions, colour, size notes"/></Field></div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={()=>setCreateOpen(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 font-bold cursor-pointer hover:bg-gray-50 transition text-gray-700">Cancel</button>
            <button disabled={saving} style={{ backgroundColor: themeColor, color: textColor, borderColor: themeColor }} className="rounded-xl px-5 py-2.5 font-black border shadow-md disabled:opacity-50 cursor-pointer transition hover:opacity-90">{saving?'Creating...':'Create & Save Advance Receipt'}</button>
          </div>
        </form>
      </div>,
      document.body
    )}

    {paymentOrder && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <form onSubmit={receivePayment} className="w-full max-w-md max-h-full overflow-hidden overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#F3F4F6]">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-600 font-mono">{paymentOrder.deposit_id}</p>
              <h3 className="text-xl font-black text-[#111111]">Receive Remaining Payment</h3>
            </div>
            <button type="button" onClick={()=>setPaymentOrder(null)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition cursor-pointer">
              <X size={16}/>
            </button>
          </div>
          <div className="mb-6 rounded-2xl bg-emerald-50 py-5 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Remaining Balance to Collect</p>
            <p className="mt-1 font-black text-4xl text-emerald-800">{formatCurrency(paymentOrder.remaining_balance)}</p>
            <p className="mt-1.5 text-xs text-emerald-700 font-semibold">Total: {formatCurrency(paymentOrder.total_amount)} • Deposit Paid: {formatCurrency(paymentOrder.deposit_amount)}</p>
          </div>
          <div className="space-y-4">
            <Field label="Payment Method">
              <select className={inputClass} value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value as AdvancePaymentMethod})}>
                <option value="cash">Cash</option>
                <option value="upi">QR</option>
                <option value="card">Card</option>
                <option value="split">Split (Cash + QR)</option>
              </select>
            </Field>
            {paymentForm.method === 'split' && (
              <SplitPaymentInputs idPrefix="adv-final-split" total={finalAmountFor(paymentOrder)} value={finalSplit} onChange={setFinalSplit} />
            )}
            <Field label="Payment Notes">
              <textarea className={inputClass} value={paymentForm.remarks} onChange={e=>setPaymentForm({...paymentForm,remarks:e.target.value})} placeholder="Notes about this payment (optional)"/>
            </Field>
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">Confirmation marks the order Completed, creates one official invoice, and recognizes the full {formatCurrency(paymentOrder.total_amount)} as revenue.</p>
            <button disabled={saving} className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 font-black text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer hover:bg-emerald-700">
              {saving?'Processing...':'Confirm Final Payment'}
            </button>
          </div>
        </form>
      </div>,
      document.body
    )}

    {selected && createPortal(
      <div className="fixed inset-0 z-[9999] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={() => setSelected(null)} />

        {/* Drawer Panel covering full view height */}
        <div className="relative z-10 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col border-l border-[#F3F4F6] animate-in slide-in-from-right duration-200">
          {/* Sticky Drawer Header */}
          <div className="shrink-0 px-6 py-4 border-b border-white/20 text-white flex items-center justify-between" style={{ backgroundColor: themeColor, color: textColor }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl border border-white/30 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: textColor }}>
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider font-mono opacity-90" style={{ color: textColor }}>{selected.deposit_id}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_STYLES[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <h3 className="text-base font-black tracking-wide" style={{ color: textColor }}>Order Details</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Drawer Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
            {(() => {
              const subtotal = Number(selected.subtotal ?? (
                selected.products && selected.products.length > 0
                  ? selected.products.reduce((acc, p) => acc + (Number(p.quantity ?? p.qty ?? 1) * Number(p.base_price ?? p.price ?? 0)), 0)
                  : selected.total_amount
              )) || selected.total_amount

              const deliveryCharge = Number(selected.delivery_charge || 0)
              const couponDiscount = Number(selected.coupon_discount || (selected.coupon_code ? selected.discount_amount : 0) || 0)
              const manualDiscount = Number(selected.manual_discount || (!selected.coupon_code && !selected.coupon_discount ? selected.discount_amount : 0) || 0)

              let totalGst = Number(selected.total_gst || 0)
              let cgstAmount = Number(selected.cgst_amount || 0)
              let sgstAmount = Number(selected.sgst_amount || 0)
              let gstRate = Number(selected.gst_rate || 0)

              if (totalGst === 0 && cgstAmount === 0 && sgstAmount === 0) {
                const diff = Math.round((selected.total_amount - (subtotal + deliveryCharge - couponDiscount - manualDiscount)) * 100) / 100
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

              const gstLabel = gstRate > 0 ? ` (${(gstRate / 2).toFixed(1).replace(/\.0$/, '')}%)` : ''

              const bdayMap = getLocalBirthdaysMap()
              const phoneKey = normalizePhone(selected.phone) || selected.phone.replace(/\D/g, '')
              const custBday = bdayMap[phoneKey]?.birthday

              const infoCards: Array<[string, string]> = [
                ['Customer', selected.customer_name],
                ['Phone', formatPhoneDisplay(selected.phone)],
                ...(custBday ? [['Birthday (DOB)', `${new Date(`${custBday}T00:00:00`).toLocaleDateString('en-IN')} 🎂`]] as Array<[string, string]> : []),
                ['Address', selected.address || '-'],
                ['Product', selected.product_name],
                ['Category', selected.category || '-'],
                ['Delivery Date', new Date(`${selected.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN')],
                ['Reference No', selected.reference_number || '—'],
                ['Invoice Number', selected.invoice_number || 'Not generated'],
                ['Created Date', new Date(selected.created_at).toLocaleDateString('en-IN')],
                ['Current Status', STATUS_LABELS[selected.status]],
              ]

              return (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {infoCards.map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                        <p className="text-[10px] font-black uppercase text-gray-500">{k}</p>
                        <p className="mt-1 break-words text-sm font-bold text-gray-900">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className="rounded-xl border border-gray-200 bg-[#FBFAF6] p-4 space-y-2.5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#171717]">Financial Summary & Taxes</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-700">
                        <span>Subtotal</span>
                        <span className="font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Coupon Discount {selected.coupon_code ? `(${selected.coupon_code})` : ''}</span>
                          <span className="font-bold">-{formatCurrency(couponDiscount)}</span>
                        </div>
                      )}
                      {manualDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Manual Discount</span>
                          <span className="font-bold">-{formatCurrency(manualDiscount)}</span>
                        </div>
                      )}
                      {cgstAmount > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span>CGST{gstLabel}</span>
                          <span className="font-bold text-gray-900">+{formatCurrency(cgstAmount)}</span>
                        </div>
                      )}
                      {sgstAmount > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span>SGST{gstLabel}</span>
                          <span className="font-bold text-gray-900">+{formatCurrency(sgstAmount)}</span>
                        </div>
                      )}
                      {deliveryCharge > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span>Delivery Charges</span>
                          <span className="font-bold text-gray-900">+{formatCurrency(deliveryCharge)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-sm text-gray-900">
                        <span>Total Order Amount</span>
                        <span>{formatCurrency(selected.total_amount)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-700">
                        <span>Advance Paid</span>
                        <span className="font-bold text-gray-900">{formatCurrency(selected.deposit_amount)}</span>
                      </div>
                      <div className="border-t border-dashed border-amber-300 pt-2 flex justify-between font-black text-sm text-[#B45309]">
                        <span>Remaining Balance</span>
                        <span>{selected.status === 'completed' ? '₹0.00 (Fully Settled)' : formatCurrency(selected.remaining_balance)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Products breakdown if available */}
                  {Array.isArray(selected.products) && selected.products.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2">
                      <p className="text-[11px] font-black uppercase text-gray-600">Booked Items ({selected.products.length})</p>
                      <div className="divide-y divide-gray-100 text-xs">
                        {selected.products.map((p, idx) => {
                          const pName = String(p.name ?? p.product_name ?? 'Item')
                          const pQty = Number(p.quantity ?? p.qty ?? 1)
                          const pRate = Number(p.base_price ?? p.price ?? 0)
                          const pTotal = Number(p.line_total ?? (pQty * pRate))
                          const pUnit = p.unit ? ` (${p.unit})` : ''
                          return (
                            <div key={idx} className="py-1.5 flex justify-between items-center">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-gray-900 truncate">{pName}</p>
                                <p className="text-[10px] text-gray-500">{pQty}{pUnit} × {formatCurrency(pRate)}</p>
                              </div>
                              <span className="font-black text-gray-900 shrink-0">{formatCurrency(pTotal)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {selected.remarks && (
              <div className="rounded-xl border border-gray-200 bg-[#F9FAFB] p-3.5">
                <p className="text-[10px] font-black uppercase text-[#111111]">Remarks</p>
                <p className="mt-1 text-sm text-gray-900 font-medium">{selected.remarks}</p>
              </div>
            )}

            {selected.description && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                <p className="text-[10px] font-black uppercase text-gray-500">Description</p>
                <p className="mt-1 text-sm text-gray-800">{selected.description}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-black text-gray-900">Quick Timeline Updates</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['order_confirmed', 'Order Confirmed'],
                  ['order_packed', 'Order Packed'],
                  ['ready_for_delivery', 'Ready for Delivery'],
                  ['customer_contacted', 'Customer Contacted'],
                  ['delivered', 'Delivered'],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => void addEvent(selected, type, label)}
                    className="rounded-lg border border-gray-200 bg-[#F9FAFB] hover:bg-gray-100 px-3 py-2 text-xs font-black text-[#111111] transition cursor-pointer"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-gray-900">Payment History</h4>
              <div className="mt-2 space-y-2">
                {payments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm">
                      <span className="font-bold capitalize text-emerald-900">{payment.payment_type} — {formatPaymentLabel(payment.payment_method, payment.split_details)}</span>
                      <span className="font-black text-emerald-800">{formatCurrency(Number(payment.amount))}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-gray-900">Order Timeline</h4>
              <div className="mt-3 border-l-2 border-gray-200 pl-4 space-y-4">
                {timeline.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No timeline events recorded.</p>
                ) : (
                  timeline.map((event) => (
                    <div key={event.id} className="relative pb-2 before:absolute before:-left-[21px] before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-[#171717]">
                      <p className="text-sm font-black text-gray-900">{event.label}</p>
                      <p className="text-xs text-gray-500">{new Date(event.created_at).toLocaleString('en-IN')}</p>
                      {event.remarks && <p className="mt-1 text-xs text-gray-600 bg-white/70 p-2 rounded-lg border border-gray-100">{event.remarks}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selected
                    setSelected(null)
                    startEditAdvance(toEdit)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#171717]/10 text-[#171717] border border-[#171717]/20 text-xs font-bold hover:bg-[#171717]/20 cursor-pointer transition shadow-xs"
                >
                  <Edit2 size={14} /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => downloadFile(selected.status === 'completed' ? invoiceFile(selected) : advanceReceiptPdf(selected))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer transition shadow-xs"
                title={selected.status === 'completed' ? 'Download PDF Invoice' : 'Download PDF Receipt'}
              >
                <Download size={14} /> PDF
              </button>
              <button
                type="button"
                onClick={() => selected.status === 'completed' ? whatsappInvoice(selected) : whatsappDepositReceipt(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 cursor-pointer transition shadow-xs"
                title="Share via WhatsApp"
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-5 py-2 rounded-xl bg-[#171717] hover:bg-[#303030] text-[#B8B8B8] text-xs font-black cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Modal: Edit Advance Order */}
    {editingOrder && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <form onSubmit={saveEditAdvance} className="max-h-full w-full max-w-3xl overflow-hidden overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#F3F4F6]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#B38018] font-mono">{editingOrder.deposit_id}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_STYLES[editingOrder.status]}`}>
                  {STATUS_LABELS[editingOrder.status]}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#111111] mt-0.5">Edit Advance Order</h3>
              <p className="text-xs text-gray-500">Modify customer, items, amounts, delivery date, or remarks.</p>
            </div>
            <button type="button" onClick={() => setEditingOrder(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer Name *" htmlFor="edit-adv-name">
              <input id="edit-adv-name" name="customerName" required className={inputClass} value={editForm.customerName} onChange={e => setEditForm({ ...editForm, customerName: e.target.value })} />
            </Field>
            <Field label="Phone Number *" htmlFor="edit-adv-phone">
              <input id="edit-adv-phone" name="phone" required className={inputClass} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </Field>
            <Field label="Delivery Address" htmlFor="edit-adv-address">
              <textarea id="edit-adv-address" name="address" className={inputClass} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
            </Field>
            <Field label="Product Name *" htmlFor="edit-adv-product">
              <input id="edit-adv-product" name="productName" required className={inputClass} value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })} />
            </Field>
            <Field label="Category" htmlFor="edit-adv-cat">
              <input id="edit-adv-cat" name="category" className={inputClass} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="edit-adv-desc">
              <textarea id="edit-adv-desc" name="description" className={inputClass} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </Field>
            <Field label="Total Order Amount *" htmlFor="edit-adv-total">
              <input id="edit-adv-total" name="totalAmount" required min="0.01" step="0.01" type="number" className={inputClass} value={editForm.totalAmount} onFocus={(e) => e.target.select()} onChange={e => setEditForm({ ...editForm, totalAmount: e.target.value })} />
            </Field>
            <Field label="Deposit Amount Received *" htmlFor="edit-adv-deposit">
              <input id="edit-adv-deposit" name="depositAmount" required min="0" step="0.01" type="number" className={inputClass} value={editForm.depositAmount} onFocus={(e) => e.target.select()} onChange={e => setEditForm({ ...editForm, depositAmount: e.target.value })} />
            </Field>
            <Field label="Remaining Balance (automatic)">
              <div className="rounded-xl bg-[#F9FAFB] px-4 py-3 font-black text-[#111111] border border-[#F3F4F6]">
                {formatCurrency(Math.max(0, Number(editForm.totalAmount || 0) - Number(editForm.depositAmount || 0)))}
              </div>
            </Field>
            <Field label="Expected Delivery Date *" htmlFor="edit-adv-delivery">
              <input id="edit-adv-delivery" name="deliveryDate" required type="date" className={inputClass} value={editForm.expectedDeliveryDate} onChange={e => setEditForm({ ...editForm, expectedDeliveryDate: e.target.value })} />
            </Field>
            <Field label="Order Status" htmlFor="edit-adv-status">
              <select id="edit-adv-status" name="orderStatus" className={inputClass} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as AdvanceStatus })}>
                <option value="pending_deposit">Pending Deposit</option>
                <option value="waiting_final_payment">Waiting for Final Payment</option>
                <option value="ready_for_delivery">Ready to Collect</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Reference Number" htmlFor="edit-adv-ref">
              <input id="edit-adv-ref" name="referenceNumber" className={inputClass} value={editForm.referenceNumber} onChange={e => setEditForm({ ...editForm, referenceNumber: e.target.value })} placeholder="e.g. PO-001, booking ref (optional)" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Remarks" htmlFor="edit-adv-remarks">
                <textarea id="edit-adv-remarks" name="remarks" className={inputClass} value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} placeholder="e.g. special instructions, colour, size notes" />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setEditingOrder(null)} className="rounded-xl border border-gray-200 px-5 py-2.5 font-bold cursor-pointer hover:bg-gray-50 transition text-gray-700">Cancel</button>
            <button
              disabled={savingEdit}
              style={{ backgroundColor: themeColor, color: textColor, borderColor: themeColor }}
              className="rounded-xl border px-5 py-2.5 font-black shadow-md disabled:opacity-50 cursor-pointer transition hover:opacity-90"
            >
              {savingEdit ? 'Updating Order...' : 'Save & Update Values'}
            </button>
          </div>
        </form>
      </div>,
      document.body
    )}

    {/* Modal: Order Completed & Final Payment Received */}
    {completionModalOrder && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#F3F4F6] text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-xs">
            <CheckCircle2 size={32} />
          </div>

          <h3 className="text-xl font-black text-[#111111]">Payment Received & Completed!</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Invoice <span className="font-mono font-bold" style={{ color: themeColor }}>#{formatInvoiceNo(completionModalOrder.invoice_number || completionModalOrder.deposit_id)}</span> generated successfully.
          </p>

          <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Customer</span>
              <span className="font-bold text-gray-900 break-words max-w-[200px] text-right">{completionModalOrder.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Phone</span>
              <span className="font-bold text-gray-900">{formatPhoneDisplay(completionModalOrder.phone) || completionModalOrder.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Payment Mode</span>
              <span className="font-bold text-gray-900">{formatPaymentLabel(completionModalOrder.final_payment_method, completionModalOrder.split_details)}</span>
            </div>
            {completionModalOrder.coupon_code && (
              <div className="flex justify-between">
                <span className="text-emerald-700 font-semibold">Coupon ({completionModalOrder.coupon_code})</span>
                <span className="font-bold text-emerald-700">-{formatCurrency(completionModalOrder.coupon_discount || completionModalOrder.discount_amount || 0)}</span>
              </div>
            )}
            {Number(completionModalOrder.manual_discount || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-emerald-700 font-semibold">Manual Discount</span>
                <span className="font-bold text-emerald-700">-{formatCurrency(Number(completionModalOrder.manual_discount || 0))}</span>
              </div>
            )}
            {Number(completionModalOrder.delivery_charge || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Delivery Charge</span>
                <span className="font-bold text-gray-900">+{formatCurrency(Number(completionModalOrder.delivery_charge || 0))}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-black">
              <span className="text-gray-900">Total Settled</span>
              <span className="text-emerald-700">{formatCurrency(completionModalOrder.total_amount)}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => printFinal(completionModalOrder)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#171717] hover:bg-[#303030] text-[#B8B8B8] border border-[#B8B8B8]/40 py-3 text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer size={16} />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => whatsappInvoice(completionModalOrder)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] py-3 text-xs font-black text-white shadow-sm transition active:scale-95 cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                const file = invoiceFile(completionModalOrder)
                downloadFile(file)
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-2.5 text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Download Invoice PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCompletionModalOrder(null)}
            className="mt-3 w-full rounded-xl bg-gray-100 hover:bg-gray-200 py-2.5 text-xs font-bold text-gray-600 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    )}

    {/* Modal: Advance Deposit Created */}
    {createdDepositModal && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#F3F4F6] text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-[#B38018] border border-amber-200 shadow-xs">
            <PackageCheck size={32} />
          </div>

          <h3 className="text-xl font-black text-[#111111]">Advance Order Created!</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Deposit Slip <span className="font-mono font-bold text-[#171717]">{createdDepositModal.deposit_id}</span> generated.
          </p>

          <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Customer</span>
              <span className="font-bold text-gray-900 break-words max-w-[200px] text-right">{createdDepositModal.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Phone</span>
              <span className="font-bold text-gray-900">{formatPhoneDisplay(createdDepositModal.phone) || createdDepositModal.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Total Order Value</span>
              <span className="font-bold text-gray-900">{formatCurrency(createdDepositModal.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700 font-semibold">Deposit Paid</span>
              <span className="font-bold text-emerald-700">{formatCurrency(createdDepositModal.deposit_amount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-black">
              <span className="text-amber-800">Remaining Balance</span>
              <span className="text-amber-800">{formatCurrency(createdDepositModal.remaining_balance)}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => printAdvanceReceipt(createdDepositModal)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#171717] hover:bg-[#303030] text-[#B8B8B8] border border-[#B8B8B8]/40 py-3 text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer size={16} />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => whatsappDepositReceipt(createdDepositModal)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] py-3 text-xs font-black text-white shadow-sm transition active:scale-95 cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                const file = advanceReceiptPdf(createdDepositModal)
                downloadFile(file)
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-2.5 text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Download Deposit PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCreatedDepositModal(null)}
            className="mt-3 w-full rounded-xl bg-gray-100 hover:bg-gray-200 py-2.5 text-xs font-bold text-gray-600 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    )}
  </div>
}
