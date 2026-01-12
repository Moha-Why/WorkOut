'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Workout, Exercise } from '@/types'
import { WorkoutCard } from '@/components/workouts/WorkoutCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

interface WorkoutWithExercises extends Workout {
  exercises: Exercise[]
}

export default function UserWorkoutsPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const programId = searchParams.get('program')

  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([])
  const [programName, setProgramName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWorkouts = async () => {
      // Always stop loading, even if conditions aren't met
      if (!profile || !programId) {
        setIsLoading(false)
        return
      }

      const supabase = createClient()

      // Fetch program info
      const { data: program } = await supabase
        .from('programs')
        .select('name')
        .eq('id', programId)
        .single<{name: string}>()

      if (program) {
        setProgramName(program.name)
      }

      // Fetch workouts with exercises
      const { data: workoutData } = await supabase
        .from('workouts')
        .select(`
          *,
          exercises (*)
        `)
        .eq('program_id', programId)
        .order('week_number', { ascending: true })
        .order('day_number', { ascending: true })

      setWorkouts(workoutData as WorkoutWithExercises[] || [])
      setIsLoading(false)
    }

    fetchWorkouts()
  }, [profile, programId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
      </div>
    )
  }

  if (!programId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">My Workouts</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Please select a program to view workouts</p>
            <Link href="/user" className="text-black font-medium mt-2 inline-block">
              ← Back to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Group workouts by week
  const workoutsByWeek = workouts.reduce((acc, workout) => {
    const week = workout.week_number
    if (!acc[week]) acc[week] = []
    acc[week].push(workout)
    return acc
  }, {} as Record<number, WorkoutWithExercises[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/user" className="text-sm text-gray-600 hover:text-black mb-2 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{programName}</h1>
        <p className="text-gray-600 mt-1">
          {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'}
        </p>
      </div>

      {/* Workouts by week */}
      {Object.keys(workoutsByWeek).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 mb-2">No workouts in this program yet</p>
            <p className="text-sm text-gray-500">
              Your coach hasn't added any workouts yet
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(workoutsByWeek)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([week, weekWorkouts]) => (
            <div key={week}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Week {week}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {weekWorkouts
                  .sort((a, b) => a.day_number - b.day_number)
                  .map((workout) => (
                    <Link
                      key={workout.id}
                      href={`/user/workouts/${workout.id}`}
                    >
                      <WorkoutCard
                        workout={workout}
                        exerciseCount={workout.exercises.length}
                      />
                    </Link>
                  ))}
              </div>
            </div>
          ))
      )}
    </div>
  )
}
