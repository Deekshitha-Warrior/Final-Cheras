/**
 * birthdayService.ts
 * Manages customer birthday tracking, birthday promotional offers,
 * WhatsApp birthday greeting compilation, and calendar date calculations.
 *
 * Designed for CHERAS CLOTHING POS & Inventory Management.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  BRAND_EN,
  BRAND_TA,
  BRAND_PHONE_DISPLAY,
  BRAND_ADDRESS,
  BRAND_INSTAGRAM_URL,
} from '../lib/brand'
import {
  normalizePhone,
  toWhatsAppUrl,
} from '../lib/phone'

export interface CustomerBirthdayRecord {
  id: string
  name: string
  phone: string
  birthday: string | null // YYYY-MM-DD or null if unset
  notes?: string
  source: 'profile' | 'order' | 'advance_order' | 'manual'
  profileId?: string | null
  orderCount?: number
  lastOrderDate?: string
  createdAt?: string
  updatedAt?: string
}

export interface BirthdayOffer {
  id: string
  title: string
  discountDescription: string
  couponCode?: string
  messageTemplate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface NextBirthdayInfo {
  nextBirthdayDate: Date
  daysUntil: number
  isToday: boolean
  isThisWeek: boolean
  isThisMonth: boolean
  formattedDate: string
  formattedShortDate: string
  statusLabel: string
  statusTone: 'today' | 'upcoming' | 'soon' | 'later'
  turningAge: number | null
}

const STORAGE_BIRTHDAYS_KEY = 'cheras_customer_birthdays_v1'
const STORAGE_OFFERS_KEY = 'cheras_birthday_offers_v1'

export const DEFAULT_BIRTHDAY_OFFERS: BirthdayOffer[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    title: 'Birthday Special 15% OFF',
    discountDescription: 'Flat 15% discount on all textiles & sarees',
    couponCode: 'BDAY15',
    messageTemplate: `Dear {name},

Wishing you a very Happy Birthday from all of us at {shop_name}! 🎂✨

As our special birthday treat, enjoy {offer} on your next visit to our store!

Coupon Code: {coupon_code}
📍 Visit us: {address}
📞 Call/WhatsApp: {phone}
✨ Instagram: {instagram}

Terms: Show this message at the billing counter to claim your birthday offer. Have a wonderful celebration! 🎉`,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    title: 'Flat ₹200 Birthday Treat',
    discountDescription: 'Flat ₹200 OFF on purchases above ₹1,000',
    couponCode: 'BDAY200',
    messageTemplate: `Happy Birthday, {name}! 💐🎉

Team {shop_name} wishes you a joyful and prosperous year ahead!

Celebrate your special day with our exclusive Birthday Gift: {offer}!

Coupon Code: {coupon_code}
📍 Store: {address}
📞 Phone: {phone}
✨ Follow: {instagram}

Visit us this week to redeem your gift. Happy Shopping! 🛍️`,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// Local storage fallback helpers
export const getLocalBirthdaysMap = (): Record<string, { birthday: string; notes?: string; updatedAt: string }> => {
  try {
    const raw = localStorage.getItem(STORAGE_BIRTHDAYS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveLocalBirthday = (phoneKey: string, birthday: string, notes = '') => {
  try {
    const map = getLocalBirthdaysMap()
    map[phoneKey] = {
      birthday,
      notes,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_BIRTHDAYS_KEY, JSON.stringify(map))
  } catch (err) {
    console.error('Failed to save local birthday', err)
  }
}

const removeLocalBirthday = (phoneKey: string) => {
  try {
    const map = getLocalBirthdaysMap()
    delete map[phoneKey]
    localStorage.setItem(STORAGE_BIRTHDAYS_KEY, JSON.stringify(map))
  } catch (err) {
    console.error('Failed to remove local birthday', err)
  }
}

export const getLocalOffers = (): BirthdayOffer[] => {
  try {
    const raw = localStorage.getItem(STORAGE_OFFERS_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_OFFERS_KEY, JSON.stringify(DEFAULT_BIRTHDAY_OFFERS))
      return DEFAULT_BIRTHDAY_OFFERS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BIRTHDAY_OFFERS
  } catch {
    return DEFAULT_BIRTHDAY_OFFERS
  }
}

export const saveLocalOffers = (offers: BirthdayOffer[]) => {
  try {
    localStorage.setItem(STORAGE_OFFERS_KEY, JSON.stringify(offers))
  } catch (err) {
    console.error('Failed to save local offers', err)
  }
}

/**
 * Robust Annual Recurring Birthday Calculator
 *
 * Accounts for:
 * - Recurring annually on month and day
 * - Leap year: Feb 29 celebrated on Feb 28 in non-leap years
 * - Correct sorting and countdown across year wrap-arounds (e.g. December today -> January birthday)
 */
export function getNextBirthday(dobString: string | null | undefined, referenceDate: Date = new Date()): NextBirthdayInfo | null {
  if (!dobString) return null

  // Clean YYYY-MM-DD or ISO string
  const cleanStr = dobString.slice(0, 10)
  const parts = cleanStr.split('-')
  if (parts.length < 3) return null

  const birthYear = parseInt(parts[0], 10)
  const birthMonthIndex = parseInt(parts[1], 10) - 1 // 0-based
  const birthDay = parseInt(parts[2], 10)

  if (isNaN(birthMonthIndex) || isNaN(birthDay) || birthMonthIndex < 0 || birthMonthIndex > 11 || birthDay < 1 || birthDay > 31) {
    return null
  }

  // Normalise reference today to start of day
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)
  const currentYear = ref.getFullYear()

  // Helper to construct a safe date handling Feb 29
  const makeCandidateDate = (year: number): Date => {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    if (birthMonthIndex === 1 && birthDay === 29 && !isLeap) {
      return new Date(year, 1, 28, 0, 0, 0, 0) // Feb 28 in non-leap years
    }
    return new Date(year, birthMonthIndex, birthDay, 0, 0, 0, 0)
  }

  // Candidate for this year
  let candidate = makeCandidateDate(currentYear)

  // If candidate is already before today, next occurrence is next year!
  if (candidate.getTime() < ref.getTime()) {
    candidate = makeCandidateDate(currentYear + 1)
  }

  const msDiff = candidate.getTime() - ref.getTime()
  const daysUntil = Math.round(msDiff / (1000 * 60 * 60 * 24))

  const isToday = daysUntil === 0
  const isThisWeek = daysUntil >= 0 && daysUntil <= 7
  const isThisMonth = candidate.getMonth() === ref.getMonth() && candidate.getFullYear() === ref.getFullYear()

  // Calculate age turning
  let turningAge: number | null = null
  if (!isNaN(birthYear) && birthYear > 1900 && birthYear < candidate.getFullYear()) {
    turningAge = candidate.getFullYear() - birthYear
  }

  // Formatted date string
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const formattedShortDate = `${birthDay} ${monthNames[birthMonthIndex]}`
  const formattedDate = !isNaN(birthYear) && birthYear > 1900
    ? `${birthDay} ${monthNames[birthMonthIndex]} ${birthYear}`
    : formattedShortDate

  let statusLabel = ''
  let statusTone: 'today' | 'upcoming' | 'soon' | 'later' = 'later'

  if (isToday) {
    statusLabel = 'Today! 🎂'
    statusTone = 'today'
  } else if (daysUntil === 1) {
    statusLabel = 'Tomorrow'
    statusTone = 'soon'
  } else if (daysUntil <= 7) {
    statusLabel = `In ${daysUntil} days`
    statusTone = 'soon'
  } else if (daysUntil <= 30) {
    statusLabel = `In ${daysUntil} days`
    statusTone = 'upcoming'
  } else {
    statusLabel = formattedShortDate
    statusTone = 'later'
  }

  return {
    nextBirthdayDate: candidate,
    daysUntil,
    isToday,
    isThisWeek,
    isThisMonth,
    formattedDate,
    formattedShortDate,
    statusLabel,
    statusTone,
    turningAge,
  }
}

/**
 * Fetch all customers as the source of truth, joining:
 * 1. profiles table (registered customers)
 * 2. orders table (POS and online store walk-ins)
 * 3. advance_orders table (custom advance orders)
 * 4. customer_birthdays table / profiles.birthday (persisted birthdays)
 */
export async function fetchAllBirthdayCustomers(): Promise<{
  customers: CustomerBirthdayRecord[]
  error: string | null
}> {
  try {
    const customerMap = new Map<string, CustomerBirthdayRecord>()
    const localMap = getLocalBirthdaysMap()

    // 1. Fetch from profiles
    if (isSupabaseConfigured) {
      try {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, name, mobile, email, birthday, created_at')
        if (!pErr && Array.isArray(profiles)) {
          for (const p of profiles) {
            const rawPhone = p.mobile || ''
            const phoneKey = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '')
            if (!phoneKey) continue

            const pBirthday = (p as { birthday?: string }).birthday || localMap[phoneKey]?.birthday || null

            customerMap.set(phoneKey, {
              id: p.id,
              profileId: p.id,
              name: p.name || 'Valued Customer',
              phone: rawPhone,
              birthday: pBirthday,
              notes: localMap[phoneKey]?.notes || '',
              source: 'profile',
              createdAt: p.created_at,
              orderCount: 0,
            })
          }
        }
      } catch (err) {
        console.warn('Profiles fetch for birthdays caught:', err)
      }
    }

    // 2. Fetch from orders (POS orders)
    if (isSupabaseConfigured) {
      try {
        const { data: orders, error: oErr } = await supabase
          .from('orders')
          .select('id, customer_name, phone, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(1000)

        if (!oErr && Array.isArray(orders)) {
          for (const o of orders) {
            const rawPhone = o.phone || ''
            const phoneKey = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '')
            if (!phoneKey || phoneKey.length < 5) continue

            const existing = customerMap.get(phoneKey)
            if (existing) {
              existing.orderCount = (existing.orderCount || 0) + 1
              if (!existing.lastOrderDate) existing.lastOrderDate = o.created_at
              if (existing.name === 'Valued Customer' && o.customer_name && o.customer_name.trim() !== 'Customer') {
                existing.name = o.customer_name.trim()
              }
            } else {
              customerMap.set(phoneKey, {
                id: `order-cust-${phoneKey}`,
                name: (o.customer_name && o.customer_name.trim() !== 'Customer') ? o.customer_name.trim() : 'Valued Customer',
                phone: rawPhone,
                birthday: localMap[phoneKey]?.birthday || null,
                notes: localMap[phoneKey]?.notes || '',
                source: 'order',
                profileId: o.user_id || null,
                createdAt: o.created_at,
                lastOrderDate: o.created_at,
                orderCount: 1,
              })
            }
          }
        }
      } catch (err) {
        console.warn('Orders fetch for birthdays caught:', err)
      }
    }

    // 3. Fetch from advance_orders
    if (isSupabaseConfigured) {
      try {
        const { data: advOrders, error: aErr } = await supabase
          .from('advance_orders')
          .select('id, customer_name, phone, created_at')
          .order('created_at', { ascending: false })
          .limit(500)

        if (!aErr && Array.isArray(advOrders)) {
          for (const a of advOrders) {
            const rawPhone = a.phone || ''
            const phoneKey = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '')
            if (!phoneKey || phoneKey.length < 5) continue

            const existing = customerMap.get(phoneKey)
            if (existing) {
              existing.orderCount = (existing.orderCount || 0) + 1
              if (!existing.lastOrderDate) existing.lastOrderDate = a.created_at
              if ((existing.name === 'Valued Customer' || existing.name === 'Customer') && a.customer_name) {
                existing.name = a.customer_name.trim()
              }
            } else {
              customerMap.set(phoneKey, {
                id: `adv-cust-${phoneKey}`,
                name: a.customer_name?.trim() || 'Valued Customer',
                phone: rawPhone,
                birthday: localMap[phoneKey]?.birthday || null,
                notes: localMap[phoneKey]?.notes || '',
                source: 'advance_order',
                createdAt: a.created_at,
                lastOrderDate: a.created_at,
                orderCount: 1,
              })
            }
          }
        }
      } catch (err) {
        console.warn('Advance orders fetch for birthdays caught:', err)
      }
    }

    // 4. Check dedicated customer_birthdays table if it exists
    if (isSupabaseConfigured) {
      try {
        const { data: bdays, error: bErr } = await supabase
          .from('customer_birthdays')
          .select('id, customer_name, phone, birthday, notes, profile_id')
        if (!bErr && Array.isArray(bdays)) {
          for (const b of bdays) {
            const rawPhone = b.phone || ''
            const phoneKey = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '')
            if (!phoneKey) continue

            const existing = customerMap.get(phoneKey)
            if (existing) {
              existing.birthday = b.birthday
              if (b.notes) existing.notes = b.notes
              if (b.customer_name && existing.name === 'Valued Customer') existing.name = b.customer_name
            } else {
              customerMap.set(phoneKey, {
                id: b.id,
                name: b.customer_name || 'Valued Customer',
                phone: rawPhone,
                birthday: b.birthday,
                notes: b.notes || '',
                source: 'manual',
                profileId: b.profile_id || null,
                orderCount: 0,
              })
            }
          }
        }
      } catch {
        // Table might not be migrated yet; fallback is already loaded
      }
    }

    // If completely offline or empty, ensure any local-only birthdays appear
    for (const [phoneKey, val] of Object.entries(localMap)) {
      if (!customerMap.has(phoneKey) && val.birthday) {
        customerMap.set(phoneKey, {
          id: `local-cust-${phoneKey}`,
          name: 'Valued Customer',
          phone: phoneKey,
          birthday: val.birthday,
          notes: val.notes || '',
          source: 'manual',
          orderCount: 0,
        })
      }
    }

    const customerList = Array.from(customerMap.values())

    return { customers: customerList, error: null }
  } catch (err) {
    console.error('fetchAllBirthdayCustomers failed:', err)
    return {
      customers: [],
      error: err instanceof Error ? err.message : 'Failed to load customers',
    }
  }
}

/**
 * Save or update customer birthday
 */
export async function saveCustomerBirthday(
  phone: string,
  birthday: string, // YYYY-MM-DD
  customerName?: string,
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const rawDigits = phone.replace(/\D/g, '')
    const phoneKey = normalizePhone(phone) || rawDigits
    if (!phoneKey) {
      return { success: false, error: 'Valid phone number is required' }
    }

    // Always update local storage first for instant resilience
    saveLocalBirthday(phoneKey, birthday, notes || '')

    // Also persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        // 1. Try upserting into customer_birthdays table
        const { error: upsertErr } = await supabase
          .from('customer_birthdays')
          .upsert(
            {
              phone: phoneKey,
              customer_name: customerName || 'Valued Customer',
              birthday,
              notes: notes || '',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'phone' }
          )

        if (upsertErr) {
          // If customer_birthdays table not created, try updating profiles directly
          const { error: pErr } = await supabase
            .from('profiles')
            .update({ birthday })
            .ilike('mobile', `%${rawDigits.slice(-10)}%`)

          if (pErr) {
            console.warn('Could not update remote birthday; saved locally.', pErr)
          }
        }
      } catch (err) {
        console.warn('Remote birthday save failed, fallback stored locally:', err)
      }
    }

    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save birthday',
    }
  }
}

/**
 * Remove customer birthday
 */
export async function removeCustomerBirthday(phone: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const rawDigits = phone.replace(/\D/g, '')
    const phoneKey = normalizePhone(phone) || rawDigits
    if (phoneKey) {
      removeLocalBirthday(phoneKey)

      if (isSupabaseConfigured) {
        try {
          await supabase.from('customer_birthdays').delete().eq('phone', phoneKey)
          await supabase.from('profiles').update({ birthday: null }).ilike('mobile', `%${rawDigits.slice(-10)}%`)
        } catch {
          // Ignore remote cleanup if table doesn't exist
        }
      }
    }
    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove birthday',
    }
  }
}

/**
 * Universal lookup for customer details (name, birthday, address) by phone number.
 * Used by front billing panel (POS), Advance Orders, etc.
 */
export async function lookupCustomerByPhone(rawPhone: string): Promise<{
  name?: string
  birthday?: string | null
  address?: string
} | null> {
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length < 5) return null
  const phoneKey = normalizePhone(rawPhone) || digits
  const last10 = digits.slice(-10)

  const localMap = getLocalBirthdaysMap()
  let resultBirthday: string | null = localMap[phoneKey]?.birthday || null
  let resultName = ''
  let resultAddress = ''

  if (isSupabaseConfigured) {
    try {
      // 1. Check customer_birthdays
      const { data: bdayRow } = await supabase
        .from('customer_birthdays')
        .select('customer_name, birthday')
        .eq('phone', phoneKey)
        .maybeSingle()

      if (bdayRow) {
        if (bdayRow.birthday) resultBirthday = bdayRow.birthday
        if (bdayRow.customer_name && bdayRow.customer_name !== 'Valued Customer') {
          resultName = bdayRow.customer_name
        }
      }

      // 2. Check profiles if name or birthday still missing
      if (!resultBirthday || !resultName) {
        const { data: profRow } = await supabase
          .from('profiles')
          .select('name, birthday')
          .ilike('mobile', `%${last10}%`)
          .maybeSingle()

        if (profRow) {
          if (profRow.birthday && !resultBirthday) resultBirthday = profRow.birthday
          if (profRow.name && !resultName) resultName = profRow.name
        }
      }

      // 3. Check recent order for address and name
      const { data: orderRow } = await supabase
        .from('orders')
        .select('customer_name, address')
        .ilike('phone', `%${last10}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (orderRow) {
        if (orderRow.customer_name && !resultName && orderRow.customer_name !== 'Customer') {
          resultName = orderRow.customer_name
        }
        if (orderRow.address && orderRow.address !== 'POS Counter') {
          resultAddress = orderRow.address
        }
      }
    } catch (err) {
      console.warn('lookupCustomerByPhone remote query caught:', err)
    }
  }

  if (!resultName && !resultBirthday && !resultAddress) return null
  return {
    name: resultName || undefined,
    birthday: resultBirthday,
    address: resultAddress || undefined,
  }
}

/**
 * Fetch all Birthday Promotional Offers
 */
export async function fetchBirthdayOffers(): Promise<{
  offers: BirthdayOffer[]
  error: string | null
}> {
  try {
    const local = getLocalOffers()

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('birthday_offers')
          .select('id, title, discount_description, coupon_code, message_template, is_active, created_at, updated_at')
          .order('created_at', { ascending: true })

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: BirthdayOffer[] = data.map((d) => ({
            id: d.id,
            title: d.title,
            discountDescription: d.discount_description,
            couponCode: d.coupon_code || '',
            messageTemplate: d.message_template,
            isActive: Boolean(d.is_active),
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }))
          saveLocalOffers(mapped)
          return { offers: mapped, error: null }
        }
      } catch {
        // Fallback to local
      }
    }

    return { offers: local, error: null }
  } catch (err) {
    return {
      offers: getLocalOffers(),
      error: err instanceof Error ? err.message : 'Error loading offers',
    }
  }
}

/**
 * Save / Update a Birthday Offer
 */
export async function saveBirthdayOffer(
  offer: Omit<BirthdayOffer, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }
): Promise<{ offer: BirthdayOffer | null; error: string | null }> {
  try {
    const id = offer.id || `offer-${Date.now()}`
    const now = new Date().toISOString()
    const fullOffer: BirthdayOffer = {
      id,
      title: offer.title.trim(),
      discountDescription: offer.discountDescription.trim(),
      couponCode: offer.couponCode?.trim() || '',
      messageTemplate: offer.messageTemplate.trim(),
      isActive: offer.isActive !== undefined ? offer.isActive : true,
      createdAt: now,
      updatedAt: now,
    }

    // Save locally
    const existing = getLocalOffers()
    const idx = existing.findIndex((o) => o.id === id)
    if (idx >= 0) {
      fullOffer.createdAt = existing[idx].createdAt
      existing[idx] = fullOffer
    } else {
      existing.push(fullOffer)
    }
    saveLocalOffers(existing)

    // Sync to Supabase if available
    if (isSupabaseConfigured) {
      try {
        await supabase.from('birthday_offers').upsert({
          id: fullOffer.id,
          title: fullOffer.title,
          discount_description: fullOffer.discountDescription,
          coupon_code: fullOffer.couponCode,
          message_template: fullOffer.messageTemplate,
          is_active: fullOffer.isActive,
          updated_at: now,
        })
      } catch (err) {
        console.warn('Could not sync birthday offer to Supabase:', err)
      }
    }

    return { offer: fullOffer, error: null }
  } catch (err) {
    return {
      offer: null,
      error: err instanceof Error ? err.message : 'Failed to save offer',
    }
  }
}

/**
 * Delete a Birthday Offer
 */
export async function deleteBirthdayOffer(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const existing = getLocalOffers().filter((o) => o.id !== id)
    saveLocalOffers(existing)

    if (isSupabaseConfigured) {
      try {
        await supabase.from('birthday_offers').delete().eq('id', id)
      } catch (err) {
        console.warn('Could not delete offer from Supabase:', err)
      }
    }

    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete offer',
    }
  }
}

/**
 * Compile a personalised WhatsApp Birthday message with placeholder replacement
 */
export function compileBirthdayMessage(
  template: string,
  customerName: string,
  offer: BirthdayOffer,
  options?: {
    lang?: 'en' | 'ta'
  }
): string {
  const shopName = options?.lang === 'ta' ? BRAND_TA : BRAND_EN

  const msg = template
    .replace(/\{name\}/gi, customerName || 'Valued Customer')
    .replace(/\{offer\}/gi, offer.discountDescription || offer.title)
    .replace(/\{coupon_code\}/gi, offer.couponCode || 'N/A')
    .replace(/\{coupon\}/gi, offer.couponCode || 'N/A')
    .replace(/\{shop_name\}/gi, shopName)
    .replace(/\{phone\}/gi, BRAND_PHONE_DISPLAY)
    .replace(/\{address\}/gi, BRAND_ADDRESS)
    .replace(/\{instagram\}/gi, BRAND_INSTAGRAM_URL)

  return msg.trim()
}

/**
 * Generate standard WhatsApp dispatch link using supported toWhatsAppUrl
 */
export function generateWhatsAppBirthdayUrl(phone: string, message: string): string {
  return toWhatsAppUrl(phone, message)
}
