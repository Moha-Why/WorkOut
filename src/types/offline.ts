import { Exercise, Workout, Program } from './index'

// IndexedDB Schema
export interface OfflineDB {
  exercises: OfflineExercise
  workouts: OfflineWorkout
  programs: OfflineProgram
  cached_videos: CachedVideo
}

// Cached entities
export interface OfflineExercise {
  id: string
  data: Exercise
  cached_at: number
  video_cached: boolean
}

export interface OfflineWorkout {
  id: string
  data: Workout
  exercises: Exercise[]
  cached_at: number
}

export interface OfflineProgram {
  id: string
  data: Program
  cached_at: number
}

// Cached video blobs
export interface CachedVideo {
  video_id: string
  provider: string
  blob_url: string
  cached_at: number
  size_bytes: number
}

// Download progress
export interface DownloadProgress {
  workout_id: string
  total_exercises: number
  downloaded_exercises: number
  total_videos: number
  downloaded_videos: number
  current_video?: string
  status: 'pending' | 'downloading' | 'completed' | 'error'
  error?: string
}
