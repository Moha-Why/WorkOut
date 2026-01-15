'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Program } from '@/types'

interface UserProgram extends Program {
  total_workouts: number
  completed_workouts: number
  progress_percentage: number
}

export default function UserProgramsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [programs, setPrograms] = useState<UserProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

    // Fetch user's assigned programs
    const { data: userPrograms } = await supabase
      .from('user_programs')
      .select('program_id, assigned_at')
      .eq('user_id', profile.id)

    if (!userPrograms || userPrograms.length === 0) {
      setPrograms([])
      setIsLoading(false)
      return
    }

    const programIds =
      (userPrograms as { program_id: string }[])?.map((up) => up.program_id) || []

    // Fetch program details
    const { data: programsData } = await supabase
      .from('programs')
      .select('*')
      .in('id', programIds)

    if (!programsData || programsData.length === 0) {
      setPrograms([])
      setIsLoading(false)
      return
    }

    // Fetch progress for each program
    const programsWithProgress = await Promise.all(
      programsData.map(async (program: any) => {
        // Get total workouts in program
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id')
          .eq('program_id', program.id)

        const totalWorkouts = workouts?.length || 0

        // Get completed workouts - count distinct workout_ids
        const workoutIds = (workouts as { id: string }[] | null)?.map((w) => w.id) || []
        let completedWorkouts = 0

        if (workoutIds.length > 0) {
          // Get all progress records for this user and these workouts
          const { data: progressRecords } = await supabase
            .from('user_workout_progress')
            .select('workout_id')
            .eq('user_id', profile.id)
            .in('workout_id', workoutIds)

          // Count unique workout IDs
          const uniqueCompletedWorkouts = new Set(
            (progressRecords as { workout_id: string }[] | null)?.map(p => p.workout_id) || []
          )
          completedWorkouts = uniqueCompletedWorkouts.size
        }

        const progressPercentage =
          totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0

        return {
          ...program,
          total_workouts: totalWorkouts,
          completed_workouts: completedWorkouts,
          progress_percentage: progressPercentage,
        }
      })
    )

    setPrograms(programsWithProgress)
    setIsLoading(false)
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
        <Badge variant="info">{programs.length} Programs</Badge>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">No programs assigned yet</p>
            <p className="text-sm text-gray-500">
              Your coach will assign training programs to you
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card
              key={program.id}
              className="hover:shadow-lg hover:shadow-black/30 hover:border-accent/50 transition-all cursor-pointer"
              onClick={() => router.push(`/user/programs/${program.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{program.name}</CardTitle>
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
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span className="font-semibold text-text-primary">
                        {program.progress_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-bg-hover rounded-full h-2.5">
                      <div
                        className="bg-accent h-2.5 rounded-full transition-all"
                        style={{ width: `${program.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {program.total_workouts}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Total Workouts</p>
                    </div>
                    <div className="bg-bg-hover rounded-lg p-3">
                      <p className="text-2xl font-bold text-text-primary">
                        {program.completed_workouts}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Completed</p>
                    </div>
                  </div>

                  {/* View Button */}
                  <Button
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/user/programs/${program.id}`)
                    }}
                    className="w-full"
                  >
                    View Program
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
