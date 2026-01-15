'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { ProgramWithProgress } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { calculateStreak } from '@/lib/utils/date'
import Link from 'next/link'

export default function UserDashboard() {
  const { profile } = useAuth()
  const [programs, setPrograms] = useState<ProgramWithProgress[]>([])
  const [stats, setStats] = useState({
    total_workouts_completed: 0,
    total_exercises_completed: 0,
    current_streak: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return

      // Always set loading to true when fetching
      setIsLoading(true)

      const supabase = createClient()

      // Fetch assigned programs
      const { data: programData } = await supabase
        .from('user_programs')
        .select(`
          program_id,
          assigned_at,
          programs (
            id,
            name,
            description,
            weeks
          )
        `)
        .eq('user_id', profile.id)

      // Fetch workout progress count
      const { count: workoutCount } = await supabase
        .from('user_workout_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      // Fetch exercise progress count
      const { count: exerciseCount } = await supabase
        .from('user_exercise_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      // Calculate streak from workout completion dates
      const { data: workoutDates } = await supabase
        .from('user_workout_progress')
        .select('completed_at')
        .eq('user_id', profile.id)
        .order('completed_at', { ascending: false })

      const streak = workoutDates
        ? calculateStreak((workoutDates as { completed_at: string }[]).map(d => new Date(d.completed_at)))
        : 0

      setPrograms(programData?.map((p: any) => p.programs) || [])
      setStats({
        total_workouts_completed: workoutCount || 0,
        total_exercises_completed: exerciseCount || 0,
        current_streak: streak,
      })
      setIsLoading(false)
    }

    fetchData()

    // Set up an interval to refresh data periodically (every 10 seconds)
    const interval = setInterval(fetchData, 10000)

    return () => clearInterval(interval)
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
      <div>
        <h1 className="text-3xl font-bold text-text-primary">
          Welcome back, {profile?.name}!
        </h1>
        <p className="text-gray-400 mt-1">
          Ready to crush your workout today?
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Workouts Completed</p>
                <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_workouts_completed}</p>
              </div>
              <div className="h-12 w-12 bg-info/20 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Exercises Done</p>
                <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_exercises_completed}</p>
              </div>
              <div className="h-12 w-12 bg-success/20 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Current Streak</p>
                <p className="text-3xl font-bold text-text-primary mt-2">{stats.current_streak} days</p>
              </div>
              <div className="h-12 w-12 bg-accent/20 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-4">Your Programs</h2>
        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 mb-2">No programs assigned yet</p>
              <p className="text-sm text-gray-500">Contact your coach to get started with a workout program</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Link key={program.id} href={`/user/workouts?program=${program.id}`}>
                <Card className="hover:shadow-lg hover:shadow-black/30 hover:border-accent/50 transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle>{program.name}</CardTitle>
                    <CardDescription>{program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {program.description && <p className="text-sm text-gray-400 mb-4">{program.description}</p>}
                    <div className="flex items-center justify-between">
                      <Badge variant="info">Active</Badge>
                      <span className="text-sm text-gray-400">View Workouts →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
