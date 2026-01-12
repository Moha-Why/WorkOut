import { format, formatDistance, formatRelative, isToday, isYesterday } from 'date-fns'

// Format date for display
export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  return format(new Date(date), formatStr)
}

// Relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  return formatDistance(new Date(date), new Date(), { addSuffix: true })
}

// Smart date formatting (Today, Yesterday, or date)
export function formatSmartDate(date: string | Date): string {
  const dateObj = new Date(date)

  if (isToday(dateObj)) {
    return 'Today'
  }

  if (isYesterday(dateObj)) {
    return 'Yesterday'
  }

  return format(dateObj, 'MMM d, yyyy')
}

// Format workout completion date
export function formatWorkoutDate(date: string | Date): string {
  const dateObj = new Date(date)

  if (isToday(dateObj)) {
    return `Today at ${format(dateObj, 'h:mm a')}`
  }

  if (isYesterday(dateObj)) {
    return `Yesterday at ${format(dateObj, 'h:mm a')}`
  }

  return format(dateObj, 'MMM d at h:mm a')
}

// Get week number of the year
export function getWeekNumber(date: Date = new Date()): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Calculate streak
export function calculateStreak(completionDates: Date[]): number {
  if (completionDates.length === 0) return 0

  const sortedDates = completionDates
    .map(d => new Date(d).setHours(0, 0, 0, 0))
    .sort((a, b) => b - a)

  let streak = 1
  const today = new Date().setHours(0, 0, 0, 0)
  const yesterday = today - 86400000

  // Check if most recent is today or yesterday
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0
  }

  // Count consecutive days
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i - 1] - sortedDates[i]
    if (diff === 86400000) {
      streak++
    } else {
      break
    }
  }

  return streak
}
