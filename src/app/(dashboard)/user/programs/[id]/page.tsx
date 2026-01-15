'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import type { Program, Workout } from '@/types'

interface WeekStructure {
  weekNumber: number
  days: DayStructure[]
}

interface DayStructure {
  dayNumber: number
  workouts: WorkoutWithCompletion[]
}

interface WorkoutWithCompletion extends Workout {
  is_completed: boolean
  exercise_count: number
}

export default function UserProgramDetailPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [weeks, setWeeks] = useState<WeekStructure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  useEffect(() => {
    if (profile && programId) {
      fetchProgramData()
    }
  }, [profile, programId])

  const fetchProgramData = async () => {
    if (!profile || !programId) return

    const supabase = createClient()

    // Check if user has access to this program
    const { data: userProgram } = await supabase
      .from('user_programs')
      .select('id')
      .eq('user_id', profile.id)
      .eq('program_id', programId)
      .single()

    if (!userProgram) {
      setToast({ message: 'Access denied - program not assigned to you', type: 'error', isOpen: true })
      router.push('/user/programs')
      return
    }

    // Fetch program
    const { data: programData } = await supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .single<Program>()

    if (!programData) {
      setToast({ message: 'Program not found', type: 'error', isOpen: true })
      router.push('/user/programs')
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

    // Fetch user's completed workouts
    const workoutIds = (workouts as Workout[] | null)?.map((w) => w.id) || []
    let completedWorkoutIds: string[] = []

    if (workoutIds.length > 0) {
      const { data: completedWorkouts } = await supabase
        .from('user_workout_progress')
        .select('workout_id')
        .eq('user_id', profile.id)
        .in('workout_id', workoutIds)

      completedWorkoutIds =
        (completedWorkouts as { workout_id: string }[] | null)?.map(
          (cw) => cw.workout_id
        ) || []
    }

    // Get exercise count for each workout
    const workoutsWithCompletion = await Promise.all(
      (workouts as Workout[] || []).map(async (workout) => {
        const { count: exerciseCount } = await supabase
          .from('exercises')
          .select('*', { count: 'exact', head: true })
          .eq('workout_id', workout.id)

        return {
          ...workout,
          is_completed: completedWorkoutIds.includes(workout.id),
          exercise_count: exerciseCount || 0,
        }
      })
    )

    // Structure workouts by week and day
    const weekStructure: WeekStructure[] = []

    for (let weekNum = 1; weekNum <= programData.weeks; weekNum++) {
      const days: DayStructure[] = []

      for (let dayNum = 1; dayNum <= 7; dayNum++) {
        const dayWorkouts = workoutsWithCompletion.filter(
          (w) => w.week_number === weekNum && w.day_number === dayNum
        )

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

  const getDayName = (dayNumber: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[dayNumber - 1] || `Day ${dayNumber}`
  }

  const handleStartWorkout = (workoutId: string) => {
    router.push(`/user/workouts/${workoutId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  if (!program) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-400 mb-4">Program not found</p>
          <Button onClick={() => router.push('/user/programs')}>
            Back to Programs
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/user/programs')}>
            ← Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{program.name}</h1>
            {program.description && (
              <p className="text-gray-400 mt-1">{program.description}</p>
            )}
          </div>
        </div>
        <Badge variant="info">{program.weeks} Week Program</Badge>
      </div>

      {/* Heavy-Style Program Structure */}
      <div className="space-y-8">
        {weeks.map((week) => (
          <Card key={week.weekNumber} className="overflow-hidden">
            <CardHeader className="bg-gray-900 text-white">
              <CardTitle>Week {week.weekNumber}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {week.days.map((day) => {
                  const hasWorkouts = day.workouts.length > 0

                  return (
                    <div
                      key={day.dayNumber}
                      className={`p-4 ${hasWorkouts ? 'bg-bg-secondary hover:bg-bg-hover' : 'bg-bg-hover'} transition-colors`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg text-text-primary">
                          {getDayName(day.dayNumber)}
                        </h3>
                        {!hasWorkouts && (
                          <Badge variant="default">Rest Day</Badge>
                        )}
                      </div>

                      {hasWorkouts ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {day.workouts.map((workout) => (
                            <Card
                              key={workout.id}
                              className={`border-2 ${
                                workout.is_completed
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-border'
                              }`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-text-primary truncate">
                                      {workout.name}
                                    </h4>
                                    <p className="text-sm text-gray-400 mt-1">
                                      {workout.exercise_count} exercises
                                    </p>
                                  </div>
                                  {workout.is_completed ? (
                                    <Badge variant="success" className="shrink-0">
                                      ✓ Done
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleStartWorkout(workout.id)}
                                    >
                                      Start
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          Take a rest and recover for tomorrow's training
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
