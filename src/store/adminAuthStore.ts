import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { alarmSound } from '../lib/alarmAudio'
import { useAlarmStore } from './alarmStore'
import { loginViaPortalRpc } from '../services/portalCredentialsService'

export type AdminRole = 'admin' | 'staff' | null

export interface AdminAuthState {
  isLoggedIn: boolean
  role: AdminRole
  adminId: string | null
  authError: string | null
  login: (portalId: string, password: string) => Promise<AdminRole | false>
  logout: () => void
  updateAdminId?: (newId: string) => void
}

export interface CredentialEvaluationResult {
  role: AdminRole
  error: string | null
}

export interface AuthEnvironmentConfig {
  isProduction?: boolean
  adminId?: string
  adminPassword?: string
  staffId?: string
  staffPassword?: string
}

// Insecure default passwords prohibited in production environments
const PROHIBITED_PRODUCTION_PASSWORDS = new Set([
  'admin123',
  'admin',
  'staff123',
  'staff',
  'password',
  'password123',
  '12345678',
  '123456',
  'root',
  'qwerty',
])

/**
 * Pure evaluation function for Portal ID and password verification.
 * Supports environment overrides for automated testing.
 */
export function evaluatePortalCredentials(
  portalId: string,
  password: string,
  envConfig?: AuthEnvironmentConfig
): CredentialEvaluationResult {
  const trimmedId = String(portalId || '').trim()
  const trimmedPass = String(password || '').trim()

  if (!trimmedId || !trimmedPass) {
    return { role: null, error: 'Please enter both Portal ID and password.' }
  }

interface MetaEnvHolder {
  env?: {
    PROD?: boolean
    MODE?: string
    VITE_ADMIN_ID?: string
    VITE_PORTAL_ID?: string
    VITE_ADMIN_PASSWORD?: string
    VITE_PORTAL_PASSWORD?: string
    VITE_STAFF_ID?: string
    VITE_STAFF_PASSWORD?: string
    [key: string]: string | boolean | undefined
  }
}

  const meta = typeof import.meta !== 'undefined' ? (import.meta as unknown as MetaEnvHolder) : undefined
  const metaEnv = meta?.env || ({} as Record<string, string | boolean | undefined>)

  const isProduction =
    envConfig?.isProduction ??
    Boolean(metaEnv.PROD || metaEnv.MODE === 'production')

  const configuredAdminId = (
    envConfig?.adminId ??
    ((typeof metaEnv.VITE_ADMIN_ID === 'string' ? metaEnv.VITE_ADMIN_ID : '') ||
     (typeof metaEnv.VITE_PORTAL_ID === 'string' ? metaEnv.VITE_PORTAL_ID : '') ||
     '')
  ).trim()

  const configuredAdminPass = (
    envConfig?.adminPassword ??
    ((typeof metaEnv.VITE_ADMIN_PASSWORD === 'string' ? metaEnv.VITE_ADMIN_PASSWORD : '') ||
     (typeof metaEnv.VITE_PORTAL_PASSWORD === 'string' ? metaEnv.VITE_PORTAL_PASSWORD : '') ||
     '')
  ).trim()

  const configuredStaffId = (
    envConfig?.staffId ??
    ((typeof metaEnv.VITE_STAFF_ID === 'string' ? metaEnv.VITE_STAFF_ID : '') ||
     '')
  ).trim()

  const configuredStaffPass = (
    envConfig?.staffPassword ??
    ((typeof metaEnv.VITE_STAFF_PASSWORD === 'string' ? metaEnv.VITE_STAFF_PASSWORD : '') ||
     '')
  ).trim()

  // ── 1. Production Mode: Strict, Fail-Closed Security ──────────────────────────
  if (isProduction) {
    const hasAdminConfig = Boolean(configuredAdminId && configuredAdminPass)
    const hasStaffConfig = Boolean(configuredStaffId && configuredStaffPass)

    if (!hasAdminConfig && !hasStaffConfig) {
      return {
        role: null,
        error: 'Portal authentication is not configured for production. Please configure administrative credentials.',
      }
    }

    // Verify Admin credentials if configured
    if (hasAdminConfig) {
      if (PROHIBITED_PRODUCTION_PASSWORDS.has(configuredAdminPass.toLowerCase())) {
        return {
          role: null,
          error: 'Configured administrator credentials use an insecure default password. Access is blocked in production.',
        }
      }

      if (trimmedId === configuredAdminId && trimmedPass === configuredAdminPass) {
        return { role: 'admin', error: null }
      }
    }

    // Verify Staff credentials if configured
    if (hasStaffConfig) {
      if (PROHIBITED_PRODUCTION_PASSWORDS.has(configuredStaffPass.toLowerCase())) {
        return {
          role: null,
          error: 'Configured staff credentials use an insecure default password. Access is blocked in production.',
        }
      }

      if (trimmedId === configuredStaffId && trimmedPass === configuredStaffPass) {
        return { role: 'staff', error: null }
      }
    }

    return { role: null, error: 'Invalid Admin or Staff credentials.' }
  }

  // ── 2. Development Mode: Safe Gated Developer Fallback ─────────────────────────
  const devAdminId = configuredAdminId || 'admin'
  const devAdminPass = configuredAdminPass || 'admin123'
  const devStaffId = configuredStaffId || 'staff'
  const devStaffPass = configuredStaffPass || 'staff123'

  if (!configuredAdminId || !configuredAdminPass) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[DEV ONLY] Portal authentication is running with development fallback credentials. This fallback is strictly disabled in production builds.'
      )
    }
  }

  if (trimmedId === devAdminId && trimmedPass === devAdminPass) {
    return { role: 'admin', error: null }
  }

  if (trimmedId === devStaffId && trimmedPass === devStaffPass) {
    return { role: 'staff', error: null }
  }

  return { role: null, error: 'Invalid Admin or Staff credentials.' }
}

/**
 * Creates an integrity token for session validation to guard against role tampering.
 */
export function createSessionIntegrityToken(adminId: string, role: string, timestamp: number): string {
  const seed = `${adminId}:${role}:${timestamp}:cheras-clothing-secure-portal`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `st_${Math.abs(hash).toString(36)}_${timestamp.toString(36)}`
}

export interface StoredSessionPayload {
  state: {
    isLoggedIn: boolean
    role: AdminRole
    adminId: string | null
    sessionToken?: string
    issuedAt?: number
  }
  version?: number
}

export function validateSessionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as StoredSessionPayload
  if (!p.state) return false
  const { isLoggedIn, role, adminId, sessionToken, issuedAt } = p.state
  if (!isLoggedIn) return true
  if (role !== 'admin' && role !== 'staff') return false
  if (!adminId || typeof adminId !== 'string') return false
  if (!sessionToken || !issuedAt) return false
  const expected = createSessionIntegrityToken(adminId, role, issuedAt)
  return sessionToken === expected
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      role: null,
      adminId: null,
      authError: null,

      login: async (portalId: string, password: string) => {
        // 1. Attempt database RPC authentication first
        const rpcResult = await loginViaPortalRpc(portalId, password)

        if (rpcResult.role === 'admin' || rpcResult.role === 'staff') {
          useAlarmStore.getState().resetSilencedState()
          set({
            isLoggedIn: true,
            role: rpcResult.role,
            adminId: portalId.trim(),
            authError: null,
          })
          return rpcResult.role
        }

        // 2. Fall back to environment/code credentials ONLY when database function does not exist
        if (rpcResult.functionMissing) {
          const result = evaluatePortalCredentials(portalId, password)
          if (result.role === 'admin' || result.role === 'staff') {
            useAlarmStore.getState().resetSilencedState()
            set({
              isLoggedIn: true,
              role: result.role,
              adminId: portalId.trim(),
              authError: null,
            })
            return result.role
          }
          set({
            isLoggedIn: false,
            role: null,
            adminId: null,
            authError: result.error || 'Invalid Admin or Staff credentials.',
          })
          return false
        }

        // 3. Any other error or failed credentials FAIL CLOSED
        set({
          isLoggedIn: false,
          role: null,
          adminId: null,
          authError: rpcResult.error || 'Invalid Admin or Staff credentials.',
        })
        return false
      },

      updateAdminId: (newId: string) => {
        set((state) => ({ ...state, adminId: newId.trim() }))
      },

      logout: () => {
        try {
          alarmSound.stopAlert()
        } catch {
          // Ignore audio stop failures on uninitialized contexts
        }
        useAlarmStore.getState().resetSilencedState()
        set({ isLoggedIn: false, role: null, adminId: null, authError: null })
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('universal-look-admin-session')
        }
      },
    }),
    {
      name: 'universal-look-admin-session',
      storage: {
        getItem: (name): StoredSessionPayload | null => {
          if (typeof sessionStorage === 'undefined') return null
          try {
            const raw = sessionStorage.getItem(name)
            if (!raw) return null
            const parsed = JSON.parse(raw) as StoredSessionPayload

            if (!parsed?.state) return null

            if (!validateSessionPayload(parsed)) {
              sessionStorage.removeItem(name)
              return null
            }

            return parsed
          } catch {
            sessionStorage.removeItem(name)
            return null
          }
        },

        setItem: (name, value: StoredSessionPayload) => {
          if (typeof sessionStorage === 'undefined') return
          try {
            const state = value.state
            if (state.isLoggedIn && state.role && state.adminId) {
              const now = Date.now()
              state.issuedAt = now
              state.sessionToken = createSessionIntegrityToken(state.adminId, state.role, now)
            }
            sessionStorage.setItem(name, JSON.stringify(value))
          } catch {
            // Storage quota or serialization error
          }
        },

        removeItem: (name) => {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(name)
          }
        },
      },
    }
  )
)
