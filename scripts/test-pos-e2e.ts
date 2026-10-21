/**
 * CHERAS CLOTHING POS — Phase 4 POS E2E & Phase 5 PWA Automated Test Suite
 * Validates retail math, pricing, discounts, tax rounding, phone normalization,
 * invoice formatting, offline queueing, boundary cases, and PWA configuration.
 */

import {
  calculateLineTotal,
  roundTo,
  formatCurrency,
  formatInvoiceNo,
  formatProductNameWithVariant,
  calculateStockDeduction,
  convertQuantityByUnitType,
  parseLegacyUnit,
  normalizeBaseQuantity,
  buildStructuredOrderItem,
} from '../src/lib/retail'
import { normalizePhone, isValidPhone, formatPhoneDisplay, getSubscriberDigits } from '../src/lib/phone'
import { splitTotal, splitInputToDetails, type SplitInputValue } from '../src/lib/payments'
import { createLocalOrder, getLocalOrders, clearLocalOrders } from '../src/lib/ordersFallback'
import * as fs from 'fs'
import * as path from 'path'

interface TestCase {
  id: string
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
let passedCount = 0
let failedCount = 0

function test(id: string, name: string, fn: () => void | Promise<void>) {
  tests.push({ id, name, fn })
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Retail Math & Pricing Calculations
// ─────────────────────────────────────────────────────────────────────────────

test('POS-MATH-01', 'Calculate line total for piece/unit items (quantity * unit price)', () => {
  // 3 sarees @ ₹1,450.00 each
  const total = calculateLineTotal(3, 'unit', 1, 1450)
  assert(total === 4350, `Expected 4350, got: ${total}`)
})

test('POS-MATH-02', 'Calculate line total for multiple unit items (e.g. 2 packs @ ₹400 each)', () => {
  // 2 packs @ ₹400 = ₹800
  const total = calculateLineTotal(2, 'unit', 1, 400)
  assert(total === 800, `Expected 800, got: ${total}`)
})

test('POS-MATH-03', 'Calculate line total for bundle/pack items', () => {
  // 5 bundles of dhotis @ ₹850 per bundle
  const total = calculateLineTotal(5, 'bundle', 1, 850)
  assert(total === 4250, `Expected 4250, got: ${total}`)
})

test('POS-ROUND-01', 'Currency rounding handles IEEE-754 floating point inaccuracies safely', () => {
  // 0.1 + 0.2 in JS is 0.30000000000000004
  const sum = roundTo(0.1 + 0.2, 2)
  assert(sum === 0.3, `Expected 0.3, got: ${sum}`)

  // 1/3 rounded to 2 decimal places
  const third = roundTo(1 / 3, 2)
  assert(third === 0.33, `Expected 0.33, got: ${third}`)

  // Fractional tax rounding: ₹125.455 should round to ₹125.46
  const tax = roundTo(125.455, 2)
  assert(tax === 125.46, `Expected 125.46, got: ${tax}`)
})

test('POS-CURR-01', 'formatCurrency formats amounts in standard INR format with currency symbol', () => {
  const formatted = formatCurrency(1450)
  assert(formatted.includes('1,450.00'), `Expected formatted currency to contain 1,450.00, got: ${formatted}`)
  assert(formatted.includes('₹'), `Expected currency symbol ₹, got: ${formatted}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Boundary Cases: Zero, Negative, and Invalid Inputs
// ─────────────────────────────────────────────────────────────────────────────

test('POS-BOUND-01', 'Zero quantity line total evaluates safely to 0', () => {
  const total = calculateLineTotal(0, 'unit', 1, 1200)
  assert(total === 0, `Expected 0, got: ${total}`)
})

test('POS-BOUND-02', 'Negative quantity line total clamps safely to 0', () => {
  const total = calculateLineTotal(-5, 'unit', 1, 1200)
  assert(total === 0, `Expected 0, got: ${total}`)
})

test('POS-BOUND-03', 'Negative base price clamps safely to 0', () => {
  const total = calculateLineTotal(2, 'unit', 1, -500)
  assert(total === 0, `Expected 0, got: ${total}`)
})

test('POS-BOUND-04', 'NaN and null inputs normalize gracefully without crashing', () => {
  const total1 = calculateLineTotal(NaN, 'unit', 1, 100)
  assert(total1 === 0, `Expected 0 for NaN quantity, got: ${total1}`)

  const total2 = calculateLineTotal(2, 'unit', 1, NaN)
  assert(total2 === 0, `Expected 0 for NaN price, got: ${total2}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Stock Deduction & Unit Conversion Logic
// ─────────────────────────────────────────────────────────────────────────────

test('POS-STOCK-01', 'Stock deduction for unit/piece items deducts exact integer pack count', () => {
  const deduction = calculateStockDeduction({
    quantity: 4,
    selectedUnit: 'piece',
    stockUnit: 'piece',
    unitType: 'unit',
  })
  assert(deduction === 4, `Expected 4 pieces deducted, got: ${deduction}`)
})

test('POS-STOCK-02', 'Stock deduction for weight items converts units accurately (e.g. 250g from kg stock)', () => {
  const deduction = calculateStockDeduction({
    quantity: 250,
    selectedUnit: 'g',
    stockUnit: 'kg',
    unitType: 'weight',
  })
  assert(deduction === 0.25, `Expected 0.25 kg deducted, got: ${deduction}`)
})

test('POS-UNIT-01', 'convertQuantityByUnitType converts weight and unit quantities accurately', () => {
  const kg = convertQuantityByUnitType(1000, 'g', 'kg', 'weight')
  assert(kg === 1, `Expected 1 kg, got: ${kg}`)
  const g = convertQuantityByUnitType(0.5, 'kg', 'g', 'weight')
  assert(g === 500, `Expected 500 g, got: ${g}`)
})

test('POS-UNIT-02', 'parseLegacyUnit parses legacy unit labels into quantity, unit, and unitType', () => {
  const parsedWeight = parseLegacyUnit('500g')
  assert(parsedWeight.unitType === 'weight', `Expected weight, got: ${parsedWeight.unitType}`)
  assert(parsedWeight.unitLabel === 'g', `Expected g, got: ${parsedWeight.unitLabel}`)
  assert(parsedWeight.baseQuantity === 500, `Expected 500, got: ${parsedWeight.baseQuantity}`)

  const parsedPiece = parseLegacyUnit('1 piece')
  assert(parsedPiece.unitType === 'unit', `Expected unit, got: ${parsedPiece.unitType}`)
  assert(parsedPiece.unitLabel === 'piece', `Expected piece, got: ${parsedPiece.unitLabel}`)
  assert(parsedPiece.baseQuantity === 1, `Expected 1, got: ${parsedPiece.baseQuantity}`)
})

test('POS-UNIT-03', 'normalizeBaseQuantity normalizes base quantity with safe fallbacks', () => {
  assert(normalizeBaseQuantity(0, 'unit') === 1, 'Expected fallback 1 for unit')
  assert(normalizeBaseQuantity(0, 'weight') === 100, 'Expected fallback 100 for weight')
  assert(normalizeBaseQuantity(250, 'weight') === 250, 'Expected 250 for weight')
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Split Payment Math & Validation
// ─────────────────────────────────────────────────────────────────────────────

test('POS-PAY-01', 'Split payment total calculation sums cash, UPI, and card accurately', () => {
  const splitInput: SplitInputValue = {
    cash: '1500.50',
    qr: '2000.00',
    card: '500.25',
  }
  const details = splitInputToDetails(splitInput)
  const total = splitTotal(details)
  assert(total === 4000.75, `Expected 4000.75, got: ${total}`)
})

test('POS-PAY-02', 'Split payment handles empty and zero fields without NaN', () => {
  const splitInput: SplitInputValue = {
    cash: '1000',
    qr: '',
    card: '0',
  }
  const details = splitInputToDetails(splitInput)
  const total = splitTotal(details)
  assert(total === 1000, `Expected 1000, got: ${total}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Phone Normalization & Indian Mobile Validation
// ─────────────────────────────────────────────────────────────────────────────

test('POS-PHONE-01', 'Valid Indian 10-digit mobile number passes validation and normalizes with 91 prefix', () => {
  const phone = '9876543210'
  assert(isValidPhone(phone) === true, `Expected ${phone} to be valid`)
  assert(normalizePhone(phone) === '919876543210', `Expected 919876543210, got: ${normalizePhone(phone)}`)
  assert(getSubscriberDigits(phone) === '9876543210', `Expected 9876543210, got: ${getSubscriberDigits(phone)}`)
})

test('POS-PHONE-02', 'Mobile number with +91 country code normalizes cleanly', () => {
  const phone = '+91 98765 43210'
  assert(isValidPhone(phone) === true, `Expected ${phone} to be valid`)
  assert(normalizePhone(phone) === '919876543210', `Expected 919876543210, got: ${normalizePhone(phone)}`)
  assert(getSubscriberDigits(phone) === '9876543210', `Expected 9876543210, got: ${getSubscriberDigits(phone)}`)
})

test('POS-PHONE-03', 'Mobile number with leading 0 normalizes cleanly', () => {
  const phone = '09876543210'
  assert(isValidPhone(phone) === true, `Expected ${phone} to be valid`)
  assert(normalizePhone(phone) === '919876543210', `Expected 919876543210, got: ${normalizePhone(phone)}`)
  assert(getSubscriberDigits(phone) === '9876543210', `Expected 9876543210, got: ${getSubscriberDigits(phone)}`)
})

test('POS-PHONE-04', 'Invalid phone numbers (too short, too long, landline) are rejected', () => {
  assert(isValidPhone('12345') === false, 'Short number must fail')
  assert(isValidPhone('1234567890123') === false, 'Long number must fail')
  assert(isValidPhone('abcdefghij') === false, 'Alphabetic string must fail')
  assert(isValidPhone('044-24567890') === false, 'Landline format must fail')
})

test('POS-PHONE-05', 'formatPhoneDisplay formats phone numbers with clean country code spacing', () => {
  assert(formatPhoneDisplay('919715083947') === '+91 9715083947', 'Expected +91 9715083947')
  assert(formatPhoneDisplay('9715083947') === '+91 9715083947', 'Expected +91 9715083947')
  assert(formatPhoneDisplay('') === '', 'Expected empty string for empty input')
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Invoice Number Formatting
// ─────────────────────────────────────────────────────────────────────────────

test('POS-INV-01', '8-digit invoice number formats with standard INV prefix', () => {
  const formatted = formatInvoiceNo('00000042')
  assert(formatted === 'INV00000042', `Expected INV00000042, got: ${formatted}`)
})

test('POS-INV-02', 'Short numeric invoice number pads to 8 digits with leading zeros', () => {
  const formatted = formatInvoiceNo('42')
  assert(formatted === 'INV00000042', `Expected INV00000042, got: ${formatted}`)
})

test('POS-INV-03', 'Invoice number with existing INV prefix is preserved without double-prefixing', () => {
  const formatted = formatInvoiceNo('INV00000042')
  assert(formatted === 'INV00000042', `Expected INV00000042, got: ${formatted}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Product Name & Variant Formatting
// ─────────────────────────────────────────────────────────────────────────────

test('POS-NAME-01', 'Variant name appends cleanly to base product name', () => {
  const name = formatProductNameWithVariant('Silk Cotton Saree', 'Maroon & Gold')
  assert(name === 'Silk Cotton Saree - Maroon & Gold', `Got: ${name}`)
})

test('POS-NAME-02', 'Prevents duplicate variant suffix when base name already includes variant', () => {
  const name = formatProductNameWithVariant('Kanchipuram Silk Saree - XL', 'XL')
  assert(name === 'Kanchipuram Silk Saree - XL', `Expected no duplicate XL, got: ${name}`)
})

test('POS-ITEM-01', 'buildStructuredOrderItem constructs structured item for checkout with calculated line total', () => {
  const item = buildStructuredOrderItem({
    productId: 'p-101',
    variantId: 'v-202',
    variantName: 'Red - M',
    name: 'Silk Shirt',
    quantity: 2,
    unit: 'piece',
    unitType: 'unit',
    baseQuantity: 1,
    basePrice: 650,
  })
  assert(item.product_id === 'p-101', 'Product ID mismatch')
  assert(item.variant_id === 'v-202', 'Variant ID mismatch')
  assert(item.name === 'Silk Shirt - Red - M', `Expected formatted name, got: ${item.name}`)
  assert(item.line_total === 1300, `Expected 1300 line total, got: ${item.line_total}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Offline Queue & Local Orders Fallback
// ─────────────────────────────────────────────────────────────────────────────

test('POS-OFFLINE-01', 'Creates and retrieves local offline order queue', () => {
  // In Node environment, mock localStorage if absent
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] || null,
      length: store.size,
    } as Storage
  }

  clearLocalOrders()
  assert(getLocalOrders().length === 0, 'Queue should start empty')

  const order = createLocalOrder({
    customerName: 'Offline Test Customer',
    phone: '9876543210',
    address: 'Store Counter',
    items: [
      {
        product_id: '1',
        name: 'Cotton Shirt',
        price: 799,
        qty: 1,
        quantity: 1,
        unit: 'piece',
        unit_type: 'unit',
        base_quantity: 1,
        base_price: 799,
        line_total: 799,
      },
    ],
    subtotal: 799,
    shipping: 0,
    total: 799,
  })

  assert(order.id.startsWith('local-'), `Expected local- ID prefix, got: ${order.id}`)
  const queued = getLocalOrders()
  assert(queued.length === 1, `Expected 1 queued order, got: ${queued.length}`)
  assert(queued[0].customer_name === 'Offline Test Customer', 'Customer name mismatch')

  clearLocalOrders()
  assert(getLocalOrders().length === 0, 'Queue should be empty after clear')
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. PWA Manifest & Service Worker Verification
// ─────────────────────────────────────────────────────────────────────────────

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

interface WebAppManifest {
  name: string
  short_name: string
  description?: string
  display: string
  theme_color: string
  background_color: string
  icons: ManifestIcon[]
}

test('PWA-CONFIG-01', 'Web App Manifest defines valid CHERAS CLOTHING branding, icons, and standalone mode', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest')
  assert(fs.existsSync(manifestPath), `manifest.webmanifest must exist at ${manifestPath}`)

  const content = fs.readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(content) as WebAppManifest

  assert(
    manifest.name.includes('CHERAS CLOTHING'),
    `Expected name to contain 'CHERAS CLOTHING', got: ${manifest.name}`
  )
  assert(manifest.short_name === 'CHERAS CLOTHING', `Expected short_name 'CHERAS CLOTHING', got: ${manifest.short_name}`)
  assert(manifest.display === 'standalone', `Expected display 'standalone', got: ${manifest.display}`)
  assert(manifest.theme_color === '#171717', `Expected theme_color '#171717', got: ${manifest.theme_color}`)
  assert(manifest.background_color === '#FFFFFF', `Expected background_color '#FFFFFF', got: ${manifest.background_color}`)
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Manifest must have at least 4 icons')
})

test('PWA-CONFIG-02', 'All manifest referenced icons exist on filesystem', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as WebAppManifest

  for (const icon of manifest.icons) {
    const iconRelative = (icon.src || '').replace(/^\//, '')
    const iconPath = path.resolve(process.cwd(), 'public', iconRelative)
    assert(fs.existsSync(iconPath), `Icon file ${icon.src} must exist at ${iconPath}`)
    const stat = fs.statSync(iconPath)
    assert(stat.size > 0, `Icon file ${icon.src} must not be 0 bytes`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=================================================================')
  console.log('  CHERAS CLOTHING POS — Phase 4 & 5 Automated Test Suite')
  console.log('=================================================================\n')

  for (const { id, name, fn } of tests) {
    try {
      await fn()
      console.log(`  [PASS] ${id}: ${name}`)
      passedCount++
    } catch (err: unknown) {
      console.error(`  [FAIL] ${id}: ${name}`)
      console.error(`         ${err instanceof Error ? err.message : String(err)}`)
      failedCount++
    }
  }

  console.log('\n=================================================================')
  console.log(`  Summary: ${passedCount} passed, ${failedCount} failed (${tests.length} total)`)
  console.log('=================================================================')

  if (failedCount > 0) {
    process.exit(1)
  }
}

void run()
