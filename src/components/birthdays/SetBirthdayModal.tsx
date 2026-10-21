import React, { useState } from 'react'
import {
  Calendar,
  X,
  Check,
  Trash2,
  AlertCircle,
  Cake,
} from 'lucide-react'
import type { CustomerBirthdayRecord } from '../../services/birthdayService'
import {
  saveCustomerBirthday,
  removeCustomerBirthday,
} from '../../services/birthdayService'
import { formatPhoneDisplay } from '../../lib/phone'
import { useTheme } from '../../store/themeStore'

interface SetBirthdayModalProps {
  customer: CustomerBirthdayRecord
  onClose: () => void
  onSaved: () => void
  l: (en: string, ta?: string) => string
}

export const SetBirthdayModal: React.FC<SetBirthdayModalProps> = ({
  customer,
  onClose,
  onSaved,
  l,
}) => {
  const { themeColor, textColor, lightBg } = useTheme()
  const [birthday, setBirthday] = useState(customer.birthday ? customer.birthday.slice(0, 10) : '')
  const [notes, setNotes] = useState(customer.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!birthday) {
      setError(l('Please choose a valid birth date', 'சரியான பிறந்த தேதியைத் தேர்ந்தெடுக்கவும்'))
      return
    }

    setSaving(true)
    const res = await saveCustomerBirthday(customer.phone, birthday, customer.name, notes)
    setSaving(false)

    if (res.success) {
      onSaved()
      onClose()
    } else {
      setError(res.error || 'Failed to save birthday')
    }
  }

  const handleRemove = async () => {
    if (window.confirm(l('Remove birthday for this customer?', 'இந்த வாடிக்கையாளரின் பிறந்தநாளை நீக்க வேண்டுமா?'))) {
      setSaving(true)
      const res = await removeCustomerBirthday(customer.phone)
      setSaving(false)
      if (res.success) {
        onSaved()
        onClose()
      } else {
        setError(res.error || 'Failed to remove birthday')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ backgroundColor: lightBg, color: themeColor }} className="w-8 h-8 rounded-xl flex items-center justify-center">
              <Cake size={17} />
            </div>
            <h3 className="text-base font-black text-[#222222]">
              {customer.birthday
                ? l('Edit Customer Birthday', 'வாடிக்கையாளர் பிறந்தநாள் திருத்துக')
                : l('Set Customer Birthday', 'வாடிக்கையாளர் பிறந்தநாள் சேர்க்க')}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer info preview */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/70 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-500">{l('Customer:', 'வாடிக்கையாளர்:')}</span>
              <span className="font-black text-[#222222]">{customer.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-500">{l('Phone:', 'தொலைபேசி:')}</span>
              <span className="font-mono font-bold text-gray-800">{formatPhoneDisplay(customer.phone)}</span>
            </div>
          </div>

          {/* Date Picker Input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5 flex items-center gap-1">
              <Calendar size={13} style={{ color: themeColor }} />
              <span>{l('Date of Birth', 'பிறந்த தேதி')} *</span>
            </label>
            <input
              type="date"
              required
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#222222] focus:outline-none cursor-pointer"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {l('Birthdays recur annually automatically on this month & date.', 'பிறந்தநாள் ஒவ்வொரு ஆண்டும் தானாக கணக்கிடப்படும்.')}
            </p>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">
              {l('Staff Notes (Optional)', 'குறிப்புகள் (விருப்பப்படி)')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIP client, prefers silk saree offers"
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#222222] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
            {customer.birthday ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>{l('Remove', 'நீக்கு')}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {l('Cancel', 'ரத்து')}
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ backgroundColor: themeColor, color: textColor }}
                className="px-4 py-1.5 rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 hover:opacity-90"
              >
                <Check size={13} />
                <span>{saving ? l('Saving...', 'சேமிக்கிறது...') : l('Save Birthday', 'சேமி')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
