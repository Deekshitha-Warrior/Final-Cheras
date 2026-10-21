import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Cake,
  Gift,
} from 'lucide-react'
import type { CustomerBirthdayRecord } from '../../services/birthdayService'
import { getNextBirthday } from '../../services/birthdayService'
import { useTheme } from '../../store/themeStore'

interface BirthdayCalendarProps {
  currentMonthDate: Date
  onMonthChange: (newDate: Date) => void
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  activeQuickFilter: 'today' | 'week' | 'month' | 'all'
  onQuickFilterChange: (filter: 'today' | 'week' | 'month' | 'all') => void
  customers: CustomerBirthdayRecord[]
  l: (en: string, ta?: string) => string
}

export const BirthdayCalendar: React.FC<BirthdayCalendarProps> = ({
  currentMonthDate,
  onMonthChange,
  selectedDate,
  onDateSelect,
  activeQuickFilter,
  onQuickFilterChange,
  customers,
  l,
}) => {
  const { themeColor, textColor, lightBg, subtleBorder } = useTheme()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth() // 0-based

  // Calculate days in month
  const firstDayOfMonth = new Date(year, month, 1)
  const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Calculate days in previous month for padding
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Build a map of birthdays in this viewed month: day -> list of customers
  const birthdaysByDay = React.useMemo(() => {
    const map: Record<number, CustomerBirthdayRecord[]> = {}
    for (const c of customers) {
      if (!c.birthday) continue
      const parts = c.birthday.slice(0, 10).split('-')
      if (parts.length < 3) continue
      const bMonth = parseInt(parts[1], 10) - 1
      const bDay = parseInt(parts[2], 10)
      if (bMonth === month) {
        if (!map[bDay]) map[bDay] = []
        map[bDay].push(c)
      }
    }
    return map
  }, [customers, month])

  // Counts for quick filters
  const filterCounts = React.useMemo(() => {
    let todayCount = 0
    let weekCount = 0
    let monthCount = 0
    let allWithDob = 0

    for (const c of customers) {
      if (!c.birthday) continue
      allWithDob++
      const info = getNextBirthday(c.birthday, today)
      if (!info) continue
      if (info.isToday) todayCount++
      if (info.isThisWeek) weekCount++
      if (info.isThisMonth) monthCount++
    }

    return {
      today: todayCount,
      week: weekCount,
      month: monthCount,
      all: allWithDob,
    }
  }, [customers, today])

  const monthNames = [
    l('January', 'ஜனவரி'),
    l('February', 'பிப்ரவரி'),
    l('March', 'மார்ச்'),
    l('April', 'ஏப்ரல்'),
    l('May', 'மே'),
    l('June', 'ஜூன்'),
    l('July', 'ஜூலை'),
    l('August', 'ஆகஸ்ட்'),
    l('September', 'செப்டம்பர்'),
    l('October', 'அக்டோபர்'),
    l('November', 'நவம்பர்'),
    l('December', 'டிசம்பர்'),
  ]

  const weekDayNames = [
    l('Sun', 'ஞா'),
    l('Mon', 'தி'),
    l('Tue', 'செ'),
    l('Wed', 'பு'),
    l('Thu', 'வி'),
    l('Fri', 'வெ'),
    l('Sat', 'ச'),
  ]

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1)
    onMonthChange(prev)
  }

  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1)
    onMonthChange(next)
  }

  const handleTodayClick = () => {
    const now = new Date()
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1))
    onDateSelect(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    onQuickFilterChange('today')
  }

  // Generate calendar cells (previous month pad + current month + next month pad)
  const calendarCells: Array<{
    dayNumber: number
    isCurrentMonth: boolean
    date: Date
  }> = []

  // Prev month pad
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    calendarCells.push({
      dayNumber: day,
      isCurrentMonth: false,
      date: new Date(year, month - 1, day),
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({
      dayNumber: d,
      isCurrentMonth: true,
      date: new Date(year, month, d),
    })
  }

  // Next month pad to complete 35 or 42 grid cells
  const remainingCells = (7 - (calendarCells.length % 7)) % 7
  for (let d = 1; d <= remainingCells; d++) {
    calendarCells.push({
      dayNumber: d,
      isCurrentMonth: false,
      date: new Date(year, month + 1, d),
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-5 flex flex-col space-y-4">
      {/* Calendar Header with Month Navigation & Today Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div
            style={{ backgroundColor: lightBg, color: themeColor }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          >
            <CalendarIcon size={17} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-[#222222] tracking-tight">
            {monthNames[month]} {year}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleTodayClick}
            style={{ backgroundColor: lightBg, color: themeColor, borderColor: subtleBorder }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:opacity-90"
            title="Jump to today"
          >
            <Sparkles size={12} style={{ color: themeColor }} />
            <span>{l('Today', 'இன்று')}</span>
          </button>

          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200/80">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-gray-700 hover:bg-white transition-colors cursor-pointer"
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md text-gray-700 hover:bg-white transition-colors cursor-pointer"
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {[
          { key: 'today' as const, label: l('Today', 'இன்று'), count: filterCounts.today, icon: Cake },
          { key: 'week' as const, label: l('This Week', 'இந்த வாரம்'), count: filterCounts.week, icon: Gift },
          { key: 'month' as const, label: l('This Month', 'இந்த மாதம்'), count: filterCounts.month, icon: CalendarIcon },
          { key: 'all' as const, label: l('All', 'அனைத்தும்'), count: filterCounts.all, icon: Sparkles },
        ].map(({ key, label, count, icon: Icon }) => {
          const isActive = activeQuickFilter === key && selectedDate === null
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onDateSelect(null)
                onQuickFilterChange(key)
              }}
              style={isActive ? { backgroundColor: themeColor, color: textColor, borderColor: themeColor } : undefined}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? 'shadow-sm'
                  : 'bg-gray-50/80 hover:bg-gray-100 text-[#222222] border-gray-200/70'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Icon size={13} style={isActive ? { color: textColor } : undefined} className={isActive ? '' : 'text-gray-500'} />
                <span className="truncate">{label}</span>
              </div>
              <span
                style={
                  isActive
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: textColor }
                    : count > 0
                    ? { backgroundColor: lightBg, color: themeColor }
                    : undefined
                }
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
                  isActive || count > 0 ? '' : 'bg-gray-200/60 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] text-gray-500 uppercase tracking-wider py-1 border-b border-gray-100">
        {weekDayNames.map((name, idx) => (
          <div key={idx} style={idx === 0 || idx === 6 ? { color: themeColor } : undefined}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {calendarCells.map((cell, idx) => {
          const isToday =
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getDate() === today.getDate()

          const isSelected =
            selectedDate !== null &&
            cell.date.getFullYear() === selectedDate.getFullYear() &&
            cell.date.getMonth() === selectedDate.getMonth() &&
            cell.date.getDate() === selectedDate.getDate()

          const dayBirthdays = cell.isCurrentMonth ? birthdaysByDay[cell.dayNumber] || [] : []
          const hasBirthdays = dayBirthdays.length > 0

          return (
            <button
              key={idx}
              type="button"
              disabled={!cell.isCurrentMonth}
              onClick={() => {
                if (cell.isCurrentMonth) {
                  onDateSelect(cell.date)
                }
              }}
              style={
                isSelected
                  ? { backgroundColor: themeColor, color: textColor, borderColor: themeColor }
                  : isToday
                  ? { backgroundColor: lightBg, borderColor: themeColor }
                  : hasBirthdays
                  ? { borderColor: subtleBorder }
                  : undefined
              }
              className={`relative min-h-[46px] sm:min-h-[52px] p-1 rounded-xl flex flex-col items-center justify-start transition-all cursor-pointer border ${
                !cell.isCurrentMonth
                  ? 'opacity-25 bg-gray-50 border-transparent cursor-not-allowed'
                  : isSelected
                  ? 'shadow-md scale-[1.03] z-10'
                  : isToday
                  ? 'font-black shadow-xs'
                  : hasBirthdays
                  ? 'bg-gray-50/70 hover:bg-gray-100 text-[#222222]'
                  : 'bg-white hover:bg-gray-50 text-[#222222] border-gray-200/60'
              }`}
            >
              <div className="flex items-center justify-between w-full px-1">
                <span
                  style={isSelected ? { color: textColor } : isToday ? { color: themeColor } : undefined}
                  className={`text-xs sm:text-[13px] font-black ${
                    isSelected ? '' : isToday ? '' : 'text-[#222222]'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {isToday && (
                  <span
                    style={{ backgroundColor: isSelected ? textColor : themeColor }}
                    className="w-1.5 h-1.5 rounded-full"
                    title="Today"
                  />
                )}
              </div>

              {/* Birthday Indicators inside Day cell */}
              {hasBirthdays && (
                <div className="mt-1 flex items-center justify-center w-full px-0.5">
                  <span
                    style={
                      isSelected
                        ? { backgroundColor: 'rgba(255,255,255,0.25)', color: textColor }
                        : { backgroundColor: themeColor, color: textColor }
                    }
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-tight"
                    title={`${dayBirthdays.length} birthday(s) on this date`}
                  >
                    <Cake size={10} />
                    <span>{dayBirthdays.length}</span>
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Date Summary & Clear Action */}
      {selectedDate && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 font-bold" style={{ color: themeColor }}>
            <Cake size={14} style={{ color: themeColor }} />
            <span>
              {l('Selected Date:', 'தேர்ந்தெடுத்த தேதி:')}{' '}
              {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}{' '}
              {selectedDate.getFullYear()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDateSelect(null)}
            className="text-xs font-bold text-gray-500 hover:opacity-80 underline cursor-pointer"
          >
            {l('Clear Date', 'நீக்கு')}
          </button>
        </div>
      )}
    </div>
  )
}
