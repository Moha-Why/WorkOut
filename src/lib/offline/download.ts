import { Workout, Exercise } from '@/types'
import { DownloadProgress } from '@/types/offline'
import { cacheWorkout, cacheVideo } from './cache'
import { getVideoEmbedUrl } from '../utils/video'

// Download workout with all exercises and videos
export async function downloadWorkout(
  workout: Workout,
  exercises: Exercise[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<boolean> {
  const progress: DownloadProgress = {
    workout_id: workout.id,
    total_exercises: exercises.length,
    downloaded_exercises: 0,
    total_videos: exercises.length,
    downloaded_videos: 0,
    status: 'downloading',
  }

  try {
    // Cache workout metadata first
    await cacheWorkout(workout, exercises)
    progress.downloaded_exercises = exercises.length
    onProgress?.(progress)

    // Download videos
    for (const exercise of exercises) {
      progress.current_video = exercise.name

      try {
        // Get video URL
        const videoUrl = getVideoEmbedUrl(
          exercise.video_provider,
          exercise.video_id
        )

        // For YouTube/Vimeo, we can't download the actual video due to CORS
        // Instead, we'll cache the metadata and rely on browser cache
        // In production, you'd use a backend proxy or video download service

        // Simulate caching for now
        await cacheVideo(
          exercise.video_provider,
          exercise.video_id,
          videoUrl
        )

        progress.downloaded_videos++
        onProgress?.(progress)
      } catch (error) {
        console.error(`Error downloading video for ${exercise.name}:`, error)
        // Continue with other videos even if one fails
      }
    }

    progress.status = 'completed'
    onProgress?.(progress)
    return true
  } catch (error) {
    console.error('Error downloading workout:', error)
    progress.status = 'error'
    progress.error = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(progress)
    return false
  }
}

// Download multiple workouts
export async function downloadWorkouts(
  workouts: Array<{ workout: Workout; exercises: Exercise[] }>,
  onProgress?: (workoutId: string, progress: DownloadProgress) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const { workout, exercises } of workouts) {
    const result = await downloadWorkout(workout, exercises, (progress) => {
      onProgress?.(workout.id, progress)
    })

    if (result) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed }
}

// Estimate download size (rough estimate)
export function estimateDownloadSize(exercises: Exercise[]): number {
  // Assume average 3MB per 10-second video
  const avgVideoSize = 3 * 1024 * 1024
  return exercises.length * avgVideoSize
}

// Format size for display
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Check if we have enough storage
export async function hasEnoughStorage(requiredBytes: number): Promise<boolean> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    const available = (estimate.quota || 0) - (estimate.usage || 0)
    return available > requiredBytes
  }
  // If we can't check, assume we have enough
  return true
}
