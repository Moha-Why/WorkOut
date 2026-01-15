'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { RoleGuard } from '@/components/auth/RoleGuard'
import Link from 'next/link'
import { Profile } from '@/types'

export default function CoachDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    total_users: 0,
    total_programs: 0,
    total_exercises: 0,
    active_users: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return

      const supabase = createClient()

      // Get coach ID
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', profile.id)
        .single<Profile>()

      if (!coach) {
        setIsLoading(false)
        return
      }

      // Fetch stats
      const { count: usersCount } = await supabase
        .from('coach_users')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coach.id)

      const { count: programsCount } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', profile.id)
        .neq('name', `Exercise Library - ${profile.id}`)

      // Get coach's library workout to count only library exercises
      const { data: libraryProgram } = await supabase
        .from('programs')
        .select('id')
        .eq('name', `Exercise Library - ${profile.id}`)
        .eq('created_by', profile.id)
        .single()

      let exercisesCount = 0
      if (libraryProgram) {
        const { data: libraryWorkout } = await supabase
          .from('workouts')
          .select('id')
          .eq('program_id', (libraryProgram as { id: string }).id)
          .eq('name', 'Exercise Library')
          .single()

        if (libraryWorkout) {
          const { count } = await supabase
            .from('exercises')
            .select('*', { count: 'exact', head: true })
            .eq('workout_id', (libraryWorkout as { id: string }).id)

          exercisesCount = count || 0
        }
      }

      setStats({
        total_users: usersCount || 0,
        total_programs: programsCount || 0,
        total_exercises: exercisesCount || 0,
        active_users: usersCount || 0, // TODO: Calculate active users
      })
      setIsLoading(false)
    }

    fetchStats()
  }, [profile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={['coach', 'admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Welcome, Coach {profile?.name}!
          </h1>
          <p className="text-gray-400 mt-1">Manage your training programs and users</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Total Users</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_users}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Programs</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_programs}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Exercises</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_exercises}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-gray-400">Active Users</p>
              <p className="text-3xl font-bold text-text-primary mt-2">{stats.active_users}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/coach/exercises">
                <div className="p-6 bg-bg-hover rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <h3 className="font-bold text-text-primary mb-2">تماريني</h3>
                  <p className="text-sm text-gray-400">Manage your exercise library</p>
                </div>
              </Link>

              <Link href="/coach/programs">
                <div className="p-6 bg-bg-hover rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <h3 className="font-bold text-text-primary mb-2">Programs</h3>
                  <p className="text-sm text-gray-400">Create and edit training programs</p>
                </div>
              </Link>

              <Link href="/coach/users">
                <div className="p-6 bg-bg-hover rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <h3 className="font-bold text-text-primary mb-2">My Users</h3>
                  <p className="text-sm text-gray-400">View and manage your clients</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}
