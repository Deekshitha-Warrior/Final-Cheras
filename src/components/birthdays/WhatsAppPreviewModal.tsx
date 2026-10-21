import React, { useState } from 'react'
import {
  MessageCircle,
  X,
  Copy,
  ExternalLink,
  Check,
  Phone,
  Cake,
  Gift,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { CustomerBirthdayRecord, BirthdayOffer } from '../../services/birthdayService'
import {
  compileBirthdayMessage,
  generateWhatsAppBirthdayUrl,
} from '../../services/birthdayService'
import { formatPhoneDisplay, isValidPhone } from '../../lib/phone'
import { useTheme } from '../../store/themeStore'

interface WhatsAppPreviewModalProps {
  customer: CustomerBirthdayRecord
  offers: BirthdayOffer[]
  onClose: () => void
  l: (en: string, ta?: string) => string
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  customer,
  offers,
  onClose,
  l,
}) => {
  const { themeColor, textColor, lightBg, subtleBorder } = useTheme()
  const activeOffers = offers.filter((o) => o.isActive)
  const defaultOffer = activeOffers[0] || offers[0]

  const [selectedOfferId, setSelectedOfferId] = useState<string>(defaultOffer?.id || '')
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || defaultOffer

  // Derived compiled message: resets when offer changes unless manually edited
  const compiledDefault = selectedOffer
    ? compileBirthdayMessage(selectedOffer.messageTemplate, customer.name, selectedOffer)
    : ''
  const activeMessage = customMessage !== null ? customMessage : compiledDefault

  const validPhone = isValidPhone(customer.phone)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleOpenWhatsApp = () => {
    if (!validPhone) return
    const url = generateWhatsAppBirthdayUrl(customer.phone, activeMessage)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-white via-white to-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-xs">
              <MessageCircle size={20} className="fill-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#222222]">
                {l('WhatsApp Birthday Greeting', 'வாட்ஸ் அப் பிறந்தநாள் வாழ்த்து')}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {l('Preview and prepare personalized birthday message before opening WhatsApp', 'வாட்ஸ் அப் திறப்பதற்கு முன் செய்தியை சரிபார்க்கலாம்')}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Customer Profile Card */}
          <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div style={{ backgroundColor: themeColor, color: textColor }} className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs">
                <Cake size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#222222]">{customer.name}</h4>
                <div className="flex items-center gap-2 text-xs text-gray-600 font-mono mt-0.5">
                  <Phone size={11} className={validPhone ? 'text-gray-500' : 'text-red-400'} />
                  <span className="font-bold">{formatPhoneDisplay(customer.phone)}</span>
                  {!validPhone && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">
                      {l('Invalid Phone', 'தவறான எண்')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {customer.birthday && (
              <span
                style={{ backgroundColor: lightBg, color: themeColor, borderColor: subtleBorder }}
                className="text-xs font-bold border px-2.5 py-1 rounded-xl flex items-center gap-1"
              >
                <Sparkles size={12} style={{ color: themeColor }} />
                <span>{customer.birthday}</span>
              </span>
            )}
          </div>

          {/* Offer Selection Dropdown */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1 flex items-center gap-1">
              <Gift size={13} style={{ color: themeColor }} />
              <span>{l('Select Birthday Offer to Include', 'சேர்க்க வேண்டிய பிறந்தநாள் சலுகை')}</span>
            </label>
            <select
              value={selectedOfferId}
              onChange={(e) => {
                setSelectedOfferId(e.target.value)
                setCustomMessage(null)
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#222222] focus:outline-none cursor-pointer"
            >
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.title} - {offer.discountDescription} {offer.couponCode ? `(${offer.couponCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Editable Live Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                {l('Personalized Message (Editable)', 'தனிப்பயனாக்கப்பட்ட செய்தி')}
              </label>
              <button
                type="button"
                onClick={handleCopy}
                style={{ color: themeColor }}
                className="inline-flex items-center gap-1 text-xs font-bold hover:opacity-80 cursor-pointer"
              >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                <span>{copied ? l('Copied!', 'நகலெடுக்கப்பட்டது!') : l('Copy Text', 'நகல் எடு')}</span>
              </button>
            </div>

            <textarea
              rows={7}
              value={activeMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-xs font-sans text-[#222222] leading-relaxed focus:outline-none transition-all"
            />
          </div>

          {/* WhatsApp Chat Preview */}
          <div className="bg-[#EFEAE2] rounded-2xl p-4 border border-gray-200 shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <MessageCircle size={12} className="text-[#25D366]" />
              <span>{l('WhatsApp Preview', 'வாட்ஸ் அப் மாதிரி')}</span>
            </div>

            <div className="bg-[#E7FFDB] text-[#111111] p-3.5 rounded-2xl rounded-tr-none shadow-xs text-xs font-sans whitespace-pre-wrap leading-relaxed relative border border-emerald-100/60">
              {activeMessage}
              <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-500">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[#53bdeb] font-black">✓✓</span>
              </div>
            </div>
          </div>

          {/* Security & Explicit Action Disclaimer */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 text-[11px] text-gray-600 flex items-start gap-2">
            <ShieldCheck size={16} style={{ color: themeColor }} className="shrink-0 mt-0.5" />
            <span>
              {l(
                "Clicking 'Open in WhatsApp' launches a direct 1-on-1 chat on your device using the official WhatsApp URL pattern. Messages are never sent in bulk or automatically dispatched without your explicit action.",
                "வாட்ஸ் அப்பை திறக்க கிளிக் செய்யும் போது மட்டுமே உங்கள் சாதனத்தில் உரையாடல் தொடங்கும். தானாகவோ மொத்தமாகவோ செய்திகள் அனுப்பப்படாது."
              )}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {l('Cancel', 'ரத்து')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>{copied ? l('Copied', 'நகலெடுக்கப்பட்டது') : l('Copy Message', 'செய்தியை நகல் எடு')}</span>
            </button>

            <button
              type="button"
              disabled={!validPhone}
              onClick={handleOpenWhatsApp}
              className="px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1fae53] text-white text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle size={15} className="fill-white" />
              <span>{l('Open in WhatsApp', 'வாட்ஸ் அப்பில் திறக்க')}</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
