'use client'

import { useEffect, useState } from 'react'
import { MuscleGroup } from '@/types'
import { getMuscleColor, groupMusclesByCategory } from '@/lib/utils/muscles'
import { createClient } from '@/lib/supabase/client'

interface MuscleModelProps {
  targetMuscles?: string[]
  assistingMuscles?: string[]
  view?: 'front' | 'back' | 'both'
  interactive?: boolean
  onMuscleClick?: (muscleId: string) => void
  className?: string
}

export function MuscleModel({
  targetMuscles = [],
  assistingMuscles = [],
  view = 'front',
  interactive = false,
  onMuscleClick,
  className = '',
}: MuscleModelProps) {
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'front' | 'back'>(
    view === 'both' ? 'front' : view
  )

  useEffect(() => {
    const fetchMuscles = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('muscle_groups')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching muscles:', error)
      } else {
        setMuscles(data || [])
      }
      setIsLoading(false)
    }

    fetchMuscles()
  }, [])

  const groupedMuscles = groupMusclesByCategory(muscles)
  const currentMuscles =
    selectedView === 'front' ? groupedMuscles.front : groupedMuscles.back

  const handleMuscleClick = (muscleId: string) => {
    if (interactive && onMuscleClick) {
      onMuscleClick(muscleId)
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {view === 'both' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSelectedView('front')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedView === 'front'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setSelectedView('back')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedView === 'back'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Back
          </button>
        </div>
      )}

      <div className="relative">
        <svg
          viewBox="0 0 400 600"
          className="w-full h-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body outline */}
          <path
            d="M200,80 L200,50 C200,40 190,30 180,30 L220,30 C210,30 200,40 200,50 L200,80"
            fill="#f3f4f6"
            stroke="#9ca3af"
            strokeWidth="2"
          />

          {/* Render muscle groups */}
          {currentMuscles.map((muscle) => {
            const color = getMuscleColor(
              muscle.id,
              targetMuscles,
              assistingMuscles
            )
            const isTarget = targetMuscles.includes(muscle.id)
            const isAssisting = assistingMuscles?.includes(muscle.id)

            return (
              <g key={muscle.id}>
                <path
                  d={muscle.svg_path}
                  className={`transition-all ${color} ${
                    interactive ? 'cursor-pointer hover:opacity-80' : ''
                  }`}
                  stroke="#1f2937"
                  strokeWidth={isTarget ? '3' : '1'}
                  onClick={() => handleMuscleClick(muscle.id)}
                  style={{
                    strokeDasharray: isAssisting ? '5,5' : 'none',
                  }}
                />
                {/* Label on hover */}
                <title>{muscle.name}</title>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        {(targetMuscles.length > 0 || assistingMuscles.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {targetMuscles.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-500/80 border-2 border-gray-900" />
                <span className="text-gray-700">Target Muscles</span>
              </div>
            )}
            {assistingMuscles.length > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded bg-blue-400/60 border border-gray-900"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(59, 130, 246, 0.6) 2px, rgba(59, 130, 246, 0.6) 4px)',
                  }}
                />
                <span className="text-gray-700">Assisting Muscles</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Muscle list */}
      {interactive && (
        <div className="mt-4 space-y-2">
          {currentMuscles.map((muscle) => {
            const isSelected =
              targetMuscles.includes(muscle.id) ||
              assistingMuscles.includes(muscle.id)
            return (
              <button
                key={muscle.id}
                onClick={() => handleMuscleClick(muscle.id)}
                className={`w-full rounded-lg px-4 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {muscle.name}
                {muscle.name_ar && (
                  <span className="mr-2 text-xs opacity-75">
                    ({muscle.name_ar})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
