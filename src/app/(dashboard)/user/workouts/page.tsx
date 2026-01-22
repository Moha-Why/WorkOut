'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Workout, Exercise, Program } from '@/types'
import { WorkoutCard } from '@/components/workouts/WorkoutCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { downloadWorkouts } from '@/lib/offline/download'
import { getAllWorkouts, clearAllOfflineData } from '@/lib/offline/db'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Link from 'next/link'

interface WorkoutWithExercises extends Workout {
  exercises: Exercise[]
  is_completed?: boolean
}

export default function UserWorkoutsPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const programId = searchParams.get('program')

  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([])
  const [programName, setProgramName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadedWorkoutIds, setDownloadedWorkoutIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchWorkouts = async () => {
      if (!profile) {
        setIsLoading(false)
        return
      }

      // Always set loading to true when fetching
      setIsLoading(true)

      const supabase = createClient()

      // If no program ID, fetch user's programs first
      if (!programId) {
        const { data: userPrograms } = await supabase
          .from('user_programs')
          .select(`
            program_id,
            programs (
              id,
              name,
              description,
              weeks
            )
          `)
          .eq('user_id', profile.id)

        const programs = userPrograms?.map((p: any) => p.programs) || []
        setAvailablePrograms(programs)

        // If user has exactly one program, auto-redirect to it
        if (programs.length === 1) {
          router.replace(`/user/workouts?program=${programs[0].id}`)
          return
        }

        setIsLoading(false)
        return
      }

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

      // Fetch completion status for each workout
      const workoutsWithCompletion = await Promise.all(
        (workoutData || []).map(async (workout: any) => {
          const { data: progressData } = await supabase
            .from('user_workout_progress')
            .select('id')
            .eq('user_id', profile.id)
            .eq('workout_id', workout.id)
            .limit(1)

          return {
            ...workout,
            is_completed: (progressData && progressData.length > 0),
          }
        })
      )

      setWorkouts(workoutsWithCompletion as WorkoutWithExercises[])
      setIsLoading(false)
    }

    fetchWorkouts()
  }, [profile, programId, router])

  // Check which workouts are already downloaded
  useEffect(() => {
    const checkDownloaded = async () => {
      try {
        const downloaded = await getAllWorkouts()
        setDownloadedWorkoutIds(new Set(downloaded.map((w) => w.id)))
      } catch (error) {
        console.error('Error checking downloaded workouts:', error)
      }
    }
    checkDownloaded()
  }, [workouts])

  const handleDownloadAll = async () => {
    if (isDownloading || workouts.length === 0) return

    setIsDownloading(true)
    try {
      const workoutsToDownload = workouts
        .filter((w) => !downloadedWorkoutIds.has(w.id))
        .map((w) => ({ workout: w, exercises: w.exercises }))

      if (workoutsToDownload.length === 0) {
        setToast({
          message: 'All workouts are already downloaded',
          type: 'info',
          isOpen: true,
        })
        setIsDownloading(false)
        return
      }

      const { success, failed } = await downloadWorkouts(workoutsToDownload)

      // Refresh downloaded list
      const downloaded = await getAllWorkouts()
      setDownloadedWorkoutIds(new Set(downloaded.map((w) => w.id)))

      if (failed === 0) {
        setToast({
          message: `Downloaded ${success} workouts for offline use`,
          type: 'success',
          isOpen: true,
        })
      } else {
        setToast({
          message: `Downloaded ${success} workouts, ${failed} failed`,
          type: 'error',
          isOpen: true,
        })
      }
    } catch (error) {
      console.error('Error downloading workouts:', error)
      setToast({
        message: 'Error downloading workouts',
        type: 'error',
        isOpen: true,
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDeleteAllDownloads = async () => {
    setIsDeleting(true)
    try {
      await clearAllOfflineData()
      setDownloadedWorkoutIds(new Set())
      setToast({
        message: 'All downloaded workouts deleted',
        type: 'success',
        isOpen: true,
      })
    } catch (error) {
      console.error('Error deleting downloads:', error)
      setToast({
        message: 'Error deleting downloads',
        type: 'error',
        isOpen: true,
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteAllConfirm(false)
    }
  }

  const notDownloadedCount = workouts.filter((w) => !downloadedWorkoutIds.has(w.id)).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
      </div>
    )
  }

  if (!programId) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/user" className="text-sm text-gray-400 hover:text-accent mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">My Workouts</h1>
        </div>

        {availablePrograms.length === 0 ? (
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
          <>
            <p className="text-gray-400">Select a program to view workouts</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availablePrograms.map((program) => (
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
          </>
        )}
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/user" className="text-sm text-gray-400 hover:text-accent mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">{programName}</h1>
          <p className="text-gray-400 mt-1">
            {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'}
            {downloadedWorkoutIds.size > 0 && (
              <span className="ml-2 text-green-500">
                ({downloadedWorkoutIds.size} downloaded)
              </span>
            )}
          </p>
        </div>

        {/* Download/Delete Buttons */}
        {workouts.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadAll}
              disabled={isDownloading || notDownloadedCount === 0}
              variant={notDownloadedCount === 0 ? 'outline' : 'primary'}
              className={notDownloadedCount === 0 ? 'text-green-600 border-green-600' : ''}
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Downloading...
                </>
              ) : notDownloadedCount === 0 ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All Downloaded
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download All ({notDownloadedCount})
                </>
              )}
            </Button>
            {downloadedWorkoutIds.size > 0 && (
              <Button
                onClick={() => setShowDeleteAllConfirm(true)}
                variant="danger"
                disabled={isDeleting}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Downloads
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Workouts by week */}
      {Object.keys(workoutsByWeek).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-400 mb-2">No workouts in this program yet</p>
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
              <h2 className="text-xl font-bold text-text-primary mb-4">
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
                        exercises={workout.exercises}
                        exerciseCount={workout.exercises.length}
                        isCompleted={workout.is_completed || false}
                        showDownload={true}
                      />
                    </Link>
                  ))}
              </div>
            </div>
          ))
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />

      {/* Delete All Downloads Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAllDownloads}
        title="Delete All Downloads"
        message={`Are you sure you want to delete all ${downloadedWorkoutIds.size} downloaded workout${downloadedWorkoutIds.size === 1 ? '' : 's'}? You'll need to download them again for offline use.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete All'}
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
