'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface SetLoggerProps {
  setNumber: number
  targetReps: number | null
  previousWeight?: number | null
  previousReps?: number | null
  isCompleted: boolean
  onComplete: (weight: number | null, reps: number) => void
  disabled?: boolean
}

export function SetLogger({
  setNumber,
  targetReps,
  previousWeight,
  isCompleted,
  onComplete,
  disabled = false,
}: SetLoggerProps) {
  const [weight, setWeight] = useState<string>(
    previousWeight?.toString() || ''
  )

  const reps = targetReps || 0

  const handleComplete = () => {
    if (disabled || isCompleted || !weight) return
    const weightValue = parseFloat(weight)
    onComplete(weightValue, reps)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg transition-all',
        isCompleted
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-bg-hover border border-transparent'
      )}
    >
      {/* Set number */}
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-main text-sm font-bold">
        {setNumber}
      </div>

      {/* Weight input */}
      <input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        disabled={isCompleted || disabled}
        className={cn(
          'flex-1 px-3 py-3 rounded-lg text-center font-medium transition-colors',
          'bg-bg-main border border-border focus:border-accent focus:outline-none',
          isCompleted && 'bg-green-500/5 border-green-500/20 text-green-600'
        )}
      />

      {/* Separator */}
      <span className="text-gray-500 font-bold">×</span>

      {/* Reps display (static) */}
      <div
        className={cn(
          'flex-1 px-3 py-3 rounded-lg text-center font-medium',
          'bg-bg-main border border-border',
          isCompleted && 'bg-green-500/5 border-green-500/20 text-green-600'
        )}
      >
        {reps}
      </div>

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={isCompleted || disabled || !weight}
        className={cn(
          'w-12 h-12 flex items-center justify-center rounded-full transition-all',
          isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-accent hover:bg-accent-hover text-white',
          (disabled || !weight) && !isCompleted && 'opacity-50 cursor-not-allowed'
        )}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  )
}
