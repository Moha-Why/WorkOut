'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Exercise, Workout, SetLog, ExerciseSet } from '@/types'
import { ExerciseLogger } from '@/components/workouts/ExerciseLogger'
import { SupersetLogger } from '@/components/workouts/SupersetLogger'
import { SetLogger } from '@/components/workouts/SetLogger'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
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
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set())
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

  // Exercise set configurations
  const [exerciseSetsMap, setExerciseSetsMap] = useState<Record<string, ExerciseSet[]>>({})

  // Track if workout was already completed today
  const [workoutAlreadyCompleted, setWorkoutAlreadyCompleted] = useState(false)

  // Rest timer state (at page level so it's always visible)
  const [isResting, setIsResting] = useState(false)
  const [restTimeLeft, setRestTimeLeft] = useState(0)


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
        } as any)

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
            // Expand all exercises by default
            if (offlineWorkout.exercises.length > 0) {
              setExpandedExerciseIds(new Set(offlineWorkout.exercises.map(e => e.id)))
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
              setExpandedExerciseIds(new Set(offlineWorkout.exercises.map(e => e.id)))
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

      // Fetch exercise sets for all exercises
      if (exerciseData && exerciseData.length > 0) {
        const exerciseIds = exerciseData.map((e: any) => e.id)
        const { data: setsData } = await supabase
          .from('exercise_sets')
          .select('*')
          .in('exercise_id', exerciseIds)
          .order('set_number', { ascending: true })

        if (setsData) {
          const setsMap: Record<string, ExerciseSet[]> = {}
          for (const set of setsData as any[]) {
            if (!setsMap[set.exercise_id]) {
              setsMap[set.exercise_id] = []
            }
            setsMap[set.exercise_id].push(set as ExerciseSet)
          }
          setExerciseSetsMap(setsMap)
        }

        // Expand all exercises by default
        setExpandedExerciseIds(new Set(exerciseData.map((e: any) => e.id)))
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
        for (const log of todayLogs as any[]) {
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

  // Rest timer countdown
  useEffect(() => {
    if (!isResting) return

    if (restTimeLeft <= 0) {
      setIsResting(false)
      return
    }

    const timer = setInterval(() => {
      setRestTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isResting, restTimeLeft])

  const handleSetComplete = async (
    exerciseId: string,
    setNumber: number,
    weight: number | null,
    reps: number,
    restSeconds: number,
    isLastInSuperset: boolean = true
  ) => {
    if (!profile) return

    // Start rest timer only if this is the last exercise in a superset (or a normal exercise)
    if (restSeconds > 0 && isLastInSuperset) {
      setIsResting(true)
      setRestTimeLeft(restSeconds)
    }

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
      } as any)

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
      } as any)
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
      const sets = exerciseSetsMap[exercise.id]?.length || exercise.sets || 3
      totalSets += sets
      completedTotal += completedSets[exercise.id]?.size || 0
    }

    return totalSets > 0 ? Math.round((completedTotal / totalSets) * 100) : 0
  }

  const progress = calculateProgress()
  const isWorkoutComplete = progress === 100

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate set score (reps × weight) and return color based on range
  const getSetScore = (weight: number | null, reps: number | null) => {
    if (!weight || !reps) return null

    const score = Math.round(weight * reps)

    // Score ranges with colors (from lowest to highest intensity)
    // 0-100: Light - Gray
    // 101-200: Easy - Blue
    // 201-350: Moderate - Green
    // 351-500: Challenging - Yellow
    // 501-700: Heavy - Orange
    // 701+: Intense - Red

    let color: string
    let label: string

    if (score <= 100) {
      color = 'text-white bg-gray-500'
      label = 'Light'
    } else if (score <= 200) {
      color = 'text-white bg-blue-500'
      label = 'Easy'
    } else if (score <= 350) {
      color = 'text-white bg-green-500'
      label = 'Moderate'
    } else if (score <= 500) {
      color = 'text-black bg-yellow-400'
      label = 'Challenging'
    } else if (score <= 700) {
      color = 'text-white bg-orange-500'
      label = 'Heavy'
    } else {
      color = 'text-white bg-red-500'
      label = 'Intense'
    }

    return { score, color, label }
  }

  // Get info about which sets are in supersets with other exercises
  const getSupersetInfo = (exerciseId: string, setNumber: number) => {
    const setConfig = exerciseSetsMap[exerciseId]?.find(s => s.set_number === setNumber)
    if (!setConfig?.superset_group) return null

    // Find other sets in this superset
    const otherSets: Array<{ exercise: Exercise, setNumber: number }> = []

    exercises.forEach(ex => {
      const exSets = exerciseSetsMap[ex.id] || []
      exSets.forEach(s => {
        if (s.superset_group === setConfig.superset_group &&
            !(ex.id === exerciseId && s.set_number === setNumber)) {
          otherSets.push({ exercise: ex, setNumber: s.set_number })
        }
      })
    })

    return {
      supersetGroup: setConfig.superset_group,
      supersetOrder: setConfig.superset_order || 0,
      otherSets,
      isLast: setConfig.superset_order === Math.max(...otherSets.map(os =>
        exerciseSetsMap[os.exercise.id]?.find(s => s.set_number === os.setNumber)?.superset_order || 0
      ), setConfig.superset_order || 0)
    }
  }

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
        {exercises.map(exercise => {
          const exerciseSetsForLogger = exerciseSetsMap[exercise.id] || []
          const completedSetsSet = completedSets[exercise.id] || new Set()
          const setCount = exerciseSetsForLogger.length || exercise.sets || 3

          return (
            <Card
              key={exercise.id}
              className={cn(
                'transition-all overflow-hidden',
                completedSetsSet.size === setCount && 'border-green-500/30 bg-green-500/5'
              )}
            >
              {/* Exercise Header */}
              <button
                onClick={() => {
                  setExpandedExerciseIds(prev => {
                    const next = new Set(prev)
                    if (next.has(exercise.id)) {
                      next.delete(exercise.id)
                    } else {
                      next.add(exercise.id)
                    }
                    return next
                  })
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                      completedSetsSet.size === setCount
                        ? 'bg-green-500 text-white'
                        : completedSetsSet.size > 0
                        ? 'bg-accent/20 text-accent'
                        : 'bg-bg-hover text-text-primary'
                    )}
                  >
                    {completedSetsSet.size === setCount ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      `${completedSetsSet.size}/${setCount}`
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">{exercise.name}</h3>
                    <p className="text-sm text-gray-500">
                      {setCount} sets × {exerciseSetsForLogger[0]?.target_reps || exercise.reps || '?'} reps
                    </p>
                  </div>
                </div>
                <svg
                  className={cn(
                    'w-5 h-5 text-gray-400 transition-transform',
                    expandedExerciseIds.has(exercise.id) && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content */}
              {expandedExerciseIds.has(exercise.id) && (
                <CardContent className="pt-0 pb-4 space-y-3">
                  {/* All sets */}
                  {Array.from({ length: setCount }, (_, i) => i + 1).map((setNum) => {
                    const setConfig = exerciseSetsForLogger.find(s => s.set_number === setNum)
                    const isCompleted = completedSetsSet.has(setNum)
                    const previousLog = previousLogs[exercise.id]?.find(log => log.set_number === setNum)
                    const supersetInfo = getSupersetInfo(exercise.id, setNum)

                    return (
                      <div key={setNum} className="space-y-2">
                        {/* Show superset badge if this set is in a superset */}
                        {supersetInfo && supersetInfo.otherSets.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <Badge variant="info" className="text-xs">SUPERSET</Badge>
                            <span className="text-xs text-gray-400">
                              with {supersetInfo.otherSets.map(os => `${os.exercise.name} Set ${os.setNumber}`).join(', ')}
                            </span>
                          </div>
                        )}

                        {!isCompleted && (() => {
                          const targetWeight = setConfig?.target_weight || null
                          const targetReps = setConfig?.target_reps || (exercise.reps ? Number(exercise.reps) : null)
                          const targetScore = getSetScore(targetWeight, targetReps)

                          return (
                            <div className="space-y-2">
                              {/* Target score indicator */}
                              {targetScore && (
                                <div className={cn('inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium', targetScore.color)}>
                                  <span>Target: {targetScore.score}</span>
                                  <span className="opacity-70">({targetScore.label})</span>
                                </div>
                              )}
                              <SetLogger
                                setNumber={setNum}
                                targetReps={targetReps}
                                targetWeight={targetWeight}
                                previousWeight={previousLog?.weight || undefined}
                                previousReps={previousLog?.reps || undefined}
                                isCompleted={isCompleted}
                                onComplete={(weight, reps) => {
                                  const restSeconds = setConfig?.rest_seconds || exercise.rest_seconds || 60
                                  const isLastInSuperset = supersetInfo ? supersetInfo.isLast : true
                                  handleSetComplete(exercise.id, setNum, weight, reps, restSeconds, isLastInSuperset)
                                }}
                                disabled={false}
                              />
                            </div>
                          )
                        })()}

                        {isCompleted && (() => {
                          // Get the logged data for this completed set
                          const completedLog = sessionLogs.find(
                            log => log.exercise_id === exercise.id && log.set_number === setNum
                          )
                          const completedScore = getSetScore(completedLog?.weight || null, completedLog?.reps || null)

                          return (
                            <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 rounded-lg">
                              <div className="flex items-center gap-2 text-sm text-green-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Set {setNum}: {completedLog?.weight}kg × {completedLog?.reps} reps</span>
                              </div>
                              {completedScore && (
                                <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold', completedScore.color)}>
                                  <span>{completedScore.score}</span>
                                  <span className="opacity-70">({completedScore.label})</span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}

                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Finish button / Rest Timer - fixed at bottom, respects sidebar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-gradient-to-t from-bg-main via-bg-main to-transparent z-10">
        <div className="max-w-2xl mx-auto px-2">
          {isResting ? (
            <div className="bg-orange-500 text-white p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm opacity-90">Rest Time</p>
                <p className="text-3xl font-bold tabular-nums">{formatTime(restTimeLeft)}</p>
              </div>
              <Button
                onClick={() => setIsResting(false)}
                variant="outline"
                className="border-white text-white hover:bg-white/20"
              >
                Skip
              </Button>
            </div>
          ) : workoutAlreadyCompleted ? (
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
