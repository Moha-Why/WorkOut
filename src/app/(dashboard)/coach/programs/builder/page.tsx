'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import type { Program, Workout } from '@/types'

interface WeekStructure {
  weekNumber: number
  days: DayStructure[]
}

interface DayStructure {
  dayNumber: number
  workouts: Workout[]
}

function ProgramBuilderContent() {
  const { profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('id')

  const [program, setProgram] = useState<Program | null>(null)
  const [weeks, setWeeks] = useState<WeekStructure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [showEditProgramModal, setShowEditProgramModal] = useState(false)
  const [editedProgramName, setEditedProgramName] = useState('')
  const [editedProgramDescription, setEditedProgramDescription] = useState('')
  const [showDeleteWorkoutConfirm, setShowDeleteWorkoutConfirm] = useState(false)
  const [workoutToDelete, setWorkoutToDelete] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  useEffect(() => {
    if (profile && programId) {
      fetchProgramData()
    } else if (!programId) {
      setIsLoading(false)
    }
  }, [profile, programId])

  const fetchProgramData = async () => {
    if (!profile || !programId) return

    const supabase = createClient()

    // Fetch program
    const { data: programData } = await supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .eq('created_by', profile.id)
      .single<Program>()

    if (!programData) {
      setToast({ message: 'Program not found or access denied', type: 'error', isOpen: true })
      router.push('/coach/programs')
      return
    }

    setProgram(programData)

    // Fetch all workouts for this program
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_id', programId)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true })

    // Structure workouts by week and day
    const weekStructure: WeekStructure[] = []

    for (let weekNum = 1; weekNum <= programData.weeks; weekNum++) {
      const days: DayStructure[] = []

      for (let dayNum = 1; dayNum <= 7; dayNum++) {
        const dayWorkouts =
          (workouts as Workout[] | null)?.filter(
            (w) => w.week_number === weekNum && w.day_number === dayNum
          ) || []

        days.push({
          dayNumber: dayNum,
          workouts: dayWorkouts,
        })
      }

      weekStructure.push({
        weekNumber: weekNum,
        days,
      })
    }

    setWeeks(weekStructure)
    setIsLoading(false)
  }

  const handleAddWorkout = async () => {
    if (
      !profile ||
      !programId ||
      !newWorkoutName.trim() ||
      selectedWeek === null ||
      selectedDay === null
    ) {
      setToast({ message: 'Please fill all fields', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    // Get current workouts count for order_index
    const { data: existingWorkouts } = await supabase
      .from('workouts')
      .select('order_index')
      .eq('program_id', programId)
      .eq('week_number', selectedWeek)
      .eq('day_number', selectedDay)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex =
      existingWorkouts && existingWorkouts.length > 0
        ? (existingWorkouts[0] as { order_index: number }).order_index + 1
        : 0

    const { error } = await supabase.from('workouts').insert({
      program_id: programId,
      name: newWorkoutName,
      week_number: selectedWeek,
      day_number: selectedDay,
      order_index: nextOrderIndex,
    } as never)

    if (error) {
      console.error('Error adding workout:', error)
      setToast({ message: 'Error adding workout', type: 'error', isOpen: true })
      return
    }

    setShowAddWorkoutModal(false)
    setNewWorkoutName('')
    setSelectedWeek(null)
    setSelectedDay(null)
    await fetchProgramData()
  }

  const handleDeleteWorkout = async () => {
    if (!workoutToDelete) return

    const supabase = createClient()

    const { error } = await supabase.from('workouts').delete().eq('id', workoutToDelete.id)

    if (error) {
      console.error('Error deleting workout:', error)
      setToast({ message: 'Error deleting workout', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Workout deleted successfully', type: 'success', isOpen: true })
    setWorkoutToDelete(null)
    await fetchProgramData()
  }

  const handleEditProgram = async () => {
    if (!program || !profile || !editedProgramName.trim()) {
      setToast({ message: 'Please enter a program name', type: 'error', isOpen: true })
      return
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('programs')
      .update({
        name: editedProgramName,
        description: editedProgramDescription || null,
      } as never)
      .eq('id', program.id)
      .eq('created_by', profile.id)

    if (error) {
      console.error('Error updating program:', error)
      setToast({ message: 'Error updating program', type: 'error', isOpen: true })
      return
    }

    setToast({ message: 'Program updated successfully', type: 'success', isOpen: true })
    setShowEditProgramModal(false)
    await fetchProgramData()
  }

  const handleEditWorkout = (workoutId: string) => {
    router.push(`/coach/programs/workouts/${workoutId}`)
  }

  const getDayName = (dayNumber: number): string => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days[dayNumber - 1] || `Day ${dayNumber}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  if (!programId || !program) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-400 mb-4">No program selected</p>
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
            onClick={() => router.push('/coach/programs')}
            className="self-start"
          >
            ← Back
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{program.name}</h1>
              {program.description && (
                <p className="text-gray-400 mt-1">{program.description}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditedProgramName(program.name)
                setEditedProgramDescription(program.description || '')
                setShowEditProgramModal(true)
              }}
              className="shrink-0"
            >
              Edit Details
            </Button>
          </div>
        </div>
        <Badge variant="info" className="self-start sm:self-auto">{program.weeks} Weeks</Badge>
      </div>

      {/* Program Builder */}
      <div className="space-y-6">
        {weeks.map((week) => (
          <Card key={week.weekNumber}>
            <CardHeader>
              <CardTitle>Week {week.weekNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
                {week.days.map((day) => (
                  <div
                    key={day.dayNumber}
                    className="border border-border rounded-lg p-4 bg-bg-secondary min-h-40 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-base text-text-primary">
                        {getDayName(day.dayNumber)}
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedWeek(week.weekNumber)
                          setSelectedDay(day.dayNumber)
                          setShowAddWorkoutModal(true)
                        }}
                        className="text-sm text-info hover:text-info/80 font-medium bg-info/10 hover:bg-info/20 px-3 py-1.5 rounded-lg transition-colors"
                        title="Create new workout"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="space-y-2">
                      {day.workouts.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Rest day
                        </p>
                      ) : (
                        day.workouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="bg-bg-secondary rounded p-3 border border-border hover:border-accent/50 transition-colors"
                          >
                            <p className="text-sm font-medium text-text-primary mb-3 wrap-break-word">
                              {workout.name}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditWorkout(workout.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-info/20 text-info hover:bg-info/30 py-2 px-3 rounded-lg transition-colors font-medium"
                                title="Edit exercises"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setWorkoutToDelete({ id: workout.id, name: workout.name })
                                  setShowDeleteWorkoutConfirm(true)
                                }}
                                className="flex items-center justify-center text-sm text-error hover:bg-error/10 py-2 px-3 rounded-lg transition-colors shrink-0"
                                title="Delete workout"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                Add Workout - Week {selectedWeek}, {getDayName(selectedDay!)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workout Name *
                </label>
                <input
                  type="text"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g., Upper Body Strength"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddWorkoutModal(false)
                    setNewWorkoutName('')
                    setSelectedWeek(null)
                    setSelectedDay(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleAddWorkout} className="flex-1">
                  Add Workout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Program Modal */}
      {showEditProgramModal && program && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Program Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={editedProgramName}
                  onChange={(e) => setEditedProgramName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g., Beginner Strength Program"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editedProgramDescription}
                  onChange={(e) => setEditedProgramDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Program description..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditProgramModal(false)
                    setEditedProgramName('')
                    setEditedProgramDescription('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleEditProgram} className="flex-1">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Workout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteWorkoutConfirm}
        onClose={() => {
          setShowDeleteWorkoutConfirm(false)
          setWorkoutToDelete(null)
        }}
        onConfirm={handleDeleteWorkout}
        title="Delete Workout"
        message={`Delete "${workoutToDelete?.name}"? This will also delete all exercises in this workout. This action cannot be undone.`}
        confirmText="Delete Workout"
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

export default function ProgramBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
        </div>
      }
    >
      <ProgramBuilderContent />
    </Suspense>
  )
}
