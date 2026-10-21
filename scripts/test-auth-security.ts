/**
 * CHERAS CLOTHING POS — Authentication Security Automated Test Suite
 * Validates fail-closed behavior, production credential enforcement,
 * development-only fallback gating, and session integrity.
 */

import {
  evaluatePortalCredentials,
  createSessionIntegrityToken,
  validateSessionPayload,
} from '../src/store/adminAuthStore'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
let passedCount = 0
let failedCount = 0

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────────────────────

test('PROD-01: In production, missing credentials FAIL CLOSED (rejects admin/admin123)', () => {
  const result = evaluatePortalCredentials('admin', 'admin123', {
    isProduction: true,
    adminId: '',
    adminPassword: '',
    staffId: '',
    staffPassword: '',
  })

  assert(result.role === null, `Expected role to be null, got: ${result.role}`)
  assert(
    result.error !== null && result.error.includes('not configured for production'),
    `Expected fail-closed production configuration error, got: ${result.error}`
  )
})

test('PROD-02: In production, empty or whitespace credentials reject immediately', () => {
  const result1 = evaluatePortalCredentials('', 'somePassword', { isProduction: true })
  assert(result1.role === null, 'Expected empty portalId to be rejected')

  const result2 = evaluatePortalCredentials('admin', '   ', { isProduction: true })
  assert(result2.role === null, 'Expected whitespace password to be rejected')
})

test('PROD-03: In production, prohibited default passwords (admin123) are BLOCKED even if configured in env', () => {
  const result = evaluatePortalCredentials('store_manager', 'admin123', {
    isProduction: true,
    adminId: 'store_manager',
    adminPassword: 'admin123', // Insecure default
  })

  assert(result.role === null, 'Expected default password to be blocked')
  assert(
    result.error !== null && result.error.includes('insecure default password'),
    `Expected default password rejection error, got: ${result.error}`
  )
})

test('PROD-04: In production, prohibited passwords (password, 12345678, root) are BLOCKED', () => {
  const badPasswords = ['password', '12345678', 'root', 'staff123']
  for (const badPass of badPasswords) {
    const result = evaluatePortalCredentials('admin_user', badPass, {
      isProduction: true,
      adminId: 'admin_user',
      adminPassword: badPass,
    })
    assert(result.role === null, `Expected ${badPass} to be blocked in production`)
  }
})

test('PROD-05: In production, valid strong admin credentials authenticate successfully', () => {
  const strongAdminPass = 'R@siTex#2026!SecOps'
  const result = evaluatePortalCredentials('cheras_admin', strongAdminPass, {
    isProduction: true,
    adminId: 'cheras_admin',
    adminPassword: strongAdminPass,
  })

  assert(result.role === 'admin', `Expected role 'admin', got: ${result.role}`)
  assert(result.error === null, `Expected null error, got: ${result.error}`)
})

test('PROD-06: In production, invalid credentials with configured admin FAIL CLOSED', () => {
  const strongAdminPass = 'R@siTex#2026!SecOps'
  const result = evaluatePortalCredentials('cheras_admin', 'wrong_password_attempt', {
    isProduction: true,
    adminId: 'cheras_admin',
    adminPassword: strongAdminPass,
  })

  assert(result.role === null, 'Expected wrong password to fail')
  assert(result.error === 'Invalid Admin or Staff credentials.', `Got: ${result.error}`)
})

test('PROD-07: In production, configured staff credentials authenticate as role: staff', () => {
  const strongStaffPass = 'R@siStaff#Counter$1'
  const result = evaluatePortalCredentials('staff_counter_1', strongStaffPass, {
    isProduction: true,
    adminId: 'cheras_admin',
    adminPassword: 'R@siTex#2026!SecOps',
    staffId: 'staff_counter_1',
    staffPassword: strongStaffPass,
  })

  assert(result.role === 'staff', `Expected role 'staff', got: ${result.role}`)
  assert(result.error === null, `Expected null error, got: ${result.error}`)
})

test('PROD-08: In production, staff credentials cannot access admin role', () => {
  const strongStaffPass = 'R@siStaff#Counter$1'
  const result = evaluatePortalCredentials('staff_counter_1', strongStaffPass, {
    isProduction: true,
    adminId: 'cheras_admin',
    adminPassword: 'R@siTex#2026!SecOps',
    staffId: 'staff_counter_1',
    staffPassword: strongStaffPass,
  })

  assert(result.role !== 'admin', 'Staff must not be assigned admin role')
})

test('DEV-01: In development mode, fallback credentials work for local offline development', () => {
  const result = evaluatePortalCredentials('admin', 'admin123', {
    isProduction: false,
    adminId: '',
    adminPassword: '',
  })

  assert(result.role === 'admin', `Expected dev fallback to grant 'admin', got: ${result.role}`)
  assert(result.error === null, `Expected no error in dev fallback, got: ${result.error}`)
})

test('DEV-02: In development mode, invalid credentials still fail', () => {
  const result = evaluatePortalCredentials('admin', 'wrong_pass', {
    isProduction: false,
    adminId: '',
    adminPassword: '',
  })

  assert(result.role === null, 'Expected invalid credentials to fail in dev mode')
})

test('SESS-01: Valid session payload with matching integrity token passes verification', () => {
  const now = Date.now()
  const token = createSessionIntegrityToken('store_admin_1', 'admin', now)
  const validPayload = {
    state: {
      isLoggedIn: true,
      role: 'admin',
      adminId: 'store_admin_1',
      sessionToken: token,
      issuedAt: now,
    },
    version: 0,
  }

  assert(validateSessionPayload(validPayload) === true, 'Expected valid session payload to pass')
})

test('SESS-02: Role tampering in session payload (injected role: hacker) is REJECTED', () => {
  const now = Date.now()
  const token = createSessionIntegrityToken('store_admin_1', 'admin', now)
  const tamperedPayload = {
    state: {
      isLoggedIn: true,
      role: 'super_hacker', // invalid role
      adminId: 'store_admin_1',
      sessionToken: token,
      issuedAt: now,
    },
    version: 0,
  }

  assert(validateSessionPayload(tamperedPayload) === false, 'Expected tampered role to be rejected')
})

test('SESS-03: Tampered adminId with forged session token is REJECTED', () => {
  const now = Date.now()
  const token = createSessionIntegrityToken('staff_counter_1', 'staff', now)
  const tamperedPayload = {
    state: {
      isLoggedIn: true,
      role: 'admin', // escalated role with staff token
      adminId: 'staff_counter_1',
      sessionToken: token,
      issuedAt: now,
    },
    version: 0,
  }

  assert(validateSessionPayload(tamperedPayload) === false, 'Expected privilege escalation to be rejected')
})

test('SESS-04: Logged-out state is valid and role is null', () => {
  const loggedOutPayload = {
    state: {
      isLoggedIn: false,
      role: null,
      adminId: null,
    },
    version: 0,
  }

  assert(validateSessionPayload(loggedOutPayload) === true, 'Logged-out state should be valid')
})

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=================================================================')
  console.log('  CHERAS CLOTHING POS — Authentication Security Test Suite')
  console.log('=================================================================\n')

  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`  [PASS] ${name}`)
      passedCount++
    } catch (err: unknown) {
      console.error(`  [FAIL] ${name}`)
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
