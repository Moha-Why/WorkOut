'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Exercise, MuscleGroup } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { extractVideoId, isValidVideoUrl } from '@/lib/utils/video'

export default function CoachExercisesPage() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exerciseToDelete, setExerciseToDelete] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    video_provider: 'youtube' as 'youtube' | 'vimeo' | 'custom',
    video_url: '',
    video_id: '',
    target_muscles: [] as string[],
    assisting_muscles: [] as string[],
    notes: '',
  })

  // Per-set configuration
  interface SetConfig {
    set_number: number
    target_weight: string
    target_reps: string
    rest_seconds: string
  }
  const [setConfigs, setSetConfigs] = useState<SetConfig[]>([
    { set_number: 1, target_weight: '', target_reps: '', rest_seconds: '60' }
  ])

  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchExercises()
      fetchMuscles()
    }
  }, [profile])

  // Get or create a library program and workout for this coach
  const getLibraryWorkoutId = async (): Promise<string | null> => {
    if (!profile) return null

    // Try to find existing library program
    const { data: existingProgram } = await supabase
      .from('programs')
      .select('id')
      .eq('name', `Exercise Library - ${profile.id}`)
      .eq('created_by', profile.id)
      .single()

    let programId: string

    if (existingProgram) {
      programId = (existingProgram as { id: string }).id
    } else {
      // Create library program
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          name: `Exercise Library - ${profile.id}`,
          description: 'Internal library for storing exercise templates',
          weeks: 0,
          created_by: profile.id,
        } as never)
        .select('id')
        .single<{ id: string }>()

      if (programError || !newProgram) {
        console.error('Error creating library program:', programError)
        return null
      }
      programId = newProgram.id
    }

    // Try to find existing library workout
    const { data: existingWorkout } = await supabase
      .from('workouts')
      .select('id')
      .eq('program_id', programId)
      .eq('name', 'Exercise Library')
      .single()

    if (existingWorkout) {
      return (existingWorkout as { id: string }).id
    }

    // Create library workout
    const { data: newWorkout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        program_id: programId,
        name: 'Exercise Library',
        week_number: 0,
        day_number: 0,
        order_index: 0,
      } as never)
      .select('id')
      .single<{ id: string }>()

    if (workoutError || !newWorkout) {
      console.error('Error creating library workout:', workoutError)
      return null
    }

    return newWorkout.id
  }

  const fetchExercises = async () => {
    if (!profile) {
      setIsLoading(false)
      return
    }

    // Get coach's library workout ID
    const libraryWorkoutId = await getLibraryWorkoutId()

    if (!libraryWorkoutId) {
      setExercises([])
      setIsLoading(false)
      return
    }

    // Fetch ONLY exercises from coach's library
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', libraryWorkoutId)
      .order('created_at', { ascending: false })

    setExercises(data || [])
    setIsLoading(false)
  }

  const fetchMuscles = async () => {
    const { data } = await supabase.from('muscle_groups').select('*')
    setMuscles(data || [])
  }

  const handleMuscleToggle = (muscleId: string, type: 'target' | 'assisting') => {
    if (type === 'target') {
      setFormData(prev => ({
        ...prev,
        target_muscles: prev.target_muscles.includes(muscleId)
          ? prev.target_muscles.filter(m => m !== muscleId)
          : [...prev.target_muscles, muscleId],
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        assisting_muscles: prev.assisting_muscles.includes(muscleId)
          ? prev.assisting_muscles.filter(m => m !== muscleId)
          : [...prev.assisting_muscles, muscleId],
      }))
    }
  }

  const handleVideoUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, video_url: url }))

    const videoId = extractVideoId(url, formData.video_provider)
    if (videoId) {
      setFormData(prev => ({ ...prev, video_id: videoId }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('handleSubmit called', { formData })

    if (isSubmitting) {
      console.log('Already submitting, returning')
      return
    }

    setIsSubmitting(true)

    // Validate name
    if (!formData.name.trim()) {
      setToast({ message: 'Please enter an exercise name', type: 'error', isOpen: true })
      setIsSubmitting(false)
      return
    }

    // Validate video URL
    if (!formData.video_url.trim()) {
      setToast({ message: 'Please enter a video URL', type: 'error', isOpen: true })
      setIsSubmitting(false)
      return
    }

    // Try to extract video ID if not already set
    let videoId = formData.video_id
    if (!videoId && formData.video_url) {
      videoId = extractVideoId(formData.video_url, formData.video_provider) || ''
      if (videoId) {
        setFormData(prev => ({ ...prev, video_id: videoId }))
      }
    }

    if (!videoId) {
      setToast({ message: 'Could not extract video ID from URL. Please check the URL format.', type: 'error', isOpen: true })
      setIsSubmitting(false)
      return
    }

    // Validate target muscles
    if (formData.target_muscles.length === 0) {
      setToast({ message: 'Please select at least one target muscle', type: 'error', isOpen: true })
      setIsSubmitting(false)
      return
    }

    // Get or create library workout ID
    const libraryWorkoutId = await getLibraryWorkoutId()
    if (!libraryWorkoutId) {
      setToast({ message: 'Failed to create library workout. Please try again.', type: 'error', isOpen: true })
      setIsSubmitting(false)
      return
    }

    const exerciseData = {
      name: formData.name,
      video_provider: formData.video_provider,
      video_id: videoId,
      target_muscles: formData.target_muscles,
      assisting_muscles: formData.assisting_muscles,
      sets: setConfigs.length,
      reps: setConfigs[0]?.target_reps || null,
      rest_seconds: setConfigs[0]?.rest_seconds ? parseInt(setConfigs[0].rest_seconds) : null,
      notes: formData.notes || null,
      order_index: 0,
      workout_id: libraryWorkoutId,
    }

    if (editingExercise) {
      // Update existing exercise
      const { error } = await supabase
        .from('exercises')
        .update(exerciseData as never)
        .eq('id', editingExercise.id)

      if (error) {
        console.error('Error updating exercise:', error)
        setToast({ message: `Error updating exercise: ${error.message}`, type: 'error', isOpen: true })
        setIsSubmitting(false)
        return
      }

      // Delete existing set configs and insert new ones
      await supabase.from('exercise_sets').delete().eq('exercise_id', editingExercise.id)

      const setData = setConfigs.map(config => ({
        exercise_id: editingExercise.id,
        set_number: config.set_number,
        target_weight: config.target_weight ? parseFloat(config.target_weight) : null,
        target_reps: config.target_reps ? parseInt(config.target_reps) : null,
        rest_seconds: config.rest_seconds ? parseInt(config.rest_seconds) : null,
      }))

      await supabase.from('exercise_sets').insert(setData as any)

      setToast({ message: 'Exercise updated successfully!', type: 'success', isOpen: true })
      resetForm()
      fetchExercises()
      setIsSubmitting(false)
    } else {
      // Create new exercise
      const { data: newExercise, error } = await supabase
        .from('exercises')
        .insert(exerciseData as never)
        .select('id')
        .single()

      if (error || !newExercise) {
        console.error('Error creating exercise:', error)
        setToast({ message: `Error creating exercise: ${error?.message}`, type: 'error', isOpen: true })
        setIsSubmitting(false)
        return
      }

      // Insert set configs
      const setData = setConfigs.map(config => ({
        exercise_id: (newExercise as any).id,
        set_number: config.set_number,
        target_weight: config.target_weight ? parseFloat(config.target_weight) : null,
        target_reps: config.target_reps ? parseInt(config.target_reps) : null,
        rest_seconds: config.rest_seconds ? parseInt(config.rest_seconds) : null,
      }))

      await supabase.from('exercise_sets').insert(setData as any)

      setToast({ message: 'Exercise created successfully!', type: 'success', isOpen: true })
      resetForm()
      fetchExercises()
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (exercise: Exercise) => {
    setEditingExercise(exercise)
    setFormData({
      name: exercise.name,
      video_provider: exercise.video_provider,
      video_url: `https://www.youtube.com/watch?v=${exercise.video_id}`,
      video_id: exercise.video_id,
      target_muscles: exercise.target_muscles,
      assisting_muscles: exercise.assisting_muscles || [],
      notes: exercise.notes || '',
    })

    // Fetch existing set configs
    const { data: existingSets } = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('exercise_id', exercise.id)
      .order('set_number', { ascending: true })

    if (existingSets && existingSets.length > 0) {
      setSetConfigs(existingSets.map((s: any) => ({
        set_number: s.set_number,
        target_weight: s.target_weight?.toString() || '',
        target_reps: s.target_reps?.toString() || '',
        rest_seconds: s.rest_seconds?.toString() || '60',
      })))
    } else {
      // Fallback to exercise defaults
      const numSets = exercise.sets || 1
      setSetConfigs(
        Array.from({ length: numSets }, (_, i) => ({
          set_number: i + 1,
          target_weight: '',
          target_reps: exercise.reps?.toString() || '',
          rest_seconds: exercise.rest_seconds?.toString() || '60',
        }))
      )
    }

    setShowForm(true)
  }

  const handleDelete = async () => {
    if (!exerciseToDelete) return

    const { error } = await supabase.from('exercises').delete().eq('id', exerciseToDelete.id)

    if (!error) {
      setToast({ message: 'Exercise deleted!', type: 'success', isOpen: true })
      setExerciseToDelete(null)
      fetchExercises()
    } else {
      setToast({ message: 'Error deleting exercise', type: 'error', isOpen: true })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      video_provider: 'youtube',
      video_url: '',
      video_id: '',
      target_muscles: [],
      assisting_muscles: [],
      notes: '',
    })
    setSetConfigs([{ set_number: 1, target_weight: '', target_reps: '', rest_seconds: '60' }])
    setEditingExercise(null)
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">تماريني</h1>
          <p className="text-gray-400 mt-1">Manage your exercise library</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Exercise'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingExercise ? 'Edit Exercise' : 'Add New Exercise'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Exercise Name *"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Provider *
                </label>
                <div className="flex gap-2">
                  {['youtube', 'vimeo', 'custom'].map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => setFormData({ ...formData, video_provider: provider as any })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.video_provider === provider
                          ? 'bg-black text-white'
                          : 'bg-bg-hover text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Video URL *"
                value={formData.video_url}
                onChange={e => handleVideoUrlChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />

              {formData.video_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Preview
                  </label>
                  <VideoPlayer
                    provider={formData.video_provider}
                    videoId={formData.video_id}
                  />
                </div>
              )}

              {/* Per-Set Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Sets Configuration
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const lastSet = setConfigs[setConfigs.length - 1]
                      setSetConfigs([
                        ...setConfigs,
                        {
                          set_number: setConfigs.length + 1,
                          target_weight: lastSet?.target_weight || '',
                          target_reps: lastSet?.target_reps || '',
                          rest_seconds: lastSet?.rest_seconds || '60',
                        }
                      ])
                    }}
                  >
                    + Add Set
                  </Button>
                </div>

                <div className="space-y-3">
                  {setConfigs.map((config, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-bg-hover rounded-lg">
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-main text-sm font-bold text-text-primary">
                        {config.set_number}
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-1.5 sm:gap-3">
                        <Input
                          label="Weight"
                          type="number"
                          value={config.target_weight}
                          onChange={e => {
                            const updated = [...setConfigs]
                            updated[index].target_weight = e.target.value
                            setSetConfigs(updated)
                          }}
                          placeholder="kg"
                        />
                        <Input
                          label="Reps"
                          type="number"
                          value={config.target_reps}
                          onChange={e => {
                            const updated = [...setConfigs]
                            updated[index].target_reps = e.target.value
                            setSetConfigs(updated)
                          }}
                          placeholder="reps"
                        />
                        <Input
                          label="Rest"
                          type="number"
                          value={config.rest_seconds}
                          onChange={e => {
                            const updated = [...setConfigs]
                            updated[index].rest_seconds = e.target.value
                            setSetConfigs(updated)
                          }}
                          placeholder="sec"
                        />
                      </div>
                      {setConfigs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = setConfigs
                              .filter((_, i) => i !== index)
                              .map((s, i) => ({ ...s, set_number: i + 1 }))
                            setSetConfigs(updated)
                          }}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Copy from previous set helper */}
                {setConfigs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstSet = setConfigs[0]
                      setSetConfigs(setConfigs.map(s => ({
                        ...s,
                        target_weight: firstSet.target_weight,
                        target_reps: firstSet.target_reps,
                        rest_seconds: firstSet.rest_seconds,
                      })))
                    }}
                    className="text-sm text-accent hover:underline"
                  >
                    Copy Set 1 values to all sets
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Muscles *
                </label>
                <MuscleModel
                  targetMuscles={formData.target_muscles}
                  assistingMuscles={formData.assisting_muscles}
                  view="both"
                  interactive
                  onMuscleClick={(muscleId) => handleMuscleToggle(muscleId, 'target')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Assisting Muscles
                </label>
                <div className="flex flex-wrap gap-2">
                  {muscles.map((muscle) => (
                    <button
                      key={muscle.id}
                      type="button"
                      onClick={() => handleMuscleToggle(muscle.id, 'assisting')}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        formData.assisting_muscles.includes(muscle.id)
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-hover text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {muscle.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border px-4 py-2"
                  placeholder="Form cues, tips, etc."
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                >
                  {editingExercise ? 'Update Exercise' : 'Create Exercise'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Exercise List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exercises.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-2">No exercises yet</p>
              <p className="text-sm text-gray-500">
                Click "Add Exercise" to create your first exercise
              </p>
            </CardContent>
          </Card>
        ) : (
          exercises.map((exercise) => (
            <Card key={exercise.id}>
              <CardContent className="pt-6">
                <h3 className="font-bold text-text-primary mb-2">{exercise.name}</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {exercise.sets && (
                    <Badge variant="default">{exercise.sets} sets</Badge>
                  )}
                  {exercise.reps && (
                    <Badge variant="default">{exercise.reps} reps</Badge>
                  )}
                  {exercise.rest_seconds && (
                    <Badge variant="default">{exercise.rest_seconds}s rest</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(exercise)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setExerciseToDelete({ id: exercise.id, name: exercise.name })
                      setShowDeleteConfirm(true)
                    }}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Exercise Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setExerciseToDelete(null)
        }}
        onConfirm={handleDelete}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${exerciseToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Exercise"
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
