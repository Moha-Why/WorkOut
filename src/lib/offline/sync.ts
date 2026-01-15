import { createClient } from '@/lib/supabase/client'
import {
  getPendingProgress,
  markProgressSynced,
  deletePendingProgress,
} from './db'
import { PendingProgress, SyncStatus } from '@/types/offline'

let syncStatus: SyncStatus = {
  is_syncing: false,
  last_sync: null,
  pending_count: 0,
  errors: [],
}

// Get current sync status
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus }
}

// Sync pending progress to Supabase
export async function syncPendingProgress(): Promise<SyncStatus> {
  if (syncStatus.is_syncing) {
    console.log('Sync already in progress')
    return syncStatus
  }

  syncStatus.is_syncing = true
  syncStatus.errors = []

  try {
    const supabase = createClient()
    const pending = await getPendingProgress()

    syncStatus.pending_count = pending.length

    if (pending.length === 0) {
      console.log('No pending progress to sync')
      syncStatus.is_syncing = false
      syncStatus.last_sync = new Date()
      return syncStatus
    }

    console.log(`Syncing ${pending.length} pending progress items`)

    // Group by type for batch operations
    const exerciseProgress = pending.filter((p) => p.type === 'exercise')
    const workoutProgress = pending.filter((p) => p.type === 'workout')

    // Sync exercise progress
    if (exerciseProgress.length > 0) {
      const { data, error } = await supabase
        .from('user_exercise_progress')
        .insert(
          exerciseProgress.map((p) => ({
            user_id: p.user_id,
            exercise_id: p.entity_id,
            completed_at: new Date(p.completed_at).toISOString(),
            synced: true,
          })) as never
        )

      if (error) {
        console.error('Error syncing exercise progress:', error)
        syncStatus.errors.push({
          id: 'exercise-batch',
          type: 'exercise',
          message: error.message,
          timestamp: new Date(),
        })
      } else {
        // Mark as synced
        await Promise.all(
          exerciseProgress.map((p) => deletePendingProgress(p.id))
        )
      }
    }

    // Sync workout progress
    if (workoutProgress.length > 0) {
      const { data, error } = await supabase
        .from('user_workout_progress')
        .insert(
          workoutProgress.map((p) => ({
            user_id: p.user_id,
            workout_id: p.entity_id,
            completed_at: new Date(p.completed_at).toISOString(),
            synced: true,
          })) as never
        )

      if (error) {
        console.error('Error syncing workout progress:', error)
        syncStatus.errors.push({
          id: 'workout-batch',
          type: 'workout',
          message: error.message,
          timestamp: new Date(),
        })
      } else {
        // Mark as synced
        await Promise.all(
          workoutProgress.map((p) => deletePendingProgress(p.id))
        )
      }
    }

    // Update pending count
    const remainingPending = await getPendingProgress()
    syncStatus.pending_count = remainingPending.length

    syncStatus.last_sync = new Date()
    console.log('Sync completed')
  } catch (error) {
    console.error('Sync error:', error)
    syncStatus.errors.push({
      id: 'sync-general',
      type: 'exercise',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    })
  } finally {
    syncStatus.is_syncing = false
  }

  return syncStatus
}

// Auto-sync when online
export function setupAutoSync() {
  if (typeof window === 'undefined') return

  // Sync when coming online
  window.addEventListener('online', () => {
    console.log('Network online, triggering sync')
    syncPendingProgress()
  })

  // Periodic sync (every 5 minutes when online)
  setInterval(() => {
    if (navigator.onLine) {
      syncPendingProgress()
    }
  }, 5 * 60 * 1000)

  // Initial sync
  if (navigator.onLine) {
    setTimeout(() => {
      syncPendingProgress()
    }, 2000)
  }
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// Listen for online/offline events
export function onNetworkChange(callback: (isOnline: boolean) => void) {
  if (typeof window === 'undefined') return () => {}

  const onlineHandler = () => callback(true)
  const offlineHandler = () => callback(false)

  window.addEventListener('online', onlineHandler)
  window.addEventListener('offline', offlineHandler)

  return () => {
    window.removeEventListener('online', onlineHandler)
    window.removeEventListener('offline', offlineHandler)
  }
}
