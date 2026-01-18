'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useWorkoutPlayer } from '@/hooks/useWorkoutPlayer'
import { createClient } from '@/lib/supabase/client'
import { Exercise, Workout } from '@/types'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getWorkout as getOfflineWorkout } from '@/lib/offline/db'
import { Card, CardContent } from '@/components/ui/Card'

export default function WorkoutPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const workoutId = params.id as string

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [workoutCompletedThisSession, setWorkoutCompletedThisSession] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  const {
    currentExercise,
    currentIndex,
    restTimer,
    isResting,
    progress,
    totalExercises,
    nextExercise,
    previousExercise,
    completeExercise,
    skipRest,
  } = useWorkoutPlayer({
    exercises,
    onComplete: handleExerciseComplete,
    onWorkoutComplete: handleWorkoutComplete,
  })

  useEffect(() => {
    const fetchWorkout = async () => {
      if (!workoutId || !profile) return

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true

      // Try to load from offline cache first if offline
      if (!online) {
        try {
          const offlineWorkout = await getOfflineWorkout(workoutId)
          if (offlineWorkout) {
            setWorkout(offlineWorkout.data)
            setExercises(offlineWorkout.exercises)
            setIsOfflineMode(true)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error loading offline workout:', error)
        }
      }

      // Online: fetch from database
      const supabase = createClient()

      // Fetch workout with exercises
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

      // If online fetch fails, try offline cache as fallback
      if ((workoutError || exerciseError) && !workoutData) {
        try {
          const offlineWorkout = await getOfflineWorkout(workoutId)
          if (offlineWorkout) {
            setWorkout(offlineWorkout.data)
            setExercises(offlineWorkout.exercises)
            setIsOfflineMode(true)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error loading offline workout:', error)
        }
      }

      // Check if workout was already completed today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      const { data: completionToday } = await supabase
        .from('user_workout_progress')
        .select('id')
        .eq('user_id', profile.id)
        .eq('workout_id', workoutId)
        .gte('completed_at', todayISO)
        .limit(1)

      if (completionToday && completionToday.length > 0) {
        setWorkoutCompletedThisSession(true)
      }

      setWorkout(workoutData)
      setExercises(exerciseData || [])
      setIsOfflineMode(false)
      setIsLoading(false)
    }

    fetchWorkout()
  }, [workoutId, profile])

  async function handleExerciseComplete(exerciseId: string) {
    if (!profile) return

    // Add to completed set
    setCompletedExercises(prev => new Set(prev).add(exerciseId))

    // Don't save progress in offline mode
    if (isOfflineMode) return

    const supabase = createClient()
    const completedAt = new Date().toISOString()

    try {
      await supabase
        .from('user_exercise_progress')
        .insert({
          user_id: profile.id,
          exercise_id: exerciseId,
          completed_at: completedAt,
        } as never)
    } catch (err) {
      console.error('Failed to save progress:', err)
    }
  }

  async function handleWorkoutComplete() {
    if (!profile || !workoutId || workoutCompletedThisSession) return

    // Mark as completed in this session to prevent duplicate submissions
    setWorkoutCompletedThisSession(true)

    // Don't save progress in offline mode
    if (isOfflineMode) return

    const supabase = createClient()
    const completedAt = new Date().toISOString()

    try {
      await supabase
        .from('user_workout_progress')
        .insert({
          user_id: profile.id,
          workout_id: workoutId,
          completed_at: completedAt,
        } as never)
    } catch (err) {
      console.error('Failed to save progress:', err)
    }

    // Navigate back after a short delay
    setTimeout(() => {
      router.push('/user/workouts')
    }, 500)
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
    <div className="max-w-4xl mx-auto space-y-6">
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
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">
            Exercise {currentIndex + 1} of {totalExercises}
          </span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rest timer */}
      {isResting && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="py-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Rest Time</p>
              <p className="text-5xl font-bold text-orange-600 mb-4">
                {restTimer}s
              </p>
              <Button
                onClick={skipRest}
                className="border-2 border-orange-600 bg-white text-orange-600 hover:bg-orange-100"
              >
                Skip Rest
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current exercise */}
      {currentExercise && !isResting && (
        <>
          {/* Video */}
          <VideoPlayer
            provider={currentExercise.video_provider}
            videoId={currentExercise.video_id}
            className="mb-6"
          />

          {/* Exercise details */}
          <Card>
            <CardContent className="py-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  {currentExercise.name}
                </h2>
                {currentExercise.notes && (
                  <p className="text-gray-400">{currentExercise.notes}</p>
                )}
              </div>

              {/* Sets, Reps, Rest */}
              <div className="flex gap-6">
                {currentExercise.sets && (
                  <div>
                    <p className="text-sm text-gray-400">Sets</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {currentExercise.sets}
                    </p>
                  </div>
                )}
                {currentExercise.reps && (
                  <div>
                    <p className="text-sm text-gray-400">Reps</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {currentExercise.reps}
                    </p>
                  </div>
                )}
                {currentExercise.rest_seconds && (
                  <div>
                    <p className="text-sm text-gray-400">Rest</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {currentExercise.rest_seconds}s
                    </p>
                  </div>
                )}
              </div>

              {/* Muscle visualization */}
              <div className="pt-4 border-t">
                <MuscleModel
                  targetMuscles={currentExercise.target_muscles}
                  assistingMuscles={currentExercise.assisting_muscles || []}
                  view="both"
                />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          {workoutCompletedThisSession ? (
            <Button
              variant="outline"
              disabled
              className="w-full"
            >
              Already Completed Today ✓
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Navigation buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={previousExercise}
                  variant="outline"
                  disabled={currentIndex === 0}
                  className="flex-1"
                >
                  ← Previous
                </Button>
                <Button
                  onClick={nextExercise}
                  variant="outline"
                  disabled={currentIndex === totalExercises - 1}
                  className="flex-1"
                >
                  Next →
                </Button>
              </div>

              {/* Complete button */}
              <Button
                onClick={completeExercise}
                variant="primary"
                className="w-full"
                disabled={isOfflineMode}
              >
                {isOfflineMode
                  ? 'Go online to complete'
                  : currentIndex === totalExercises - 1
                  ? 'Complete Exercise & Finish Workout ✓'
                  : 'Complete Exercise ✓'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Exercise list */}
      <Card>
        <CardContent className="py-6">
          <h3 className="font-bold text-text-primary mb-4">Exercises</h3>
          <div className="space-y-2">
            {exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  index === currentIndex
                    ? 'bg-black text-white'
                    : completedExercises.has(exercise.id)
                    ? 'bg-green-50 text-green-900'
                    : 'bg-bg-hover text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{index + 1}.</span>
                  <span>{exercise.name}</span>
                </div>
                {completedExercises.has(exercise.id) && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-success"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
