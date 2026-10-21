import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { parseSplit, splitTotal, type SplitDetails } from '../lib/payments'
import { useProductStore, useVariantStore } from '../store/store'

export type AdvanceStatus = 'pending_deposit' | 'ready_for_delivery' | 'waiting_final_payment' | 'completed' | 'cancelled'
export type AdvancePaymentMethod = 'cash' | 'upi' | 'card' | 'split'

export type AdvanceOrder = {
  id: string
  deposit_id: string
  customer_name: string
  phone: string
  address: string
  product_name: string
  products: Array<Record<string, unknown>>
  category: string
  description: string
  total_amount: number
  deposit_amount: number
  remaining_balance: number
  expected_delivery_date: string
  status: AdvanceStatus
  remarks: string
  reference_number: string
  created_by_name: string
  created_at: string
  updated_at: string
  completed_at: string | null
  completed_order_id: string | null
  invoice_number: string | null
  final_payment_method: string | null
  /** Full cash / QR / card amounts collected for this order (deposit + final payment). */
  split_details?: SplitDetails
  subtotal?: number
  delivery_charge?: number
  discount_amount?: number
  coupon_code?: string | null
  coupon_discount?: number
  manual_discount?: number
  gst_enabled?: boolean
  total_gst?: number
  gst_rate?: number
  cgst_amount?: number
  sgst_amount?: number
}

export type AdvanceTimeline = { id: number; advance_order_id: string; event_type: string; label: string; remarks: string; created_at: string }
export type AdvancePayment = { id: string; advance_order_id: string; payment_type: 'deposit' | 'remaining'; amount: number; payment_method: string; split_details?: unknown; remarks: string; received_at: string }

const STORAGE_ORDERS_KEY = 'universal_look_advance_orders_v1'
const STORAGE_TIMELINE_KEY = 'universal_look_advance_timeline_v1'
const STORAGE_PAYMENTS_KEY = 'universal_look_advance_payments_v1'

const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

const isNumeric = (s: string) => /^\d+$/.test(s)

const loadLocalOrders = (): AdvanceOrder[] => {
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY)
    return raw ? (JSON.parse(raw) as AdvanceOrder[]) : []
  } catch {
    return []
  }
}

const saveLocalOrders = (orders: AdvanceOrder[]) => {
  try {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders))
  } catch { /* ignore */ }
}

const loadLocalTimeline = (): AdvanceTimeline[] => {
  try {
    const raw = localStorage.getItem(STORAGE_TIMELINE_KEY)
    return raw ? (JSON.parse(raw) as AdvanceTimeline[]) : []
  } catch {
    return []
  }
}

const saveLocalTimeline = (timeline: AdvanceTimeline[]) => {
  try {
    localStorage.setItem(STORAGE_TIMELINE_KEY, JSON.stringify(timeline))
  } catch { /* ignore */ }
}

const loadLocalPayments = (): AdvancePayment[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PAYMENTS_KEY)
    return raw ? (JSON.parse(raw) as AdvancePayment[]) : []
  } catch {
    return []
  }
}

const saveLocalPayments = (payments: AdvancePayment[]) => {
  try {
    localStorage.setItem(STORAGE_PAYMENTS_KEY, JSON.stringify(payments))
  } catch { /* ignore */ }
}

const normalizeOrder = (row: Record<string, unknown>): AdvanceOrder => {
  const isCompleted = row.status === 'completed'
  const total = Number(row.total_amount || 0)
  const deposit = Number(row.deposit_amount || 0)
  const calculatedRemaining = Number(row.remaining_balance ?? (total - deposit))

  const subtotalRaw = row.subtotal !== null && row.subtotal !== undefined ? Number(row.subtotal) : undefined
  const deliveryCharge = Number(row.delivery_charge || 0)
  const discountAmount = Number(row.discount_amount || 0)
  const couponCode = row.coupon_code ? String(row.coupon_code) : null
  const couponDiscount = Number(row.coupon_discount || 0)
  const manualDiscount = Number(row.manual_discount || 0)
  const gstEnabled = Boolean(row.gst_enabled)
  const totalGst = Number(row.total_gst || 0)
  const gstRate = Number(row.gst_rate || 0)
  const cgstAmount = Number(row.cgst_amount || 0)
  const sgstAmount = Number(row.sgst_amount || 0)

  const prods = Array.isArray(row.products) ? (row.products as Array<Record<string, unknown>>) : []
  let resolvedSubtotal = subtotalRaw
  let resolvedTotalGst = totalGst
  let resolvedCgst = cgstAmount
  let resolvedSgst = sgstAmount
  let resolvedGstEnabled = gstEnabled
  let resolvedGstRate = gstRate

  if (resolvedSubtotal === undefined && prods.length > 0) {
    const sumBase = prods.reduce((acc, p) => acc + (Number(p.quantity ?? p.qty ?? 1) * Number(p.base_price ?? p.price ?? 0)), 0)
    if (sumBase > 0) {
      resolvedSubtotal = sumBase
      const diff = total - sumBase
      if (diff > 0 && resolvedTotalGst === 0 && deliveryCharge === 0) {
        resolvedGstEnabled = true
        resolvedTotalGst = diff
        resolvedCgst = Math.round((diff / 2) * 100) / 100
        resolvedSgst = Math.round((diff / 2) * 100) / 100
        resolvedGstRate = Math.round((diff / sumBase) * 10000) / 100
      }
    } else {
      resolvedSubtotal = total
    }
  } else if (resolvedSubtotal === undefined) {
    resolvedSubtotal = total
  }

  return {
    ...row,
    id: String(row.id || ''),
    deposit_id: String(row.deposit_id || ''),
    customer_name: String(row.customer_name || ''),
    phone: String(row.phone || ''),
    address: String(row.address || ''),
    product_name: String(row.product_name || ''),
    products: prods,
    category: String(row.category || ''),
    description: String(row.description || ''),
    total_amount: total,
    deposit_amount: deposit,
    remaining_balance: isCompleted ? 0 : Math.max(0, calculatedRemaining),
    expected_delivery_date: String(row.expected_delivery_date || ''),
    status: String(row.status || 'pending_deposit') as AdvanceStatus,
    remarks: String(row.remarks || ''),
    reference_number: String(row.reference_number || ''),
    created_by_name: String(row.created_by_name || ''),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    completed_order_id: row.completed_order_id ? String(row.completed_order_id) : null,
    invoice_number: row.invoice_number ? String(row.invoice_number) : null,
    final_payment_method: row.final_payment_method ? String(row.final_payment_method) : null,
    subtotal: resolvedSubtotal,
    delivery_charge: deliveryCharge,
    discount_amount: discountAmount,
    coupon_code: couponCode,
    coupon_discount: couponDiscount,
    manual_discount: manualDiscount,
    gst_enabled: resolvedGstEnabled,
    total_gst: resolvedTotalGst,
    gst_rate: resolvedGstRate,
    cgst_amount: resolvedCgst,
    sgst_amount: resolvedSgst,
  }
}

const rpcRow = (data: unknown) => (Array.isArray(data) ? data[0] : data) as Record<string, unknown>

/**
 * Deducts stock from inventory (product_variants and products) when an advance order is booked,
 * recording SALE movements in the audit ledger.
 */
export async function deductAdvanceOrderStock(
  products: Array<Record<string, unknown>>,
  depositId: string,
  staffName = 'Staff'
): Promise<void> {
  if (!Array.isArray(products) || products.length === 0) return

  if (isSupabaseConfigured) {
    for (const item of products) {
      try {
        const isManual = Boolean(item.is_manual ?? item.isManual ?? false)
        const category = String(item.category ?? '').trim()
        if (isManual || category.toLowerCase() === 'unregistered') {
          continue
        }

        const quantity = Math.max(0, Number(item.quantity ?? item.qty ?? 1))
        if (quantity <= 0) continue

        let variantId = item.variant_id ?? item.variantId ? String(item.variant_id ?? item.variantId).trim() : null
        let productIdRaw = item.product_id ?? item.productId ? String(item.product_id ?? item.productId).trim() : null
        const name = String(item.name ?? item.product_name ?? 'Product').trim()

        // If product_id looks like a UUID and no variant_id was provided, it's actually a variant ID
        if (!variantId && productIdRaw && isUUID(productIdRaw)) {
          variantId = productIdRaw
          productIdRaw = null
        }

        // If neither variantId nor productIdRaw is provided, try looking up product by name
        if (!variantId && !productIdRaw && name) {
          try {
            const { data: matchedProd } = await supabase
              .from('products')
              .select('id')
              .eq('name', name)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (matchedProd?.id) {
              productIdRaw = String(matchedProd.id)
            }
          } catch { /* optional */ }
        }

        // Case 1: Variant item
        if (variantId && isUUID(variantId)) {
          const { data: vData, error: vErr } = await supabase
            .from('product_variants')
            .select('id, product_id, stock')
            .eq('id', variantId)
            .maybeSingle()

          if (vErr || !vData) {
            console.warn('[deductAdvanceOrderStock] Variant not found:', variantId, vErr?.message)
            continue
          }

          const currentStock = Number(vData.stock || 0)
          const newStock = Math.max(0, currentStock - quantity)
          const parentProductId = vData.product_id || (productIdRaw && isNumeric(productIdRaw) ? Number(productIdRaw) : null)

          // 1. Update variant stock
          const { error: updVErr } = await supabase
            .from('product_variants')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', variantId)
          if (updVErr) console.error('[deductAdvanceOrderStock] Failed to update variant stock:', updVErr.message)

          // 2. Update parent product aggregate stock
          if (parentProductId) {
            const { data: siblingVars } = await supabase
              .from('product_variants')
              .select('stock')
              .eq('product_id', parentProductId)
              .eq('is_active', true)
            const totalStock = (siblingVars || []).reduce((sum, v) => sum + Number(v.stock || 0), 0)
            await supabase
              .from('products')
              .update({
                stock_quantity: totalStock,
                stock: Math.floor(totalStock),
                updated_at: new Date().toISOString(),
              })
              .eq('id', parentProductId)
          }

          // 3. Lookup active barcode
          let barcodeId: string | null = null
          try {
            const { data: bData } = await supabase
              .from('barcode_registry')
              .select('id')
              .eq('variant_id', variantId)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (bData?.id) barcodeId = bData.id
          } catch { /* optional */ }

          // 4. Log SALE movement
          await supabase.from('inventory_movements').insert({
            product_id: parentProductId ? Number(parentProductId) : null,
            variant_id: variantId,
            barcode_id: barcodeId,
            movement_type: 'SALE',
            quantity_delta: -quantity,
            quantity_before: currentStock,
            quantity_after: newStock,
            reference_type: 'advance_order',
            reference_id: depositId,
            note: `Advance order deposit booked (${name})`,
            created_by_name: staffName || 'Staff',
            created_at: new Date().toISOString(),
          })
          continue
        }

        // Case 2: Standalone product
        if (productIdRaw && isNumeric(productIdRaw)) {
          const numId = Number(productIdRaw)
          const { data: pData, error: pErr } = await supabase
            .from('products')
            .select('id, stock_quantity, stock')
            .eq('id', numId)
            .maybeSingle()

          if (pErr || !pData) {
            console.warn('[deductAdvanceOrderStock] Product not found:', numId, pErr?.message)
            continue
          }

          const currentStock = Number(pData.stock_quantity ?? pData.stock ?? 0)
          const newStock = Math.max(0, currentStock - quantity)

          // 1. Update product stock
          await supabase
            .from('products')
            .update({
              stock_quantity: newStock,
              stock: Math.floor(newStock),
              updated_at: new Date().toISOString(),
            })
            .eq('id', numId)

          // 2. Lookup active barcode
          let barcodeId: string | null = null
          try {
            const { data: bData } = await supabase
              .from('barcode_registry')
              .select('id')
              .eq('product_id', numId)
              .is('variant_id', null)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (bData?.id) barcodeId = bData.id
          } catch { /* optional */ }

          // 3. Log SALE movement
          await supabase.from('inventory_movements').insert({
            product_id: numId,
            variant_id: null,
            barcode_id: barcodeId,
            movement_type: 'SALE',
            quantity_delta: -quantity,
            quantity_before: currentStock,
            quantity_after: newStock,
            reference_type: 'advance_order',
            reference_id: depositId,
            note: `Advance order deposit booked (${name})`,
            created_by_name: staffName || 'Staff',
            created_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[deductAdvanceOrderStock] Item deduction error:', err)
      }
    }
  }

  // Refresh frontend product stores
  try {
    void useProductStore.getState().fetchProducts(true)
    void useVariantStore.getState().fetchVariants()
  } catch { /* optional */ }
}

/**
 * Restores stock to inventory when an advance order is cancelled or deleted, recording RETURN movements.
 */
export async function restoreAdvanceOrderStock(
  products: Array<Record<string, unknown>>,
  depositId: string,
  staffName = 'Staff',
  reason: 'cancelled' | 'deleted' = 'cancelled'
): Promise<void> {
  if (!Array.isArray(products) || products.length === 0) return

  if (isSupabaseConfigured) {
    try {
      // 1. Guard against double-restoring stock
      const { data: existingReturns } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('reference_type', 'advance_order')
        .eq('reference_id', depositId)
        .eq('movement_type', 'RETURN')
        .limit(1)

      if (existingReturns && existingReturns.length > 0) {
        console.info(`[restoreAdvanceOrderStock] Stock for ${depositId} already restored; skipping.`)
        return
      }

      // 2. Guard against restoring stock for legacy orders that never had stock deducted
      const { data: existingSales } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('reference_type', 'advance_order')
        .eq('reference_id', depositId)
        .eq('movement_type', 'SALE')
        .limit(1)

      if (!existingSales || existingSales.length === 0) {
        console.info(`[restoreAdvanceOrderStock] No prior SALE movement found for ${depositId}; skipping restoration.`)
        return
      }
    } catch (checkErr) {
      console.warn('[restoreAdvanceOrderStock] Error checking movements ledger:', checkErr)
    }

    for (const item of products) {
      try {
        const isManual = Boolean(item.is_manual ?? item.isManual ?? false)
        const category = String(item.category ?? '').trim()
        if (isManual || category.toLowerCase() === 'unregistered') {
          continue
        }

        const quantity = Math.max(0, Number(item.quantity ?? item.qty ?? 1))
        if (quantity <= 0) continue

        let variantId = item.variant_id ?? item.variantId ? String(item.variant_id ?? item.variantId).trim() : null
        let productIdRaw = item.product_id ?? item.productId ? String(item.product_id ?? item.productId).trim() : null
        const name = String(item.name ?? item.product_name ?? 'Product').trim()

        if (!variantId && productIdRaw && isUUID(productIdRaw)) {
          variantId = productIdRaw
          productIdRaw = null
        }

        if (!variantId && !productIdRaw && name) {
          try {
            const { data: matchedProd } = await supabase
              .from('products')
              .select('id')
              .eq('name', name)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (matchedProd?.id) {
              productIdRaw = String(matchedProd.id)
            }
          } catch { /* optional */ }
        }

        // Case 1: Variant item
        if (variantId && isUUID(variantId)) {
          const { data: vData } = await supabase
            .from('product_variants')
            .select('id, product_id, stock')
            .eq('id', variantId)
            .maybeSingle()

          if (!vData) continue

          const currentStock = Number(vData.stock || 0)
          const newStock = currentStock + quantity
          const parentProductId = vData.product_id || (productIdRaw && isNumeric(productIdRaw) ? Number(productIdRaw) : null)

          await supabase
            .from('product_variants')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', variantId)

          if (parentProductId) {
            const { data: siblingVars } = await supabase
              .from('product_variants')
              .select('stock')
              .eq('product_id', parentProductId)
              .eq('is_active', true)
            const totalStock = (siblingVars || []).reduce((sum, v) => sum + Number(v.stock || 0), 0)
            await supabase
              .from('products')
              .update({
                stock_quantity: totalStock,
                stock: Math.floor(totalStock),
                updated_at: new Date().toISOString(),
              })
              .eq('id', parentProductId)
          }

          let barcodeId: string | null = null
          try {
            const { data: bData } = await supabase
              .from('barcode_registry')
              .select('id')
              .eq('variant_id', variantId)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (bData?.id) barcodeId = bData.id
          } catch { /* optional */ }

          await supabase.from('inventory_movements').insert({
            product_id: parentProductId ? Number(parentProductId) : null,
            variant_id: variantId,
            barcode_id: barcodeId,
            movement_type: 'RETURN',
            quantity_delta: quantity,
            quantity_before: currentStock,
            quantity_after: newStock,
            reference_type: 'advance_order',
            reference_id: depositId,
            note: `Advance order ${reason} - stock restored (${name})`,
            created_by_name: staffName || 'Staff',
            created_at: new Date().toISOString(),
          })
          continue
        }

        // Case 2: Standalone product
        if (productIdRaw && isNumeric(productIdRaw)) {
          const numId = Number(productIdRaw)
          const { data: pData } = await supabase
            .from('products')
            .select('id, stock_quantity, stock')
            .eq('id', numId)
            .maybeSingle()

          if (!pData) continue

          const currentStock = Number(pData.stock_quantity ?? pData.stock ?? 0)
          const newStock = currentStock + quantity

          await supabase
            .from('products')
            .update({
              stock_quantity: newStock,
              stock: Math.floor(newStock),
              updated_at: new Date().toISOString(),
            })
            .eq('id', numId)

          let barcodeId: string | null = null
          try {
            const { data: bData } = await supabase
              .from('barcode_registry')
              .select('id')
              .eq('product_id', numId)
              .is('variant_id', null)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (bData?.id) barcodeId = bData.id
          } catch { /* optional */ }

          await supabase.from('inventory_movements').insert({
            product_id: numId,
            variant_id: null,
            barcode_id: barcodeId,
            movement_type: 'RETURN',
            quantity_delta: quantity,
            quantity_before: currentStock,
            quantity_after: newStock,
            reference_type: 'advance_order',
            reference_id: depositId,
            note: `Advance order ${reason} - stock restored (${name})`,
            created_by_name: staffName || 'Staff',
            created_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[restoreAdvanceOrderStock] Item restoration error:', err)
      }
    }
  }

  // Refresh frontend product stores
  try {
    void useProductStore.getState().fetchProducts(true)
    void useVariantStore.getState().fetchVariants()
  } catch { /* optional */ }
}

export async function deleteAdvanceOrder(orderId: string): Promise<void> {
  // 1. Fetch existing order to check status and products
  let existing: AdvanceOrder | null = null
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('advance_orders').select('*').eq('id', orderId).maybeSingle()
      if (data) existing = normalizeOrder(data)
    } catch { /* fallback */ }
  }
  if (!existing) {
    existing = loadLocalOrders().find(o => o.id === orderId) || null
  }

  // 2. Restore stock if the order was active (not completed and not cancelled)
  if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
    try {
      await restoreAdvanceOrderStock(existing.products, existing.deposit_id, 'Staff', 'deleted')
    } catch (err) {
      console.error('[deleteAdvanceOrder] Failed to restore stock on deletion:', err)
    }
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('advance_orders').delete().eq('id', orderId)
    if (error) throw new Error(error.message)
  }

  // Clean up local storage
  const localOrders = loadLocalOrders().filter(o => o.id !== orderId)
  saveLocalOrders(localOrders)

  const localTimeline = loadLocalTimeline().filter(t => t.advance_order_id !== orderId)
  saveLocalTimeline(localTimeline)

  const localPayments = loadLocalPayments().filter(p => p.advance_order_id !== orderId)
  saveLocalPayments(localPayments)

  try {
    void useProductStore.getState().fetchProducts(true)
    void useVariantStore.getState().fetchVariants()
  } catch { /* optional */ }
}

export async function listAdvanceOrders(throwOnError = false): Promise<AdvanceOrder[]> {
  const local = loadLocalOrders()
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('advance_orders').select('*').order('created_at', { ascending: false })
      if (error) {
        console.error('[listAdvanceOrders] Supabase error:', error.message)
        if (throwOnError) throw new Error(error.message)
      } else if (Array.isArray(data)) {
        const remote = data.map(row => normalizeOrder(row as Record<string, unknown>))
        const remoteIds = new Set(remote.map(r => r.id))
        const localOnly = local.filter(l => !remoteIds.has(l.id))
        const merged = [...remote, ...localOnly].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        saveLocalOrders(merged)
        return merged
      }
    } catch (err) {
      console.error('[listAdvanceOrders] Exception:', err)
      if (throwOnError) throw err instanceof Error ? err : new Error(String(err))
    }
  }
  return local
}

export async function getAdvanceOrderHistory(orderId: string) {
  const localTimeline = loadLocalTimeline().filter(t => t.advance_order_id === orderId)
  const localPayments = loadLocalPayments().filter(p => p.advance_order_id === orderId)

  if (isSupabaseConfigured) {
    try {
      const [tRes, pRes] = await Promise.all([
        supabase.from('advance_order_timeline').select('*').eq('advance_order_id', orderId).order('created_at'),
        supabase.from('advance_order_payments').select('*').eq('advance_order_id', orderId).order('received_at'),
      ])
      const timeline = (tRes.data && tRes.data.length > 0) ? (tRes.data as AdvanceTimeline[]) : localTimeline
      const payments = (pRes.data && pRes.data.length > 0) ? (pRes.data as AdvancePayment[]) : localPayments
      return { timeline, payments }
    } catch { /* fallback */ }
  }
  return { timeline: localTimeline, payments: localPayments }
}

export async function createAdvanceOrder(input: {
  customerName: string; phone: string; address: string; productName: string; category: string; description: string
  totalAmount: number; depositAmount: number; expectedDeliveryDate: string; remarks: string; referenceNumber: string
  paymentMethod: AdvancePaymentMethod; createdByName: string; products?: Array<Record<string, unknown>>
  splitDetails?: SplitDetails
  subtotal?: number; deliveryCharge?: number; discountAmount?: number; couponCode?: string | null
  couponDiscount?: number; manualDiscount?: number; gstEnabled?: boolean; totalGst?: number
  gstRate?: number; cgstAmount?: number; sgstAmount?: number
}): Promise<AdvanceOrder> {
  if (input.paymentMethod === 'split') {
    if (Math.abs(splitTotal(parseSplit(input.splitDetails)) - Number(input.depositAmount)) >= 0.01) {
      throw new Error('Split payment amounts must add up to the deposit amount.')
    }
  }
  const splitDetails = input.paymentMethod === 'split' ? parseSplit(input.splitDetails) : {}

  let createdOrder: AdvanceOrder | null = null

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('create_advance_order', {
        p_customer_name: input.customerName, p_phone: input.phone, p_address: input.address, p_product_name: input.productName,
        p_category: input.category, p_description: input.description, p_total_amount: input.totalAmount,
        p_deposit_amount: input.depositAmount, p_expected_delivery_date: input.expectedDeliveryDate, p_remarks: input.remarks,
        p_payment_method: input.paymentMethod, p_created_by_name: input.createdByName, p_products: input.products || [],
        ...(input.paymentMethod === 'split' ? { p_split_details: splitDetails } : {}),
      })
      if (error) {
        console.error('[createAdvanceOrder] Supabase error:', error.message)
      } else if (data) {
        createdOrder = normalizeOrder(rpcRow(data))
        // Patch reference_number and financial breakdown fields
        const patchPayload: Record<string, unknown> = {}
        if (input.referenceNumber.trim()) patchPayload.reference_number = input.referenceNumber.trim()
        if (input.subtotal !== undefined) patchPayload.subtotal = input.subtotal
        if (input.deliveryCharge !== undefined) patchPayload.delivery_charge = input.deliveryCharge
        if (input.discountAmount !== undefined) patchPayload.discount_amount = input.discountAmount
        if (input.couponCode) patchPayload.coupon_code = input.couponCode
        if (input.couponDiscount !== undefined) patchPayload.coupon_discount = input.couponDiscount
        if (input.manualDiscount !== undefined) patchPayload.manual_discount = input.manualDiscount
        if (input.gstEnabled !== undefined) patchPayload.gst_enabled = input.gstEnabled
        if (input.totalGst !== undefined) patchPayload.total_gst = input.totalGst
        if (input.gstRate !== undefined) patchPayload.gst_rate = input.gstRate
        if (input.cgstAmount !== undefined) patchPayload.cgst_amount = input.cgstAmount
        if (input.sgstAmount !== undefined) patchPayload.sgst_amount = input.sgstAmount

        if (Object.keys(patchPayload).length > 0) {
          try {
            const { error: patchError } = await supabase.from('advance_orders').update(patchPayload).eq('id', createdOrder.id)
            if (patchError) console.warn('[createAdvanceOrder] Failed to patch financial details:', patchError.message)
            Object.assign(createdOrder, patchPayload)
          } catch (patchErr) {
            console.warn('[createAdvanceOrder] Failed to patch financial details:', patchErr)
          }
        }
      }
    } catch (err) {
      console.error('[createAdvanceOrder] Exception:', err)
      if (createdOrder) throw new Error(`Advance order was created, but its details could not be saved: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (!createdOrder) {
    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const seq = String(Math.floor(1000 + Math.random() * 9000))
    const depositId = `DEP-${ymd}-${seq}`
    const orderId = crypto.randomUUID ? crypto.randomUUID() : `adv_${Date.now()}_${Math.random().toString(36).slice(2)}`

    createdOrder = {
      id: orderId,
      deposit_id: depositId,
      customer_name: input.customerName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      product_name: input.productName.trim(),
      products: input.products || [{ name: input.productName, category: input.category, quantity: 1, base_price: input.totalAmount, line_total: input.totalAmount }],
      category: input.category.trim(),
      description: input.description.trim(),
      total_amount: Number(input.totalAmount),
      deposit_amount: Number(input.depositAmount),
      remaining_balance: Number(input.totalAmount) - Number(input.depositAmount),
      expected_delivery_date: input.expectedDeliveryDate,
      status: 'pending_deposit',
      remarks: input.remarks.trim(),
      reference_number: input.referenceNumber.trim(),
      created_by_name: input.createdByName,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      completed_at: null,
      completed_order_id: null,
      invoice_number: null,
      final_payment_method: null,
      subtotal: input.subtotal ?? Number(input.totalAmount),
      delivery_charge: input.deliveryCharge ?? 0,
      discount_amount: input.discountAmount ?? 0,
      coupon_code: input.couponCode ?? null,
      coupon_discount: input.couponDiscount ?? 0,
      manual_discount: input.manualDiscount ?? 0,
      gst_enabled: input.gstEnabled ?? false,
      total_gst: input.totalGst ?? 0,
      gst_rate: input.gstRate ?? 0,
      cgst_amount: input.cgstAmount ?? 0,
      sgst_amount: input.sgstAmount ?? 0,
    }

    const currentTimeline = loadLocalTimeline()
    currentTimeline.push(
      { id: Date.now(), advance_order_id: orderId, event_type: 'created', label: 'Deposit Created', remarks: input.remarks, created_at: now.toISOString() },
      { id: Date.now() + 1, advance_order_id: orderId, event_type: 'deposit_received', label: 'Deposit Received', remarks: `Received INR ${input.depositAmount} via ${input.paymentMethod.toLowerCase() === 'upi' ? 'QR' : input.paymentMethod.toUpperCase()}`, created_at: now.toISOString() }
    )
    saveLocalTimeline(currentTimeline)

    const currentPayments = loadLocalPayments()
    currentPayments.push({
      id: orderId + '_dep',
      advance_order_id: orderId,
      payment_type: 'deposit',
      amount: Number(input.depositAmount),
      payment_method: input.paymentMethod,
      split_details: splitDetails,
      remarks: input.remarks,
      received_at: now.toISOString(),
    })
    saveLocalPayments(currentPayments)
  }

  // Ensure products snapshot is present
  const orderProducts = (createdOrder.products && createdOrder.products.length > 0) ? createdOrder.products : (input.products || [])
  createdOrder.products = orderProducts

  // Deduct inventory stock for the booked advance order items
  if (orderProducts.length > 0) {
    try {
      await deductAdvanceOrderStock(
        orderProducts,
        createdOrder.deposit_id,
        createdOrder.created_by_name || input.createdByName
      )
    } catch (stockErr) {
      console.error('[createAdvanceOrder] Failed to deduct advance order stock:', stockErr)
    }
  }

  const localOrders = loadLocalOrders()
  const updated = [createdOrder, ...localOrders.filter(o => o.id !== createdOrder!.id)]
  saveLocalOrders(updated)
  return createdOrder
}

export async function updateAdvanceOrder(orderId: string, updates: {
  customerName?: string
  phone?: string
  address?: string
  productName?: string
  category?: string
  description?: string
  totalAmount?: number
  depositAmount?: number
  expectedDeliveryDate?: string
  referenceNumber?: string
  remarks?: string
  status?: AdvanceStatus
}): Promise<AdvanceOrder> {
  const localOrders = loadLocalOrders()
  let existing = localOrders.find(o => o.id === orderId)
  if (isSupabaseConfigured && !existing) {
    try {
      const { data } = await supabase.from('advance_orders').select('*').eq('id', orderId).maybeSingle()
      if (data) existing = normalizeOrder(data)
    } catch { /* fallback */ }
  }
  if (!existing) throw new Error('Advance order not found')

  // If status is transitioning to cancelled, restore reserved stock
  if (updates.status === 'cancelled' && existing.status !== 'completed' && existing.status !== 'cancelled') {
    try {
      await restoreAdvanceOrderStock(existing.products, existing.deposit_id, 'Staff', 'cancelled')
    } catch (err) {
      console.error('[updateAdvanceOrder] Failed to restore stock on cancellation:', err)
    }
  }

  const total = updates.totalAmount !== undefined ? Number(updates.totalAmount) : existing.total_amount
  const deposit = updates.depositAmount !== undefined ? Number(updates.depositAmount) : existing.deposit_amount
  if (total <= 0) throw new Error('Total amount must be greater than zero')
  if (deposit < 0 || deposit >= total) throw new Error('Deposit must be greater than or equal to 0 and less than total amount')

  const newStatus = updates.status || existing.status
  const isCompleted = newStatus === 'completed'
  const newRemaining = isCompleted ? 0 : Math.max(0, total - deposit)
  const now = new Date().toISOString()

  let updatedOrder: AdvanceOrder | null = null

  if (isSupabaseConfigured) {
    try {
      const dbPayload: Record<string, unknown> = {
        updated_at: now,
      }
      if (updates.customerName !== undefined) dbPayload.customer_name = updates.customerName.trim()
      if (updates.phone !== undefined) dbPayload.phone = updates.phone.trim()
      if (updates.address !== undefined) dbPayload.address = updates.address.trim()
      if (updates.productName !== undefined) dbPayload.product_name = updates.productName.trim()
      if (updates.category !== undefined) dbPayload.category = updates.category.trim()
      if (updates.description !== undefined) dbPayload.description = updates.description.trim()
      if (updates.totalAmount !== undefined) dbPayload.total_amount = total
      if (updates.depositAmount !== undefined) dbPayload.deposit_amount = deposit
      if (updates.expectedDeliveryDate !== undefined) dbPayload.expected_delivery_date = updates.expectedDeliveryDate
      if (updates.referenceNumber !== undefined) dbPayload.reference_number = updates.referenceNumber.trim()
      if (updates.remarks !== undefined) dbPayload.remarks = updates.remarks.trim()
      if (updates.status !== undefined) dbPayload.status = updates.status
      dbPayload.remaining_balance = newRemaining

      const { data, error } = await supabase
        .from('advance_orders')
        .update(dbPayload)
        .eq('id', orderId)
        .select()
        .maybeSingle()

      if (error) {
        console.error('[updateAdvanceOrder] Supabase error:', error.message)
        throw new Error(`Failed to update advance order in database: ${error.message}`)
      } else if (data) {
        updatedOrder = normalizeOrder(data)
        // Add timeline event
        void supabase.from('advance_order_timeline').insert({
          advance_order_id: orderId,
          event_type: 'order_updated',
          label: 'Order Details Updated',
          remarks: updates.remarks || 'Order details updated',
        }).then(() => {}, () => {})
      }
    } catch (err) {
      console.error('[updateAdvanceOrder] Exception:', err)
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  if (!updatedOrder) {
    updatedOrder = {
      ...existing,
      customer_name: updates.customerName !== undefined ? updates.customerName.trim() : existing.customer_name,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      address: updates.address !== undefined ? updates.address.trim() : existing.address,
      product_name: updates.productName !== undefined ? updates.productName.trim() : existing.product_name,
      category: updates.category !== undefined ? updates.category.trim() : existing.category,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      total_amount: total,
      deposit_amount: deposit,
      remaining_balance: newRemaining,
      expected_delivery_date: updates.expectedDeliveryDate || existing.expected_delivery_date,
      reference_number: updates.referenceNumber !== undefined ? updates.referenceNumber.trim() : existing.reference_number,
      remarks: updates.remarks !== undefined ? updates.remarks.trim() : existing.remarks,
      status: newStatus,
      updated_at: now,
    }
  }

  const updatedList = localOrders.map(o => o.id === orderId ? updatedOrder! : o)
  saveLocalOrders(updatedList)

  const timeline = loadLocalTimeline()
  timeline.push({
    id: Date.now(),
    advance_order_id: orderId,
    event_type: 'order_updated',
    label: 'Order Details Updated',
    remarks: updates.remarks || 'Order details updated',
    created_at: now,
  })
  saveLocalTimeline(timeline)

  return updatedOrder
}

export async function updateAdvanceStatus(orderId: string, status: AdvanceStatus, remarks = ''): Promise<AdvanceOrder> {
  // If transitioning to cancelled, restore reserved stock
  if (status === 'cancelled') {
    let existing: AdvanceOrder | null = null
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('advance_orders').select('*').eq('id', orderId).maybeSingle()
        if (data) existing = normalizeOrder(data)
      } catch { /* fallback */ }
    }
    if (!existing) {
      existing = loadLocalOrders().find(o => o.id === orderId) || null
    }

    if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
      try {
        await restoreAdvanceOrderStock(existing.products, existing.deposit_id, 'Staff', 'cancelled')
      } catch (err) {
        console.error('[updateAdvanceStatus] Failed to restore stock on cancellation:', err)
      }
    }
  }

  let updatedOrder: AdvanceOrder | null = null

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('update_advance_order_status', { p_order_id: orderId, p_status: status, p_remarks: remarks })
      if (!error && data) {
        updatedOrder = normalizeOrder(rpcRow(data))
      } else {
        if (error) console.warn('[updateAdvanceStatus] RPC failed, attempting direct table update:', error.message)
        const now = new Date().toISOString()
        const { data: directData, error: directError } = await supabase
          .from('advance_orders')
          .update({
            status,
            remarks: remarks || undefined,
            updated_at: now
          })
          .eq('id', orderId)
          .select()
          .maybeSingle()

        if (directError) {
          throw new Error(`Failed to update order status: ${directError.message || error?.message}`)
        }
        if (directData) {
          updatedOrder = normalizeOrder(directData)
          void supabase.from('advance_order_timeline').insert({
            advance_order_id: orderId,
            event_type: status,
            label: status === 'ready_for_delivery' ? 'Ready to Collect' : status === 'waiting_final_payment' ? 'Waiting for Final Payment' : status === 'cancelled' ? 'Order Cancelled' : 'Pending Deposit',
            remarks: remarks || '',
          }).then(() => {}, () => {})
        }
      }
    } catch (err) {
      console.error('[updateAdvanceStatus] Exception:', err)
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  const localOrders = loadLocalOrders()
  const existing = localOrders.find(o => o.id === orderId)
  if (!updatedOrder && existing) {
    const now = new Date().toISOString()
    const label = status === 'ready_for_delivery' ? 'Ready for Delivery' : status === 'waiting_final_payment' ? 'Customer Contacted' : status === 'cancelled' ? 'Cancelled' : 'Pending Deposit'
    updatedOrder = { ...existing, status, remarks: remarks || existing.remarks, updated_at: now }

    const timeline = loadLocalTimeline()
    timeline.push({ id: Date.now(), advance_order_id: orderId, event_type: status, label, remarks, created_at: now })
    saveLocalTimeline(timeline)
  }

  if (updatedOrder) {
    saveLocalOrders(localOrders.map(o => o.id === orderId ? updatedOrder! : o))
    return updatedOrder
  }
  throw new Error('Order not found')
}

export async function addAdvanceEvent(orderId: string, eventType: string, label: string, remarks = '') {
  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('add_advance_order_event', { p_order_id: orderId, p_event_type: eventType, p_label: label, p_remarks: remarks })
    } catch { /* fallback */ }
  }
  const timeline = loadLocalTimeline()
  timeline.push({ id: Date.now(), advance_order_id: orderId, event_type: eventType, label, remarks, created_at: new Date().toISOString() })
  saveLocalTimeline(timeline)
}

export async function completeAdvanceOrder(
  orderId: string,
  paymentMethod: AdvancePaymentMethod,
  finalAmount: number,
  couponCode: string | null = null,
  couponPercentage: number = 0,
  manualDiscountAmount: number = 0,
  remarks = '',
  splitInput?: SplitDetails
) {
  let result: { order_id: string; invoice_no: string; completed_at: string; split_details?: SplitDetails } | null = null
  if (paymentMethod === 'split' && Math.abs(splitTotal(parseSplit(splitInput)) - Number(finalAmount)) >= 0.01) {
    throw new Error('Split payment amounts must add up to the final amount.')
  }
  const splitDetails = paymentMethod === 'split' ? parseSplit(splitInput) : {}

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('complete_advance_order_v2', {
        p_order_id: orderId,
        p_payment_method: paymentMethod,
        p_final_amount: finalAmount,
        p_coupon_code: couponCode,
        p_coupon_percentage: couponPercentage,
        p_manual_discount: manualDiscountAmount,
        p_remarks: remarks,
        ...(paymentMethod === 'split' ? { p_split_details: splitDetails } : {}),
      })
      if (error) {
        if (error.message?.includes('already generated') || error.message?.includes('already completed')) {
          // Self-heal: order was already completed with invoice
          const { data: existing } = await supabase.from('advance_orders').select('*').eq('id', orderId).maybeSingle()
          if (existing && (existing.invoice_number || existing.completed_order_id)) {
            result = {
              order_id: existing.completed_order_id || existing.id,
              invoice_no: existing.invoice_number || 'INV-COMPLETED',
              completed_at: existing.completed_at || new Date().toISOString()
            }
          } else {
            throw new Error('This order has already been completed.')
          }
        } else {
          throw new Error(error.message || JSON.stringify(error))
        }
      }
      if (data) {
        const row = Array.isArray(data) ? data[0] : data
        result = row as { order_id: string; invoice_no: string; completed_at: string }
        // Full collection breakdown (deposit + final) written by the database for analytics
        try {
          const { data: orderRow } = await supabase.from('orders').select('split_details').eq('id', result.order_id).maybeSingle()
          if (orderRow && splitTotal(parseSplit(orderRow.split_details)) > 0) result.split_details = parseSplit(orderRow.split_details)
        } catch { /* optional */ }

        // Guarantee advance order financial breakdown (subtotal, delivery, coupon, discount, GST) is synchronized to orders table
        try {
          const { data: adv } = await supabase.from('advance_orders').select('*').eq('id', orderId).maybeSingle()
          if (adv && result.order_id) {
            const totalGst = Number(adv.total_gst || (Number(adv.cgst_amount || 0) + Number(adv.sgst_amount || 0)) || 0)
            const delivery = Number(adv.delivery_charge || 0)
            const code = adv.coupon_code || couponCode || null
            const couponDisc = Number(adv.coupon_discount || (code ? adv.discount_amount : 0) || 0)
            const manualDisc = Number(adv.manual_discount || manualDiscountAmount || 0)
            const totalDisc = couponDisc + manualDisc
            const subtotal = Number(adv.subtotal ?? (Number(adv.total_amount || 0) - delivery - totalGst + totalDisc))

            await supabase.from('orders').update({
              subtotal,
              total: Number(adv.total_amount || finalAmount),
              delivery_charge: delivery,
              shipping: delivery,
              coupon_code: code,
              discount_amount: couponDisc,
              manual_discount_amount: manualDisc,
              manual_discount_value: manualDisc,
              manual_discount_type: 'flat',
              total_gst: totalGst,
              gst_amount: totalGst,
              gst_enabled: Boolean(adv.gst_enabled || totalGst > 0),
              reference_number: adv.reference_number || undefined,
              remarks: remarks || adv.remarks || undefined,
              address: adv.address || undefined
            }).eq('id', result.order_id)
          }
        } catch (syncErr) {
          console.warn('[completeAdvanceOrder] Order financial sync warning:', syncErr)
        }
      }
    } catch (err: unknown) {
      if (!result) {
        alert(`Supabase Backend Error: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      }
    }
  }

  const localOrders = loadLocalOrders()
  const order = localOrders.find(o => o.id === orderId)
  const now = new Date().toISOString()

  if (!result) {
    const seq = String(Math.floor(10000000 + Math.random() * 89999999))
    const invoiceNo = `INV${seq}`
    const completedOrderId = crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}_${Math.random().toString(36).slice(2)}`
    result = { order_id: completedOrderId, invoice_no: invoiceNo, completed_at: now }
  }

  if (order) {
    const updatedOrder: AdvanceOrder = {
      ...order,
      status: 'completed',
      remaining_balance: 0,
      completed_at: result.completed_at,
      completed_order_id: result.order_id,
      invoice_number: result.invoice_no,
      final_payment_method: paymentMethod,
      split_details: result.split_details,
      remarks: remarks || order.remarks,
      updated_at: now,
    }
    saveLocalOrders(localOrders.map(o => o.id === orderId ? updatedOrder : o))

    const timeline = loadLocalTimeline()
    timeline.push(
      { id: Date.now(), advance_order_id: orderId, event_type: 'remaining_payment_received', label: 'Final Payment Received', remarks, created_at: now },
      { id: Date.now() + 1, advance_order_id: orderId, event_type: 'delivered', label: 'Delivered', remarks, created_at: now },
      { id: Date.now() + 2, advance_order_id: orderId, event_type: 'revenue_posted', label: `Revenue Posted (INR ${order.total_amount})`, remarks, created_at: now },
      { id: Date.now() + 3, advance_order_id: orderId, event_type: 'invoice_generated', label: `Invoice Generated (${result.invoice_no})`, remarks, created_at: now }
    )
    saveLocalTimeline(timeline)

    const payments = loadLocalPayments()
    payments.push({
      id: orderId + '_rem',
      advance_order_id: orderId,
      payment_type: 'remaining',
      amount: order.remaining_balance,
      payment_method: paymentMethod,
      split_details: splitDetails,
      remarks,
      received_at: now,
    })
    saveLocalPayments(payments)
  }

  return result!
}
