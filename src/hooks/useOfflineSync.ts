'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  syncPendingProgress,
  getSyncStatus,
  isOnline as checkOnline,
  onNetworkChange,
} from '@/lib/offline/sync'
import { SyncStatus } from '@/types/offline'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    is_syncing: false,
    last_sync: null,
    pending_count: 0,
    errors: [],
  })

  // Check online status
  useEffect(() => {
    setIsOnline(checkOnline())

    const cleanup = onNetworkChange((online) => {
      setIsOnline(online)
    })

    return cleanup
  }, [])

  // Update sync status
  const updateStatus = useCallback(() => {
    setSyncStatus(getSyncStatus())
  }, [])

  // Manual sync trigger
  const sync = useCallback(async () => {
    const status = await syncPendingProgress()
    setSyncStatus(status)
    return status
  }, [])

  // Listen for sync requests from service worker
  useEffect(() => {
    const handleSyncRequest = () => {
      sync()
    }

    window.addEventListener('sw-sync-requested', handleSyncRequest)

    return () => {
      window.removeEventListener('sw-sync-requested', handleSyncRequest)
    }
  }, [sync])

  // Auto-sync on mount and when coming online
  useEffect(() => {
    if (isOnline) {
      sync()
    }
  }, [isOnline, sync])

  // Periodic status check
  useEffect(() => {
    updateStatus()

    const interval = setInterval(updateStatus, 5000)

    return () => clearInterval(interval)
  }, [updateStatus])

  return {
    isOnline,
    syncStatus,
    sync,
    isSyncing: syncStatus.is_syncing,
    hasPendingItems: syncStatus.pending_count > 0,
    lastSync: syncStatus.last_sync,
    errors: syncStatus.errors,
  }
}
