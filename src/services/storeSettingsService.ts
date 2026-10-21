/**
 * storeSettingsService.ts
 * Manages shop profile, brand customization, theme colors, and real-time database synchronization.
 * Designed for CHERAS CLOTHING POS & Administration.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  BRAND_EN,
  BRAND_OWNER_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_EMAIL,
  BRAND_ADDRESS,
  BRAND_INSTAGRAM_URL,
  BRAND_GSTIN,
  BRAND_ICON,
} from '../lib/brand'

export interface ShopSettings {
  id: number
  name: string
  owner_name: string
  tagline: string
  phone: string
  email: string
  address: string
  city: string
  business_hours: string
  instagram_url: string
  catalog_headline: string
  gstin: string
  logo_url: string
  theme_color: string
  gst_enabled: boolean
  updated_at?: string
}

export const DEFAULT_THEME_COLOR = '#171717' // Cheras Clothing Black and Grey

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  id: 1,
  name: BRAND_EN || 'CHERAS CLOTHING',
  owner_name: BRAND_OWNER_NAME || '',
  tagline: 'Wear Your Kingdom',
  phone: BRAND_PHONE_DISPLAY || '+91 9715083947',
  email: BRAND_EMAIL || 'cherasclothing777@gmail.com',
  address: BRAND_ADDRESS || '74, Cheras Clothing, Avinashi Road, opposite to Government Medical College, Coimbatore 641014',
  city: 'Coimbatore, Tamil Nadu',
  business_hours: 'Open Daily 9:30 AM - 9:30 PM',
  instagram_url: BRAND_INSTAGRAM_URL || 'https://www.instagram.com/cherasclothing_official/',
  catalog_headline: 'Explore the Cheras Clothing Collection',
  gstin: BRAND_GSTIN || '',
  logo_url: BRAND_ICON || '/cheras-icon-white.png',
  theme_color: DEFAULT_THEME_COLOR,
  gst_enabled: false,
}

const STORAGE_SETTINGS_KEY = 'cheras_store_settings_v1'
const STORAGE_THEME_KEY = 'cheras_theme_color_v1'

/**
 * Adjust hex color brightness by percentage (e.g., -15 for darker hover)
 */
export function adjustBrightness(hex: string, percent: number): string {
  try {
    const cleanHex = hex.replace('#', '')
    if (cleanHex.length !== 6) return hex
    const num = parseInt(cleanHex, 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max(0, Math.min(255, (num >> 16) + amt))
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt))
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt))
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
  } catch {
    return hex
  }
}

/**
 * Determines whether text on top of this color should be light or dark.
 */
export function isLightColor(hex: string): boolean {
  try {
    const cleanHex = hex.replace('#', '')
    if (cleanHex.length !== 6) return false
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 155
  } catch {
    return false
  }
}

export function getContrastTextColor(hex: string): string {
  return isLightColor(hex) ? '#111111' : '#FFFFFF'
}

/**
 * Applies the given theme color to documentElement CSS custom properties.
 */
export function applyThemeColorToDOM(color: string): void {
  if (typeof document === 'undefined') return
  const cleanColor = color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`
  const hoverColor = adjustBrightness(cleanColor, -12)
  const textColor = getContrastTextColor(cleanColor)
  const lightBg = `${cleanColor}18` // ~10% opacity
  const subtleBorder = `${cleanColor}40` // ~25% opacity

  document.documentElement.style.setProperty('--brand-primary', cleanColor)
  document.documentElement.style.setProperty('--brand-primary-hover', hoverColor)
  document.documentElement.style.setProperty('--brand-primary-text', textColor)
  document.documentElement.style.setProperty('--brand-primary-light', lightBg)
  document.documentElement.style.setProperty('--brand-primary-border', subtleBorder)

  document.documentElement.style.setProperty('--brand-blue', cleanColor)
  document.documentElement.style.setProperty('--brand-blue-hover', hoverColor)
  document.documentElement.style.setProperty('--brand-blue-light', lightBg)
  document.documentElement.style.setProperty('--brand-blue-surface', lightBg)

  try {
    localStorage.setItem(STORAGE_THEME_KEY, cleanColor)
  } catch { /* ignore */ }
}

/**
 * Returns current locally stored theme color or default.
 */
export function getInitialThemeColor(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_COLOR
  try {
    const stored = localStorage.getItem(STORAGE_THEME_KEY)
    if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
      return stored
    }
  } catch { /* ignore */ }
  return DEFAULT_THEME_COLOR
}

/**
 * Reads local cached store settings.
 */
export function getLocalStoreSettings(): ShopSettings {
  if (typeof window === 'undefined') return DEFAULT_SHOP_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY)
    if (raw) {
      return { ...DEFAULT_SHOP_SETTINGS, ...JSON.parse(raw) }
    }
  } catch { /* ignore */ }
  return DEFAULT_SHOP_SETTINGS
}

/**
 * Fetches store settings from Supabase, with automatic local fallback and DOM theme apply.
 */
export async function fetchStoreSettings(): Promise<ShopSettings> {
  const local = getLocalStoreSettings()

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      if (!error && data) {
        const merged: ShopSettings = {
          id: 1,
          name: data.name || local.name || DEFAULT_SHOP_SETTINGS.name,
          owner_name: data.owner_name ?? local.owner_name,
          tagline: data.tagline ?? local.tagline,
          phone: data.phone || local.phone || DEFAULT_SHOP_SETTINGS.phone,
          email: data.email || local.email || DEFAULT_SHOP_SETTINGS.email,
          address: data.address || local.address || DEFAULT_SHOP_SETTINGS.address,
          city: data.city || local.city || DEFAULT_SHOP_SETTINGS.city,
          business_hours: data.business_hours || local.business_hours || DEFAULT_SHOP_SETTINGS.business_hours,
          instagram_url: data.instagram_url || local.instagram_url || DEFAULT_SHOP_SETTINGS.instagram_url,
          catalog_headline: data.catalog_headline || local.catalog_headline || DEFAULT_SHOP_SETTINGS.catalog_headline,
          gstin: data.gstin || local.gstin || DEFAULT_SHOP_SETTINGS.gstin,
          logo_url: data.logo_url || local.logo_url || DEFAULT_SHOP_SETTINGS.logo_url,
          theme_color: data.theme_color || local.theme_color || DEFAULT_SHOP_SETTINGS.theme_color,
          gst_enabled: data.gst_enabled ?? local.gst_enabled,
          updated_at: data.updated_at,
        }

        try {
          localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(merged))
        } catch { /* ignore */ }

        if (merged.theme_color) {
          applyThemeColorToDOM(merged.theme_color)
        }

        return merged
      }
    } catch (err) {
      console.warn('[storeSettingsService] Failed to load remote settings, using local:', err)
    }
  }

  // Apply local theme color
  if (local.theme_color) {
    applyThemeColorToDOM(local.theme_color)
  }
  return local
}

/**
 * Updates store settings in Supabase and updates local storage cache.
 */
export async function saveStoreSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
  const current = getLocalStoreSettings()
  const updated: ShopSettings = {
    ...current,
    ...settings,
    id: 1,
    updated_at: new Date().toISOString(),
  }

  // Save to local storage first
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }

  if (updated.theme_color) {
    applyThemeColorToDOM(updated.theme_color)
  }

  if (isSupabaseConfigured) {
    try {
      const payload: Record<string, unknown> = {
        id: 1,
        name: updated.name,
        owner_name: updated.owner_name,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        updated_at: updated.updated_at,
      }

      // Add extended columns if present
      if (updated.tagline !== undefined) payload.tagline = updated.tagline
      if (updated.city !== undefined) payload.city = updated.city
      if (updated.business_hours !== undefined) payload.business_hours = updated.business_hours
      if (updated.instagram_url !== undefined) payload.instagram_url = updated.instagram_url
      if (updated.catalog_headline !== undefined) payload.catalog_headline = updated.catalog_headline
      if (updated.gstin !== undefined) payload.gstin = updated.gstin
      if (updated.logo_url !== undefined) payload.logo_url = updated.logo_url
      if (updated.theme_color !== undefined) payload.theme_color = updated.theme_color
      if (updated.gst_enabled !== undefined) payload.gst_enabled = updated.gst_enabled

      const { data, error } = await supabase
        .from('store_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle()

      if (error) {
        console.error('[storeSettingsService] Remote upsert error:', error.message)
        // Check if error is due to missing columns, if so fallback to base columns
        if (error.message.includes('column') || error.message.includes('does not exist')) {
          const fallbackPayload = {
            id: 1,
            name: updated.name,
            owner_name: updated.owner_name,
            phone: updated.phone,
            email: updated.email,
            address: updated.address,
            updated_at: updated.updated_at,
          }
          await supabase.from('store_settings').upsert(fallbackPayload, { onConflict: 'id' })
        }
      } else if (data) {
        return {
          ...updated,
          ...data,
        }
      }
    } catch (err) {
      console.error('[storeSettingsService] Exception during save:', err)
    }
  }

  return updated
}

/**
 * Uploads a shop logo file to Supabase Storage 'branding' bucket.
 */
export async function uploadShopLogo(file: File): Promise<string> {
  if (isSupabaseConfigured) {
    try {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `shop_logo_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (!uploadError) {
        const { data } = supabase.storage.from('branding').getPublicUrl(fileName)
        if (data?.publicUrl) {
          return data.publicUrl
        }
      } else {
        console.warn('[storeSettingsService] Upload to branding bucket failed:', uploadError.message)
      }
    } catch (err) {
      console.warn('[storeSettingsService] Exception uploading logo:', err)
    }
  }

  // Fallback to data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
