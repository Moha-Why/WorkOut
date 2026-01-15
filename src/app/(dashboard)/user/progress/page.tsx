'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatSmartDate, calculateStreak } from '@/lib/utils/date'

interface ProgressEntry {
  id: string
  exercise_name: string
  workout_name: string
  completed_at: string
}

export default function ProgressPage() {
  const { profile } = useAuth()
  const [recentProgress, setRecentProgress] = useState<ProgressEntry[]>([])
  const [stats, setStats] = useState({
    total_workouts: 0,
    total_exercises: 0,
    this_week_workouts: 0,
    this_week_exercises: 0,
    streak: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProgress = async () => {
      if (!profile) return

      const supabase = createClient()

      // Fetch recent exercise completions with workout names
      const { data: exerciseProgress } = await supabase
        .from('user_exercise_progress')
        .select(`
          id,
          completed_at,
          exercises (
            name,
            workouts (
              name
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('completed_at', { ascending: false })
        .limit(50)

      // Fetch total counts
      const { count: totalWorkouts } = await supabase
        .from('user_workout_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      const { count: totalExercises } = await supabase
        .from('user_exercise_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      // Calculate this week's stats
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const { count: thisWeekWorkouts } = await supabase
        .from('user_workout_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('completed_at', oneWeekAgo.toISOString())

      const { count: thisWeekExercises } = await supabase
        .from('user_exercise_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('completed_at', oneWeekAgo.toISOString())

      // Calculate streak
      const { data: workoutDates } = await supabase
        .from('user_workout_progress')
        .select('completed_at')
        .eq('user_id', profile.id)
        .order('completed_at', { ascending: false })

      const streak = workoutDates
        ? calculateStreak((workoutDates as { completed_at: string }[]).map(d => new Date(d.completed_at)))
        : 0

      // Format progress entries
      const formattedProgress: ProgressEntry[] = exerciseProgress?.map((p: any) => ({
        id: p.id,
        exercise_name: p.exercises?.name || 'Unknown',
        workout_name: p.exercises?.workouts?.name || 'Unknown',
        completed_at: p.completed_at,
      })) || []

      setRecentProgress(formattedProgress)
      setStats({
        total_workouts: totalWorkouts || 0,
        total_exercises: totalExercises || 0,
        this_week_workouts: thisWeekWorkouts || 0,
        this_week_exercises: thisWeekExercises || 0,
        streak,
      })
      setIsLoading(false)
    }

    fetchProgress()
  }, [profile])

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
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Progress</h1>
        <p className="text-gray-500 mt-1">Track your fitness journey</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Workouts
              </p>
              <p className="text-3xl font-bold text-text-primary mt-2">
                {stats.total_workouts}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{stats.this_week_workouts} this week
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Exercises
              </p>
              <p className="text-3xl font-bold text-text-primary mt-2">
                {stats.total_exercises}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{stats.this_week_exercises} this week
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Current Streak
              </p>
              <p className="text-3xl font-bold text-text-primary mt-2">
                {stats.streak}
              </p>
              <p className="text-sm text-gray-500 mt-1">days</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Avg Per Week
              </p>
              <p className="text-3xl font-bold text-text-primary mt-2">
                {stats.this_week_workouts}
              </p>
              <p className="text-sm text-gray-500 mt-1">workouts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentProgress.length === 0 ? (
            <div className="text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-gray-500 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-gray-500 mb-2">No activity yet</p>
              <p className="text-sm text-gray-500">
                Complete your first workout to see your progress here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProgress.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-bg-hover rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">
                      {entry.exercise_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {entry.workout_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="success">Completed</Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatSmartDate(entry.completed_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
