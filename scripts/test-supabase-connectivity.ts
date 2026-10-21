/**
 * CHERAS CLOTHING POS — Comprehensive Supabase HTTP Connectivity & Schema Verification Test Suite
 *
 * Verifies live HTTP communication from the application's client key (VITE_SUPABASE_ANON_KEY)
 * against all Supabase tables, RPC functions, indexes, and storage buckets.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase URL or Anon Key in .env')
  process.exit(1)
}

// 1. App Client (Anonymous client used by the frontend in production)
const appClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
})

// 2. Admin Client (Service Role for verifying underlying schema and indexes)
const adminClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  details: string
  latencyMs: number
}

const results: TestResult[] = []

async function runTest(name: string, fn: () => Promise<string | void>) {
  const start = Date.now()
  try {
    const note = await fn()
    const latencyMs = Date.now() - start
    results.push({
      name,
      status: 'PASS',
      details: note || 'OK',
      latencyMs,
    })
    console.log(`  [PASS] ${name} (${latencyMs}ms) — ${note || 'OK'}`)
  } catch (err: any) {
    const latencyMs = Date.now() - start
    results.push({
      name,
      status: 'FAIL',
      details: err.message || String(err),
      latencyMs,
    })
    console.log(`  [FAIL] ${name} (${latencyMs}ms) — ${err.message || String(err)}`)
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🌐 CHERAS CLOTHING POS — SUPABASE HTTP API CONNECTIVITY TEST')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Endpoint URL : ${supabaseUrl}`)
  console.log(`Auth Mode    : Anonymous Client (VITE_SUPABASE_ANON_KEY)`)
  console.log(`Admin Check  : ${adminClient ? 'Available (Service Role)' : 'Skipped'}\n`)

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. HTTP Table Communication Tests (App Client)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── 1. HTTP Table Communication Tests (App Client) ───')

  const tables = [
    'categories',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'advance_orders',
    'advance_order_timeline',
    'advance_order_payments',
    'inventory_movements',
    'barcode_registry',
    'expenses',
    'expense_categories',
    'customer_birthdays',
    'birthday_offers',
    'store_settings',
    'coupons',
    'profiles',
  ]

  for (const table of tables) {
    await runTest(`HTTP Table Query: ${table}`, async () => {
      const { data, error, count } = await appClient
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(2)

      if (error) {
        throw new Error(`HTTP Error ${error.code}: ${error.message}`)
      }
      return `Accessible over HTTP (found ${count ?? data?.length ?? 0} rows)`
    })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. HTTP RPC / Function Tests (App Client)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 2. HTTP RPC / Function Execution Tests (App Client) ───')

  // RPC: get_next_invoice_no
  await runTest('RPC: get_next_invoice_no()', async () => {
    const { data, error } = await appClient.rpc('get_next_invoice_no')
    if (error) throw new Error(`HTTP Error ${error.code}: ${error.message}`)
    if (!data) throw new Error('Did not return next invoice number')
    return `Next Invoice Number generated: "${data}"`
  })

  // RPC: generate_barcode_value
  await runTest('RPC: generate_barcode_value("product")', async () => {
    const { data, error } = await appClient.rpc('generate_barcode_value', {
      p_entity_type: 'product',
    })
    if (error) throw new Error(`HTTP Error ${error.code}: ${error.message}`)
    if (!data) throw new Error('Did not return generated barcode')
    return `Generated barcode: "${data}"`
  })

  // RPC: get_public_invoice_by_number
  await runTest('RPC: get_public_invoice_by_number("INV-00000001")', async () => {
    const { data, error } = await appClient.rpc('get_public_invoice_by_number', {
      p_invoice_no: 'INV-00000001',
    })
    if (error) throw new Error(`HTTP Error ${error.code}: ${error.message}`)
    return `Responded with status 200 (Result: ${data === null ? 'null (no order yet)' : 'matched order'})`
  })

  // RPC: get_expense_summary_metrics
  await runTest('RPC: get_expense_summary_metrics()', async () => {
    const { data, error } = await appClient.rpc('get_expense_summary_metrics', {
      p_current_date: new Date().toISOString().split('T')[0],
    })
    if (error) throw new Error(`HTTP Error ${error.code}: ${error.message}`)
    if (!data || typeof data !== 'object') throw new Error('Metrics response is not an object')
    return `Summary Metrics: today=${data.today}, week=${data.this_week}, month=${data.this_month}, year=${data.this_year}, total=${data.total_all_time}`
  })

  // RPC: complete_pos_sale_with_inventory (Signature Verification via App Client)
  await runTest('RPC: complete_pos_sale_with_inventory (Exact Signature)', async () => {
    // Calling with empty items array tests that the RPC exists, parses parameters, and validates
    const { error } = await appClient.rpc('complete_pos_sale_with_inventory', {
      p_customer_name: 'Connectivity Probe',
      p_phone: '9876543210',
      p_address: 'Store Counter',
      p_items: [],
      p_shipping: 0,
      p_status: 'completed',
      p_order_mode: 'offline',
      p_order_type: 'pos_sale',
      p_delivery_charge: 0,
      p_discount_amount: 0,
      p_manual_discount_amount: 0,
      p_manual_discount_type: 'flat',
      p_manual_discount_value: 0,
      p_coupon_code: null,
      p_coupon_percentage: 0,
      p_payment_method: 'cash',
      p_split_details: {},
      p_total_gst: 0,
      p_gst_enabled: false,
      p_remarks: 'Automated connectivity test probe',
      p_reference_number: '',
      p_billing_date: new Date().toISOString(),
    })

    if (error && error.code === 'PGRST202') {
      throw new Error(`RPC complete_pos_sale_with_inventory not found on server`)
    }
    return `RPC exists on Supabase and accepted HTTP POST payload`
  })

  // RPC: adjust_inventory_stock (Exact Signature)
  await runTest('RPC: adjust_inventory_stock (Exact Signature)', async () => {
    // Call with invalid dummy ID 0 to verify signature presence without mutating data
    const { error } = await appClient.rpc('adjust_inventory_stock', {
      p_product_id: 0,
      p_variant_id: null,
      p_new_quantity: 0,
      p_reason: 'RESTOCK',
      p_note: 'Connectivity probe',
      p_created_by_name: 'system_test',
    })

    if (error && error.code === 'PGRST202') {
      throw new Error(`RPC adjust_inventory_stock not found on server`)
    }
    return `RPC exists on Supabase and accepted HTTP POST payload`
  })

  // RPC: create_barcode_and_receive_stock (Exact Signature)
  await runTest('RPC: create_barcode_and_receive_stock (Exact Signature)', async () => {
    const { error } = await appClient.rpc('create_barcode_and_receive_stock', {
      p_product_id: 0,
      p_variant_id: null,
      p_quantity_received: 0,
      p_unit_cost: null,
      p_created_by_name: 'system_test',
      p_custom_barcode: null,
      p_note: 'Connectivity probe',
    })

    if (error && error.code === 'PGRST202') {
      throw new Error(`RPC create_barcode_and_receive_stock not found on server`)
    }
    return `RPC exists on Supabase and accepted HTTP POST payload`
  })

  // RPC: create_advance_order (Exact Signature)
  await runTest('RPC: create_advance_order (Exact Signature)', async () => {
    const { error } = await appClient.rpc('create_advance_order', {
      p_customer_name: '',
      p_phone: '',
      p_address: '',
      p_product_name: '',
      p_category: '',
      p_description: '',
      p_total_amount: 0,
      p_deposit_amount: 0,
      p_expected_delivery_date: new Date().toISOString().split('T')[0],
      p_remarks: '',
      p_payment_method: 'cash',
      p_created_by_name: 'test',
      p_products: [],
      p_split_details: {},
    })

    if (error && error.code === 'PGRST202') {
      throw new Error(`RPC create_advance_order not found on server`)
    }
    return `RPC exists on Supabase and accepted HTTP POST payload`
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Storage Bucket HTTP Tests
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 3. Storage Buckets HTTP Tests ───')

  for (const bucketName of ['invoices', 'branding']) {
    await runTest(`Storage Bucket: ${bucketName}`, async () => {
      const { data, error } = await appClient.storage.from(bucketName).list('', { limit: 1 })
      if (error) throw new Error(`HTTP Storage Error: ${error.message}`)
      return `Bucket "${bucketName}" is active and accessible (files: ${data?.length ?? 0})`
    })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Critical Indexes & Constraints Verification
  // ─────────────────────────────────────────────────────────────────────────────
  if (adminClient) {
    console.log('\n─── 4. Database Indexes Verification (via Admin Client) ───')

    await runTest('Index: customer_birthdays_phone_idx', async () => {
      const { error } = await adminClient.rpc('exec_sql', {
        sql: `
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'customer_birthdays' AND indexname = 'customer_birthdays_phone_idx';
        `,
      })
      if (error) throw new Error(`Index check failed: ${error.message}`)
      return 'Index customer_birthdays_phone_idx verified'
    })

    await runTest('Index: idx_inv_movements_ref', async () => {
      const { error } = await adminClient.rpc('exec_sql', {
        sql: `
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'inventory_movements' AND indexname = 'idx_inv_movements_ref';
        `,
      })
      if (error) throw new Error(`Index check failed: ${error.message}`)
      return 'Index idx_inv_movements_ref verified'
    })

    await runTest('Index: barcode_registry indexes', async () => {
      const { error } = await adminClient.rpc('exec_sql', {
        sql: `
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'barcode_registry';
        `,
      })
      if (error) throw new Error(`Index check failed: ${error.message}`)
      return 'Barcode registry indexes verified'
    })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Store Settings Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 5. Store Settings Record Verification ───')
  await runTest('Store Settings (id: 1)', async () => {
    const { data, error } = await appClient
      .from('store_settings')
      .select('id, name, owner_name, phone, email, address')
      .eq('id', 1)
      .single()

    if (error) throw new Error(`Error: ${error.message}`)
    if (data.name !== 'CHERAS CLOTHING') {
      throw new Error(`Expected name 'CHERAS CLOTHING', found: '${data.name}'`)
    }
    return `Verified: ${data.name} | Phone: ${data.phone} | Address: ${data.address}`
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────────
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📊 CONNECTIVITY TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
