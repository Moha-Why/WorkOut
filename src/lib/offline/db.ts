import { openDB, IDBPDatabase } from 'idb'
import {
  OfflineExercise,
  OfflineWorkout,
  OfflineProgram,
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
  cached_videos: {
    key: string
    value: CachedVideo
    indexes: { 'by-provider': string; 'by-cached': number }
  }
}

const DB_NAME = 'workout-app-db'
const DB_VERSION = 2

let dbInstance: IDBPDatabase<WorkoutDB> | null = null

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

export async function getDB(): Promise<IDBPDatabase<WorkoutDB>> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment')
  }

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

      // Cached videos store
      if (!db.objectStoreNames.contains('cached_videos')) {
        const videoStore = db.createObjectStore('cached_videos', {
          keyPath: 'video_id',
        })
        videoStore.createIndex('by-provider', 'provider')
        videoStore.createIndex('by-cached', 'cached_at')
      }

      // Remove pending_progress store if it exists (cleanup)
      if (db.objectStoreNames.contains('pending_progress')) {
        db.deleteObjectStore('pending_progress')
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
  if (!isBrowser) return []
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
    ['exercises', 'workouts', 'programs', 'cached_videos'],
    'readwrite'
  )

  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('workouts').clear(),
    tx.objectStore('programs').clear(),
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
  if (!isBrowser) {
    return { usage: 0, quota: 0, percentage: 0 }
  }
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
