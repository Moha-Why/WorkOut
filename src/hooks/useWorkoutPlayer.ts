'use client'

import { useState, useCallback, useEffect } from 'react'
import { Exercise } from '@/types'
import { WorkoutPlayerState } from '@/types'

interface UseWorkoutPlayerProps {
  exercises: Exercise[]
  onComplete?: (exerciseId: string) => void
  onWorkoutComplete?: () => void
}

export function useWorkoutPlayer({
  exercises,
  onComplete,
  onWorkoutComplete,
}: UseWorkoutPlayerProps) {
  const [state, setState] = useState<WorkoutPlayerState>({
    current_exercise_index: 0,
    is_playing: false,
    is_paused: false,
    rest_timer: null,
  })

  const currentExercise = exercises[state.current_exercise_index]
  const isLastExercise = state.current_exercise_index === exercises.length - 1
  const progress = ((state.current_exercise_index + 1) / exercises.length) * 100

  // Move to next exercise
  const nextExercise = useCallback(() => {
    if (isLastExercise) {
      // Workout completed
      setState((prev) => ({
        ...prev,
        is_playing: false,
        is_paused: false,
      }))
      onWorkoutComplete?.()
    } else {
      setState((prev) => ({
        ...prev,
        current_exercise_index: prev.current_exercise_index + 1,
        rest_timer: currentExercise.rest_seconds || null,
      }))
    }
  }, [isLastExercise, currentExercise, onWorkoutComplete])

  // Move to previous exercise
  const previousExercise = useCallback(() => {
    if (state.current_exercise_index > 0) {
      setState((prev) => ({
        ...prev,
        current_exercise_index: prev.current_exercise_index - 1,
        rest_timer: null,
      }))
    }
  }, [state.current_exercise_index])

  // Go to specific exercise
  const goToExercise = useCallback((index: number) => {
    if (index >= 0 && index < exercises.length) {
      setState((prev) => ({
        ...prev,
        current_exercise_index: index,
        rest_timer: null,
      }))
    }
  }, [exercises.length])

  // Mark current exercise as complete
  const completeExercise = useCallback(() => {
    if (currentExercise) {
      onComplete?.(currentExercise.id)
      nextExercise()
    }
  }, [currentExercise, onComplete, nextExercise])

  // Skip rest timer
  const skipRest = useCallback(() => {
    setState((prev) => ({ ...prev, rest_timer: null }))
  }, [])

  // Start/pause workout
  const togglePlayPause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      is_playing: !prev.is_playing,
      is_paused: prev.is_playing,
    }))
  }, [])

  // Reset workout
  const reset = useCallback(() => {
    setState({
      current_exercise_index: 0,
      is_playing: false,
      is_paused: false,
      rest_timer: null,
    })
  }, [])

  // Rest timer countdown
  useEffect(() => {
    if (state.rest_timer === null || state.rest_timer <= 0) {
      return
    }

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.rest_timer === null || prev.rest_timer <= 0) {
          return prev
        }
        return {
          ...prev,
          rest_timer: prev.rest_timer - 1,
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state.rest_timer])

  return {
    currentExercise,
    currentIndex: state.current_exercise_index,
    isPlaying: state.is_playing,
    isPaused: state.is_paused,
    restTimer: state.rest_timer,
    isResting: state.rest_timer !== null && state.rest_timer > 0,
    isLastExercise,
    progress,
    totalExercises: exercises.length,
    nextExercise,
    previousExercise,
    goToExercise,
    completeExercise,
    skipRest,
    togglePlayPause,
    reset,
  }
}
