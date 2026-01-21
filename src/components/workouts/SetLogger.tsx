'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface SetLoggerProps {
  setNumber: number
  targetReps: number | null
  targetWeight?: number | null
  previousWeight?: number | null
  previousReps?: number | null
  isCompleted: boolean
  onComplete: (weight: number | null, reps: number) => void
  disabled?: boolean
}

export function SetLogger({
  setNumber,
  targetReps,
  targetWeight,
  previousWeight,
  isCompleted,
  onComplete,
  disabled = false,
}: SetLoggerProps) {
  // Priority: previous weight > target weight > empty
  const getInitialWeight = () => {
    if (previousWeight != null) return previousWeight.toString()
    if (targetWeight != null) return targetWeight.toString()
    return ''
  }

  const [weight, setWeight] = useState<string>(getInitialWeight())

  // Update weight when set changes (new targetWeight or previousWeight)
  useEffect(() => {
    if (!isCompleted) {
      // Priority: previous weight > target weight > empty
      if (previousWeight != null) {
        setWeight(previousWeight.toString())
      } else if (targetWeight != null) {
        setWeight(targetWeight.toString())
      } else {
        setWeight('')
      }
    }
  }, [setNumber, targetWeight, previousWeight, isCompleted])

  const reps = targetReps || 0

  const handleComplete = () => {
    if (disabled || isCompleted || !weight) return
    const weightValue = parseFloat(weight)
    onComplete(weightValue, reps)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg transition-all',
        isCompleted
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-bg-hover border border-transparent'
      )}
    >
      {/* Set number */}
      <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">Set</label>
        <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-bg-main text-sm font-bold shrink-0">
          {setNumber}
        </div>
      </div>

      {/* Weight input */}
      <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">Weight</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          disabled={isCompleted || disabled}
          className={cn(
            'w-20 sm:w-24 px-2 sm:px-3 py-2.5 sm:py-3 rounded-lg text-center font-medium transition-colors',
            'bg-bg-main border border-border focus:border-accent focus:outline-none',
            isCompleted && 'bg-green-500/5 border-green-500/20 text-green-600'
          )}
        />
      </div>

      {/* Separator */}
      <span className="text-gray-500 font-bold shrink-0 mt-5">×</span>

      {/* Reps display (static) */}
      <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">Reps</label>
        <div
          className={cn(
            'w-14 sm:w-20 px-2 sm:px-3 py-2.5 sm:py-3 rounded-lg text-center font-medium',
            'bg-bg-main border border-border',
            isCompleted && 'bg-green-500/5 border-green-500/20 text-green-600'
          )}
        >
          {reps}
        </div>
      </div>

      {/* Spacer to push button to right */}
      <div className="flex-1" />

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={isCompleted || disabled || !weight}
        className={cn(
          'w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all shrink-0 mt-4',
          isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-accent hover:bg-accent-hover text-white',
          (disabled || !weight) && !isCompleted && 'opacity-50 cursor-not-allowed'
        )}
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  )
}
