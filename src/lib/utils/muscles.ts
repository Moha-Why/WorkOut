import { MuscleGroup } from '@/types'

// Muscle group colors for visualization
export const MUSCLE_COLORS = {
  target: 'fill-red-500/80',
  assisting: 'fill-blue-400/60',
  default: 'fill-gray-300',
} as const

// Get muscle group display color
export function getMuscleColor(
  muscleId: string,
  targetMuscles: string[],
  assistingMuscles?: string[]
): string {
  if (targetMuscles.includes(muscleId)) {
    return MUSCLE_COLORS.target
  }
  if (assistingMuscles?.includes(muscleId)) {
    return MUSCLE_COLORS.assisting
  }
  return MUSCLE_COLORS.default
}

// Get muscle groups by category
export function groupMusclesByCategory(muscles: MuscleGroup[]) {
  return {
    front: muscles.filter((m) => m.category === 'front'),
    back: muscles.filter((m) => m.category === 'back'),
    core: muscles.filter((m) => m.category === 'core'),
  }
}

// Validate muscle IDs
export function validateMuscleIds(
  muscleIds: string[],
  validMuscles: MuscleGroup[]
): boolean {
  const validIds = new Set(validMuscles.map((m) => m.id))
  return muscleIds.every((id) => validIds.has(id))
}

// Get muscle names from IDs
export function getMuscleNames(
  muscleIds: string[],
  muscles: MuscleGroup[],
  locale: 'en' | 'ar' = 'en'
): string[] {
  return muscleIds
    .map((id) => {
      const muscle = muscles.find((m) => m.id === id)
      if (!muscle) return null
      return locale === 'ar' && muscle.name_ar ? muscle.name_ar : muscle.name
    })
    .filter(Boolean) as string[]
}
