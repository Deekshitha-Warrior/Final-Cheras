import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Cake,
  Gift,
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  Tag,
  Users,
  Clock,
  AlertCircle,
  Download,
} from 'lucide-react'
import { BRAND_EN, BRAND_ICON } from '../../lib/brand'
import { useLangStore } from '../../store/langStore'
import { useTheme } from '../../store/themeStore'
import { downloadCsv } from '../../lib/exportCsv'
import { formatPhoneDisplay } from '../../lib/phone'
import { BirthdayCalendar } from './BirthdayCalendar'
import { CustomerBirthdayList } from './CustomerBirthdayList'
import { BirthdayOffersManager } from './BirthdayOffersManager'
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal'
import { SetBirthdayModal } from './SetBirthdayModal'
import {
  fetchAllBirthdayCustomers,
  fetchBirthdayOffers,
  getNextBirthday,
  type CustomerBirthdayRecord,
  type BirthdayOffer,
} from '../../services/birthdayService'

export const BirthdayManagementView: React.FC = () => {
  const { lang } = useLangStore()
  const { themeColor, textColor, lightBg, subtleBorder } = useTheme()
  const l = useCallback((en: string, ta?: string) => (lang === 'ta' && ta ? ta : en), [lang])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerBirthdayRecord[]>([])
  const [offers, setOffers] = useState<BirthdayOffer[]>([])

  // Calendar and list state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [activeQuickFilter, setActiveQuickFilter] = useState<'today' | 'week' | 'month' | 'all'>('month')

  // Modals state
  const [whatsAppModalCustomer, setWhatsAppModalCustomer] = useState<CustomerBirthdayRecord | null>(null)
  const [editBirthdayCustomer, setEditBirthdayCustomer] = useState<CustomerBirthdayRecord | null>(null)
  const [isOffersManagerOpen, setIsOffersManagerOpen] = useState(false)
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [custRes, offersRes] = await Promise.all([
        fetchAllBirthdayCustomers(),
        fetchBirthdayOffers(),
      ])

      if (custRes.error) {
        setError(custRes.error)
      } else {
        setCustomers(custRes.customers)
      }

      setOffers(offersRes.offers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load birthday data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Summary statistics
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const stats = useMemo(() => {
    let todayCount = 0
    let weekCount = 0
    let monthCount = 0
    let recordedCount = 0

    const currentMonth = currentMonthDate.getMonth()

    for (const c of customers) {
      if (!c.birthday) continue
      recordedCount++
      const info = getNextBirthday(c.birthday, today)
      if (!info) continue
      if (info.isToday) todayCount++
      if (info.isThisWeek) weekCount++

      const parts = c.birthday.slice(0, 10).split('-')
      const bMonth = parseInt(parts[1], 10) - 1
      if (bMonth === currentMonth) monthCount++
    }

    return {
      today: todayCount,
      week: weekCount,
      month: monthCount,
      totalRecorded: recordedCount,
      totalCustomers: customers.length,
    }
  }, [customers, currentMonthDate, today])

  const handleExportCSV = async () => {
    if (customers.length === 0) {
      alert(l('No customer records to export', 'ஏற்றுமதி செய்ய வாடிக்கையாளர் பதிவுகள் இல்லை'))
      return
    }

    const escapeCsv = (str: unknown) => {
      if (str === null || str === undefined) return '""'
      const s = String(str).replace(/"/g, '""')
      return `"${s}"`
    }

    const headers = [
      'Customer Name',
      'Phone',
      'Birthday',
      'Next Birthday',
      'Days Until Birthday',
      'Turning Age',
      'Total Orders',
      'Source',
      'Notes',
    ]

    const rows = customers.map((c) => {
      const bInfo = c.birthday ? getNextBirthday(c.birthday, today) : null
      return [
        escapeCsv(c.name || 'Unnamed'),
        escapeCsv(formatPhoneDisplay(c.phone)),
        escapeCsv(c.birthday || 'Not Set'),
        escapeCsv(bInfo ? bInfo.formattedDate : 'N/A'),
        escapeCsv(bInfo ? bInfo.daysUntil : 'N/A'),
        escapeCsv(bInfo && bInfo.turningAge !== null ? bInfo.turningAge : 'N/A'),
        escapeCsv(c.orderCount ?? 0),
        escapeCsv(c.source || 'profile'),
        escapeCsv(c.notes || ''),
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const dateStr = new Date().toISOString().slice(0, 10)
    await downloadCsv(`customer_birthdays_${dateStr}.csv`, csvContent)
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 shadow-sm p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-[#171717]/5 via-[#B8B8B8]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3.5 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5] flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }}
          >
            <img src={BRAND_ICON} alt={BRAND_EN} className="w-full h-full object-contain" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                {l('Customer Birthday Management', 'வாடிக்கையாளர் பிறந்தநாள் மேலாண்மை')}
              </h2>
              <span
                style={{ backgroundColor: lightBg, color: themeColor, borderColor: subtleBorder }}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
              >
                {BRAND_EN}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
              {l(
                'Track customer birthdays, manage special offers, and send 1-on-1 WhatsApp greetings',
                'வாடிக்கையாளர் பிறந்தநாள்களை கண்காணித்து சிறப்பு சலுகைகளுடன் வாட்ஸ் அப் வாழ்த்துக்களை அனுப்புங்கள்'
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          {/* Manage Offers */}
          <button
            type="button"
            onClick={() => setIsOffersManagerOpen(true)}
            style={{ borderColor: subtleBorder, color: themeColor }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border hover:bg-gray-50 text-xs font-black shadow-xs transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Gift size={14} style={{ color: themeColor }} />
            <span>{l('Birthday Offers', 'பிறந்தநாள் சலுகைகள்')}</span>
            <span
              style={{ backgroundColor: themeColor, color: textColor }}
              className="text-[10px] px-1.5 py-0.2 rounded-full font-black"
            >
              {offers.filter((o) => o.isActive).length}
            </span>
          </button>

          {/* Quick Add Birthday */}
          <button
            type="button"
            onClick={() => setIsQuickAddModalOpen(true)}
            style={{ backgroundColor: themeColor, color: textColor }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer hover:scale-[1.02] hover:opacity-95"
          >
            <Plus size={14} />
            <span>{l('Add Birthday', 'பிறந்தநாள் சேர்')}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={() => void handleExportCSV()}
            disabled={loading || customers.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-black shadow-xs transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-50"
            title={l('Export Birthday List as CSV', 'CSV கோப்பாக ஏற்றுமதி செய்')}
          >
            <Download size={14} style={{ color: themeColor }} />
            <span>{l('Export CSV', 'CSV ஏற்றுமதி')}</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
            title={l('Refresh data', 'புதுப்பி')}
          >
            <RefreshCw size={15} style={loading ? { color: themeColor } : undefined} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today */}
        <div
          onClick={() => {
            setSelectedDate(null)
            setActiveQuickFilter('today')
          }}
          style={activeQuickFilter === 'today' && selectedDate === null ? { backgroundColor: themeColor, borderColor: themeColor, color: textColor } : undefined}
          className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
            activeQuickFilter === 'today' && selectedDate === null
              ? 'shadow-md'
              : 'bg-white border-gray-200/90 text-[#222222]'
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              style={activeQuickFilter === 'today' && selectedDate === null ? { color: textColor, opacity: 0.9 } : undefined}
              className={`text-[11px] font-black uppercase tracking-wider ${
                activeQuickFilter === 'today' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l("Today's Birthdays", 'இன்றைய பிறந்தநாள்கள்')}
            </span>
            <div
              style={activeQuickFilter === 'today' && selectedDate === null ? { backgroundColor: 'rgba(255,255,255,0.2)', color: textColor } : undefined}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeQuickFilter === 'today' && selectedDate === null
                  ? ''
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
            >
              <Cake size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black">{stats.today}</div>
            <p
              style={activeQuickFilter === 'today' && selectedDate === null ? { color: textColor, opacity: 0.8 } : undefined}
              className={`text-[11px] font-medium mt-0.5 ${
                activeQuickFilter === 'today' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {stats.today > 0 ? l('Ready for WhatsApp greetings 🎉', 'வாழ்த்துகள் அனுப்ப தயார் 🎉') : l('No birthdays today', 'இன்று பிறந்தநாள் இல்லை')}
            </p>
          </div>
        </div>

        {/* Card 2: This Week */}
        <div
          onClick={() => {
            setSelectedDate(null)
            setActiveQuickFilter('week')
          }}
          style={activeQuickFilter === 'week' && selectedDate === null ? { backgroundColor: themeColor, borderColor: themeColor, color: textColor } : undefined}
          className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
            activeQuickFilter === 'week' && selectedDate === null
              ? 'shadow-md'
              : 'bg-white border-gray-200/90 text-[#222222]'
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              style={activeQuickFilter === 'week' && selectedDate === null ? { color: textColor, opacity: 0.9 } : undefined}
              className={`text-[11px] font-black uppercase tracking-wider ${
                activeQuickFilter === 'week' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('This Week (Next 7 Days)', 'இந்த வாரம் (7 நாட்கள்)')}
            </span>
            <div
              style={activeQuickFilter === 'week' && selectedDate === null ? { backgroundColor: 'rgba(255,255,255,0.2)', color: textColor } : undefined}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeQuickFilter === 'week' && selectedDate === null
                  ? ''
                  : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}
            >
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black">{stats.week}</div>
            <p
              style={activeQuickFilter === 'week' && selectedDate === null ? { color: textColor, opacity: 0.8 } : undefined}
              className={`text-[11px] font-medium mt-0.5 ${
                activeQuickFilter === 'week' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('Upcoming in 7 days', 'அடுத்த 7 நாட்களில்')}
            </p>
          </div>
        </div>

        {/* Card 3: This Month */}
        <div
          onClick={() => {
            setSelectedDate(null)
            setActiveQuickFilter('month')
          }}
          style={activeQuickFilter === 'month' && selectedDate === null ? { backgroundColor: themeColor, borderColor: themeColor, color: textColor } : undefined}
          className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
            activeQuickFilter === 'month' && selectedDate === null
              ? 'shadow-md'
              : 'bg-white border-gray-200/90 text-[#222222]'
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              style={activeQuickFilter === 'month' && selectedDate === null ? { color: textColor, opacity: 0.9 } : undefined}
              className={`text-[11px] font-black uppercase tracking-wider ${
                activeQuickFilter === 'month' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('This Month', 'இந்த மாதம்')}
            </span>
            <div
              style={activeQuickFilter === 'month' && selectedDate === null ? { backgroundColor: 'rgba(255,255,255,0.2)', color: textColor } : undefined}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeQuickFilter === 'month' && selectedDate === null
                  ? ''
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}
            >
              <Calendar size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black">{stats.month}</div>
            <p
              style={activeQuickFilter === 'month' && selectedDate === null ? { color: textColor, opacity: 0.8 } : undefined}
              className={`text-[11px] font-medium mt-0.5 ${
                activeQuickFilter === 'month' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('Total in viewed month', 'தேர்ந்தெடுத்த மாதத்தில்')}
            </p>
          </div>
        </div>

        {/* Card 4: Total With Birthdays */}
        <div
          onClick={() => {
            setSelectedDate(null)
            setActiveQuickFilter('all')
          }}
          style={activeQuickFilter === 'all' && selectedDate === null ? { backgroundColor: themeColor, borderColor: themeColor, color: textColor } : undefined}
          className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
            activeQuickFilter === 'all' && selectedDate === null
              ? 'shadow-md'
              : 'bg-white border-gray-200/90 text-[#222222]'
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              style={activeQuickFilter === 'all' && selectedDate === null ? { color: textColor, opacity: 0.9 } : undefined}
              className={`text-[11px] font-black uppercase tracking-wider ${
                activeQuickFilter === 'all' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('Total Customer Birthdays', 'மொத்த பிறந்தநாள்கள்')}
            </span>
            <div
              style={activeQuickFilter === 'all' && selectedDate === null ? { backgroundColor: 'rgba(255,255,255,0.2)', color: textColor } : undefined}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeQuickFilter === 'all' && selectedDate === null
                  ? ''
                  : 'bg-blue-50 text-blue-600 border border-blue-100'
              }`}
            >
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black">
              {stats.totalRecorded}{' '}
              <span
                style={activeQuickFilter === 'all' && selectedDate === null ? { color: textColor, opacity: 0.7 } : undefined}
                className={`text-xs font-normal ${activeQuickFilter === 'all' && selectedDate === null ? '' : 'text-gray-400'}`}
              >
                / {stats.totalCustomers}
              </span>
            </div>
            <p
              style={activeQuickFilter === 'all' && selectedDate === null ? { color: textColor, opacity: 0.8 } : undefined}
              className={`text-[11px] font-medium mt-0.5 ${
                activeQuickFilter === 'all' && selectedDate === null ? '' : 'text-gray-500'
              }`}
            >
              {l('Customers with birthday saved', 'பதிவு செய்யப்பட்டவர்கள்')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar on Left (5 cols) & Customer List on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Calendar */}
        <div className="lg:col-span-5 w-full">
          <BirthdayCalendar
            currentMonthDate={currentMonthDate}
            onMonthChange={setCurrentMonthDate}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            activeQuickFilter={activeQuickFilter}
            onQuickFilterChange={setActiveQuickFilter}
            customers={customers}
            l={l}
          />
        </div>

        {/* Right Column: Customer List */}
        <div className="lg:col-span-7 w-full min-h-[500px]">
          <CustomerBirthdayList
            customers={customers}
            selectedDate={selectedDate}
            activeQuickFilter={activeQuickFilter}
            currentMonth={currentMonthDate.getMonth()}
            onOpenWhatsApp={(c) => setWhatsAppModalCustomer(c)}
            onEditBirthday={(c) => setEditBirthdayCustomer(c)}
            l={l}
          />
        </div>
      </div>

      {/* WhatsApp Message Preview Modal */}
      {whatsAppModalCustomer && (
        <WhatsAppPreviewModal
          customer={whatsAppModalCustomer}
          offers={offers}
          onClose={() => setWhatsAppModalCustomer(null)}
          l={l}
        />
      )}

      {/* Set / Edit Customer Birthday Modal */}
      {editBirthdayCustomer && (
        <SetBirthdayModal
          customer={editBirthdayCustomer}
          onClose={() => setEditBirthdayCustomer(null)}
          onSaved={() => void loadData()}
          l={l}
        />
      )}

      {/* Quick Add Birthday Modal (For new / walk-in customer) */}
      {isQuickAddModalOpen && (
        <SetBirthdayModal
          customer={{
            id: 'new-cust',
            name: '',
            phone: '',
            birthday: null,
            source: 'manual',
          }}
          onClose={() => setIsQuickAddModalOpen(false)}
          onSaved={() => void loadData()}
          l={l}
        />
      )}

      {/* Offers Manager Modal */}
      {isOffersManagerOpen && (
        <BirthdayOffersManager
          offers={offers}
          onOffersUpdated={() => void loadData()}
          onClose={() => setIsOffersManagerOpen(false)}
          l={l}
        />
      )}
    </div>
  )
}
