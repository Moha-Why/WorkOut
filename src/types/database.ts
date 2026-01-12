export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role: 'user' | 'coach' | 'admin'
          active: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role: 'user' | 'coach' | 'admin'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'user' | 'coach' | 'admin'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      coaches: {
        Row: {
          id: string
          user_id: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          active?: boolean
          created_at?: string
        }
      }
      coach_users: {
        Row: {
          id: string
          coach_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          user_id?: string
          created_at?: string
        }
      }
      programs: {
        Row: {
          id: string
          name: string
          description: string | null
          weeks: number
          created_by: string | null
          duplicated_from: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          weeks?: number
          created_by?: string | null
          duplicated_from?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          weeks?: number
          created_by?: string | null
          duplicated_from?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workouts: {
        Row: {
          id: string
          program_id: string
          name: string
          week_number: number
          day_number: number
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          name: string
          week_number: number
          day_number: number
          order_index: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          name?: string
          week_number?: number
          day_number?: number
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          workout_id: string
          name: string
          video_provider: 'youtube' | 'vimeo' | 'custom'
          video_id: string
          target_muscles: string[]
          assisting_muscles: string[] | null
          sets: number | null
          reps: string | null
          rest_seconds: number | null
          notes: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          name: string
          video_provider: 'youtube' | 'vimeo' | 'custom'
          video_id: string
          target_muscles: string[]
          assisting_muscles?: string[] | null
          sets?: number | null
          reps?: string | null
          rest_seconds?: number | null
          notes?: string | null
          order_index: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          name?: string
          video_provider?: 'youtube' | 'vimeo' | 'custom'
          video_id?: string
          target_muscles?: string[]
          assisting_muscles?: string[] | null
          sets?: number | null
          reps?: string | null
          rest_seconds?: number | null
          notes?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_programs: {
        Row: {
          id: string
          user_id: string
          program_id: string
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          program_id: string
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          program_id?: string
          assigned_by?: string | null
          assigned_at?: string
        }
      }
      user_exercise_progress: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          completed_at: string
          synced: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          completed_at: string
          synced?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          completed_at?: string
          synced?: boolean
          created_at?: string
        }
      }
      user_workout_progress: {
        Row: {
          id: string
          user_id: string
          workout_id: string
          completed_at: string
          synced: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_id: string
          completed_at: string
          synced?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string
          completed_at?: string
          synced?: boolean
          created_at?: string
        }
      }
      muscle_groups: {
        Row: {
          id: string
          name: string
          name_ar: string | null
          svg_path: string
          category: 'front' | 'back' | 'core'
        }
        Insert: {
          id: string
          name: string
          name_ar?: string | null
          svg_path: string
          category: 'front' | 'back' | 'core'
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string | null
          svg_path?: string
          category?: 'front' | 'back' | 'core'
        }
      }
    }
  }
}
