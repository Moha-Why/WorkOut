'use client'

import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import { isOnline as checkIsOnline, onNetworkChange, getSyncStatus, syncPendingProgress } from '@/lib/offline/sync'
import { SyncStatus } from '@/types/offline'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false)

  useEffect(() => {
    // Check initial status
    setIsOnline(checkIsOnline())
    setSyncStatus(getSyncStatus())

    // Listen for online/offline events
    const unsubscribe = onNetworkChange((online) => {
      setIsOnline(online)

      if (online) {
        // Show reconnected banner
        setShowReconnectedBanner(true)
        // Sync and hide banner after delay
        syncPendingProgress().then(setSyncStatus)
        setTimeout(() => setShowReconnectedBanner(false), 3000)
      }
    })

    // Periodic sync status update
    const interval = setInterval(() => {
      setSyncStatus(getSyncStatus())
    }, 10000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const pendingCount = syncStatus?.pending_count || 0

  return (
    <>
      {/* Offline Banner - Fixed at top */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            You're offline - Downloaded workouts are still available
          </div>
        </div>
      )}

      {/* Back Online Banner */}
      {isOnline && showReconnectedBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Back online - Syncing your progress...
          </div>
        </div>
      )}

      {/* Bottom corner indicator for pending syncs */}
      {isOnline && !showReconnectedBanner && pendingCount > 0 && (
        <div className="fixed bottom-4 right-4 z-40">
          <Badge variant="info" className="flex items-center gap-2 px-3 py-2 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span>{syncStatus?.is_syncing ? 'Syncing...' : `${pendingCount} pending`}</span>
          </Badge>
        </div>
      )}
    </>
  )
}
