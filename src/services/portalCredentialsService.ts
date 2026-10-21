import { supabase } from '../lib/supabase'

export interface PortalCredentialItem {
  login_id: string
  password: string
}

export interface PortalCredentialsMap {
  admin?: PortalCredentialItem
  staff?: PortalCredentialItem
}

export interface PortalRpcLoginResult {
  role: 'admin' | 'staff' | null
  error?: string
  functionMissing?: boolean
}

/**
 * Authenticates via the database RPC `portal_login`.
 * Returns the authenticated role or detailed error condition.
 */
export async function loginViaPortalRpc(
  portalId: string,
  password: string
): Promise<PortalRpcLoginResult> {
  const trimmedId = portalId.trim()
  try {
    const { data, error } = await supabase.rpc('portal_login', {
      p_id: trimmedId,
      p_password: password,
    })

    if (error) {
      // PGRST202: Function not found in schema cache
      // 42883: undefined_function in postgres
      if (error.code === 'PGRST202' || error.code === '42883') {
        return { role: null, functionMissing: true }
      }
      return { role: null, error: error.message || 'Database authentication error' }
    }

    if (data === 'admin' || data === 'staff') {
      return { role: data }
    }

    return {
      role: null,
      error: 'Invalid credentials or account temporarily locked after 5 failed attempts.',
    }
  } catch (err) {
    return {
      role: null,
      error: err instanceof Error ? err.message : 'Network error during authentication',
    }
  }
}

/**
 * Fetches admin & staff credentials for the 4-box Settings view.
 * Requires admin authentication.
 */
export async function fetchPortalCredentials(
  adminId: string,
  adminPassword: string
): Promise<{ success: boolean; data?: PortalCredentialsMap; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('portal_get_credentials', {
      p_admin_id: adminId.trim(),
      p_admin_password: adminPassword,
    })

    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        return {
          success: false,
          error: 'Portal credentials feature is not installed yet (run SQL migration).',
        }
      }
      return { success: false, error: error.message }
    }

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'Incorrect admin password or authentication failed.',
      }
    }

    return { success: true, data: data as PortalCredentialsMap }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve portal credentials',
    }
  }
}

/**
 * Updates portal login ID and password for the target role.
 * Requires admin authentication.
 */
export async function updatePortalCredential(
  adminId: string,
  adminPassword: string,
  targetRole: 'admin' | 'staff',
  newLoginId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanId = newLoginId.trim()
  const cleanPass = newPassword.trim()

  if (cleanId.length < 3) {
    return { success: false, error: 'Login ID must be at least 3 characters long.' }
  }
  if (cleanPass.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' }
  }

  try {
    const { data, error } = await supabase.rpc('portal_update_credential', {
      p_admin_id: adminId.trim(),
      p_admin_password: adminPassword,
      p_target_role: targetRole,
      p_new_login_id: cleanId,
      p_new_password: cleanPass,
    })

    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        return {
          success: false,
          error: 'Portal credentials feature is not installed yet (run SQL migration).',
        }
      }
      return { success: false, error: error.message }
    }

    if (data !== true) {
      return {
        success: false,
        error: 'Authentication failed. Please verify the current admin password.',
      }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update portal credential',
    }
  }
}
