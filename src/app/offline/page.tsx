'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { getAllWorkouts, getStorageEstimate } from '@/lib/offline/db'
import { OfflineWorkout } from '@/types/offline'
import { Exercise } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true)
  const [downloadedWorkouts, setDownloadedWorkouts] = useState<OfflineWorkout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Workout player state
  const [selectedWorkout, setSelectedWorkout] = useState<OfflineWorkout | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)

  useEffect(() => {
    setIsMounted(true)
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    loadOfflineContent()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadOfflineContent = async () => {
    try {
      const [workouts, storage] = await Promise.all([
        getAllWorkouts(),
        getStorageEstimate(),
      ])
      setDownloadedWorkouts(workouts)
      setStorageInfo({ usage: storage.usage, quota: storage.quota })
    } catch (error) {
      console.error('Error loading offline content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = '/'
    } else {
      window.location.reload()
    }
  }

  const handleWorkoutSelect = (workout: OfflineWorkout) => {
    setSelectedWorkout(workout)
    setCurrentExerciseIndex(0)
  }

  const handleBackToList = () => {
    setSelectedWorkout(null)
    setCurrentExerciseIndex(0)
  }

  const currentExercise: Exercise | null = selectedWorkout?.exercises?.[currentExerciseIndex] || null
  const totalExercises = selectedWorkout?.exercises?.length || 0

  const handleNextExercise = () => {
    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex((prev) => prev + 1)
    }
  }

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((prev) => prev - 1)
    }
  }

  // Show loading state until mounted (prevents SSR hydration issues)
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-text-primary/60">Loading...</div>
      </div>
    )
  }

  // Workout Player View
  if (selectedWorkout) {
    const workout = selectedWorkout.data
    const exercises = selectedWorkout.exercises || []

    return (
      <div className="min-h-screen bg-bg-main">
        {/* Header */}
        <div className="bg-bg-secondary border-b border-border px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleBackToList}
              className="text-sm text-text-primary/60 hover:text-accent mb-2 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Downloads
            </button>
            <h1 className="text-xl font-bold text-text-primary">{workout.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="info" className="text-xs">Week {workout.week_number}</Badge>
              <Badge variant="default" className="text-xs">Day {workout.day_number}</Badge>
              <Badge variant="warning" className="text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Offline Preview
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-primary/60">
              Exercise {currentExerciseIndex + 1} of {totalExercises}
            </span>
          </div>

          {/* Current exercise */}
          {currentExercise && (
            <>
              {/* Video - show placeholder when offline for YouTube/Vimeo */}
              {!isOnline && (currentExercise.video_provider === 'youtube' || currentExercise.video_provider === 'vimeo') ? (
                <div className="w-full aspect-video bg-bg-secondary rounded-xl flex flex-col items-center justify-center border border-border">
                  <svg className="w-12 h-12 text-text-primary/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-text-primary/50 text-sm font-medium">Video unavailable offline</p>
                  <p className="text-text-primary/30 text-xs mt-1">Connect to internet to watch</p>
                </div>
              ) : (
                <VideoPlayer
                  provider={currentExercise.video_provider}
                  videoId={currentExercise.video_id}
                  className="rounded-xl overflow-hidden"
                />
              )}

              {/* Exercise details */}
              <Card>
                <CardContent className="py-4 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary mb-1">
                      {currentExercise.name}
                    </h2>
                    {currentExercise.notes && (
                      <p className="text-sm text-text-primary/60">{currentExercise.notes}</p>
                    )}
                  </div>

                  {/* Sets, Reps, Rest */}
                  <div className="flex gap-6">
                    {currentExercise.sets && (
                      <div>
                        <p className="text-xs text-text-primary/50">Sets</p>
                        <p className="text-2xl font-bold text-text-primary">
                          {currentExercise.sets}
                        </p>
                      </div>
                    )}
                    {currentExercise.reps && (
                      <div>
                        <p className="text-xs text-text-primary/50">Reps</p>
                        <p className="text-2xl font-bold text-text-primary">
                          {currentExercise.reps}
                        </p>
                      </div>
                    )}
                    {currentExercise.rest_seconds && (
                      <div>
                        <p className="text-xs text-text-primary/50">Rest</p>
                        <p className="text-2xl font-bold text-text-primary">
                          {currentExercise.rest_seconds}s
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Muscle visualization */}
                  {(currentExercise.target_muscles || currentExercise.assisting_muscles) && (
                    <div className="pt-4 border-t border-border">
                      <MuscleModel
                        targetMuscles={currentExercise.target_muscles}
                        assistingMuscles={currentExercise.assisting_muscles || []}
                        view="both"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePreviousExercise}
                  variant="outline"
                  disabled={currentExerciseIndex === 0}
                  className="flex-1"
                >
                  ← Previous
                </Button>
                <Button
                  onClick={handleNextExercise}
                  variant="outline"
                  disabled={currentExerciseIndex === totalExercises - 1}
                  className="flex-1"
                >
                  Next →
                </Button>
              </div>

              {/* Info banner */}
              <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-accent font-medium">Preview Mode</p>
                    <p className="text-xs text-accent/70 mt-0.5">
                      Go online to track your progress and complete workouts.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Exercise list */}
          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold text-text-primary mb-3">All Exercises</h3>
              <div className="space-y-2">
                {exercises.map((exercise, index) => (
                  <button
                    key={exercise.id}
                    onClick={() => setCurrentExerciseIndex(index)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                      index === currentExerciseIndex
                        ? 'bg-accent text-bg-main'
                        : 'bg-bg-hover text-text-primary hover:bg-bg-hover/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{index + 1}.</span>
                      <span>{exercise.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Workout List View
  return (
    <div className="min-h-screen bg-bg-main">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success' : 'bg-accent'}`} />
            <span className="text-sm font-medium text-text-primary/70">
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isOnline ? 'Connection Restored' : 'Offline Workouts'}
          </h1>
          <p className="text-text-primary/60 mt-1">
            {isOnline
              ? 'You\'re back online! Continue to the app to track your progress.'
              : 'Preview your downloaded workouts while offline.'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Online Banner */}
        {isOnline && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-success">Connection restored!</p>
                <p className="text-sm text-success/70">Go to the app to track your workout progress.</p>
              </div>
              <Button onClick={handleRetry} size="sm">
                Go to App
              </Button>
            </div>
          </div>
        )}

        {/* Downloaded Workouts Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Downloaded Workouts</h2>
            {storageInfo && storageInfo.usage > 0 && (
              <span className="text-sm text-text-primary/50">
                {formatBytes(storageInfo.usage)} used
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg-secondary rounded-xl border border-border p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-bg-hover rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-bg-hover rounded w-3/4" />
                      <div className="h-3 bg-bg-hover rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : downloadedWorkouts.length > 0 ? (
            <div className="space-y-3">
              {downloadedWorkouts.map((offlineWorkout) => {
                const workout = offlineWorkout.data
                const exerciseCount = offlineWorkout.exercises?.length || 0

                return (
                  <Card
                    key={offlineWorkout.id}
                    className="cursor-pointer hover:shadow-lg hover:shadow-accent/10 hover:border-accent/50 transition-all"
                    onClick={() => handleWorkoutSelect(offlineWorkout)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="info" className="text-xs">
                              Week {workout.week_number}
                            </Badge>
                            <Badge variant="default" className="text-xs">
                              Day {workout.day_number}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-text-primary truncate">
                            {workout.name}
                          </h3>
                          <p className="text-sm text-text-primary/50">
                            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                            <span className="mx-2">•</span>
                            Downloaded {formatDate(offlineWorkout.cached_at)}
                          </p>
                        </div>

                        {/* Arrow */}
                        <div className="text-text-primary/40">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 bg-bg-hover rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-text-primary mb-1">No Downloaded Workouts</h3>
                <p className="text-sm text-text-primary/50 max-w-xs mx-auto">
                  Download workouts while online to preview them offline. Look for the download button on workout pages.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Help Section */}
        {!isOnline && (
          <Card className="bg-bg-secondary border-border">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-bg-hover rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-text-primary font-medium">Offline Preview</p>
                  <ul className="text-sm text-text-primary/50 mt-1 space-y-1">
                    <li>• Browse exercises and view details</li>
                    <li>• Go online to track progress</li>
                    <li>• Download more workouts when connected</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Retry Button when offline */}
        {!isOnline && (
          <div className="pt-4">
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check Connection
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
