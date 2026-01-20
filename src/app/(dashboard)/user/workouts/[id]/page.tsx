'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Exercise, Workout, SetLog } from '@/types'
import { ExerciseLogger } from '@/components/workouts/ExerciseLogger'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { Card, CardContent } from '@/components/ui/Card'
import { getWorkout as getOfflineWorkout } from '@/lib/offline/db'
import {
  saveSetLog,
  getSetLogsForWorkout,
  getPendingSetLogs,
  markSetLogSynced,
} from '@/lib/offline/setLogs'

export default function WorkoutPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const workoutId = params.id as string

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  // Track completed sets per exercise: { exerciseId: Set<setNumber> }
  const [completedSets, setCompletedSets] = useState<Record<string, Set<number>>>({})

  // Previous session logs for pre-filling
  const [previousLogs, setPreviousLogs] = useState<Record<string, SetLog[]>>({})

  // Current session logs
  const [sessionLogs, setSessionLogs] = useState<SetLog[]>([])

  // Track if workout was already completed today
  const [workoutAlreadyCompleted, setWorkoutAlreadyCompleted] = useState(false)

  // Sync pending logs when online
  const syncPendingLogs = useCallback(async () => {
    if (!navigator.onLine || !profile) return

    try {
      const pending = await getPendingSetLogs()
      if (pending.length === 0) return

      const supabase = createClient()

      for (const log of pending) {
        const { error } = await supabase.from('user_set_logs').insert({
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
        })

        if (!error) {
          await markSetLogSynced(log.id)
        }
      }
    } catch (error) {
      console.error('Error syncing pending logs:', error)
    }
  }, [profile])

  // Fetch workout and exercises
  useEffect(() => {
    const fetchWorkout = async () => {
      if (!workoutId || !profile) return

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true

      // Try offline cache first if offline
      if (!online) {
        try {
          const offlineWorkout = await getOfflineWorkout(workoutId)
          if (offlineWorkout) {
            setWorkout(offlineWorkout.data)
            setExercises(offlineWorkout.exercises)
            setIsOfflineMode(true)
            // Expand first exercise by default
            if (offlineWorkout.exercises.length > 0) {
              setExpandedExerciseId(offlineWorkout.exercises[0].id)
            }
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error loading offline workout:', error)
        }
      }

      // Online: fetch from database
      const supabase = createClient()

      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single()

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('workout_id', workoutId)
        .order('order_index', { ascending: true })

      // Fallback to offline cache if fetch fails
      if ((workoutError || exerciseError) && !workoutData) {
        try {
          const offlineWorkout = await getOfflineWorkout(workoutId)
          if (offlineWorkout) {
            setWorkout(offlineWorkout.data)
            setExercises(offlineWorkout.exercises)
            setIsOfflineMode(true)
            if (offlineWorkout.exercises.length > 0) {
              setExpandedExerciseId(offlineWorkout.exercises[0].id)
            }
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error loading offline workout:', error)
        }
      }

      setWorkout(workoutData)
      setExercises(exerciseData || [])
      setIsOfflineMode(false)

      // Expand first exercise by default
      if (exerciseData && exerciseData.length > 0) {
        setExpandedExerciseId(exerciseData[0].id)
      }

      setIsLoading(false)
    }

    fetchWorkout()
  }, [workoutId, profile])

  // Fetch previous session logs and current session completed sets
  useEffect(() => {
    const fetchLogs = async () => {
      if (!profile || !workoutId || exercises.length === 0) return

      const supabase = createClient()

      // Get today's date at midnight for filtering current session
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Fetch logs from before today (previous sessions) for each exercise
      const prevLogsMap: Record<string, SetLog[]> = {}

      for (const exercise of exercises) {
        const { data } = await supabase
          .from('user_set_logs')
          .select('*')
          .eq('user_id', profile.id)
          .eq('exercise_id', exercise.id)
          .lt('completed_at', todayISO)
          .order('completed_at', { ascending: false })
          .limit(exercise.sets || 3)

        if (data && data.length > 0) {
          prevLogsMap[exercise.id] = data as SetLog[]
        }
      }

      setPreviousLogs(prevLogsMap)

      // Check if workout was already completed today
      const { data: workoutProgress } = await supabase
        .from('user_workout_progress')
        .select('id')
        .eq('user_id', profile.id)
        .eq('workout_id', workoutId)
        .gte('completed_at', todayISO)
        .limit(1)

      if (workoutProgress && workoutProgress.length > 0) {
        setWorkoutAlreadyCompleted(true)
      }

      // Fetch today's logs (current session)
      const { data: todayLogs } = await supabase
        .from('user_set_logs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('workout_id', workoutId)
        .gte('completed_at', todayISO)

      if (todayLogs && todayLogs.length > 0) {
        setSessionLogs(todayLogs as SetLog[])

        // Build completed sets map from today's logs
        const completed: Record<string, Set<number>> = {}
        for (const log of todayLogs) {
          if (!completed[log.exercise_id]) {
            completed[log.exercise_id] = new Set()
          }
          completed[log.exercise_id].add(log.set_number)
        }
        setCompletedSets(completed)
      }

      // Also check IndexedDB for any offline logs
      try {
        const offlineLogs = await getSetLogsForWorkout(workoutId)
        if (offlineLogs.length > 0) {
          const completed: Record<string, Set<number>> = { ...completedSets }
          for (const log of offlineLogs) {
            if (!completed[log.exercise_id]) {
              completed[log.exercise_id] = new Set()
            }
            completed[log.exercise_id].add(log.set_number)
          }
          setCompletedSets(completed)
        }
      } catch (error) {
        console.error('Error loading offline logs:', error)
      }
    }

    if (!isLoading) {
      fetchLogs()
    }
  }, [profile, workoutId, exercises, isLoading])

  // Sync pending logs when coming online
  useEffect(() => {
    window.addEventListener('online', syncPendingLogs)
    // Try to sync on mount if online
    syncPendingLogs()

    return () => {
      window.removeEventListener('online', syncPendingLogs)
    }
  }, [syncPendingLogs])

  const handleSetComplete = async (
    exerciseId: string,
    setNumber: number,
    weight: number | null,
    reps: number
  ) => {
    if (!profile) return

    const logId = crypto.randomUUID()
    const completedAt = new Date().toISOString()

    const newLog: SetLog = {
      id: logId,
      user_id: profile.id,
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight,
      reps,
      rpe: null,
      completed_at: completedAt,
      notes: null,
    }

    // Update UI immediately
    setCompletedSets((prev) => {
      const updated = { ...prev }
      if (!updated[exerciseId]) {
        updated[exerciseId] = new Set()
      }
      updated[exerciseId] = new Set(updated[exerciseId]).add(setNumber)
      return updated
    })

    setSessionLogs((prev) => [...prev, newLog])

    // Save to IndexedDB first (for offline support)
    try {
      await saveSetLog(newLog)
    } catch (error) {
      console.error('Error saving to IndexedDB:', error)
    }

    // If online, also save to Supabase
    if (navigator.onLine) {
      const supabase = createClient()
      const { error } = await supabase.from('user_set_logs').insert({
        id: logId,
        user_id: profile.id,
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_number: setNumber,
        weight,
        reps,
        rpe: null,
        completed_at: completedAt,
        notes: null,
      })

      if (error) {
        console.error('Error saving to Supabase:', error)
        setToast({
          message: 'Saved offline - will sync when connected',
          type: 'info',
          isOpen: true,
        })
      } else {
        // Mark as synced in IndexedDB
        await markSetLogSynced(logId)
      }
    } else {
      setToast({
        message: 'Saved offline - will sync when connected',
        type: 'info',
        isOpen: true,
      })
    }

    // Check if exercise is now complete, expand next exercise
    const exercise = exercises.find((e) => e.id === exerciseId)
    if (exercise) {
      const totalSets = exercise.sets || 3
      const completedCount = (completedSets[exerciseId]?.size || 0) + 1
      if (completedCount >= totalSets) {
        // Find next incomplete exercise
        const currentIndex = exercises.findIndex((e) => e.id === exerciseId)
        for (let i = currentIndex + 1; i < exercises.length; i++) {
          const nextExercise = exercises[i]
          const nextCompletedCount = completedSets[nextExercise.id]?.size || 0
          const nextTotalSets = nextExercise.sets || 3
          if (nextCompletedCount < nextTotalSets) {
            setExpandedExerciseId(nextExercise.id)
            break
          }
        }
      }
    }
  }

  const handleFinishWorkout = async () => {
    if (!profile || !workoutId || workoutAlreadyCompleted) return

    // Save workout completion
    if (navigator.onLine) {
      const supabase = createClient()
      await supabase.from('user_workout_progress').insert({
        user_id: profile.id,
        workout_id: workoutId,
        completed_at: new Date().toISOString(),
      })
    }

    setWorkoutAlreadyCompleted(true)

    setToast({
      message: 'Workout completed! Great job!',
      type: 'success',
      isOpen: true,
    })

    setTimeout(() => {
      router.push('/user/workouts')
    }, 1500)
  }

  // Calculate overall progress
  const calculateProgress = () => {
    let totalSets = 0
    let completedTotal = 0

    for (const exercise of exercises) {
      const sets = exercise.sets || 3
      totalSets += sets
      completedTotal += completedSets[exercise.id]?.size || 0
    }

    return totalSets > 0 ? Math.round((completedTotal / totalSets) * 100) : 0
  }

  const progress = calculateProgress()
  const isWorkoutComplete = progress === 100

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  if (!workout || exercises.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Workout not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-400 hover:text-accent mb-2"
        >
          ← Back to Workouts
        </button>
        <h1 className="text-3xl font-bold text-text-primary">{workout.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="info">Week {workout.week_number}</Badge>
          <Badge variant="default">Day {workout.day_number}</Badge>
          {isOfflineMode && (
            <Badge variant="warning" className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Workout Progress</span>
            <span className="font-bold text-accent">{progress}%</span>
          </div>
          <div className="h-3 bg-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-green-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exercises */}
      <div className="space-y-3">
        {exercises.map((exercise) => (
          <ExerciseLogger
            key={exercise.id}
            exercise={exercise}
            previousLogs={previousLogs[exercise.id]}
            completedSets={completedSets[exercise.id] || new Set()}
            onSetComplete={handleSetComplete}
            disabled={false}
            isExpanded={expandedExerciseId === exercise.id}
            onToggleExpand={() =>
              setExpandedExerciseId(
                expandedExerciseId === exercise.id ? null : exercise.id
              )
            }
          />
        ))}
      </div>

      {/* Finish button - fixed at bottom, respects sidebar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-gradient-to-t from-bg-main via-bg-main to-transparent z-10">
        <div className="max-w-2xl mx-auto px-2">
          {workoutAlreadyCompleted ? (
            <Button
              variant="outline"
              className="w-full py-4 text-lg font-bold border-green-500 text-green-500"
              disabled
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Already Completed Today
            </Button>
          ) : (
            <Button
              onClick={handleFinishWorkout}
              variant="primary"
              className="w-full py-4 text-lg font-bold"
              disabled={!isWorkoutComplete}
            >
              {isWorkoutComplete ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Finish Workout
                </>
              ) : (
                `Complete all sets to finish (${progress}%)`
              )}
            </Button>
          )}
        </div>
      </div>

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
