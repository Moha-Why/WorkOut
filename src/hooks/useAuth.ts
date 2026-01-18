'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Profile, UserRole } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  isLoading: boolean
  error: Error | null
}
const supabase = createClient()

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    isLoading: true,
    error: null,
  })

      const getSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (session?.user) {
          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single<Profile>()

          if (profileError) throw profileError

          setState({
            user: session.user,
            profile,
            role: profile.role,
            isLoading: false,
            error: null,
          })
        } else {
          setState({
            user: null,
            profile: null,
            role: null,
            isLoading: false,
            error: null,
          })
        }
      } catch (error) {
        console.error('Auth error:', error)
        setState({
          user: null,
          profile: null,
          role: null,
          isLoading: false,
          error: error as Error,
        })
      }
    }

  useEffect(() => {
    getSession()
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          setState({
            user: null,
            profile: null,
            role: null,
            isLoading: false,
            error: null,
          })
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single<Profile>()

        if (error) {
          setState(prev => ({ ...prev, error }))
          return
        }

        setState({
          user: session.user,
          profile,
          role: profile.role,
          isLoading: false,
          error: null,
        })
      })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Profile will be fetched by onAuthStateChange
      return { success: true, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }))
      return { success: false, error: error as Error }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole = 'user'
  ) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email,
        name,
        role,
        active: true,
      } as never)

      if (profileError) throw profileError

      return { success: true, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }))
      return { success: false, error: error as Error }
    }
  }

  const signOut = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setState({
        user: null,
        profile: null,
        role: null,
        isLoading: false,
        error: null,
      })

      return { success: true, error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }))
      return { success: false, error: error as Error }
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!state.user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', state.user.id)

      if (error) throw error

      // Refresh profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .single()

      setState((prev) => ({ ...prev, profile }))

      return { success: true, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { success: false, error: error as Error }
    }
  }

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAuthenticated: !!state.user,
    isUser: state.role === 'user',
    isCoach: state.role === 'coach',
    isAdmin: state.role === 'admin',
  }
}
