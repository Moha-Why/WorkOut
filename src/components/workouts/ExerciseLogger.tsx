'use client'

import { Exercise, SetLog, ExerciseSet } from '@/types'
import { SetLogger } from './SetLogger'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { MuscleModel } from '@/components/ui/MuscleModel'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

interface ExerciseLoggerProps {
  exercise: Exercise
  exerciseSets?: ExerciseSet[]
  previousLogs?: SetLog[]
  onSetComplete: (exerciseId: string, setNumber: number, weight: number | null, reps: number, restSeconds: number) => void
  completedSets: Set<number>
  disabled?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export function ExerciseLogger({
  exercise,
  exerciseSets = [],
  previousLogs = [],
  onSetComplete,
  completedSets,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
}: ExerciseLoggerProps) {
  // Use exercise_sets if available, otherwise fall back to exercise defaults
  const totalSets = exerciseSets.length > 0 ? exerciseSets.length : (exercise.sets || 3)

  // Get set config for current set
  const getSetConfig = (setNumber: number): ExerciseSet | undefined => {
    return exerciseSets.find(s => s.set_number === setNumber)
  }

  // Get target reps for a specific set
  const getTargetReps = (setNumber: number): number | null => {
    const setConfig = getSetConfig(setNumber)
    if (setConfig?.target_reps) return setConfig.target_reps
    return exercise.reps ? Number(exercise.reps) : null
  }

  // Get target weight for a specific set
  const getTargetWeight = (setNumber: number): number | null => {
    const setConfig = getSetConfig(setNumber)
    return setConfig?.target_weight ?? null
  }

  // Get rest seconds for a specific set
  const getRestSeconds = (setNumber: number): number => {
    const setConfig = getSetConfig(setNumber)
    return setConfig?.rest_seconds || exercise.rest_seconds || 60
  }

  // For display in header
  const defaultReps = exerciseSets[0]?.target_reps || (exercise.reps ? Number(exercise.reps) : null)
  const defaultRest = exerciseSets[0]?.rest_seconds || exercise.rest_seconds || 60

  // Get previous log for a specific set
  const getPreviousLog = (setNumber: number): SetLog | undefined => {
    return previousLogs.find((log) => log.set_number === setNumber)
  }

  const handleSetComplete = (setNumber: number, weight: number | null, reps: number) => {
    // Pass rest seconds to parent so it can handle the timer at page level
    // Always show timer, even for the last set (to rest before next exercise)
    const restSeconds = getRestSeconds(setNumber)
    onSetComplete(exercise.id, setNumber, weight, reps, restSeconds)
  }

  const completedCount = completedSets.size
  const isAllCompleted = completedCount === totalSets

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
              {totalSets} sets × {defaultReps || '?'} reps
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
          {((exercise.target_muscles?.length ?? 0) > 0 || (exercise.assisting_muscles?.length ?? 0) > 0) && (
            <div className="border-t border-border pt-4">
              <MuscleModel
                targetMuscles={exercise.target_muscles || []}
                assistingMuscles={exercise.assisting_muscles || []}
                view="both"
              />
            </div>
          )}


          {/* All Sets - show all at once */}
          {!isAllCompleted && (
            <div className="space-y-2">
              {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNum) => {
                const setTargetReps = getTargetReps(setNum)
                const setTargetWeight = getTargetWeight(setNum)
                const setPrevLog = getPreviousLog(setNum)
                return (
                  <SetLogger
                    key={setNum}
                    setNumber={setNum}
                    targetReps={setTargetReps}
                    targetWeight={setTargetWeight}
                    previousWeight={setPrevLog?.weight}
                    previousReps={setPrevLog?.reps}
                    isCompleted={completedSets.has(setNum)}
                    onComplete={(weight, reps) => handleSetComplete(setNum, weight, reps)}
                    disabled={disabled}
                  />
                )
              })}
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
