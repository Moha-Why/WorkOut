'use client'

import { useEffect, useState } from 'react'
import { Badge } from './Badge'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSync, setPendingSync] = useState(0)

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Check for pending sync items
  useEffect(() => {
    const checkPendingSync = async () => {
      try {
        const { getPendingProgress } = await import('@/lib/offline/db')
        const pending = await getPendingProgress()
        setPendingSync(pending.length)
      } catch (error) {
        console.error('Error checking pending sync:', error)
      }
    }

    checkPendingSync()

    // Check every 10 seconds
    const interval = setInterval(checkPendingSync, 10000)

    return () => clearInterval(interval)
  }, [isOnline])

  if (isOnline && pendingSync === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOnline ? (
        <Badge variant="warning" className="flex items-center gap-2 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-yellow-600 animate-pulse" />
          <span>Offline Mode</span>
        </Badge>
      ) : pendingSync > 0 ? (
        <Badge variant="info" className="flex items-center gap-2 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <span>Syncing {pendingSync} items...</span>
        </Badge>
      ) : null}
    </div>
  )
}
