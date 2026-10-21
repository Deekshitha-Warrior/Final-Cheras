import { create } from 'zustand'
import { alarmSound } from '../lib/alarmAudio'
import { useNavigationStore } from './navigationStore'

export interface LowStockItem {
  id: string | number
  name: string
  variantName?: string
  stock: number
  alertThreshold: number
  barcode?: string
  category?: string
}

interface AlarmState {
  lowStockItems: LowStockItem[]
  isAlarmActive: boolean
  hasCompletedStartupAlert: boolean
  silencedItemIds: Set<string | number>
  setLowStockItems: (items: LowStockItem[]) => void
  silenceAlarm: () => void
  dismissStartupAlert: () => void
  triggerInventoryAlert: () => void
  resetSilencedState: () => void
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  lowStockItems: [],
  isAlarmActive: false,
  hasCompletedStartupAlert: false,
  silencedItemIds: new Set<string | number>(),

  setLowStockItems: (items) => {
    // Forget silenced ids that are no longer low, so an item that recovers and drops again alarms as new
    const currentIds = new Set(items.map((item) => String(item.id)))
    const silencedItemIds = new Set(Array.from(get().silencedItemIds).filter((id) => currentIds.has(String(id))))
    set({ silencedItemIds })

    // Check if the current context allows the alert:
    // Expected: ONLY at start of website (!hasCompletedStartupAlert) or when opening inventory
    const currentTab = useNavigationStore.getState().currentTab
    const isInventory = currentTab === 'inventory' || currentTab === 'products'
    const allowAlert = !get().hasCompletedStartupAlert || isInventory

    // Alarm triggers only if there is at least one low-stock item that has not been acknowledged
    const hasUnsilencedLowStock = items.some(
      (item) => !silencedItemIds.has(String(item.id)) && !silencedItemIds.has(item.id)
    )

    if (items.length > 0 && hasUnsilencedLowStock && allowAlert) {
      // Start sound and display alert
      alarmSound.startAlert()
      set({ lowStockItems: items, isAlarmActive: true })
    } else {
      // On all other screens (e.g. advance_orders, billing, pos, history, etc.):
      // Keep lowStockItems up to date for badges, but NEVER sound alarm or popup modal!
      alarmSound.stopAlert()
      set({ lowStockItems: items, isAlarmActive: false })
      if (items.length === 0) {
        set({ silencedItemIds: new Set() })
      }
    }
  },

  silenceAlarm: () => {
    const currentItemIds = get().lowStockItems.map((i) => String(i.id))
    alarmSound.stopAlert()
    set({
      isAlarmActive: false,
      hasCompletedStartupAlert: true,
      silencedItemIds: new Set(currentItemIds),
    })
  },

  dismissStartupAlert: () => {
    const currentItemIds = get().lowStockItems.map((i) => String(i.id))
    alarmSound.stopAlert()
    set({
      isAlarmActive: false,
      hasCompletedStartupAlert: true,
      silencedItemIds: new Set(currentItemIds),
    })
  },

  triggerInventoryAlert: () => {
    const items = get().lowStockItems
    if (items.length > 0) {
      alarmSound.startAlert()
      set({ isAlarmActive: true, silencedItemIds: new Set() })
    }
  },

  resetSilencedState: () => {
    set({ silencedItemIds: new Set() })
  },
}))
