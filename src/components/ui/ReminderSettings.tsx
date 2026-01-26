'use client'

import { useState, useEffect } from 'react'
import { Button } from './Button'
import {
  getReminderSettings,
  saveReminderSettings,
  formatReminderTime,
} from '@/lib/offline/reminders'

interface ReminderSettingsProps {
  isOpen: boolean
  onClose: () => void
  onRequestPermission: () => void
  notificationPermission: NotificationPermission | 'default'
}

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function ReminderSettings({
  isOpen,
  onClose,
  onRequestPermission,
  notificationPermission,
}: ReminderSettingsProps) {
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('09:00')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])

  useEffect(() => {
    if (isOpen) {
      const settings = getReminderSettings()
      setEnabled(settings.enabled)
      setTime(settings.time)
      setDays(settings.days)
    }
  }, [isOpen])

  const handleSave = () => {
    saveReminderSettings({ enabled, time, days })
    onClose()
  }

  const toggleDay = (day: number) => {
    setDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Workout Reminders
        </h2>

        {/* Notification permission warning */}
        {notificationPermission !== 'granted' && (
          <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm text-orange-500 font-medium">Notifications Required</p>
                <p className="text-xs text-orange-400/70 mt-0.5">
                  {notificationPermission === 'denied'
                    ? 'Notifications are blocked. Enable them in your browser settings.'
                    : 'Allow notifications to receive workout reminders.'
                  }
                </p>
                {notificationPermission !== 'denied' && (
                  <button
                    onClick={onRequestPermission}
                    className="mt-2 text-xs text-orange-500 hover:text-orange-400 underline"
                  >
                    Enable notifications
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-6 p-3 bg-bg-hover rounded-lg">
          <div>
            <p className="font-medium text-text-primary">Enable Reminders</p>
            <p className="text-xs text-text-primary/60">Get notified at your preferred time</p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? 'bg-accent' : 'bg-gray-600'
            }`}
            disabled={notificationPermission !== 'granted'}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Time picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Reminder Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled}
            className="w-full px-4 py-3 bg-bg-hover border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
          {time && (
            <p className="text-xs text-text-primary/60 mt-1">
              {formatReminderTime(time)}
            </p>
          )}
        </div>

        {/* Day selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Reminder Days
          </label>
          <div className="flex gap-2 flex-wrap">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                disabled={!enabled}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  days.includes(day.value)
                    ? 'bg-accent text-bg-main'
                    : 'bg-bg-hover text-text-primary hover:bg-bg-hover/80'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info text */}
        <p className="text-xs text-text-primary/50 mb-6">
          Reminders work best when the app is open. For the most reliable reminders,
          keep the app open in a browser tab.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
