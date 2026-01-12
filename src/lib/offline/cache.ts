import { Exercise, Workout } from '@/types'
import {
  saveExercise,
  getExercise,
  saveWorkout,
  getWorkout,
  saveCachedVideo,
  getCachedVideo,
} from './db'
import { OfflineExercise, OfflineWorkout, CachedVideo } from '@/types/offline'

// Cache an exercise with its metadata
export async function cacheExercise(
  exercise: Exercise,
  videoCached: boolean = false
): Promise<void> {
  const offlineExercise: OfflineExercise = {
    id: exercise.id,
    data: exercise,
    cached_at: Date.now(),
    video_cached: videoCached,
  }

  await saveExercise(offlineExercise)
}

// Cache a workout with all exercises
export async function cacheWorkout(
  workout: Workout,
  exercises: Exercise[]
): Promise<void> {
  const offlineWorkout: OfflineWorkout = {
    id: workout.id,
    data: workout,
    exercises,
    cached_at: Date.now(),
  }

  await saveWorkout(offlineWorkout)

  // Also cache individual exercises
  await Promise.all(exercises.map((ex) => cacheExercise(ex)))
}

// Check if workout is fully cached (including videos)
export async function isWorkoutFullyCached(workoutId: string): Promise<boolean> {
  const workout = await getWorkout(workoutId)
  if (!workout) return false

  // Check if all exercises have cached videos
  const videoCacheChecks = await Promise.all(
    workout.exercises.map(async (exercise) => {
      const videoKey = `${exercise.video_provider}_${exercise.video_id}`
      const cachedVideo = await getCachedVideo(videoKey)
      return cachedVideo !== undefined
    })
  )

  return videoCacheChecks.every((cached) => cached)
}

// Download and cache video
export async function cacheVideo(
  provider: string,
  videoId: string,
  videoUrl: string
): Promise<boolean> {
  try {
    // Fetch video as blob
    const response = await fetch(videoUrl)
    if (!response.ok) throw new Error('Failed to fetch video')

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const cachedVideo: CachedVideo = {
      video_id: `${provider}_${videoId}`,
      provider,
      blob_url: blobUrl,
      cached_at: Date.now(),
      size_bytes: blob.size,
    }

    await saveCachedVideo(cachedVideo)
    return true
  } catch (error) {
    console.error('Error caching video:', error)
    return false
  }
}

// Get cached video URL or original URL
export async function getVideoUrl(
  provider: string,
  videoId: string,
  originalUrl: string
): Promise<string> {
  const videoKey = `${provider}_${videoId}`
  const cachedVideo = await getCachedVideo(videoKey)

  if (cachedVideo) {
    return cachedVideo.blob_url
  }

  return originalUrl
}

// Preload images for faster loading
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
}

// Cache expiration (7 days)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000

// Check if cache is expired
export function isCacheExpired(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_EXPIRATION
}

// Clean expired caches
export async function cleanExpiredCaches(): Promise<void> {
  const { getAllExercises, getAllWorkouts, getAllCachedVideos, deleteExercise, deleteWorkout, deleteCachedVideo } = await import('./db')

  const exercises = await getAllExercises()
  const workouts = await getAllWorkouts()
  const videos = await getAllCachedVideos()

  // Clean expired exercises
  await Promise.all(
    exercises
      .filter((ex) => isCacheExpired(ex.cached_at))
      .map((ex) => deleteExercise(ex.id))
  )

  // Clean expired workouts
  await Promise.all(
    workouts
      .filter((w) => isCacheExpired(w.cached_at))
      .map((w) => deleteWorkout(w.id))
  )

  // Clean expired videos and revoke blob URLs
  await Promise.all(
    videos
      .filter((v) => isCacheExpired(v.cached_at))
      .map(async (v) => {
        URL.revokeObjectURL(v.blob_url)
        await deleteCachedVideo(v.video_id)
      })
  )
}
