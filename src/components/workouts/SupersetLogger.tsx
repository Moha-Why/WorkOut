'use client'

import { Exercise, SetLog, ExerciseSet } from '@/types'
import { SetLogger } from './SetLogger'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { useState } from 'react'

interface SupersetLoggerProps {
  exercises: Exercise[]
  supersetGroup: string
  exerciseSetsMap: Record<string, ExerciseSet[]>
  previousLogsMap: Record<string, SetLog[]>
  completedSetsMap: Record<string, Set<number>>
  onSetComplete: (exerciseId: string, setNumber: number, weight: number | null, reps: number, restSeconds: number, isLastInSuperset: boolean) => void
  disabled?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  totalSetsOverride?: Record<string, number>
  onAddRound?: (supersetGroup: string) => void
}

export function SupersetLogger({
  exercises,
  supersetGroup,
  exerciseSetsMap,
  previousLogsMap,
  completedSetsMap,
  onSetComplete,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
  totalSetsOverride,
  onAddRound,
}: SupersetLoggerProps) {
  // Sort exercises by superset_order
  const sortedExercises = [...exercises].sort((a, b) =>
    (a.superset_order || 0) - (b.superset_order || 0)
  )

  // Get set config for a specific exercise and set number
  const getSetConfig = (exerciseId: string, setNumber: number): ExerciseSet | undefined => {
    return exerciseSetsMap[exerciseId]?.find(s => s.set_number === setNumber)
  }

  // Get target reps for a specific set
  const getTargetReps = (exercise: Exercise, setNumber: number): number | null => {
    const setConfig = getSetConfig(exercise.id, setNumber)
    if (setConfig?.target_reps) return setConfig.target_reps
    return exercise.reps ? Number(exercise.reps) : null
  }

  // Get target weight for a specific set
  const getTargetWeight = (exercise: Exercise, setNumber: number): number | null => {
    const setConfig = getSetConfig(exercise.id, setNumber)
    return setConfig?.target_weight ?? null
  }

  // Get rest seconds for a specific set
  const getRestSeconds = (exercise: Exercise, setNumber: number): number => {
    const setConfig = getSetConfig(exercise.id, setNumber)
    return setConfig?.rest_seconds || exercise.rest_seconds || 60
  }

  // Get previous log for a specific set
  const getPreviousLog = (exerciseId: string, setNumber: number): SetLog | undefined => {
    return previousLogsMap[exerciseId]?.find((log) => log.set_number === setNumber)
  }

  // Calculate total sets (all exercises should have same number)
  const maxSets = Math.max(...sortedExercises.map(ex => {
    if (totalSetsOverride && totalSetsOverride[ex.id]) {
      return totalSetsOverride[ex.id]
    }
    return exerciseSetsMap[ex.id]?.length || ex.sets || 3
  }))

  // Calculate completion status
  const getTotalCompletedSets = () => {
    let total = 0
    for (let setNum = 1; setNum <= maxSets; setNum++) {
      const allExercisesCompletedThisSet = sortedExercises.every(ex =>
        completedSetsMap[ex.id]?.has(setNum)
      )
      if (allExercisesCompletedThisSet) {
        total++
      }
    }
    return total
  }

  const completedRounds = getTotalCompletedSets()
  const isAllCompleted = completedRounds === maxSets

  // For display in header
  const firstExercise = sortedExercises[0]
  const defaultReps = exerciseSetsMap[firstExercise.id]?.[0]?.target_reps ||
                      (firstExercise.reps ? Number(firstExercise.reps) : null)
  const defaultRest = exerciseSetsMap[firstExercise.id]?.[0]?.rest_seconds ||
                      firstExercise.rest_seconds || 60

  // Handle set completion - determine if this is the last exercise in the superset for this set
  const handleSetComplete = (exercise: Exercise, setNumber: number, weight: number | null, reps: number) => {
    const isLastExercise = exercise.superset_order === Math.max(...sortedExercises.map(e => e.superset_order || 0))
    const restSeconds = getRestSeconds(exercise, setNumber)
    onSetComplete(exercise.id, setNumber, weight, reps, restSeconds, isLastExercise)
  }

  return (
    <Card
      className={cn(
        'transition-all overflow-hidden border-l-4',
        isAllCompleted
          ? 'border-l-green-500 border-green-500/30 bg-green-500/5'
          : 'border-l-blue-500'
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
                : completedRounds > 0
                ? 'bg-accent/20 text-accent'
                : 'bg-bg-hover text-text-primary'
            )}
          >
            {isAllCompleted ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              `${completedRounds}/${maxSets}`
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="info" className="text-xs">SUPERSET {supersetGroup}</Badge>
              <h3 className="font-semibold text-text-primary">
                {sortedExercises.map(ex => ex.name).join(' + ')}
              </h3>
            </div>
            <p className="text-sm text-gray-500">
              {maxSets} rounds × {defaultReps || '?'} reps
              {defaultRest && ` • ${defaultRest}s rest`}
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
        <CardContent className="pt-0 pb-4 space-y-6">
          {/* Render each exercise in the superset */}
          {sortedExercises.map((exercise, idx) => {
            const exerciseSets = exerciseSetsMap[exercise.id] || []
            const totalSets = totalSetsOverride?.[exercise.id] || exerciseSets.length || exercise.sets || 3
            const completedSets = completedSetsMap[exercise.id] || new Set()
            const completedCount = completedSets.size

            return (
              <div key={exercise.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                {/* Exercise header */}
                <div className="mb-3">
                  <h4 className="font-semibold text-text-primary flex items-center gap-2">
                    <span className="text-blue-500">{supersetGroup}{String.fromCharCode(65 + idx)}.</span>
                    {exercise.name}
                    <span className="text-sm text-gray-400">({completedCount}/{totalSets})</span>
                  </h4>
                </div>

                {/* Video */}
                {exercise.video_id && (
                  <VideoPlayer
                    provider={exercise.video_provider}
                    videoId={exercise.video_id}
                    className="rounded-lg overflow-hidden mb-3"
                  />
                )}

                {/* Notes */}
                {exercise.notes && (
                  <p className="text-sm text-gray-400 bg-bg-hover p-3 rounded-lg mb-3">
                    {exercise.notes}
                  </p>
                )}

                {/* Muscle Model */}
                {((exercise.target_muscles?.length ?? 0) > 0 || (exercise.assisting_muscles?.length ?? 0) > 0) && (
                  <div className="mb-3">
                    <MuscleModel
                      targetMuscles={exercise.target_muscles || []}
                      assistingMuscles={exercise.assisting_muscles || []}
                      view="both"
                    />
                  </div>
                )}

                {/* Sets for this exercise */}
                {!isAllCompleted && (
                  <div className="space-y-2">
                    {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNum) => {
                      const setTargetReps = getTargetReps(exercise, setNum)
                      const setTargetWeight = getTargetWeight(exercise, setNum)
                      const setPrevLog = getPreviousLog(exercise.id, setNum)
                      return (
                        <SetLogger
                          key={setNum}
                          setNumber={setNum}
                          targetReps={setTargetReps}
                          targetWeight={setTargetWeight}
                          previousWeight={setPrevLog?.weight}
                          previousReps={setPrevLog?.reps}
                          isCompleted={completedSets.has(setNum)}
                          onComplete={(weight, reps) => handleSetComplete(exercise, setNum, weight, reps)}
                          disabled={disabled}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* All sets completed message */}
          {isAllCompleted && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-500 font-semibold">Superset Complete!</p>
              <p className="text-sm text-gray-400 mt-1">All {maxSets} rounds completed</p>
            </div>
          )}

          {/* Add round button */}
          {isAllCompleted && onAddRound && (
            <Button
              onClick={() => onAddRound(supersetGroup)}
              variant="outline"
              className="w-full"
            >
              + Add Another Round
            </Button>
          )}

          {/* Completed rounds summary */}
          {completedRounds > 0 && !isAllCompleted && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-gray-500 mb-2">Completed Rounds:</p>
              <div className="space-y-1">
                {Array.from({ length: maxSets }, (_, i) => i + 1)
                  .filter((roundNum) => {
                    return sortedExercises.every(ex =>
                      completedSetsMap[ex.id]?.has(roundNum)
                    )
                  })
                  .map((roundNum) => (
                    <div
                      key={roundNum}
                      className="flex items-center justify-between text-sm text-gray-400 bg-bg-hover/50 px-3 py-2 rounded"
                    >
                      <span>Round {roundNum}</span>
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
