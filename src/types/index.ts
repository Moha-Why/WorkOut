import { Database } from './database'

// Type helpers for cleaner code
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// Domain types
export type Profile = Tables<'profiles'>
export type Coach = Tables<'coaches'>
export type CoachUser = Tables<'coach_users'>
export type Program = Tables<'programs'>
export type Workout = Tables<'workouts'>
export type Exercise = Tables<'exercises'>
export type UserProgram = Tables<'user_programs'>
export type UserExerciseProgress = Tables<'user_exercise_progress'>
export type UserWorkoutProgress = Tables<'user_workout_progress'>
export type MuscleGroup = Tables<'muscle_groups'>

// User roles
export type UserRole = 'user' | 'coach' | 'admin'

// Video providers
export type VideoProvider = 'youtube' | 'vimeo' | 'custom'

// Extended types with relations
export interface ProgramWithWorkouts extends Program {
  workouts: WorkoutWithExercises[]
}

export interface WorkoutWithExercises extends Workout {
  exercises: Exercise[]
}

export interface ExerciseWithProgress extends Exercise {
  progress?: UserExerciseProgress[]
  is_completed?: boolean
}

export interface WorkoutWithProgress extends Workout {
  exercises: ExerciseWithProgress[]
  progress?: UserWorkoutProgress[]
  is_completed?: boolean
  completion_percentage?: number
}

export interface ProgramWithProgress extends Program {
  workouts: WorkoutWithProgress[]
  assigned_at?: string
  completion_percentage?: number
}

export interface UserWithCoach extends Profile {
  coach?: Coach & { profile: Profile }
}

export interface CoachWithUsers extends Coach {
  profile: Profile
  assigned_users: Profile[]
}

// Stats types
export interface UserStats {
  total_workouts_completed: number
  total_exercises_completed: number
  current_streak: number
  weekly_completion_rate: number
}

export interface CoachStats {
  total_users: number
  active_users: number
  total_programs: number
  avg_completion_rate: number
}

// UI State types
export interface OfflineState {
  is_online: boolean
  pending_syncs: number
  last_sync: Date | null
}

export interface WorkoutPlayerState {
  current_exercise_index: number
  is_playing: boolean
  is_paused: boolean
  rest_timer: number | null
}
