'use client'

import { useEffect, useState } from 'react'
import Model, { Muscle, IExerciseData } from 'react-body-highlighter'
import { MuscleGroup } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface MuscleModelProps {
  targetMuscles?: string[]
  assistingMuscles?: string[]
  view?: 'front' | 'back' | 'both'
  interactive?: boolean
  onMuscleClick?: (muscleId: string) => void
  className?: string
}

// Map our muscle IDs to react-body-highlighter muscle names
const MUSCLE_ID_MAP: Record<string, Muscle> = {
  // Front muscles
  'chest': 'chest',
  'pectorals': 'chest',
  'abs': 'abs',
  'abdominals': 'abs',
  'core': 'abs',
  'obliques': 'obliques',
  'biceps': 'biceps',
  'forearms': 'forearm',
  'forearm': 'forearm',
  'front-delts': 'front-deltoids',
  'front-deltoids': 'front-deltoids',
  'front-shoulders': 'front-deltoids',
  'shoulders': 'front-deltoids',
  'deltoids': 'front-deltoids',
  'quadriceps': 'quadriceps',
  'quads': 'quadriceps',
  'adductors': 'adductor',
  'adductor': 'adductor',
  'calves-front': 'calves',

  // Back muscles
  'back': 'upper-back',
  'upper-back': 'trapezius',
  'lats': 'upper-back',
  'latissimus': 'upper-back',
  'traps': 'trapezius',
  'trapezius': 'trapezius',
  'rhomboids': 'upper-back',
  'lower-back': 'lower-back',
  'erector-spinae': 'lower-back',
  'hamstrings': 'hamstring',
  'hamstring': 'hamstring',
  'glutes': 'gluteal',
  'gluteus': 'gluteal',
  'gluteal': 'gluteal',
  'calves': 'calves',
  'calves-back': 'calves',
  'triceps': 'triceps',
  'rear-delts': 'back-deltoids',
  'rear-shoulders': 'back-deltoids',
  'back-deltoids': 'back-deltoids',
}

// Reverse map for click handling - maps library muscle name to our DB muscle ID
// Some muscles have different IDs for front/back views
const REVERSE_MUSCLE_MAP_FRONT: Record<string, string> = {
  'chest': 'chest',
  'abs': 'abs',
  'obliques': 'obliques',
  'biceps': 'biceps',
  'forearm': 'forearms',
  'front-deltoids': 'front-shoulders',
  'quadriceps': 'quads',
  'adductor': 'adductors',
  'calves': 'calves-front',
}

const REVERSE_MUSCLE_MAP_BACK: Record<string, string> = {
  'upper-back': 'lats',
  'trapezius': 'upper-back',
  'lower-back': 'lower-back',
  'hamstring': 'hamstrings',
  'gluteal': 'glutes',
  'calves': 'calves-back',
  'triceps': 'triceps',
  'back-deltoids': 'rear-shoulders',
  'obliques': 'obliques',
  'neck': 'upper-back',
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

  // Convert our muscle IDs to react-body-highlighter format
  const mapMuscleId = (id: string): Muscle | null => {
    return MUSCLE_ID_MAP[id.toLowerCase()] || null
  }

  // Build exercise data for the highlighter
  const buildExerciseData = (): IExerciseData[] => {
    const data: IExerciseData[] = []

    // Add target muscles (will show with higher intensity)
    if (targetMuscles.length > 0) {
      const mappedMuscles = targetMuscles
        .map(mapMuscleId)
        .filter((m): m is Muscle => m !== null)

      if (mappedMuscles.length > 0) {
        data.push({
          name: 'Target',
          muscles: mappedMuscles,
        })
        // Add again for higher intensity (frequency = 2)
        data.push({
          name: 'Target2',
          muscles: mappedMuscles,
        })
      }
    }

    // Add assisting muscles (lower intensity)
    if (assistingMuscles.length > 0) {
      const mappedMuscles = assistingMuscles
        .map(mapMuscleId)
        .filter((m): m is Muscle => m !== null)

      if (mappedMuscles.length > 0) {
        data.push({
          name: 'Assisting',
          muscles: mappedMuscles,
        })
      }
    }

    return data
  }

  const handleMuscleClick = (muscleId: string) => {
    if (interactive && onMuscleClick) {
      onMuscleClick(muscleId)
    }
  }

  const handleModelClick = ({ muscle }: { muscle: string }) => {
    if (!interactive) return

    // Map back to our muscle ID system based on current view
    const reverseMap = selectedView === 'front' ? REVERSE_MUSCLE_MAP_FRONT : REVERSE_MUSCLE_MAP_BACK
    const ourMuscleId = reverseMap[muscle] || muscle

    // Find matching muscle in our database
    const matchingMuscle = muscles.find(
      (m) => m.id.toLowerCase() === ourMuscleId.toLowerCase() ||
             mapMuscleId(m.id) === muscle
    )

    if (matchingMuscle) {
      handleMuscleClick(matchingMuscle.id)
    }
  }

  // Get all muscles for the current view for the muscle list
  const currentViewMuscles = muscles.filter((muscle) => {
    return muscle.category === selectedView || muscle.category === 'core'
  })

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-orange-500" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {view === 'both' && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedView('front')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedView === 'front'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('back')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedView === 'back'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Back
          </button>
        </div>
      )}

      <div className="relative flex justify-center">
        <Model
          data={buildExerciseData()}
          style={{ width: '15rem', padding: '1rem' }}
          onClick={interactive ? handleModelClick : undefined}
          type={selectedView === 'front' ? 'anterior' : 'posterior'}
          highlightedColors={['#fdba74', '#f97316', '#ea580c']}
        />
      </div>

      {/* Legend */}
      {(targetMuscles.length > 0 || assistingMuscles.length > 0) && (
        <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
          {targetMuscles.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#ea580c' }} />
              <span className="text-gray-600 font-medium">Target</span>
            </div>
          )}
          {assistingMuscles.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#fdba74' }} />
              <span className="text-gray-600 font-medium">Assisting</span>
            </div>
          )}
        </div>
      )}

      {/* Muscle list for interactive mode */}
      {interactive && (
        <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
          <p className="text-sm font-medium text-gray-500 mb-2">
            {selectedView === 'front' ? 'Front' : 'Back'} Muscles:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {currentViewMuscles.map((muscle) => {
              const isTarget = targetMuscles.includes(muscle.id)
              const isAssisting = assistingMuscles.includes(muscle.id)

              return (
                <button
                  key={muscle.id}
                  type="button"
                  onClick={() => handleMuscleClick(muscle.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    isTarget
                      ? 'bg-orange-600 text-white shadow-md'
                      : isAssisting
                      ? 'bg-orange-300 text-gray-800 shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="block font-medium">{muscle.name}</span>
                  {muscle.name_ar && (
                    <span className="block text-xs opacity-80">
                      {muscle.name_ar}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
