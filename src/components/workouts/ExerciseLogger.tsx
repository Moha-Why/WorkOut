'use client'

import { useState, useEffect, useCallback } from 'react'
import { Exercise, SetLog } from '@/types'
import { SetLogger } from './SetLogger'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface ExerciseLoggerProps {
  exercise: Exercise
  previousLogs?: SetLog[]
  onSetComplete: (exerciseId: string, setNumber: number, weight: number | null, reps: number) => void
  completedSets: Set<number>
  disabled?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export function ExerciseLogger({
  exercise,
  previousLogs = [],
  onSetComplete,
  completedSets,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
}: ExerciseLoggerProps) {
  const totalSets = exercise.sets || 3
  const targetReps = exercise.reps || null
  const restSeconds = exercise.rest_seconds || 60

  // Current set to show (next uncompleted set)
  const [currentSetNumber, setCurrentSetNumber] = useState(1)

  // Rest timer state
  const [isResting, setIsResting] = useState(false)
  const [restTimeLeft, setRestTimeLeft] = useState(restSeconds)

  // Update current set when completedSets changes
  useEffect(() => {
    // Find the first uncompleted set
    for (let i = 1; i <= totalSets; i++) {
      if (!completedSets.has(i)) {
        setCurrentSetNumber(i)
        return
      }
    }
    // All sets completed
    setCurrentSetNumber(totalSets)
  }, [completedSets, totalSets])

  // Rest timer countdown
  useEffect(() => {
    if (!isResting) return

    if (restTimeLeft <= 0) {
      setIsResting(false)
      setRestTimeLeft(restSeconds)
      return
    }

    const timer = setInterval(() => {
      setRestTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isResting, restTimeLeft, restSeconds])

  // Get previous log for a specific set
  const getPreviousLog = (setNumber: number): SetLog | undefined => {
    return previousLogs.find((log) => log.set_number === setNumber)
  }

  const handleSetComplete = (weight: number | null, reps: number) => {
    onSetComplete(exercise.id, currentSetNumber, weight, reps)

    // Start rest timer if not the last set
    if (currentSetNumber < totalSets) {
      setIsResting(true)
      setRestTimeLeft(restSeconds)
    }
  }

  const skipRest = () => {
    setIsResting(false)
    setRestTimeLeft(restSeconds)
  }

  const completedCount = completedSets.size
  const isAllCompleted = completedCount === totalSets
  const prevLog = getPreviousLog(currentSetNumber)

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card
      className={cn(
        'transition-all overflow-hidden',
        isAllCompleted && 'border-green-500/30 bg-green-500/5'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-bg-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
              isAllCompleted
                ? 'bg-green-500 text-white'
                : completedCount > 0
                ? 'bg-accent/20 text-accent'
                : 'bg-bg-hover text-text-primary'
            )}
          >
            {isAllCompleted ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              `${completedCount}/${totalSets}`
            )}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{exercise.name}</h3>
            <p className="text-sm text-gray-500">
              {totalSets} sets × {targetReps || '?'} reps
              {restSeconds && ` • ${restSeconds}s rest`}
            </p>
          </div>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-4">
          {/* Video */}
          {exercise.video_id && (
            <VideoPlayer
              provider={exercise.video_provider}
              videoId={exercise.video_id}
              className="rounded-lg overflow-hidden"
            />
          )}

          {/* Notes */}
          {exercise.notes && (
            <p className="text-sm text-gray-400 bg-bg-hover p-3 rounded-lg">
              {exercise.notes}
            </p>
          )}

          {/* Muscle Model */}
          {(exercise.target_muscles?.length > 0 || exercise.assisting_muscles?.length > 0) && (
            <div className="border-t border-border pt-4">
              <MuscleModel
                targetMuscles={exercise.target_muscles || []}
                assistingMuscles={exercise.assisting_muscles || []}
                view="both"
              />
            </div>
          )}

          {/* Rest Timer */}
          {isResting && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 text-center">
              <p className="text-sm text-orange-400 mb-2">Rest Time</p>
              <p className="text-5xl font-bold text-orange-500 mb-4">
                {formatTime(restTimeLeft)}
              </p>
              <Button
                onClick={skipRest}
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
              >
                Skip Rest
              </Button>
            </div>
          )}

          {/* Current Set - Only show when not resting */}
          {!isResting && !isAllCompleted && (
            <div className="space-y-3">
              {/* Set progress indicator */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">
                  Set {currentSetNumber} of {totalSets}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNum) => (
                    <div
                      key={setNum}
                      className={cn(
                        'w-3 h-3 rounded-full transition-colors',
                        completedSets.has(setNum)
                          ? 'bg-green-500'
                          : setNum === currentSetNumber
                          ? 'bg-accent'
                          : 'bg-gray-600'
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Current set logger */}
              <SetLogger
                setNumber={currentSetNumber}
                targetReps={targetReps}
                previousWeight={prevLog?.weight}
                previousReps={prevLog?.reps}
                isCompleted={completedSets.has(currentSetNumber)}
                onComplete={handleSetComplete}
                disabled={disabled}
              />
            </div>
          )}

          {/* All sets completed message */}
          {isAllCompleted && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-500 font-semibold">Exercise Complete!</p>
              <p className="text-sm text-gray-400 mt-1">All {totalSets} sets logged</p>
            </div>
          )}

          {/* Completed sets summary */}
          {completedCount > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs text-gray-500 mb-2">Completed Sets:</p>
              <div className="space-y-1">
                {Array.from({ length: totalSets }, (_, i) => i + 1)
                  .filter((setNum) => completedSets.has(setNum))
                  .map((setNum) => (
                    <div
                      key={setNum}
                      className="flex items-center justify-between text-sm text-gray-400 bg-bg-hover/50 px-3 py-2 rounded"
                    >
                      <span>Set {setNum}</span>
                      <span className="text-green-500">✓</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
