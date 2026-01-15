import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  OfflineExercise,
  OfflineWorkout,
  OfflineProgram,
  PendingProgress,
  CachedVideo,
} from '@/types/offline'

interface WorkoutDB {
  exercises: {
    key: string
    value: OfflineExercise
    indexes: { 'by-cached': number }
  }
  workouts: {
    key: string
    value: OfflineWorkout
    indexes: { 'by-cached': number }
  }
  programs: {
    key: string
    value: OfflineProgram
    indexes: { 'by-cached': number }
  }
  pending_progress: {
    key: string
    value: PendingProgress
    indexes: { 'by-synced': boolean; 'by-type': string }
  }
  cached_videos: {
    key: string
    value: CachedVideo
    indexes: { 'by-provider': string; 'by-cached': number }
  }
}

const DB_NAME = 'workout-app-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<WorkoutDB> | null = null

export async function getDB(): Promise<IDBPDatabase<WorkoutDB>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Exercises store
      if (!db.objectStoreNames.contains('exercises')) {
        const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' })
        exerciseStore.createIndex('by-cached', 'cached_at')
      }

      // Workouts store
      if (!db.objectStoreNames.contains('workouts')) {
        const workoutStore = db.createObjectStore('workouts', { keyPath: 'id' })
        workoutStore.createIndex('by-cached', 'cached_at')
      }

      // Programs store
      if (!db.objectStoreNames.contains('programs')) {
        const programStore = db.createObjectStore('programs', { keyPath: 'id' })
        programStore.createIndex('by-cached', 'cached_at')
      }

      // Pending progress store
      if (!db.objectStoreNames.contains('pending_progress')) {
        const progressStore = db.createObjectStore('pending_progress', {
          keyPath: 'id',
        })
        progressStore.createIndex('by-synced', 'synced')
        progressStore.createIndex('by-type', 'type')
      }

      // Cached videos store
      if (!db.objectStoreNames.contains('cached_videos')) {
        const videoStore = db.createObjectStore('cached_videos', {
          keyPath: 'video_id',
        })
        videoStore.createIndex('by-provider', 'provider')
        videoStore.createIndex('by-cached', 'cached_at')
      }
    },
  })

  return dbInstance
}

// Exercise operations
export async function saveExercise(exercise: OfflineExercise) {
  const db = await getDB()
  await db.put('exercises', exercise)
}

export async function getExercise(id: string): Promise<OfflineExercise | undefined> {
  const db = await getDB()
  return db.get('exercises', id)
}

export async function getAllExercises(): Promise<OfflineExercise[]> {
  const db = await getDB()
  return db.getAll('exercises')
}

export async function deleteExercise(id: string) {
  const db = await getDB()
  await db.delete('exercises', id)
}

// Workout operations
export async function saveWorkout(workout: OfflineWorkout) {
  const db = await getDB()
  await db.put('workouts', workout)
}

export async function deleteWorkout(id: string) {
  const db = await getDB()
  await db.delete('workouts', id)
}

export async function getWorkout(id: string): Promise<OfflineWorkout | undefined> {
  const db = await getDB()
  return db.get('workouts', id)
}

export async function getAllWorkouts(): Promise<OfflineWorkout[]> {
  const db = await getDB()
  return db.getAll('workouts')
}

// Program operations
export async function saveProgram(program: OfflineProgram) {
  const db = await getDB()
  await db.put('programs', program)
}

export async function getProgram(id: string): Promise<OfflineProgram | undefined> {
  const db = await getDB()
  return db.get('programs', id)
}

export async function getAllPrograms(): Promise<OfflineProgram[]> {
  const db = await getDB()
  return db.getAll('programs')
}

// Pending progress operations
export async function savePendingProgress(progress: PendingProgress) {
  const db = await getDB()
  await db.put('pending_progress', progress)
}

export async function getPendingProgress(): Promise<PendingProgress[]> {
  const db = await getDB()
  const index = db.transaction('pending_progress').store.index('by-synced')
  return index.getAll(null)
}

export async function markProgressSynced(id: string) {
  const db = await getDB()
  const progress = await db.get('pending_progress', id)
  if (progress) {
    progress.synced = true
    await db.put('pending_progress', progress)
  }
}

export async function deletePendingProgress(id: string) {
  const db = await getDB()
  await db.delete('pending_progress', id)
}

// Cached video operations
export async function saveCachedVideo(video: CachedVideo) {
  const db = await getDB()
  await db.put('cached_videos', video)
}

export async function getCachedVideo(videoId: string): Promise<CachedVideo | undefined> {
  const db = await getDB()
  return db.get('cached_videos', videoId)
}

export async function getAllCachedVideos(): Promise<CachedVideo[]> {
  const db = await getDB()
  return db.getAll('cached_videos')
}

export async function deleteCachedVideo(videoId: string) {
  const db = await getDB()
  await db.delete('cached_videos', videoId)
}

// Utility: Clear all offline data
export async function clearAllOfflineData() {
  const db = await getDB()
  const tx = db.transaction(
    ['exercises', 'workouts', 'programs', 'pending_progress', 'cached_videos'],
    'readwrite'
  )

  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('workouts').clear(),
    tx.objectStore('programs').clear(),
    tx.objectStore('pending_progress').clear(),
    tx.objectStore('cached_videos').clear(),
  ])

  await tx.done
}

// Get storage usage estimate
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
  percentage: number
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    }
  }
  return { usage: 0, quota: 0, percentage: 0 }
}
