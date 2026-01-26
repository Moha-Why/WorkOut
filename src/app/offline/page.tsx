'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { SetLogger } from '@/components/workouts/SetLogger'
import {
  getAllWorkouts,
  clearAllOfflineData,
  savePendingCompletion,
  getPendingCompletions,
  markCompletionSynced,
  updateWorkoutCompletion,
} from '@/lib/offline/db'
import {
  saveSetLog,
  getSetLogsForWorkout,
  getPendingSetLogs,
  markSetLogSynced,
  getPreviousLogsForExercises,
  getPendingLogCount,
} from '@/lib/offline/setLogs'
import { retryWithBackoff } from '@/lib/offline/retry'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { ReminderSettings } from '@/components/ui/ReminderSettings'
import { startReminderChecker, getReminderSettings } from '@/lib/offline/reminders'
import { OfflineWorkout } from '@/types/offline'
import { Exercise, SetLog } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSwipe } from '@/hooks/useSwipe'
import { createClient } from '@/lib/supabase/client'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default function OfflinePage() {
  const { profile } = useAuth()
  const [isOnline, setIsOnline] = useState(true)
  const [downloadedWorkouts, setDownloadedWorkouts] = useState<OfflineWorkout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Workout player state
  const [selectedWorkout, setSelectedWorkout] = useState<OfflineWorkout | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCompletingWorkout, setIsCompletingWorkout] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  // Set logging state
  const [completedSets, setCompletedSets] = useState<Map<string, Set<number>>>(new Map())
  const [setLogs, setSetLogs] = useState<Map<string, SetLog[]>>(new Map())
  const [previousLogs, setPreviousLogs] = useState<Map<string, Map<number, SetLog>>>(new Map())
  const [isResting, setIsResting] = useState(false)
  const [restTimeLeft, setRestTimeLeft] = useState(0)
  const [currentSetNumber, setCurrentSetNumber] = useState(1)

  // Sync status state
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  // Notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'default'>('default')

  // Reminder settings modal state
  const [showReminderSettings, setShowReminderSettings] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)

  // Refresh pending sync count
  const refreshPendingCount = useCallback(async () => {
    try {
      const [pendingCompletions, pendingLogs] = await Promise.all([
        getPendingCompletions(),
        getPendingLogCount(),
      ])
      setPendingSyncCount(pendingCompletions.length + pendingLogs)
    } catch (error) {
      console.error('Error getting pending count:', error)
    }
  }, [])

  // Sync all pending data with exponential backoff retry
  const syncAllPendingData = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return

    setIsSyncing(true)
    let syncedCount = 0
    let failedCount = 0

    try {
      const supabase = createClient()

      // Sync pending completions with retry
      const pendingCompletions = await getPendingCompletions()
      for (const completion of pendingCompletions) {
        try {
          await retryWithBackoff(
            async () => {
              const { error } = await supabase.from('user_workout_progress').insert({
                user_id: completion.user_id,
                workout_id: completion.workout_id,
                completed_at: completion.completed_at,
              } as any)
              if (error) throw error
            },
            { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
          )
          await markCompletionSynced(completion.id)
          syncedCount++
        } catch (error) {
          console.error('Failed to sync completion after retries:', completion.id, error)
          failedCount++
        }
      }

      // Sync pending set logs with retry
      const pendingLogs = await getPendingSetLogs()
      for (const log of pendingLogs) {
        try {
          await retryWithBackoff(
            async () => {
              const { error } = await supabase.from('set_logs').insert({
                id: log.id,
                user_id: log.user_id,
                workout_id: log.workout_id,
                exercise_id: log.exercise_id,
                set_number: log.set_number,
                weight: log.weight,
                reps: log.reps,
                rpe: log.rpe,
                completed_at: log.completed_at,
                notes: log.notes,
              } as any)
              if (error) throw error
            },
            { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
          )
          await markSetLogSynced(log.id)
          syncedCount++
        } catch (error) {
          console.error('Failed to sync set log after retries:', log.id, error)
          failedCount++
        }
      }

      if (syncedCount > 0 && failedCount === 0) {
        setToast({
          message: `Synced ${syncedCount} item${syncedCount === 1 ? '' : 's'}!`,
          type: 'success',
          isOpen: true,
        })
      } else if (syncedCount > 0 && failedCount > 0) {
        setToast({
          message: `Synced ${syncedCount}, ${failedCount} failed. Will retry.`,
          type: 'info',
          isOpen: true,
        })
      } else if (failedCount > 0) {
        setToast({
          message: `Sync failed for ${failedCount} item${failedCount === 1 ? '' : 's'}. Will retry.`,
          type: 'error',
          isOpen: true,
        })
      }
    } catch (error) {
      console.error('Error syncing pending data:', error)
      setToast({
        message: 'Sync failed. Will retry later.',
        type: 'error',
        isOpen: true,
      })
    } finally {
      setIsSyncing(false)
      await refreshPendingCount()
    }
  }, [isSyncing, refreshPendingCount])

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted')
      return
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }, [])

  // Show notification when rest timer completes
  const showRestCompleteNotification = useCallback(() => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    // Only show notification if page is hidden (app in background)
    if (document.visibilityState === 'hidden') {
      const notification = new Notification('Rest Complete! 💪', {
        body: 'Time for your next set!',
        icon: '/icons/icon-192x192.png',
        tag: 'rest-timer',
        requireInteraction: true,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000)
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    setIsOnline(navigator.onLine)

    // Check notification permission on mount
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }

    // Load reminder settings
    const settings = getReminderSettings()
    setReminderEnabled(settings.enabled)

    // Start reminder checker
    const stopReminderChecker = startReminderChecker(() => {
      // Refresh reminder state when a reminder is shown
      const updatedSettings = getReminderSettings()
      setReminderEnabled(updatedSettings.enabled)
    })

    const handleOnline = () => {
      setIsOnline(true)
      syncAllPendingData()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    loadOfflineContent()
    refreshPendingCount()

    // Try to sync on mount if online
    if (navigator.onLine) {
      syncAllPendingData()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      stopReminderChecker()
    }
  }, [syncAllPendingData, refreshPendingCount])

  const loadOfflineContent = async () => {
    try {
      const workouts = await getAllWorkouts()
      setDownloadedWorkouts(workouts)
    } catch (error) {
      console.error('Error loading offline content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = '/'
    } else {
      window.location.reload()
    }
  }

  const handleWorkoutSelect = async (workout: OfflineWorkout) => {
    setSelectedWorkout(workout)
    setCurrentExerciseIndex(0)
    setCurrentSetNumber(1)
    setIsResting(false)
    setRestTimeLeft(0)

    // Request notification permission when starting a workout
    requestNotificationPermission()

    // Load existing set logs for this workout
    try {
      const existingLogs = await getSetLogsForWorkout(workout.id)
      const logsMap = new Map<string, SetLog[]>()
      const completedMap = new Map<string, Set<number>>()

      for (const log of existingLogs) {
        // Group logs by exercise
        const exerciseLogs = logsMap.get(log.exercise_id) || []
        exerciseLogs.push(log)
        logsMap.set(log.exercise_id, exerciseLogs)

        // Track completed sets per exercise
        const exerciseCompleted = completedMap.get(log.exercise_id) || new Set<number>()
        exerciseCompleted.add(log.set_number)
        completedMap.set(log.exercise_id, exerciseCompleted)
      }

      setSetLogs(logsMap)
      setCompletedSets(completedMap)

      // Load previous session logs for each exercise (for pre-filling weight)
      const exerciseIds = workout.exercises?.map((e) => e.id) || []
      if (exerciseIds.length > 0) {
        const prevLogs = await getPreviousLogsForExercises(exerciseIds, workout.id)
        setPreviousLogs(prevLogs)
      }
    } catch (error) {
      console.error('Error loading set logs:', error)
      setSetLogs(new Map())
      setCompletedSets(new Map())
      setPreviousLogs(new Map())
    }
  }

  const handleBackToList = () => {
    setSelectedWorkout(null)
    setCurrentExerciseIndex(0)
    setCompletedSets(new Map())
    setSetLogs(new Map())
    setPreviousLogs(new Map())
    setCurrentSetNumber(1)
    setIsResting(false)
    setRestTimeLeft(0)
  }

  // Handle set completion
  const handleSetComplete = async (exerciseId: string, setNumber: number, weight: number | null, reps: number) => {
    if (!selectedWorkout || !profile) return

    const log: SetLog = {
      id: crypto.randomUUID(),
      user_id: profile.id,
      workout_id: selectedWorkout.id,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight,
      reps,
      rpe: null,
      completed_at: new Date().toISOString(),
      notes: null,
    }

    // Save to IndexedDB (will sync when online)
    const isOnlineNow = navigator.onLine
    await saveSetLog(log, isOnlineNow)

    // If online, try to sync immediately
    if (isOnlineNow) {
      try {
        const supabase = createClient()
        const { error } = await supabase.from('set_logs').insert({
          id: log.id,
          user_id: log.user_id,
          workout_id: log.workout_id,
          exercise_id: log.exercise_id,
          set_number: log.set_number,
          weight: log.weight,
          reps: log.reps,
          rpe: log.rpe,
          completed_at: log.completed_at,
          notes: log.notes,
        } as any)

        if (!error) {
          await markSetLogSynced(log.id)
        }
      } catch (error) {
        console.error('Error syncing set log:', error)
      }
    }

    // Update local state
    setSetLogs((prev) => {
      const updated = new Map(prev)
      const exerciseLogs = updated.get(exerciseId) || []
      updated.set(exerciseId, [...exerciseLogs, log])
      return updated
    })

    setCompletedSets((prev) => {
      const updated = new Map(prev)
      const exerciseCompleted = updated.get(exerciseId) || new Set<number>()
      exerciseCompleted.add(setNumber)
      updated.set(exerciseId, new Set(exerciseCompleted))
      return updated
    })

    // Find current exercise and get total sets
    const currentExercise = selectedWorkout.exercises?.[currentExerciseIndex]
    const totalSets = currentExercise?.sets || 3

    // Start rest timer if not the last set
    if (setNumber < totalSets) {
      setIsResting(true)
      setRestTimeLeft(currentExercise?.rest_seconds || 60)
      setCurrentSetNumber(setNumber + 1)
    } else {
      // Move to next exercise if all sets done
      setCurrentSetNumber(1)
    }

    // Refresh pending count if offline
    if (!isOnlineNow) {
      await refreshPendingCount()
    }
  }

  // Rest timer countdown
  useEffect(() => {
    if (!isResting) return

    if (restTimeLeft <= 0) {
      setIsResting(false)
      showRestCompleteNotification()
      return
    }

    const timer = setInterval(() => {
      setRestTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isResting, restTimeLeft, showRestCompleteNotification])

  // Update currentSetNumber when exercise changes
  useEffect(() => {
    if (!selectedWorkout) return
    const currentExercise = selectedWorkout.exercises?.[currentExerciseIndex]
    if (!currentExercise) return

    const exerciseCompletedSets = completedSets.get(currentExercise.id)
    const totalSets = currentExercise.sets || 3

    // Find first uncompleted set
    for (let i = 1; i <= totalSets; i++) {
      if (!exerciseCompletedSets?.has(i)) {
        setCurrentSetNumber(i)
        return
      }
    }
    // All sets completed
    setCurrentSetNumber(totalSets)
  }, [currentExerciseIndex, selectedWorkout, completedSets])

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    try {
      await clearAllOfflineData()
      setDownloadedWorkouts([])
    } catch (error) {
      console.error('Error deleting offline data:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteAllConfirm(false)
    }
  }

  const handleCompleteWorkout = async () => {
    if (!selectedWorkout || !profile) return
    if (selectedWorkout.is_completed) return

    setIsCompletingWorkout(true)
    const completedAt = new Date().toISOString()

    try {
      // Update local offline workout status
      await updateWorkoutCompletion(selectedWorkout.id, true, completedAt)

      // Update local state
      setSelectedWorkout({
        ...selectedWorkout,
        is_completed: true,
        completed_at: completedAt,
      })

      setDownloadedWorkouts((prev) =>
        prev.map((w) =>
          w.id === selectedWorkout.id
            ? { ...w, is_completed: true, completed_at: completedAt }
            : w
        )
      )

      if (navigator.onLine) {
        // If online, save directly to Supabase
        const supabase = createClient()
        const { error } = await supabase.from('user_workout_progress').insert({
          user_id: profile.id,
          workout_id: selectedWorkout.id,
          completed_at: completedAt,
        } as any)

        if (error) {
          // Save to pending if insert fails
          await savePendingCompletion({
            id: crypto.randomUUID(),
            workout_id: selectedWorkout.id,
            user_id: profile.id,
            completed_at: completedAt,
            synced: false,
          })
        }

        setToast({
          message: 'Workout completed!',
          type: 'success',
          isOpen: true,
        })
      } else {
        // Offline: save to pending completions for later sync
        await savePendingCompletion({
          id: crypto.randomUUID(),
          workout_id: selectedWorkout.id,
          user_id: profile.id,
          completed_at: completedAt,
          synced: false,
        })

        setToast({
          message: 'Workout completed! Will sync when online.',
          type: 'info',
          isOpen: true,
        })
      }
    } catch (error) {
      console.error('Error completing workout:', error)
      setToast({
        message: 'Error completing workout',
        type: 'error',
        isOpen: true,
      })
    } finally {
      setIsCompletingWorkout(false)
    }
  }

  const currentExercise: Exercise | null = selectedWorkout?.exercises?.[currentExerciseIndex] || null
  const totalExercises = selectedWorkout?.exercises?.length || 0

  const handleNextExercise = () => {
    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex((prev) => prev + 1)
    }
  }

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((prev) => prev - 1)
    }
  }

  // Swipe handlers for exercise navigation
  const swipeHandlers = useSwipe({
    onSwipeLeft: handleNextExercise,
    onSwipeRight: handlePreviousExercise,
    threshold: 50,
  })

  // Show loading state until mounted (prevents SSR hydration issues)
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-text-primary/60">Loading...</div>
      </div>
    )
  }

  // Workout Player View
  if (selectedWorkout) {
    const workout = selectedWorkout.data
    const exercises = selectedWorkout.exercises || []

    return (
      <div className="min-h-screen bg-bg-main">
        {/* Header */}
        <div className="bg-bg-secondary border-b border-border px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleBackToList}
              className="text-sm text-text-primary/60 hover:text-accent mb-2 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Downloads
            </button>
            <h1 className="text-xl font-bold text-text-primary">{workout.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="info" className="text-xs">Week {workout.week_number}</Badge>
              <Badge variant="default" className="text-xs">Day {workout.day_number}</Badge>
              {selectedWorkout.is_completed ? (
                <Badge variant="success" className="text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Completed
                </Badge>
              ) : (
                <Badge variant="warning" className="text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Offline
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div
          className="max-w-2xl mx-auto p-4 space-y-4"
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchMove={swipeHandlers.onTouchMove}
          onTouchEnd={swipeHandlers.onTouchEnd}
        >
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-primary/60">
              Exercise {currentExerciseIndex + 1} of {totalExercises}
            </span>
            {/* Swipe hint */}
            <span className="text-text-primary/40 text-xs">
              ← Swipe to navigate →
            </span>
          </div>

          {/* Current exercise */}
          {currentExercise && (
            <>
              {/* Video - show placeholder when offline for YouTube/Vimeo */}
              {!isOnline && (currentExercise.video_provider === 'youtube' || currentExercise.video_provider === 'vimeo') ? (
                <div className="w-full aspect-video bg-bg-secondary rounded-xl flex flex-col items-center justify-center border border-border">
                  <svg className="w-12 h-12 text-text-primary/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-text-primary/50 text-sm font-medium">Video unavailable offline</p>
                  <p className="text-text-primary/30 text-xs mt-1">Connect to internet to watch</p>
                </div>
              ) : (
                <VideoPlayer
                  provider={currentExercise.video_provider}
                  videoId={currentExercise.video_id}
                  className="rounded-xl overflow-hidden"
                />
              )}

              {/* Exercise details */}
              <Card>
                <CardContent className="py-4 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary mb-1">
                      {currentExercise.name}
                    </h2>
                    {currentExercise.notes && (
                      <p className="text-sm text-text-primary/60">{currentExercise.notes}</p>
                    )}
                  </div>

                  {/* Set Logging Section */}
                  {(() => {
                    const totalSets = currentExercise.sets || 3
                    const exerciseCompletedSets = completedSets.get(currentExercise.id) || new Set<number>()
                    const completedCount = exerciseCompletedSets.size
                    const isAllCompleted = completedCount === totalSets
                    const exerciseLogs = setLogs.get(currentExercise.id) || []

                    // Get previous session's log for this exercise/set (for pre-filling weight)
                    const exercisePrevLogs = previousLogs.get(currentExercise.id)
                    const prevSessionLog = exercisePrevLogs?.get(currentSetNumber)

                    // Format time as MM:SS
                    const formatTime = (seconds: number) => {
                      const mins = Math.floor(seconds / 60)
                      const secs = seconds % 60
                      return `${mins}:${secs.toString().padStart(2, '0')}`
                    }

                    return (
                      <div className="space-y-4">
                        {/* Previous session hint */}
                        {prevSessionLog && !exerciseCompletedSets.has(currentSetNumber) && (
                          <div className="flex items-center gap-2 text-xs text-text-primary/50 bg-bg-hover/50 px-3 py-2 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Last session: {prevSessionLog.weight}kg × {prevSessionLog.reps} reps</span>
                          </div>
                        )}

                        {/* Set progress indicator */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-text-primary/60">
                            {isAllCompleted ? 'All sets complete!' : `Set ${currentSetNumber} of ${totalSets}`}
                          </p>
                          <div className="flex gap-1">
                            {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNum) => (
                              <div
                                key={setNum}
                                className={`w-3 h-3 rounded-full transition-colors ${
                                  exerciseCompletedSets.has(setNum)
                                    ? 'bg-green-500'
                                    : setNum === currentSetNumber
                                    ? 'bg-accent'
                                    : 'bg-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Rest Timer */}
                        {isResting && (
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 text-center">
                            <p className="text-sm text-orange-400 mb-2">Rest Time</p>
                            <p className="text-5xl font-bold text-orange-500 mb-4">
                              {formatTime(restTimeLeft)}
                            </p>
                            <Button
                              onClick={() => setIsResting(false)}
                              variant="outline"
                              className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                            >
                              Skip Rest
                            </Button>
                            {/* Notification status */}
                            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                              {notificationPermission === 'granted' ? (
                                <>
                                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                  </svg>
                                  <span className="text-green-500/70">Notifications enabled</span>
                                </>
                              ) : notificationPermission === 'denied' ? (
                                <>
                                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  <span className="text-red-500/70">Notifications blocked</span>
                                </>
                              ) : (
                                <button
                                  onClick={requestNotificationPermission}
                                  className="flex items-center gap-2 text-orange-400/70 hover:text-orange-400"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                  </svg>
                                  <span>Enable notifications</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Set Logger - only show when profile exists and not resting */}
                        {!isResting && !isAllCompleted && profile && (
                          <SetLogger
                            setNumber={currentSetNumber}
                            targetReps={currentExercise.reps ? Number(currentExercise.reps) : null}
                            previousWeight={prevSessionLog?.weight}
                            previousReps={prevSessionLog?.reps}
                            isCompleted={exerciseCompletedSets.has(currentSetNumber)}
                            onComplete={(weight, reps) => handleSetComplete(currentExercise.id, currentSetNumber, weight, reps)}
                          />
                        )}

                        {/* All sets completed message */}
                        {isAllCompleted && (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                            <svg className="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-green-500 font-semibold">Exercise Complete!</p>
                            <p className="text-sm text-green-500/70 mt-1">All {totalSets} sets logged</p>
                          </div>
                        )}

                        {/* Preview mode message when no profile */}
                        {!profile && !isAllCompleted && (
                          <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="text-sm text-accent font-medium">Preview Mode</p>
                                <p className="text-xs text-accent/70 mt-0.5">
                                  Sign in to log your sets and track progress.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Completed sets summary */}
                        {completedCount > 0 && (
                          <div className="border-t border-border pt-4">
                            <p className="text-xs text-text-primary/50 mb-2">Completed Sets:</p>
                            <div className="space-y-1">
                              {Array.from({ length: totalSets }, (_, i) => i + 1)
                                .filter((setNum) => exerciseCompletedSets.has(setNum))
                                .map((setNum) => {
                                  const log = exerciseLogs.find(l => l.set_number === setNum)
                                  return (
                                    <div
                                      key={setNum}
                                      className="flex items-center justify-between text-sm text-text-primary/70 bg-bg-hover/50 px-3 py-2 rounded"
                                    >
                                      <span>Set {setNum}</span>
                                      <span className="text-green-500">
                                        {log ? `${log.weight}kg × ${log.reps}` : '✓'}
                                      </span>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Muscle visualization */}
                  {(currentExercise.target_muscles || currentExercise.assisting_muscles) && (
                    <div className="pt-4 border-t border-border">
                      <MuscleModel
                        targetMuscles={currentExercise.target_muscles}
                        assistingMuscles={currentExercise.assisting_muscles || []}
                        view="both"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePreviousExercise}
                  variant="outline"
                  disabled={currentExerciseIndex === 0}
                  className="flex-1"
                >
                  ← Previous
                </Button>
                <Button
                  onClick={handleNextExercise}
                  variant="outline"
                  disabled={currentExerciseIndex === totalExercises - 1}
                  className="flex-1"
                >
                  Next →
                </Button>
              </div>

              {/* Complete Workout Button */}
              {selectedWorkout.is_completed ? (
                <div className="bg-success/10 border border-success/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-success font-medium">Workout Completed</p>
                      <p className="text-xs text-success/70 mt-0.5">
                        {selectedWorkout.completed_at
                          ? `Completed on ${new Date(selectedWorkout.completed_at).toLocaleDateString()}`
                          : 'Great job!'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : profile ? (
                <Button
                  onClick={handleCompleteWorkout}
                  variant="primary"
                  className="w-full py-4 text-lg font-bold"
                  disabled={isCompletingWorkout}
                >
                  {isCompletingWorkout ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Workout Complete
                    </>
                  )}
                </Button>
              ) : (
                <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-accent font-medium">Preview Mode</p>
                      <p className="text-xs text-accent/70 mt-0.5">
                        Sign in to mark workouts as complete.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Exercise list */}
          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold text-text-primary mb-3">All Exercises</h3>
              <div className="space-y-2">
                {exercises.map((exercise, index) => (
                  <button
                    key={exercise.id}
                    onClick={() => setCurrentExerciseIndex(index)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                      index === currentExerciseIndex
                        ? 'bg-accent text-bg-main'
                        : 'bg-bg-hover text-text-primary hover:bg-bg-hover/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{index + 1}.</span>
                      <span>{exercise.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Workout List View
  return (
    <div className="min-h-screen bg-bg-main">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success' : 'bg-accent'}`} />
              <span className="text-sm font-medium text-text-primary/70">
                {isOnline ? 'Online' : 'Offline Mode'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Reminder button */}
              <button
                onClick={() => setShowReminderSettings(true)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  reminderEnabled
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-bg-hover text-text-primary/60 hover:bg-bg-hover/80'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>{reminderEnabled ? 'On' : 'Off'}</span>
              </button>

              {/* Sync status indicator */}
              {pendingSyncCount > 0 && (
                <button
                  onClick={isOnline ? syncAllPendingData : undefined}
                  disabled={!isOnline || isSyncing}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    isOnline
                      ? 'bg-accent/20 text-accent hover:bg-accent/30 cursor-pointer'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{pendingSyncCount} pending</span>
                  </>
                )}
              </button>
            )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isOnline ? 'Connection Restored' : 'Offline Workouts'}
          </h1>
          <p className="text-text-primary/60 mt-1">
            {isOnline
              ? 'You\'re back online! Continue to the app to track your progress.'
              : 'Preview your downloaded workouts while offline.'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Online Banner */}
        {isOnline && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-success">Connection restored!</p>
                <p className="text-sm text-success/70">Go to the app to track your workout progress.</p>
              </div>
              <Button onClick={handleRetry} size="sm">
                Go to App
              </Button>
            </div>
          </div>
        )}

        {/* Downloaded Workouts Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Downloaded Workouts</h2>
            {downloadedWorkouts.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="text-sm text-red-500 hover:text-red-400 transition-colors"
              >
                Delete All
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg-secondary rounded-xl border border-border p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-bg-hover rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-bg-hover rounded w-3/4" />
                      <div className="h-3 bg-bg-hover rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : downloadedWorkouts.length > 0 ? (
            <div className="space-y-3">
              {[...downloadedWorkouts]
                .sort((a, b) => {
                  // Sort by week first, then by day
                  if (a.data.week_number !== b.data.week_number) {
                    return a.data.week_number - b.data.week_number
                  }
                  return a.data.day_number - b.data.day_number
                })
                .map((offlineWorkout) => {
                const workout = offlineWorkout.data
                const exerciseCount = offlineWorkout.exercises?.length || 0

                return (
                  <Card
                    key={offlineWorkout.id}
                    className="cursor-pointer hover:shadow-lg hover:shadow-accent/10 hover:border-accent/50 transition-all"
                    onClick={() => handleWorkoutSelect(offlineWorkout)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          offlineWorkout.is_completed ? 'bg-success/20' : 'bg-accent/20'
                        }`}>
                          {offlineWorkout.is_completed ? (
                            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="info" className="text-xs">
                              Week {workout.week_number}
                            </Badge>
                            <Badge variant="default" className="text-xs">
                              Day {workout.day_number}
                            </Badge>
                            {offlineWorkout.is_completed && (
                              <Badge variant="success" className="text-xs flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Done
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-text-primary truncate">
                            {workout.name}
                          </h3>
                          <p className="text-sm text-text-primary/50">
                            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                            <span className="mx-2">•</span>
                            {offlineWorkout.is_completed && offlineWorkout.completed_at
                              ? `Completed ${formatDate(new Date(offlineWorkout.completed_at).getTime())}`
                              : `Downloaded ${formatDate(offlineWorkout.cached_at)}`}
                          </p>
                        </div>

                        {/* Arrow */}
                        <div className="text-text-primary/40">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 bg-bg-hover rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-text-primary mb-1">No Downloaded Workouts</h3>
                <p className="text-sm text-text-primary/50 max-w-xs mx-auto">
                  Download workouts while online to preview them offline. Look for the download button on workout pages.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Help Section */}
        {!isOnline && (
          <Card className="bg-bg-secondary border-border">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-bg-hover rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-text-primary font-medium">Offline Preview</p>
                  <ul className="text-sm text-text-primary/50 mt-1 space-y-1">
                    <li>• Browse exercises and view details</li>
                    <li>• Go online to track progress</li>
                    <li>• Download more workouts when connected</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Retry Button when offline */}
        {!isOnline && (
          <div className="pt-4">
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check Connection
            </Button>
          </div>
        )}
      </div>

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Downloads"
        message={`Are you sure you want to delete all ${downloadedWorkouts.length} downloaded workout${downloadedWorkouts.length === 1 ? '' : 's'}? You'll need to download them again for offline use.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete All'}
        cancelText="Cancel"
        variant="danger"
      />

      {/* Reminder Settings Modal */}
      <ReminderSettings
        isOpen={showReminderSettings}
        onClose={() => {
          setShowReminderSettings(false)
          // Refresh reminder state after closing
          const settings = getReminderSettings()
          setReminderEnabled(settings.enabled)
        }}
        onRequestPermission={requestNotificationPermission}
        notificationPermission={notificationPermission}
      />

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  )
}
