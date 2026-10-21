import React, { useState, useEffect } from 'react'
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  MessageCircle,
  Info,
  Gift,
} from 'lucide-react'
import type { BirthdayOffer } from '../../services/birthdayService'
import {
  saveBirthdayOffer,
  deleteBirthdayOffer,
  compileBirthdayMessage,
} from '../../services/birthdayService'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useTheme } from '../../store/themeStore'

interface BirthdayOffersManagerProps {
  offers: BirthdayOffer[]
  onOffersUpdated: () => void
  onClose: () => void
  l: (en: string, ta?: string) => string
}

export const BirthdayOffersManager: React.FC<BirthdayOffersManagerProps> = ({
  offers,
  onOffersUpdated,
  onClose,
  l,
}) => {
  const { themeColor, textColor } = useTheme()
  const [selectedOfferId, setSelectedOfferId] = useState<string>(offers[0]?.id || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [existingCouponCodes, setExistingCouponCodes] = useState<string[]>([])

  // Form state initialized with first offer
  const initialOffer = offers[0]
  const [title, setTitle] = useState(initialOffer?.title || '')
  const [discountDescription, setDiscountDescription] = useState(initialOffer?.discountDescription || '')
  const [couponCode, setCouponCode] = useState(initialOffer?.couponCode || '')
  const [messageTemplate, setMessageTemplate] = useState(initialOffer?.messageTemplate || '')
  const [isActive, setIsActive] = useState(initialOffer?.isActive ?? true)
  const [formError, setFormError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch active coupons from existing coupon system to offer easy association
  useEffect(() => {
    async function loadCoupons() {
      if (!isSupabaseConfigured) return
      try {
        const { data } = await supabase
          .from('coupons')
          .select('code, percentage, is_active')
          .eq('is_active', true)
        if (data) {
          setExistingCouponCodes(data.map((c) => String(c.code)))
        }
      } catch {
        // Ignore if coupons table is unavailable
      }
    }
    void loadCoupons()
  }, [])

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || offers[0]

  const handleSelectOffer = (offer: BirthdayOffer) => {
    if (isEditing) return
    setSelectedOfferId(offer.id)
    setTitle(offer.title)
    setDiscountDescription(offer.discountDescription)
    setCouponCode(offer.couponCode || '')
    setMessageTemplate(offer.messageTemplate)
    setIsActive(offer.isActive)
    setFormError('')
  }

  const handleStartCreate = () => {
    setIsCreatingNew(true)
    setIsEditing(true)
    setTitle('')
    setDiscountDescription('')
    setCouponCode('BDAY' + Math.floor(10 + Math.random() * 90))
    setMessageTemplate(`Dear {name},

Wishing you a joyful and blessed Birthday from {shop_name}! 🎂✨

To celebrate, enjoy {offer} on your next purchase!

Coupon Code: {coupon_code}
📍 Visit: {address}
📞 Phone: {phone}
✨ Follow: {instagram}

Show this message at billing counter to claim. Have a great day! 🎉`)
    setIsActive(true)
    setFormError('')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setIsCreatingNew(false)
    setFormError('')
    if (selectedOffer) {
      setTitle(selectedOffer.title)
      setDiscountDescription(selectedOffer.discountDescription)
      setCouponCode(selectedOffer.couponCode || '')
      setMessageTemplate(selectedOffer.messageTemplate)
      setIsActive(selectedOffer.isActive)
    }
  }

  const insertPlaceholder = (tag: string) => {
    setMessageTemplate((prev) => `${prev} ${tag}`)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!title.trim()) {
      setFormError(l('Offer title is required', 'சலுகை தலைப்பு தேவை'))
      return
    }
    if (!discountDescription.trim()) {
      setFormError(l('Discount description is required', 'தள்ளுபடி விவரம் தேவை'))
      return
    }
    if (!messageTemplate.trim()) {
      setFormError(l('Message template cannot be empty', 'வாழ்த்து செய்தி தேவை'))
      return
    }
    if (!messageTemplate.includes('{name}')) {
      setFormError(l("Template must include '{name}' placeholder for customer personalisation", "வாடிக்கையாளர் பெயருக்காக '{name}' இடம்பெற வேண்டும்"))
      return
    }

    setSaving(true)
    const payload = {
      ...(isCreatingNew ? {} : { id: selectedOffer?.id }),
      title: title.trim(),
      discountDescription: discountDescription.trim(),
      couponCode: couponCode.trim().toUpperCase(),
      messageTemplate: messageTemplate.trim(),
      isActive,
    }

    const { offer, error } = await saveBirthdayOffer(payload)
    setSaving(false)

    if (error || !offer) {
      setFormError(error || 'Failed to save offer')
    } else {
      setSaveSuccess(true)
      setIsEditing(false)
      setIsCreatingNew(false)
      setSelectedOfferId(offer.id)
      onOffersUpdated()
      setTimeout(() => setSaveSuccess(false), 2500)
    }
  }

  const handleDelete = async (id: string) => {
    if (offers.length <= 1) {
      alert(l('At least one birthday offer must remain configured.', 'குறைந்தது ஒரு சலுகை இருக்க வேண்டும்.'))
      return
    }
    if (window.confirm(l('Are you sure you want to delete this offer?', 'இந்த சலுகையை நீக்க வேண்டுமா?'))) {
      const { success } = await deleteBirthdayOffer(id)
      if (success) {
        onOffersUpdated()
        const remaining = offers.filter((o) => o.id !== id)
        if (remaining.length > 0) setSelectedOfferId(remaining[0].id)
      }
    }
  }

  // Live preview text with sample customer
  const livePreviewText = compileBirthdayMessage(
    messageTemplate || selectedOffer?.messageTemplate || '',
    'Priya Sundaram',
    {
      id: 'preview',
      title: title || selectedOffer?.title || 'Birthday Treat',
      discountDescription: discountDescription || selectedOffer?.discountDescription || '15% OFF',
      couponCode: couponCode || selectedOffer?.couponCode || 'BDAY15',
      messageTemplate: '',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-white via-white to-gray-50/40">
          <div className="flex items-center gap-2.5">
            <div style={{ backgroundColor: themeColor, color: textColor }} className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs">
              <Gift size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#222222]">
                {l('Birthday Offer & Message Templates', 'பிறந்தநாள் சலுகை & வாழ்த்து செய்திகள்')}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {l('Configure promotions and WhatsApp templates for birthday greetings', 'வாட்ஸ் அப் பிறந்தநாள் வாழ்த்து சலுகைகளை மாற்றியமைக்கலாம்')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Offers Selection & Management Form (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Offer Picker Tabs */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                {l('Configured Offers', 'சலுகைகள்')} ({offers.length})
              </span>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleStartCreate}
                  style={{ backgroundColor: themeColor, color: textColor }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs hover:opacity-90"
                >
                  <Plus size={13} />
                  <span>{l('New Offer', 'புதிய சலுகை')}</span>
                </button>
              )}
            </div>

            {/* Existing Offers Pill Selector */}
            {!isCreatingNew && (
              <div className="flex flex-wrap gap-2">
                {offers.map((offer) => {
                  const isSelected = offer.id === selectedOfferId
                  return (
                    <div
                      key={offer.id}
                      style={isSelected ? { backgroundColor: themeColor, color: textColor, borderColor: themeColor } : undefined}
                      className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        handleSelectOffer(offer)
                      }}
                    >
                      <Tag size={12} className={isSelected ? 'text-white' : 'text-gray-400'} />
                      <span className="truncate max-w-[150px]">{offer.title}</span>

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(offer.id)
                          }}
                          className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white ${
                            isSelected ? 'text-white/80' : 'text-gray-400'
                          }`}
                          title="Delete offer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Edit / View Form */}
            <form onSubmit={handleSave} className="space-y-3.5 bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80">
              <div className="flex items-center justify-between">
                <span style={{ color: themeColor }} className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={13} style={{ color: themeColor }} />
                  {isCreatingNew
                    ? l('Create New Birthday Offer', 'புதிய பிறந்தநாள் சலுகை உருவாக்குக')
                    : isEditing
                    ? l('Edit Birthday Offer', 'சலுகையை திருத்துக')
                    : l('Offer Details', 'சலுகை விவரங்கள்')}
                </span>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    style={{ color: themeColor }}
                    className="inline-flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>{l('Edit this offer', 'திருத்துக')}</span>
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 font-bold flex items-center gap-2">
                  <Check size={14} className="shrink-0" />
                  <span>{l('Offer saved successfully!', 'சலுகை வெற்றிகரமாக சேமிக்கப்பட்டது!')}</span>
                </div>
              )}

              {/* Offer Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                  {l('Offer Title / Name', 'சலுகை தலைப்பு')} *
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Birthday Special 15% OFF"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#222222] disabled:bg-gray-100 disabled:text-gray-600 focus:outline-none focus:border-[#171717]"
                />
              </div>

              {/* Discount Description & Optional Coupon Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                    {l('Discount Description', 'தள்ளுபடி விவரம்')} *
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={discountDescription}
                    onChange={(e) => setDiscountDescription(e.target.value)}
                    placeholder="e.g. Flat 15% discount on textiles"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#222222] disabled:bg-gray-100 disabled:text-gray-600 focus:outline-none focus:border-[#171717]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                    {l('Coupon Code', 'கூப்பன் குறியீடு')}
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BDAY15"
                    list="coupon-codes-list"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#222222] uppercase tracking-wider disabled:bg-gray-100 disabled:text-gray-600 focus:outline-none focus:border-[#171717]"
                  />
                  <datalist id="coupon-codes-list">
                    {existingCouponCodes.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Message Template Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                    {l('WhatsApp Message Template', 'வாட்ஸ் அப் செய்தி மாதிரி')} *
                  </label>
                  {isEditing && (
                    <span className="text-[10px] text-gray-400">
                      {l('Click chips below to insert', 'குறிச்சொற்களை கிளிக் செய்க')}
                    </span>
                  )}
                </div>

                <textarea
                  rows={6}
                  disabled={!isEditing}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-mono text-[#222222] leading-relaxed disabled:bg-gray-100 disabled:text-gray-600 focus:outline-none focus:border-[#171717]"
                />

                {/* Placeholder chips */}
                {isEditing && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { tag: '{name}', label: 'Customer Name' },
                      { tag: '{offer}', label: 'Offer Description' },
                      { tag: '{coupon_code}', label: 'Coupon Code' },
                      { tag: '{shop_name}', label: 'CHERAS CLOTHING' },
                      { tag: '{phone}', label: 'Phone' },
                      { tag: '{address}', label: 'Address' },
                      { tag: '{instagram}', label: 'Instagram' },
                    ].map(({ tag, label }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertPlaceholder(tag)}
                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-[#171717] hover:bg-[#B8B8B8]/15 hover:border-[#B8B8B8] transition-colors cursor-pointer"
                        title={`Insert ${label}`}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3.5 py-1.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {l('Cancel', 'ரத்து')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ backgroundColor: themeColor, color: textColor }}
                    className="px-4 py-1.5 rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50 hover:opacity-90"
                  >
                    {saving ? l('Saving...', 'சேமிக்கிறது...') : l('Save Offer', 'சலுகையை சேமி')}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Live WhatsApp Chat Bubble Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-[#25D366]" />
                  {l('Live WhatsApp Preview', 'நேரலை வாட்ஸ் அப் முன்னோட்டம்')}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {l('Sample with Priya Sundaram', 'மாதிரி')}
                </span>
              </div>

              {/* Realistic WhatsApp Chat Box */}
              <div className="bg-[#EFEAE2] rounded-2xl p-4 border border-gray-200 shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                {/* Date bubble */}
                <div className="text-center mb-3">
                  <span className="bg-white/80 backdrop-blur-xs text-[10px] font-bold text-gray-600 px-2.5 py-0.5 rounded-full shadow-2xs">
                    {l('TODAY', 'இன்று')}
                  </span>
                </div>

                {/* Message Bubble */}
                <div className="bg-[#E7FFDB] text-[#111111] p-3.5 rounded-2xl rounded-tr-none shadow-xs text-xs font-sans whitespace-pre-wrap leading-relaxed relative border border-emerald-100/60 max-w-full">
                  {livePreviewText}

                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-500">
                    <span>10:30 AM</span>
                    <span className="text-[#53bdeb] font-black">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Helpful Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 flex items-start gap-2">
              <Info size={14} className="shrink-0 text-amber-700 mt-0.5" />
              <span>
                {l(
                  'Birthday offers do not alter POS prices or billing calculations automatically. Staff can apply discounts or coupons at the register during checkout.',
                  'பிறந்தநாள் சலுகைகள் பில்லிங் விலையை தானாக மாற்றாது. கட்டணம் செலுத்தும் போது ஊழியர்கள் தள்ளுபடியைப் பயன்படுத்தலாம்.'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
