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
import type { Workout, Exercise } from '@/types'

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

    const { error } = await supabase.from('exercises').insert({
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
    } as never)

    if (error) {
      console.error('Error adding exercise:', error)
      setToast({ message: 'Error adding exercise', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Exercise added successfully', type: 'success', isOpen: true })
    setShowAddExerciseModal(false)
    setSelectedExercise(null)
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

  const handleEditExercise = async (
    exerciseId: string,
    field: 'sets' | 'reps' | 'rest_seconds',
    value: string
  ) => {
    const supabase = createClient()

    let updateValue: number | string | null = value

    if (field === 'sets' || field === 'rest_seconds') {
      updateValue = value ? parseInt(value) : null
    } else if (field === 'reps') {
      updateValue = value || null
    }

    const { error } = await supabase
      .from('exercises')
      .update({ [field]: updateValue } as never)
      .eq('id', exerciseId)

    if (error) {
      console.error('Error updating exercise:', error)
      setToast({ message: 'Error updating exercise', type: 'error', isOpen: true })
      return
    }

    // Update local state
    setExercises(
      exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, [field]: updateValue } : ex
      )
    )
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
          {exercises.map((exercise, index) => (
            <Card key={exercise.id}>
              <CardContent className="py-4">
                {/* Mobile Layout */}
                <div className="flex flex-col gap-4 md:hidden">
                  {/* Header with order and name */}
                  <div className="flex items-start gap-3">
                    {/* Order Controls */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveExercise(index, 'up')}
                        disabled={index === 0}
                        className="p-2 hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed text-text-primary"
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
                        className="p-2 hover:bg-bg-hover rounded disabled:opacity-30 disabled:cursor-not-allowed text-text-primary"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Exercise Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary wrap-break-word">
                        {exercise.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {exercise.target_muscles.map((muscle) => (
                          <Badge key={muscle} variant="info" className="text-xs">
                            {muscle}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Exercise Parameters - Mobile */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Sets
                      </label>
                      <input
                        type="number"
                        value={exercise.sets || ''}
                        onChange={(e) =>
                          handleEditExercise(exercise.id, 'sets', e.target.value)
                        }
                        className="w-full px-3 py-2 text-sm border border-border bg-bg-hover text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Reps
                      </label>
                      <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={(e) =>
                          handleEditExercise(exercise.id, 'reps', e.target.value)
                        }
                        className="w-full px-3 py-2 text-sm border border-border bg-bg-hover text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="8-12"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        Rest (s)
                      </label>
                      <input
                        type="number"
                        value={exercise.rest_seconds || ''}
                        onChange={(e) =>
                          handleEditExercise(
                            exercise.id,
                            'rest_seconds',
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-border bg-bg-hover text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Remove Button - Mobile */}
                  <Button
                    variant="danger"
                    onClick={() => {
                      setExerciseToRemove({ id: exercise.id, name: exercise.name })
                      setShowRemoveConfirm(true)
                    }}
                    className="w-full"
                  >
                    Remove Exercise
                  </Button>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:flex items-center gap-4">
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

                  {/* Exercise Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">
                      {exercise.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {exercise.target_muscles.map((muscle) => (
                        <Badge key={muscle} variant="info" className="text-xs">
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Exercise Parameters */}
                  <div className="flex gap-3 shrink-0">
                    <div className="w-20">
                      <label className="text-xs text-gray-400 block mb-1">
                        Sets
                      </label>
                      <input
                        type="number"
                        value={exercise.sets || ''}
                        onChange={(e) =>
                          handleEditExercise(exercise.id, 'sets', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-border bg-bg-hover text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                        min="1"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-gray-400 block mb-1">
                        Reps
                      </label>
                      <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={(e) =>
                          handleEditExercise(exercise.id, 'reps', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-border bg-bg-hover text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder="8-12"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs text-gray-400 block mb-1">
                        Rest (s)
                      </label>
                      <input
                        type="number"
                        value={exercise.rest_seconds || ''}
                        onChange={(e) =>
                          handleEditExercise(
                            exercise.id,
                            'rest_seconds',
                            e.target.value
                          )
                        }
                        className="w-full px-2 py-1 text-sm border border-border bg-bg-hover text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-accent"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setExerciseToRemove({ id: exercise.id, name: exercise.name })
                        setShowRemoveConfirm(true)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle>Add Exercise from Library</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-4">
              <div className="space-y-2">
                {exerciseLibrary.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">
                    No exercises in library. Create exercises in the "تماريني" page
                    first.
                  </p>
                ) : (
                  exerciseLibrary.map((exercise) => (
                    <div
                      key={exercise.id}
                      onClick={() => setSelectedExercise(exercise.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedExercise === exercise.id
                          ? 'border-black bg-bg-hover'
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
