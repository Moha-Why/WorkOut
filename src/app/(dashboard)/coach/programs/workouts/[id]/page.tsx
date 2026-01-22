'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import type { Workout, Exercise, ExerciseSet } from '@/types'

interface SetConfig {
  set_number: number
  target_weight: string
  target_reps: string
  rest_seconds: string
}

interface ExerciseLibraryItem extends Exercise {
  id: string
  name: string
  video_provider: 'youtube' | 'vimeo' | 'custom'
  video_id: string
  target_muscles: string[]
  sets: number | null
  reps: string | null
}

export default function WorkoutEditorPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const params = useParams()
  const workoutId = params.id as string

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryItem[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [exerciseToRemove, setExerciseToRemove] = useState<{ id: string; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [exerciseSetsMap, setExerciseSetsMap] = useState<Record<string, SetConfig[]>>({})
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  useEffect(() => {
    if (profile && workoutId) {
      fetchWorkoutData()
      fetchExerciseLibrary()
    }
  }, [profile, workoutId])

  const fetchWorkoutData = async () => {
    if (!profile || !workoutId) return

    const supabase = createClient()

    // Fetch workout
    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*, programs!inner(*)')
      .eq('id', workoutId)
      .single()

    if (!workoutData) {
      setToast({ message: 'Workout not found', type: 'error', isOpen: true })
      router.push('/coach/programs')
      return
    }

    // Check if coach owns this program
    const program = (workoutData as any).programs
    if (program.created_by !== profile.id) {
      setToast({ message: 'Access denied', type: 'error', isOpen: true })
      router.push('/coach/programs')
      return
    }

    setWorkout(workoutData as Workout)

    // Fetch exercises
    const { data: exerciseData } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true })

    setExercises((exerciseData as Exercise[]) || [])

    // Fetch exercise_sets for all exercises
    if (exerciseData && exerciseData.length > 0) {
      const exerciseIds = exerciseData.map((e: any) => e.id)
      const { data: setsData } = await supabase
        .from('exercise_sets')
        .select('*')
        .in('exercise_id', exerciseIds)
        .order('set_number', { ascending: true })

      if (setsData && setsData.length > 0) {
        const setsMap: Record<string, SetConfig[]> = {}
        for (const set of setsData as any[]) {
          if (!setsMap[set.exercise_id]) {
            setsMap[set.exercise_id] = []
          }
          setsMap[set.exercise_id].push({
            set_number: set.set_number,
            target_weight: set.target_weight?.toString() || '',
            target_reps: set.target_reps?.toString() || '',
            rest_seconds: set.rest_seconds?.toString() || '60',
          })
        }
        setExerciseSetsMap(setsMap)
      } else {
        // Initialize with default sets based on exercise.sets
        const setsMap: Record<string, SetConfig[]> = {}
        for (const exercise of exerciseData as Exercise[]) {
          const numSets = exercise.sets || 3
          setsMap[exercise.id] = Array.from({ length: numSets }, (_, i) => ({
            set_number: i + 1,
            target_weight: '',
            target_reps: exercise.reps?.toString() || '',
            rest_seconds: exercise.rest_seconds?.toString() || '60',
          }))
        }
        setExerciseSetsMap(setsMap)
      }
    }

    setIsLoading(false)
  }

  const fetchExerciseLibrary = async () => {
    if (!profile) return

    const supabase = createClient()

    // Get coach's library workout ID
    const { data: libraryProgram } = await supabase
      .from('programs')
      .select('id')
      .eq('name', `Exercise Library - ${profile.id}`)
      .eq('created_by', profile.id)
      .single()

    if (!libraryProgram) {
      setExerciseLibrary([])
      return
    }

    const { data: libraryWorkout } = await supabase
      .from('workouts')
      .select('id')
      .eq('program_id', (libraryProgram as { id: string }).id)
      .eq('name', 'Exercise Library')
      .single()

    if (!libraryWorkout) {
      setExerciseLibrary([])
      return
    }

    // Fetch ONLY exercises from coach's library
    const { data } = await supabase
      .from('exercises')
      .select('id, name, video_provider, video_id, target_muscles, assisting_muscles, sets, reps, rest_seconds, notes')
      .eq('workout_id', (libraryWorkout as { id: string }).id)
      .order('name', { ascending: true })

    setExerciseLibrary((data as ExerciseLibraryItem[]) || [])
  }

  const handleAddExercise = async () => {
    if (!selectedExercise || !workoutId) {
      setToast({ message: 'Please select an exercise', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    // Get the selected exercise details
    const exercise = exerciseLibrary.find((ex) => ex.id === selectedExercise)
    if (!exercise) return

    // Get current max order_index
    const { data: existingExercises } = await supabase
      .from('exercises')
      .select('order_index')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex =
      existingExercises && existingExercises.length > 0
        ? (existingExercises[0] as { order_index: number }).order_index + 1
        : 0

    const { data: newExercise, error } = await supabase.from('exercises').insert({
      workout_id: workoutId,
      name: exercise.name,
      video_provider: exercise.video_provider,
      video_id: exercise.video_id,
      target_muscles: exercise.target_muscles,
      assisting_muscles: exercise.assisting_muscles || null,
      sets: exercise.sets,
      reps: exercise.reps,
      rest_seconds: exercise.rest_seconds || null,
      notes: exercise.notes || null,
      order_index: nextOrderIndex,
    } as never).select('id').single()

    if (error || !newExercise) {
      console.error('Error adding exercise:', error)
      setToast({ message: 'Error adding exercise', type: 'error', isOpen: true })
      return
    }

    // Copy exercise_sets from library exercise to new workout exercise
    const { data: librarySets } = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('exercise_id', selectedExercise)
      .order('set_number', { ascending: true })

    if (librarySets && librarySets.length > 0) {
      const newSets = librarySets.map((set: any) => ({
        exercise_id: (newExercise as any).id,
        set_number: set.set_number,
        target_weight: set.target_weight,
        target_reps: set.target_reps,
        rest_seconds: set.rest_seconds,
      }))

      await supabase.from('exercise_sets').insert(newSets as any)
    }

    setToast({ message: 'Exercise added successfully', type: 'success', isOpen: true })
    setShowAddExerciseModal(false)
    setSelectedExercise(null)
    setSearchQuery('')
    await fetchWorkoutData()
  }

  const handleRemoveExercise = async () => {
    if (!exerciseToRemove) return

    const supabase = createClient()

    const { error } = await supabase.from('exercises').delete().eq('id', exerciseToRemove.id)

    if (error) {
      console.error('Error removing exercise:', error)
      setToast({ message: 'Error removing exercise', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Exercise removed successfully', type: 'success', isOpen: true })
    setExerciseToRemove(null)
    await fetchWorkoutData()
  }

  const handleMoveExercise = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === exercises.length - 1)
    ) {
      return
    }

    const newExercises = [...exercises]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    // Swap exercises
    ;[newExercises[index], newExercises[targetIndex]] = [
      newExercises[targetIndex],
      newExercises[index],
    ]

    // Update order_index for both
    const supabase = createClient()

    await Promise.all([
      supabase
        .from('exercises')
        .update({ order_index: targetIndex } as never)
        .eq('id', newExercises[targetIndex].id),
      supabase
        .from('exercises')
        .update({ order_index: index } as never)
        .eq('id', newExercises[index].id),
    ])

    setExercises(newExercises)
  }

  // Update a specific set's config
  const handleSetConfigChange = (
    exerciseId: string,
    setIndex: number,
    field: 'target_weight' | 'target_reps' | 'rest_seconds',
    value: string
  ) => {
    setExerciseSetsMap((prev) => {
      const sets = [...(prev[exerciseId] || [])]
      if (sets[setIndex]) {
        sets[setIndex] = { ...sets[setIndex], [field]: value }
      }
      return { ...prev, [exerciseId]: sets }
    })
  }

  // Add a new set to an exercise
  const handleAddSet = (exerciseId: string) => {
    setExerciseSetsMap((prev) => {
      const sets = [...(prev[exerciseId] || [])]
      const lastSet = sets[sets.length - 1]
      sets.push({
        set_number: sets.length + 1,
        target_weight: lastSet?.target_weight || '',
        target_reps: lastSet?.target_reps || '',
        rest_seconds: lastSet?.rest_seconds || '60',
      })
      return { ...prev, [exerciseId]: sets }
    })
  }

  // Remove a set from an exercise
  const handleRemoveSet = (exerciseId: string, setIndex: number) => {
    setExerciseSetsMap((prev) => {
      const sets = prev[exerciseId]?.filter((_, i) => i !== setIndex).map((s, i) => ({
        ...s,
        set_number: i + 1,
      })) || []
      return { ...prev, [exerciseId]: sets }
    })
  }

  // Save exercise sets to database
  const handleSaveExerciseSets = async (exerciseId: string) => {
    const supabase = createClient()
    const sets = exerciseSetsMap[exerciseId] || []

    // Delete existing sets
    await supabase.from('exercise_sets').delete().eq('exercise_id', exerciseId)

    // Insert new sets
    if (sets.length > 0) {
      const setData = sets.map((config) => ({
        exercise_id: exerciseId,
        set_number: config.set_number,
        target_weight: config.target_weight ? parseFloat(config.target_weight) : null,
        target_reps: config.target_reps ? parseInt(config.target_reps) : null,
        rest_seconds: config.rest_seconds ? parseInt(config.rest_seconds) : null,
      }))

      const { error } = await supabase.from('exercise_sets').insert(setData as any)

      if (error) {
        console.error('Error saving exercise sets:', error)
        setToast({ message: 'Error saving sets', type: 'error', isOpen: true })
        return
      }

      // Also update the exercise's sets count
      await supabase
        .from('exercises')
        .update({
          sets: sets.length,
          reps: sets[0]?.target_reps || null,
          rest_seconds: sets[0]?.rest_seconds ? parseInt(sets[0].rest_seconds) : null,
        } as never)
        .eq('id', exerciseId)

      // Update local exercises state
      setExercises(
        exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: sets.length,
                reps: sets[0]?.target_reps || null,
                rest_seconds: sets[0]?.rest_seconds ? parseInt(sets[0].rest_seconds) : null,
              }
            : ex
        )
      )
    }

    setToast({ message: 'Sets saved successfully', type: 'success', isOpen: true })
    setExpandedExerciseId(null)
  }

  // Copy first set values to all sets
  const handleCopyToAllSets = (exerciseId: string) => {
    setExerciseSetsMap((prev) => {
      const sets = prev[exerciseId] || []
      if (sets.length === 0) return prev
      const firstSet = sets[0]
      return {
        ...prev,
        [exerciseId]: sets.map((s) => ({
          ...s,
          target_weight: firstSet.target_weight,
          target_reps: firstSet.target_reps,
          rest_seconds: firstSet.rest_seconds,
        })),
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  if (!workout) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-400 mb-4">Workout not found</p>
          <Button onClick={() => router.push('/coach/programs')}>
            Go to Programs
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="self-start"
          >
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{workout.name}</h1>
            <p className="text-gray-400 mt-1">
              Week {workout.week_number}, Day {workout.day_number}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddExerciseModal(true)}
          className="self-start sm:self-auto"
        >
          Add Exercise
        </Button>
      </div>

      {/* Exercises List */}
      {exercises.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">No exercises yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Add exercises from your library to build this workout
            </p>
            <Button onClick={() => setShowAddExerciseModal(true)}>
              Add First Exercise
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise, index) => {
            const isExpanded = expandedExerciseId === exercise.id
            const sets = exerciseSetsMap[exercise.id] || []

            return (
              <Card key={exercise.id}>
                <CardContent className="py-4">
                  {/* Exercise Header */}
                  <div className="flex items-center gap-3">
                    {/* Order Controls */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveExercise(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed text-text-primary"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <span className="text-sm font-bold text-gray-400 text-center">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => handleMoveExercise(index, 'down')}
                        disabled={index === exercises.length - 1}
                        className="p-1 hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed text-text-primary"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Exercise Details - Clickable to expand */}
                    <button
                      onClick={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <h3 className="font-semibold text-text-primary truncate">
                        {exercise.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {sets.length} sets
                        {sets[0]?.target_reps && ` × ${sets[0].target_reps} reps`}
                        {sets[0]?.rest_seconds && ` • ${sets[0].rest_seconds}s rest`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {exercise.target_muscles.map((muscle) => (
                          <Badge key={muscle} variant="info" className="text-xs">
                            {muscle}
                          </Badge>
                        ))}
                      </div>
                    </button>

                    {/* Expand/Collapse Icon */}
                    <button
                      onClick={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                      className="p-2 hover:bg-bg-hover rounded text-gray-400"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Remove Button */}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setExerciseToRemove({ id: exercise.id, name: exercise.name })
                        setShowRemoveConfirm(true)
                      }}
                      className="shrink-0"
                    >
                      Remove
                    </Button>
                  </div>

                  {/* Expanded Per-Set Configuration */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {/* Sets Configuration */}
                      <div className="space-y-3">
                        {sets.map((config, setIndex) => (
                          <div key={setIndex} className="flex items-center gap-3 p-3 bg-bg-hover rounded-lg">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-main text-sm font-bold text-text-primary shrink-0">
                              {config.set_number}
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-1.5 sm:gap-2">
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Weight</label>
                                <input
                                  type="number"
                                  value={config.target_weight}
                                  onChange={(e) => handleSetConfigChange(exercise.id, setIndex, 'target_weight', e.target.value)}
                                  className="w-full px-1.5 sm:px-2 py-1.5 text-sm border border-border bg-bg-main text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                                  placeholder="kg"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Reps</label>
                                <input
                                  type="number"
                                  value={config.target_reps}
                                  onChange={(e) => handleSetConfigChange(exercise.id, setIndex, 'target_reps', e.target.value)}
                                  className="w-full px-1.5 sm:px-2 py-1.5 text-sm border border-border bg-bg-main text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                                  placeholder="reps"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Rest</label>
                                <input
                                  type="number"
                                  value={config.rest_seconds}
                                  onChange={(e) => handleSetConfigChange(exercise.id, setIndex, 'rest_seconds', e.target.value)}
                                  className="w-full px-1.5 sm:px-2 py-1.5 text-sm border border-border bg-bg-main text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                                  placeholder="sec"
                                />
                              </div>
                            </div>
                            {sets.length > 1 && (
                              <button
                                onClick={() => handleRemoveSet(exercise.id, setIndex)}
                                className="text-red-500 hover:text-red-700 p-2 shrink-0"
                                title="Remove set"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSet(exercise.id)}
                        >
                          + Add Set
                        </Button>
                        {sets.length > 1 && (
                          <button
                            onClick={() => handleCopyToAllSets(exercise.id)}
                            className="text-sm text-accent hover:underline"
                          >
                            Copy Set 1 to all
                          </button>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedExerciseId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveExerciseSets(exercise.id)}
                        >
                          Save Sets
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="space-y-4">
              <CardTitle>Add Exercise from Library</CardTitle>
              {/* Search Input */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border bg-bg-hover text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-gray-500"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-text-primary"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-4">
              <div className="space-y-2">
                {exerciseLibrary.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">
                    No exercises in library. Create exercises in the "تماريني" page
                    first.
                  </p>
                ) : (
                  (() => {
                    const filteredExercises = exerciseLibrary.filter((exercise) => {
                      const query = searchQuery.toLowerCase().trim()
                      if (!query) return true
                      return (
                        exercise.name.toLowerCase().includes(query) ||
                        exercise.target_muscles.some((muscle) =>
                          muscle.toLowerCase().includes(query)
                        )
                      )
                    })

                    if (filteredExercises.length === 0) {
                      return (
                        <p className="text-center text-gray-400 py-8">
                          No exercises match "{searchQuery}"
                        </p>
                      )
                    }

                    return filteredExercises.map((exercise) => (
                      <div
                        key={exercise.id}
                        onClick={() => setSelectedExercise(exercise.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedExercise === exercise.id
                            ? 'border-accent bg-bg-hover'
                            : 'border-border hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-text-primary truncate">
                              {exercise.name}
                            </h4>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {exercise.target_muscles.map((muscle) => (
                                <Badge key={muscle} variant="default" className="text-xs">
                                  {muscle}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-sm text-gray-400 shrink-0">
                            {exercise.sets && <span>{exercise.sets} sets</span>}
                            {exercise.reps && <span>{exercise.reps} reps</span>}
                            {exercise.rest_seconds && <span>{exercise.rest_seconds}s rest</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  })()
                )}
              </div>
            </CardContent>
            <div className="border-t p-4 bg-bg-secondary">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddExerciseModal(false)
                    setSelectedExercise(null)
                    setSearchQuery('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExercise}
                  disabled={!selectedExercise}
                  className="flex-1"
                >
                  Add Exercise
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Remove Exercise Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false)
          setExerciseToRemove(null)
        }}
        onConfirm={handleRemoveExercise}
        title="Remove Exercise"
        message={`Are you sure you want to remove "${exerciseToRemove?.name}" from this workout? This action cannot be undone.`}
        confirmText="Remove Exercise"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  )
}
