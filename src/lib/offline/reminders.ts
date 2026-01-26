/**
 * Workout reminder notification utilities
 * Uses localStorage and the Notification API for scheduling workout reminders
 */

interface ReminderSettings {
  enabled: boolean
  time: string // HH:MM format
  days: number[] // 0-6, Sunday-Saturday
  lastNotificationDate?: string // ISO date string to prevent duplicate notifications
}

const STORAGE_KEY = 'workout-reminder-settings'

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  time: '09:00',
  days: [1, 2, 3, 4, 5], // Monday-Friday
}

/**
 * Get reminder settings from localStorage
 */
export function getReminderSettings(): ReminderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Error reading reminder settings:', error)
  }

  return DEFAULT_SETTINGS
}

/**
 * Save reminder settings to localStorage
 */
export function saveReminderSettings(settings: Partial<ReminderSettings>): void {
  if (typeof window === 'undefined') return

  try {
    const current = getReminderSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving reminder settings:', error)
  }
}

/**
 * Check if notification should be shown now based on settings
 */
export function shouldShowReminder(): boolean {
  const settings = getReminderSettings()

  if (!settings.enabled) return false

  const now = new Date()
  const todayDay = now.getDay()
  const todayDate = now.toISOString().split('T')[0]

  // Check if today is an enabled day
  if (!settings.days.includes(todayDay)) return false

  // Check if we already showed notification today
  if (settings.lastNotificationDate === todayDate) return false

  // Parse reminder time
  const [hours, minutes] = settings.time.split(':').map(Number)
  const reminderMinutes = hours * 60 + minutes
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // Show if within 5 minute window of reminder time
  const diff = nowMinutes - reminderMinutes
  if (diff >= 0 && diff <= 5) {
    return true
  }

  return false
}

/**
 * Mark today's reminder as shown
 */
export function markReminderShown(): void {
  const todayDate = new Date().toISOString().split('T')[0]
  saveReminderSettings({ lastNotificationDate: todayDate })
}

/**
 * Show workout reminder notification
 */
export async function showWorkoutReminder(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  try {
    const notification = new Notification('Time to Workout! 🏋️', {
      body: 'Your scheduled workout time is here. Ready to crush it?',
      icon: '/icons/icon-192x192.png',
      tag: 'workout-reminder',
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    // Auto-close after 30 seconds
    setTimeout(() => notification.close(), 30000)

    markReminderShown()
    return true
  } catch (error) {
    console.error('Error showing notification:', error)
    return false
  }
}

/**
 * Schedule reminder check interval
 * Returns cleanup function to stop the interval
 */
export function startReminderChecker(onReminder?: () => void): () => void {
  // Check every minute
  const interval = setInterval(() => {
    if (shouldShowReminder()) {
      showWorkoutReminder()
      onReminder?.()
    }
  }, 60000) // Check every minute

  // Also check immediately on start
  if (shouldShowReminder()) {
    showWorkoutReminder()
    onReminder?.()
  }

  return () => clearInterval(interval)
}

/**
 * Format time for display (12-hour format)
 */
export function formatReminderTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Get day names for display
 */
export function getDayNames(days: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days.map(d => dayNames[d]).join(', ')
}
