'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import type { Program } from '@/types'

interface ProgramWithStats extends Program {
  workout_count: number
  exercise_count: number
  assigned_users: number
}

export default function CoachProgramsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [programs, setPrograms] = useState<ProgramWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    weeks: 4,
  })
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [programToAction, setProgramToAction] = useState<Program | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  useEffect(() => {
    if (profile) {
      fetchPrograms()
    } else {
      setIsLoading(false)
    }
  }, [profile])

  const fetchPrograms = async () => {
    if (!profile) return

    const supabase = createClient()

    // Fetch programs created by this coach (exclude library program)
    const { data: programsData } = await supabase
      .from('programs')
      .select('*')
      .eq('created_by', profile.id)
      .neq('name', `Exercise Library - ${profile.id}`)
      .order('created_at', { ascending: false })

    if (!programsData || programsData.length === 0) {
      setPrograms([])
      setIsLoading(false)
      return
    }

    // Fetch stats for each program
    const programsWithStats = await Promise.all(
      (programsData as Program[]).map(async (program) => {
        // Get workout count
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id')
          .eq('program_id', program.id)

        const workoutIds =
          (workouts as { id: string }[] | null)?.map((w) => w.id) || []

        // Get exercise count
        let exerciseCount = 0
        if (workoutIds.length > 0) {
          const { count } = await supabase
            .from('exercises')
            .select('*', { count: 'exact', head: true })
            .in('workout_id', workoutIds)

          exerciseCount = count || 0
        }

        // Get assigned users count
        const { count: assignedUsers } = await supabase
          .from('user_programs')
          .select('*', { count: 'exact', head: true })
          .eq('program_id', program.id)

        return {
          ...program,
          workout_count: workoutIds.length,
          exercise_count: exerciseCount,
          assigned_users: assignedUsers || 0,
        }
      })
    )

    setPrograms(programsWithStats)
    setIsLoading(false)
  }

  const handleCreateProgram = async () => {
    console.log('handleCreateProgram called', { profile, newProgram })

    if (!profile || !newProgram.name.trim()) {
      setToast({ message: 'Please enter a program name', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('programs')
        .insert({
          name: newProgram.name,
          description: newProgram.description || null,
          weeks: newProgram.weeks,
          created_by: profile.id,
        } as never)
        .select()
        .single<Program>()

      if (error) {
        console.error('Error creating program:', error)
        setToast({ message: `Error creating program: ${error.message}`, type: 'error', isOpen: true })
        return
      }

      setShowCreateModal(false)
      setNewProgram({ name: '', description: '', weeks: 4 })
      await fetchPrograms()

      // Navigate to builder for new program
      if (data) {
        router.push(`/coach/programs/builder?id=${data.id}`)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setToast({ message: 'An unexpected error occurred', type: 'error', isOpen: true })
    }
  }

  const handleDuplicateProgram = async () => {
    if (!profile || !programToAction) return

    const supabase = createClient()
    const program = programToAction

    // Create duplicate program
    const { data: newProgram, error: programError } = await supabase
      .from('programs')
      .insert({
        name: `${program.name} (Copy)`,
        description: program.description,
        weeks: program.weeks,
        created_by: profile.id,
        duplicated_from: program.id,
      } as never)
      .select()
      .single<Program>()

    if (programError || !newProgram) {
      setToast({ message: 'Error duplicating program', type: 'error', isOpen: true })
      return
    }

    // Fetch all workouts from original program
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_id', program.id)
      .order('order_index', { ascending: true })

    if (workouts && workouts.length > 0) {
      // Create new workouts
      const workoutMap = new Map<string, string>()

      for (const workout of workouts as any[]) {
        const { data: newWorkout } = await supabase
          .from('workouts')
          .insert({
            program_id: newProgram.id,
            name: workout.name,
            week_number: workout.week_number,
            day_number: workout.day_number,
            order_index: workout.order_index,
          } as never)
          .select()
          .single<{ id: string }>()

        if (newWorkout) {
          workoutMap.set(workout.id, newWorkout.id)
        }
      }

      // Fetch and copy all exercises
      for (const [oldWorkoutId, newWorkoutId] of workoutMap.entries()) {
        const { data: exercises } = await supabase
          .from('exercises')
          .select('*')
          .eq('workout_id', oldWorkoutId)
          .order('order_index', { ascending: true })

        if (exercises && exercises.length > 0) {
          const newExercises = (exercises as any[]).map((ex) => ({
            workout_id: newWorkoutId,
            name: ex.name,
            video_provider: ex.video_provider,
            video_id: ex.video_id,
            target_muscles: ex.target_muscles,
            assisting_muscles: ex.assisting_muscles,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            order_index: ex.order_index,
          }))

          await supabase.from('exercises').insert(newExercises as never)
        }
      }
    }

    setToast({ message: 'Program duplicated successfully!', type: 'success', isOpen: true })
    setProgramToAction(null)
    await fetchPrograms()
  }

  const handleDeleteProgram = async () => {
    if (!programToAction) return

    const supabase = createClient()

    const { error } = await supabase.from('programs').delete().eq('id', programToAction.id)

    if (error) {
      console.error('Error deleting program:', error)
      setToast({ message: 'Error deleting program', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Program deleted successfully', type: 'success', isOpen: true })
    setProgramToAction(null)
    await fetchPrograms()
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary">My Programs</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Create New Program
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">No programs yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first training program to get started
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Program
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">
                      {program.name}
                    </CardTitle>
                    {program.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {program.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="info" className="shrink-0">
                    {program.weeks}w
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {program.workout_count}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Workouts</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {program.exercise_count}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Exercises</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {program.assigned_users}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Users</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      onClick={() =>
                        router.push(`/coach/programs/builder?id=${program.id}`)
                      }
                      className="w-full"
                    >
                      Edit Program
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setProgramToAction(program)
                          setShowDuplicateConfirm(true)
                        }}
                        size="sm"
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setProgramToAction(program)
                          setShowDeleteConfirm(true)
                        }}
                        size="sm"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Program Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Program</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={newProgram.name}
                  onChange={(e) =>
                    setNewProgram({ ...newProgram, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g., Beginner Strength Program"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProgram.description}
                  onChange={(e) =>
                    setNewProgram({ ...newProgram, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Program description..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Weeks
                </label>
                <input
                  type="number"
                  value={newProgram.weeks}
                  onChange={(e) =>
                    setNewProgram({
                      ...newProgram,
                      weeks: parseInt(e.target.value) || 1,
                    })
                  }
                  min="1"
                  max="52"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewProgram({ name: '', description: '', weeks: 4 })
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateProgram} className="flex-1">
                  Create Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duplicate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDuplicateConfirm}
        onClose={() => {
          setShowDuplicateConfirm(false)
          setProgramToAction(null)
        }}
        onConfirm={handleDuplicateProgram}
        title="Duplicate Program"
        message={`Duplicate "${programToAction?.name}"? This will copy the entire program structure including all workouts and exercises.`}
        confirmText="Duplicate"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setProgramToAction(null)
        }}
        onConfirm={handleDeleteProgram}
        title="Delete Program"
        message={`Are you sure you want to delete "${programToAction?.name}"? This will remove all workouts, exercises, and user assignments. This action cannot be undone.`}
        confirmText="Delete Program"
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
