import React, { useState, useMemo } from 'react'
import {
  Search,
  MessageCircle,
  Calendar,
  Cake,
  Edit2,
  Clock,
  Sparkles,
  PhoneCall,
  ShoppingBag,
} from 'lucide-react'
import type { CustomerBirthdayRecord } from '../../services/birthdayService'
import { getNextBirthday } from '../../services/birthdayService'
import { formatPhoneDisplay, isValidPhone } from '../../lib/phone'
import { useTheme } from '../../store/themeStore'

interface CustomerBirthdayListProps {
  customers: CustomerBirthdayRecord[]
  selectedDate: Date | null
  activeQuickFilter: 'today' | 'week' | 'month' | 'all'
  currentMonth: number // 0-based
  onOpenWhatsApp: (customer: CustomerBirthdayRecord) => void
  onEditBirthday: (customer: CustomerBirthdayRecord) => void
  l: (en: string, ta?: string) => string
}

export const CustomerBirthdayList: React.FC<CustomerBirthdayListProps> = ({
  customers,
  selectedDate,
  activeQuickFilter,
  currentMonth,
  onOpenWhatsApp,
  onEditBirthday,
  l,
}) => {
  const { themeColor, textColor, lightBg } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewTab, setViewTab] = useState<'birthdays' | 'unset'>('birthdays')

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Filter customers based on calendar selection or quick filters
  const filteredBirthdayCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Must have birthday for this view
        if (!c.birthday) return false

        // Search match
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          const nameMatch = (c.name || '').toLowerCase().includes(q)
          const phoneMatch = (c.phone || '').includes(q)
          if (!nameMatch && !phoneMatch) return false
        }

        const bInfo = getNextBirthday(c.birthday, today)
        if (!bInfo) return false

        // 1. If a specific calendar date is selected:
        if (selectedDate !== null) {
          const selMonth = selectedDate.getMonth()
          const selDay = selectedDate.getDate()
          const parts = c.birthday.slice(0, 10).split('-')
          const bMonth = parseInt(parts[1], 10) - 1
          const bDay = parseInt(parts[2], 10)
          return bMonth === selMonth && bDay === selDay
        }

        // 2. Quick filters
        if (activeQuickFilter === 'today') {
          return bInfo.isToday
        }
        if (activeQuickFilter === 'week') {
          return bInfo.isThisWeek
        }
        if (activeQuickFilter === 'month') {
          const parts = c.birthday.slice(0, 10).split('-')
          const bMonth = parseInt(parts[1], 10) - 1
          return bMonth === currentMonth
        }

        return true // 'all'
      })
      .sort((a, b) => {
        const infoA = getNextBirthday(a.birthday, today)
        const infoB = getNextBirthday(b.birthday, today)
        if (!infoA) return 1
        if (!infoB) return -1
        // Sort upcoming first (daysUntil ascending)
        return infoA.daysUntil - infoB.daysUntil
      })
  }, [customers, searchTerm, selectedDate, activeQuickFilter, currentMonth, today])

  // Customers without birthdays recorded
  const unsetCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (c.birthday) return false
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase()
      return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    })
  }, [customers, searchTerm])

  const displayedList = viewTab === 'birthdays' ? filteredBirthdayCustomers : unsetCustomers

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header with Search and View Switcher */}
      <div className="p-4 sm:p-5 border-b border-gray-100 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cake size={18} style={{ color: themeColor }} />
              <h3 className="text-base sm:text-lg font-black text-[#222222] tracking-tight">
                {viewTab === 'birthdays'
                  ? selectedDate
                    ? `${l('Birthdays on', 'பிறந்தநாள்கள்:')} ${selectedDate.getDate()} ${selectedDate.toLocaleString('default', { month: 'short' })}`
                    : activeQuickFilter === 'today'
                    ? l("Today's Birthday Celebrations", 'இன்றைய பிறந்தநாள் கொண்டாட்டங்கள்')
                    : activeQuickFilter === 'week'
                    ? l('This Week Birthdays', 'இந்த வார பிறந்தநாள்கள்')
                    : activeQuickFilter === 'month'
                    ? l('This Month Birthdays', 'இந்த மாத பிறந்தநாள்கள்')
                    : l('All Customer Birthdays', 'அனைத்து வாடிக்கையாளர் பிறந்தநாள்கள்')
                  : l('Customers with Missing Birthdays', 'பிறந்தநாள் இல்லாத வாடிக்கையாளர்கள்')}
              </h3>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {viewTab === 'birthdays'
                ? `${displayedList.length} ${l('matching customer(s) found', 'வாடிக்கையாளர்(கள்) உள்ளனர்')}`
                : `${unsetCustomers.length} ${l('customers need birthday details', 'வாடிக்கையாளர்களுக்கு பிறந்தநாள் சேர்க்கவும்')}`}
            </p>
          </div>

          {/* View Tab Buttons */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200/70 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setViewTab('birthdays')}
              style={viewTab === 'birthdays' ? { color: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewTab === 'birthdays'
                  ? 'bg-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {l('Birthdays', 'பிறந்தநாள்கள்')} ({filteredBirthdayCustomers.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab('unset')}
              style={viewTab === 'unset' ? { color: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewTab === 'unset'
                  ? 'bg-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {l('Unset', 'சேர்க்கப்படாதவை')} ({unsetCustomers.length})
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={l('Search by customer name or phone number...', 'வாடிக்கையாளர் பெயர் அல்லது தொலைபேசி மூலம் தேடுக...')}
            className="w-full pl-9 pr-4 py-2 bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-[#222222] font-medium placeholder-gray-400 focus:outline-none focus:border-[#171717] focus:ring-2 focus:ring-[#171717]/10 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Customer List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 sm:p-4 space-y-2.5">
        {displayedList.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Cake size={38} className="mx-auto text-gray-300 mb-2.5" />
            <p className="text-sm font-bold text-gray-700">
              {viewTab === 'birthdays'
                ? l('No birthday customers found for this selection', 'இந்த தேர்வுக்கு வாடிக்கையாளர் பிறந்தநாள் இல்லை')
                : l('All customer birthdays are up to date!', 'அனைத்து வாடிக்கையாளர்களுக்கும் பிறந்தநாள் சேர்க்கப்பட்டுள்ளது!')}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {viewTab === 'birthdays'
                ? l('Try selecting another date, switching filters, or adding a birthday.', 'வேறு தேதியைத் தேர்ந்தெடுக்கவும் அல்லது புதிய பிறந்தநாளை சேர்க்கவும்.')
                : l('Great job keeping your customer records complete.', 'வாடிக்கையாளர் பதிவுகள் முழுமையாக உள்ளன.')}
            </p>
          </div>
        ) : (
          displayedList.map((customer) => {
            const hasPhone = Boolean(customer.phone)
            const validPhone = isValidPhone(customer.phone)
            const bInfo = customer.birthday ? getNextBirthday(customer.birthday, today) : null

            return (
              <div
                key={customer.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                  bInfo?.isToday
                    ? 'bg-[#FFF9EA] border-[#B8B8B8]/50 ring-1 ring-[#B8B8B8]/30'
                    : 'bg-white border-gray-200/70 hover:border-gray-300'
                }`}
              >
                {/* Left: Customer Identity & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    style={
                      bInfo?.isToday
                        ? { backgroundColor: themeColor, color: textColor }
                        : bInfo?.isThisWeek
                        ? { backgroundColor: lightBg, color: themeColor }
                        : undefined
                    }
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm shadow-xs ${
                      bInfo?.isToday || bInfo?.isThisWeek ? '' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {bInfo?.isToday ? (
                      <Cake size={20} className="animate-bounce" />
                    ) : (
                      <span>{(customer.name || 'C')[0].toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-[#222222] truncate">
                        {customer.name || l('Valued Customer', 'வாடிக்கையாளர்')}
                      </h4>

                      {/* Status Badges */}
                      {bInfo?.isToday && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs animate-pulse">
                          <Sparkles size={11} />
                          {l('Birthday Today! 🎉', 'இன்று பிறந்தநாள்! 🎉')}
                        </span>
                      )}

                      {!bInfo?.isToday && bInfo?.statusLabel && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            bInfo.isThisWeek
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          <Clock size={10} />
                          {bInfo.statusLabel}
                        </span>
                      )}

                      {bInfo?.turningAge && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {l('Turning', 'வயது')} {bInfo.turningAge}
                        </span>
                      )}
                    </div>

                    {/* Metadata line: Phone & Birthday */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <PhoneCall size={12} className={validPhone ? 'text-gray-500' : 'text-red-400'} />
                        <span className={`font-mono ${validPhone ? 'font-bold text-gray-700' : 'text-red-500'}`}>
                          {hasPhone ? formatPhoneDisplay(customer.phone) : l('No phone number', 'எண் இல்லை')}
                        </span>
                        {!validPhone && hasPhone && (
                          <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1 rounded">
                            {l('Invalid', 'தவறானது')}
                          </span>
                        )}
                      </div>

                      {customer.birthday ? (
                        <div className="flex items-center gap-1 font-bold" style={{ color: themeColor }}>
                          <Calendar size={12} style={{ color: themeColor }} />
                          <span>{bInfo?.formattedDate || customer.birthday}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">
                          {l('Birthday not set', 'பிறந்தநாள் சேர்க்கப்படவில்லை')}
                        </span>
                      )}

                      {typeof customer.orderCount === 'number' && customer.orderCount > 0 && (
                        <div className="flex items-center gap-1 text-gray-500 text-[11px]">
                          <ShoppingBag size={11} />
                          <span>{customer.orderCount} {l('order(s)', 'ஆர்டர்கள்')}</span>
                        </div>
                      )}
                    </div>

                    {/* Optional notes */}
                    {customer.notes && (
                      <p className="text-[11px] text-gray-500 italic truncate max-w-md">
                        {customer.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Edit / Set Birthday button */}
                  <button
                    type="button"
                    onClick={() => onEditBirthday(customer)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer border border-gray-200/80"
                    title={customer.birthday ? l('Edit Birthday', 'மாற்றுக') : l('Set Birthday', 'சேர்க்க')}
                  >
                    <Edit2 size={12} />
                    <span>{customer.birthday ? l('Edit', 'மாற்று') : l('Set Birthday', 'சேர்')}</span>
                  </button>

                  {/* WhatsApp Greeting action */}
                  <button
                    type="button"
                    disabled={!validPhone}
                    onClick={() => onOpenWhatsApp(customer)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                      validPhone
                        ? 'bg-[#25D366] hover:bg-[#20ba59] text-white hover:scale-[1.02]'
                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      validPhone
                        ? l('Send WhatsApp Birthday Greeting', 'வாட்ஸ் அப் வாழ்த்து அனுப்புக')
                        : l('Valid phone number required for WhatsApp', 'சரியான தொலைபேசி எண் தேவை')
                    }
                  >
                    <MessageCircle size={14} className={validPhone ? 'fill-white' : ''} />
                    <span>{l('WhatsApp', 'வாட்ஸ் அப்')}</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
