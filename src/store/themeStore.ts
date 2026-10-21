import { create } from 'zustand'
import {
  type ShopSettings,
  DEFAULT_THEME_COLOR,
  DEFAULT_SHOP_SETTINGS,
  getInitialThemeColor,
  getLocalStoreSettings,
  applyThemeColorToDOM,
  fetchStoreSettings,
  saveStoreSettings,
  adjustBrightness,
  isLightColor,
} from '../services/storeSettingsService'

interface ThemeState {
  themeColor: string
  settings: ShopSettings
  loading: boolean
  isSaving: boolean
  setThemeColor: (color: string) => void
  saveThemeColorToDB: (color: string) => Promise<void>
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<ShopSettings>) => Promise<ShopSettings>
}

// Ensure theme is applied on initial load immediately
const initialColor = getInitialThemeColor()
applyThemeColorToDOM(initialColor)

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeColor: initialColor,
  settings: getLocalStoreSettings(),
  loading: false,
  isSaving: false,

  setThemeColor: (color: string) => {
    applyThemeColorToDOM(color)
    set((state) => ({
      themeColor: color,
      settings: { ...state.settings, theme_color: color },
    }))
  },

  saveThemeColorToDB: async (color: string) => {
    set({ isSaving: true })
    try {
      applyThemeColorToDOM(color)
      const updated = await saveStoreSettings({ theme_color: color })
      set({
        themeColor: color,
        settings: updated,
        isSaving: false,
      })
    } catch {
      set({ isSaving: false })
    }
  },

  loadSettings: async () => {
    set({ loading: true })
    try {
      const fresh = await fetchStoreSettings()
      set({
        settings: fresh,
        themeColor: fresh.theme_color || DEFAULT_THEME_COLOR,
        loading: false,
      })
      if (fresh.theme_color) {
        applyThemeColorToDOM(fresh.theme_color)
      }
    } catch {
      set({ loading: false })
    }
  },

  updateSettings: async (updates: Partial<ShopSettings>) => {
    set({ isSaving: true })
    try {
      const updated = await saveStoreSettings(updates)
      set({
        settings: updated,
        themeColor: updated.theme_color || get().themeColor,
        isSaving: false,
      })
      return updated
    } finally {
      set({ isSaving: false })
    }
  },
}))

export const useTheme = () => {
  const themeColor = useThemeStore((s) => s.themeColor)
  const isLight = isLightColor(themeColor)
  const textColor = isLight ? '#111111' : '#FFFFFF'
  const hoverColor = adjustBrightness(themeColor, -12)
  return {
    themeColor,
    textColor,
    hoverColor,
    lightBg: `${themeColor}18`,
    subtleBorder: `${themeColor}40`,
  }
}
