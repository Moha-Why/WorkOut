'use client'

import { Exercise } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getVideoThumbnail } from '@/lib/utils/video'
import { getMuscleNames } from '@/lib/utils/muscles'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface ExerciseCardProps {
  exercise: Exercise
  isCompleted?: boolean
  onPlay?: () => void
  onComplete?: () => void
  showProgress?: boolean
  className?: string
}

export function ExerciseCard({
  exercise,
  isCompleted = false,
  onPlay,
  onComplete,
  showProgress = false,
  className = '',
}: ExerciseCardProps) {
  const [muscleNames, setMuscleNames] = useState<string[]>([])
  const thumbnailUrl = getVideoThumbnail(
    exercise.video_provider,
    exercise.video_id
  )

  useEffect(() => {
    const fetchMuscleNames = async () => {
      const supabase = createClient()
      const { data: muscles } = await supabase
        .from('muscle_groups')
        .select('*')

      if (muscles) {
        const names = getMuscleNames(exercise.target_muscles, muscles)
        setMuscleNames(names)
      }
    }

    fetchMuscleNames()
  }, [exercise.target_muscles])

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200">
        <Image
          src={thumbnailUrl}
          alt={exercise.name}
          fill
          className="object-cover"
          unoptimized
        />
        {isCompleted && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <div className="bg-green-500 text-white rounded-full p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}
        {onPlay && (
          <button
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-white rounded-full p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-black"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>
        )}
      </div>

      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{exercise.name}</CardTitle>
          {isCompleted && <Badge variant="success">Completed</Badge>}
        </div>
      </CardHeader>

      <CardContent>
        {/* Exercise details */}
        <div className="space-y-3">
          {/* Sets & Reps */}
          <div className="flex gap-4 text-sm">
            {exercise.sets && (
              <div>
                <span className="font-medium">Sets:</span>{' '}
                <span className="text-gray-600">{exercise.sets}</span>
              </div>
            )}
            {exercise.reps && (
              <div>
                <span className="font-medium">Reps:</span>{' '}
                <span className="text-gray-600">{exercise.reps}</span>
              </div>
            )}
            {exercise.rest_seconds && (
              <div>
                <span className="font-medium">Rest:</span>{' '}
                <span className="text-gray-600">{exercise.rest_seconds}s</span>
              </div>
            )}
          </div>

          {/* Target muscles */}
          {muscleNames.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Target Muscles:
              </p>
              <div className="flex flex-wrap gap-1">
                {muscleNames.map((name) => (
                  <Badge key={name} variant="default">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {exercise.notes && (
            <p className="text-sm text-gray-600">{exercise.notes}</p>
          )}

          {/* Action button */}
          {onComplete && !isCompleted && (
            <button
              onClick={onComplete}
              className="w-full rounded-lg bg-black text-white py-2 px-4 font-medium hover:bg-gray-800 transition-colors"
            >
              Mark Complete
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
