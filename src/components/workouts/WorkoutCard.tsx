'use client'

import { Workout, WorkoutWithProgress } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatSmartDate } from '@/lib/utils/date'

interface WorkoutCardProps {
  workout: Workout | WorkoutWithProgress
  exerciseCount?: number
  isCompleted?: boolean
  completionPercentage?: number
  completedAt?: string
  onClick?: () => void
  className?: string
}

export function WorkoutCard({
  workout,
  exerciseCount = 0,
  isCompleted = false,
  completionPercentage = 0,
  completedAt,
  onClick,
  className = '',
}: WorkoutCardProps) {
  const hasProgress = 'is_completed' in workout

  return (
    <Card
      className={`transition-all hover:shadow-lg ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="info" className="text-xs">
                Week {workout.week_number}
              </Badge>
              <Badge variant="default" className="text-xs">
                Day {workout.day_number}
              </Badge>
            </div>
            <CardTitle className="text-xl">{workout.name}</CardTitle>
            <CardDescription className="mt-1">
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </CardDescription>
          </div>

          {isCompleted && (
            <div className="bg-green-500 text-white rounded-full p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        {hasProgress && completionPercentage > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion date */}
        {completedAt && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <span>Completed {formatSmartDate(completedAt)}</span>
          </div>
        )}

        {/* Start button */}
        {!isCompleted && onClick && (
          <button
            className="w-full mt-4 rounded-lg bg-black text-white py-2 px-4 font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            Start Workout
          </button>
        )}
      </CardContent>
    </Card>
  )
}
