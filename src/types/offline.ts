import { Exercise, Workout, Program } from './index'

// IndexedDB Schema
export interface OfflineDB {
  exercises: OfflineExercise
  workouts: OfflineWorkout
  programs: OfflineProgram
  pending_progress: PendingProgress
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

// Pending sync items
export interface PendingProgress {
  id: string
  type: 'exercise' | 'workout'
  user_id: string
  entity_id: string
  completed_at: number
  synced: boolean
  retry_count: number
}

// Cached video blobs
export interface CachedVideo {
  video_id: string
  provider: string
  blob_url: string
  cached_at: number
  size_bytes: number
}

// Sync status
export interface SyncStatus {
  is_syncing: boolean
  last_sync: Date | null
  pending_count: number
  errors: SyncError[]
}

export interface SyncError {
  id: string
  type: 'exercise' | 'workout' | 'video'
  message: string
  timestamp: Date
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
