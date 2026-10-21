import React, { useState, useEffect, useRef } from 'react'
import {
  SlidersHorizontal,
  Palette,
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  Hash,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

const InstagramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)
import { useThemeStore } from '../../store/themeStore'
import { PortalCredentialsCard } from './PortalCredentialsCard'
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_SHOP_SETTINGS,
  uploadShopLogo,
  isLightColor,
} from '../../services/storeSettingsService'
import { BRAND_EN, BRAND_ICON } from '../../lib/brand'

// Curated 20 color palettes matching modern retail and Nidhulan reference
const CURATED_PALETTES = [
  // Row 1 (Golds, Bronzes, Dark neutrals, Slates)
  '#B8B8B8', // Cheras Classic Gold
  '#B8B8B8', // Rich Metallic Gold
  '#E6CA65', // Pale Gold
  '#B38018', // Warm Bronze
  '#85581A', // Deep Amber Bronze
  '#2B2D42', // Charcoal
  '#1F2937', // Dark Slate
  '#4B5563', // Slate Grey
  '#64748B', // Cool Slate
  '#94A3B8', // Light Slate

  // Row 2 (Teals, Blues, Purples, Maroons, Reds, Terracotta, Greens)
  '#0F766E', // Forest Teal
  '#1E3A8A', // Deep Sapphire Navy
  '#6B21A8', // Royal Purple
  '#831843', // Plum / Berry
  '#171717', // Cheras Black and Grey (Default)
  '#991B1B', // Deep Crimson
  '#C2410C', // Terracotta Rust (Nidhulan tone)
  '#D97706', // Warm Amber
  '#059669', // Emerald Green
  '#334155', // Steel Blue
]

export const SettingsView: React.FC = () => {
  const { themeColor, settings, isSaving, setThemeColor, saveThemeColorToDB, updateSettings, loadSettings } = useThemeStore()

  // Form states
  const [customHex, setCustomHex] = useState(themeColor)
  const [formData, setFormData] = useState(settings)
  const [logoUploading, setLogoUploading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    setFormData(settings)
    setCustomHex(settings.theme_color || themeColor)
  }, [settings, themeColor])

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => {
      setNotice(null)
    }, 4500)
  }

  // Handle color palette click
  const handleSelectPalette = (color: string) => {
    setCustomHex(color)
    setThemeColor(color)
  }

  // Handle saving color specifically
  const handleSaveColor = async () => {
    let clean = customHex.trim()
    if (!clean.startsWith('#')) clean = `#${clean}`
    if (!/^#[0-9a-fA-F]{6}$/i.test(clean)) {
      showNotice('error', 'Please enter a valid 6-character hex code (e.g. #171717).')
      return
    }
    await saveThemeColorToDB(clean)
    showNotice('success', `Theme colour ${clean.toUpperCase()} saved & synchronized.`)
  }

  // Reset color to default Cheras black
  const handleResetColor = async () => {
    setCustomHex(DEFAULT_THEME_COLOR)
    setThemeColor(DEFAULT_THEME_COLOR)
    await saveThemeColorToDB(DEFAULT_THEME_COLOR)
    showNotice('success', 'Restored default CHERAS CLOTHING Black and Grey theme (#171717).')
  }

  // Handle saving full shop profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings({
        ...formData,
        theme_color: themeColor,
      })
      showNotice('success', 'Shop profile & branding details updated successfully.')
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Failed to update shop details.')
    }
  }

  // Handle logo file selection & upload
  const handleLogoUpload = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showNotice('error', 'Please select a valid image file (PNG, JPG, or WebP).')
      return
    }
    setLogoUploading(true)
    try {
      const publicUrl = await uploadShopLogo(file)
      setFormData((prev) => ({ ...prev, logo_url: publicUrl }))
      await updateSettings({ logo_url: publicUrl })
      showNotice('success', 'Shop logo uploaded & updated successfully.')
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Failed to upload logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  const activeColor = themeColor || DEFAULT_THEME_COLOR
  const textIsDark = isLightColor(activeColor)

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 max-w-7xl mx-auto">
      {/* Top Header / Store Title */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl bg-white border border-[#E5E5E5] flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden"
          >
            <img src={formData.logo_url || BRAND_ICON} alt={formData.name || BRAND_EN} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111111] tracking-tight">
              {formData.name || BRAND_EN}
            </h1>
          </div>
        </div>
      </div>

      {/* Header Banner Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 shadow-sm p-5 sm:p-6 flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm transition-colors duration-300"
          style={{ backgroundColor: activeColor }}
        >
          <SlidersHorizontal size={22} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#111111] tracking-wide uppercase">
            Shop Settings &amp; Customization
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            Configure your brand identity, shop profile, logo, and theme colours across the POS and invoices.
          </p>
        </div>
      </div>

      {/* Floating Notice / Toast */}
      {notice && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm transition-all animate-in slide-in-from-top-2 duration-150 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: APPEARANCE & BRAND THEME (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-gray-700" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#111111]">
                  Appearance &amp; Brand Theme
                </h3>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Select or customize the primary accent colour used across the POS terminal, buttons, totals, receipts, and printed invoices.
              </p>
            </div>

            {/* CURATED PALETTES */}
            <div className="space-y-2.5">
              <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider">
                Curated Palettes
              </label>
              <div className="grid grid-cols-10 gap-2 sm:gap-2.5">
                {CURATED_PALETTES.map((color) => {
                  const isSelected = activeColor.toLowerCase() === color.toLowerCase()
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleSelectPalette(color)}
                      title={color}
                      className={`w-full aspect-square rounded-xl transition-all duration-150 cursor-pointer relative hover:scale-105 ${
                        isSelected
                          ? 'ring-2 ring-black ring-offset-2 scale-105 shadow-sm'
                          : 'hover:opacity-90'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isLightColor(color) ? '#000000' : '#FFFFFF' }}
                          />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CUSTOM HEX COLOR */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider">
                Custom Hex Color
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Visual Swatch with Hidden Native Color Picker */}
                <div
                  onClick={() => colorPickerRef.current?.click()}
                  className="w-11 h-11 rounded-xl border border-gray-200 cursor-pointer shadow-xs transition-transform active:scale-95 shrink-0 overflow-hidden relative"
                  style={{ backgroundColor: activeColor }}
                  title="Click to open color picker"
                >
                  <input
                    ref={colorPickerRef}
                    type="color"
                    value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#171717'}
                    onChange={(e) => {
                      setCustomHex(e.target.value.toUpperCase())
                      setThemeColor(e.target.value.toUpperCase())
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>

                {/* Hex Input */}
                <input
                  type="text"
                  maxLength={7}
                  value={customHex}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase()
                    setCustomHex(val)
                    if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
                      setThemeColor(val)
                    }
                  }}
                  placeholder="#171717"
                  className="flex-1 min-w-[110px] h-11 px-3.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs font-mono font-black text-[#111111] focus:outline-none focus:border-black uppercase transition-all"
                />

                {/* Reset Button */}
                <button
                  type="button"
                  onClick={handleResetColor}
                  className="h-11 px-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                  title="Reset to default CHERAS CLOTHING Black (#171717)"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>

                {/* Save Color Button */}
                <button
                  type="button"
                  onClick={() => void handleSaveColor()}
                  disabled={isSaving}
                  className="h-11 px-4 rounded-xl bg-[#111111] hover:bg-black text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{isSaving ? 'Saving...' : 'Save Color'}</span>
                </button>
              </div>
            </div>

            {/* LIVE COMPONENT PREVIEW */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider">
                Live Component Preview
              </label>

              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50/60 shadow-xs">
                {/* Active Theme Banner */}
                <div
                  className="p-3.5 sm:p-4 text-center transition-colors duration-300"
                  style={{ backgroundColor: activeColor, color: textIsDark ? '#111111' : '#FFFFFF' }}
                >
                  <p className="text-xs font-black uppercase tracking-wider">
                    ACTIVE THEME: {activeColor.toUpperCase()}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5 font-medium">
                    Buttons, highlights, badges, and invoice headers will adapt to this tone.
                  </p>
                </div>

                {/* Components Sample Bar */}
                <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-black shadow-xs transition-colors pointer-events-none"
                    style={{ backgroundColor: activeColor, color: textIsDark ? '#111111' : '#FFFFFF' }}
                  >
                    Action Button
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-[#222222] text-white text-[11px] font-black tracking-wide">
                    Badge Sample
                  </span>

                  <span className="px-3.5 py-1.5 rounded-xl bg-[#333333] text-[#F3F4F6] text-xs font-black tracking-wider">
                    Total ₹1,250
                  </span>
                </div>

                {/* Token Specs */}
                <div className="p-4 bg-gray-50/80 text-[11px] font-semibold text-gray-600 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Theme Token</span>
                    <span className="font-mono font-bold text-gray-900">{activeColor.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Button Text Fill</span>
                    <span className="font-mono font-bold text-gray-900">{textIsDark ? 'Dark (#111111)' : 'Pure White (#FFFFFF)'}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200/60 leading-normal">
                    Saved colours are stored in your cloud database and applied in real time to the POS, store catalog, and printed receipts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PORTAL ACCESS & PASSWORDS (4 Textboxes with Admin Auth Modal) */}
          <PortalCredentialsCard />
        </div>

        {/* Right Column: SHOP PROFILE & BRAND (7 cols) */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <Store size={18} className="text-gray-700" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#111111]">
                  Shop Profile &amp; Brand
                </h3>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Details shown on printed bills, WhatsApp receipts, and the customer-facing storefront.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Owner Name */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Shop Owner Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    placeholder="e.g. "
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Shop Name */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Shop Name
                </label>
                <div className="relative">
                  <Store size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. CHERAS CLOTHING"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Tagline / Sub-heading */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Tagline / Sub-heading
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Wear Your Kingdom"
                  className="w-full h-11 px-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                />
              </div>

              {/* Contact Numbers */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Contact Numbers
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 9715083947"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Email ID */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Email ID
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. cherasclothing777@gmail.com"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Shop Address */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Shop Address
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                  <textarea
                    rows={2}
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. 74, Cheras Clothing, Avinashi Road, opposite to Government Medical College, Coimbatore 641014"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all resize-none"
                  />
                </div>
              </div>

              {/* City / Location */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  City / Location
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Coimbatore, Tamil Nadu"
                  className="w-full h-11 px-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                />
              </div>

              {/* Business Hours */}
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Business Hours
                </label>
                <div className="relative">
                  <Clock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.business_hours}
                    onChange={(e) => setFormData({ ...formData, business_hours: e.target.value })}
                    placeholder="e.g. Open Daily 9:30 AM - 9:30 PM"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Instagram Link */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Instagram Link
                </label>
                <div className="relative">
                  <InstagramIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="e.g. https://www.instagram.com/cherasclothing_official/"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Catalogue Headline / Services */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  Catalogue Headline / Services
                </label>
                <div className="relative">
                  <Sparkles size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.catalog_headline}
                    onChange={(e) => setFormData({ ...formData, catalog_headline: e.target.value })}
                    placeholder="e.g. Exclusive Sarees, Men's Wear & Kids"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* GSTIN */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                  GSTIN (On GST Invoices)
                </label>
                <div className="relative">
                  <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="# Optional (e.g. )"
                    className="w-full h-11 pl-10 pr-3.5 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold font-mono text-[#111111] focus:outline-none focus:border-black uppercase transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SHOP LOGO */}
            <div className="pt-2 border-t border-gray-100 space-y-2.5">
              <label className="block text-[11px] font-black uppercase text-gray-700 tracking-wider">
                Shop Logo
              </label>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Logo Preview Square */}
                <div className="w-24 h-24 rounded-2xl bg-white border border-gray-200 p-2 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                  <img
                    src={formData.logo_url || BRAND_ICON}
                    alt={formData.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Upload Button & Description */}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleLogoUpload(file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: activeColor, color: textIsDark ? '#111111' : '#FFFFFF' }}
                  >
                    <Upload size={14} />
                    <span>{logoUploading ? 'Uploading Logo...' : 'Upload Logo'}</span>
                  </button>
                  <p className="text-[11px] text-gray-500 font-medium">
                    PNG or JPG, auto-resized to 512px. Used on the store page, invoices, receipts and the installed app icon.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto min-w-[200px] h-12 px-6 rounded-2xl text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: activeColor, color: textIsDark ? '#111111' : '#FFFFFF' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving Changes...' : 'Save Shop Details'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
export default SettingsView
