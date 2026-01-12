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
import { extractVideoId, isValidVideoUrl } from '@/lib/utils/video'

export default function CoachExercisesPage() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    video_provider: 'youtube' as 'youtube' | 'vimeo' | 'custom',
    video_url: '',
    video_id: '',
    target_muscles: [] as string[],
    assisting_muscles: [] as string[],
    sets: '',
    reps: '',
    rest_seconds: '',
    notes: '',
  })

  const supabase = createClient()

  useEffect(() => {
    fetchExercises()
    fetchMuscles()
  }, [])

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
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

    if (!formData.name || !formData.video_id || formData.target_muscles.length === 0) {
      alert('Please fill in all required fields')
      return
    }

    const exerciseData = {
      name: formData.name,
      video_provider: formData.video_provider,
      video_id: formData.video_id,
      target_muscles: formData.target_muscles,
      assisting_muscles: formData.assisting_muscles,
      sets: formData.sets ? parseInt(formData.sets) : null,
      reps: formData.reps || null,
      rest_seconds: formData.rest_seconds ? parseInt(formData.rest_seconds) : null,
      notes: formData.notes || null,
      order_index: 0,
      workout_id: null, // This is for library, will be set when added to workout
    }

    if (editingExercise) {
      // Update existing
      const { error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', editingExercise.id)

      if (!error) {
        alert('Exercise updated successfully!')
        resetForm()
        fetchExercises()
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('exercises')
        .insert(exerciseData)

      if (!error) {
        alert('Exercise created successfully!')
        resetForm()
        fetchExercises()
      }
    }
  }

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setFormData({
      name: exercise.name,
      video_provider: exercise.video_provider,
      video_url: `https://www.youtube.com/watch?v=${exercise.video_id}`,
      video_id: exercise.video_id,
      target_muscles: exercise.target_muscles,
      assisting_muscles: exercise.assisting_muscles || [],
      sets: exercise.sets?.toString() || '',
      reps: exercise.reps || '',
      rest_seconds: exercise.rest_seconds?.toString() || '',
      notes: exercise.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return

    const { error } = await supabase.from('exercises').delete().eq('id', id)

    if (!error) {
      alert('Exercise deleted!')
      fetchExercises()
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
      sets: '',
      reps: '',
      rest_seconds: '',
      notes: '',
    })
    setEditingExercise(null)
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">تماريني</h1>
          <p className="text-gray-600 mt-1">Manage your exercise library</p>
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
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Sets"
                  type="number"
                  value={formData.sets}
                  onChange={e => setFormData({ ...formData, sets: e.target.value })}
                />
                <Input
                  label="Reps"
                  value={formData.reps}
                  onChange={e => setFormData({ ...formData, reps: e.target.value })}
                  placeholder="e.g., 8-12"
                />
                <Input
                  label="Rest (seconds)"
                  type="number"
                  value={formData.rest_seconds}
                  onChange={e => setFormData({ ...formData, rest_seconds: e.target.value })}
                />
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
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  placeholder="Form cues, tips, etc."
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" variant="primary" className="flex-1">
                  {editingExercise ? 'Update Exercise' : 'Create Exercise'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
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
              <p className="text-gray-600 mb-2">No exercises yet</p>
              <p className="text-sm text-gray-500">
                Click "Add Exercise" to create your first exercise
              </p>
            </CardContent>
          </Card>
        ) : (
          exercises.map((exercise) => (
            <Card key={exercise.id}>
              <CardContent className="pt-6">
                <h3 className="font-bold text-gray-900 mb-2">{exercise.name}</h3>
                <div className="flex gap-2 mb-4">
                  {exercise.sets && (
                    <Badge variant="default">{exercise.sets} sets</Badge>
                  )}
                  {exercise.reps && (
                    <Badge variant="default">{exercise.reps} reps</Badge>
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
                    onClick={() => handleDelete(exercise.id)}
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
    </div>
  )
}
