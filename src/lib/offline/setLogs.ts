import { openDB, IDBPDatabase } from 'idb'
import { SetLog } from '@/types'

interface SetLogWithSync extends SetLog {
  synced: boolean
}

interface SetLogsDB {
  set_logs: {
    key: string
    value: SetLogWithSync
    indexes: {
      'by-workout': string
      'by-exercise': string
      'by-user': string
      'by-synced': number
    }
  }
}

const DB_NAME = 'workout-setlogs-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<SetLogsDB> | null = null

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

async function getDB(): Promise<IDBPDatabase<SetLogsDB>> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment')
  }

  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<SetLogsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('set_logs')) {
        const store = db.createObjectStore('set_logs', { keyPath: 'id' })
        store.createIndex('by-workout', 'workout_id')
        store.createIndex('by-exercise', 'exercise_id')
        store.createIndex('by-user', 'user_id')
        store.createIndex('by-synced', 'synced')
      }
    },
  })

  return dbInstance
}

// Save a set log
export async function saveSetLog(log: SetLog, synced = false): Promise<void> {
  if (!isBrowser) return

  const db = await getDB()
  await db.put('set_logs', { ...log, synced })
}

// Get all set logs for a workout
export async function getSetLogsForWorkout(workoutId: string): Promise<SetLogWithSync[]> {
  if (!isBrowser) return []

  const db = await getDB()
  return db.getAllFromIndex('set_logs', 'by-workout', workoutId)
}

// Get all set logs for an exercise
export async function getSetLogsForExercise(exerciseId: string): Promise<SetLogWithSync[]> {
  if (!isBrowser) return []

  const db = await getDB()
  return db.getAllFromIndex('set_logs', 'by-exercise', exerciseId)
}

// Get all pending (unsynced) set logs
export async function getPendingSetLogs(): Promise<SetLogWithSync[]> {
  if (!isBrowser) return []

  const db = await getDB()
  const all = await db.getAll('set_logs')
  return all.filter((log) => !log.synced)
}

// Mark a set log as synced
export async function markSetLogSynced(logId: string): Promise<void> {
  if (!isBrowser) return

  const db = await getDB()
  const log = await db.get('set_logs', logId)
  if (log) {
    await db.put('set_logs', { ...log, synced: true })
  }
}

// Delete a set log
export async function deleteSetLog(logId: string): Promise<void> {
  if (!isBrowser) return

  const db = await getDB()
  await db.delete('set_logs', logId)
}

// Clear all set logs for a workout
export async function clearSetLogsForWorkout(workoutId: string): Promise<void> {
  if (!isBrowser) return

  const db = await getDB()
  const logs = await db.getAllFromIndex('set_logs', 'by-workout', workoutId)
  const tx = db.transaction('set_logs', 'readwrite')
  await Promise.all(logs.map((log) => tx.store.delete(log.id)))
  await tx.done
}

// Get count of pending logs
export async function getPendingLogCount(): Promise<number> {
  if (!isBrowser) return 0

  const pending = await getPendingSetLogs()
  return pending.length
}
