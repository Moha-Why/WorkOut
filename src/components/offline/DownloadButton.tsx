'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Workout, Exercise } from '@/types'
import { DownloadProgress } from '@/types/offline'
import { downloadWorkout, estimateDownloadSize, formatSize, hasEnoughStorage } from '@/lib/offline/download'
import { getWorkout, deleteWorkout } from '@/lib/offline/db'
import { Toast } from '@/components/ui/Toast'

interface DownloadButtonProps {
  workout: Workout
  exercises: Exercise[]
  size?: 'sm' | 'md' | 'lg'
  showSize?: boolean
  onDownloadComplete?: () => void
}

export function DownloadButton({
  workout,
  exercises,
  size = 'sm',
  showSize = false,
  onDownloadComplete,
}: DownloadButtonProps) {
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  })

  const estimatedSize = estimateDownloadSize(exercises)

  useEffect(() => {
    checkIfDownloaded()
  }, [workout.id])

  const checkIfDownloaded = async () => {
    try {
      const cached = await getWorkout(workout.id)
      setIsDownloaded(!!cached)
    } catch (error) {
      console.error('Error checking download status:', error)
    }
  }

  const handleDownload = async () => {
    if (isDownloading) return

    // Check storage
    const hasStorage = await hasEnoughStorage(estimatedSize)
    if (!hasStorage) {
      setToast({
        message: 'Not enough storage space available',
        type: 'error',
        isOpen: true,
      })
      return
    }

    setIsDownloading(true)
    setProgress({
      workout_id: workout.id,
      total_exercises: exercises.length,
      downloaded_exercises: 0,
      total_videos: exercises.length,
      downloaded_videos: 0,
      status: 'downloading',
    })

    try {
      const success = await downloadWorkout(workout, exercises, (prog) => {
        setProgress(prog)
      })

      if (success) {
        setIsDownloaded(true)
        setToast({
          message: 'Workout downloaded for offline use',
          type: 'success',
          isOpen: true,
        })
        onDownloadComplete?.()
      } else {
        setToast({
          message: 'Failed to download workout',
          type: 'error',
          isOpen: true,
        })
      }
    } catch (error) {
      console.error('Download error:', error)
      setToast({
        message: 'Error downloading workout',
        type: 'error',
        isOpen: true,
      })
    } finally {
      setIsDownloading(false)
      setProgress(null)
    }
  }

  const handleRemove = async () => {
    try {
      await deleteWorkout(workout.id)
      setIsDownloaded(false)
      setToast({
        message: 'Offline workout removed',
        type: 'info',
        isOpen: true,
      })
    } catch (error) {
      console.error('Error removing download:', error)
      setToast({
        message: 'Error removing download',
        type: 'error',
        isOpen: true,
      })
    }
  }

  const getProgressPercentage = () => {
    if (!progress) return 0
    const total = progress.total_exercises + progress.total_videos
    const done = progress.downloaded_exercises + progress.downloaded_videos
    return Math.round((done / total) * 100)
  }

  if (isDownloading && progress) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 min-w-[3rem]">
          {getProgressPercentage()}%
        </span>
      </div>
    )
  }

  if (isDownloaded) {
    return (
      <>
        <Button
          variant="outline"
          size={size}
          onClick={handleRemove}
          className="text-green-600 border-green-600 hover:bg-green-50"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Downloaded
        </Button>
        <Toast
          message={toast.message}
          type={toast.type}
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download
        {showSize && <span className="ml-1 text-xs text-gray-400">({formatSize(estimatedSize)})</span>}
      </Button>
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </>
  )
}
