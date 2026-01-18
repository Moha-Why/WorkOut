'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Profile, UserRole } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  isLoading: boolean
  error: Error | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    const getSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (sessionError) throw sessionError

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single<Profile>()

          if (!isMounted) return

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
        if (!isMounted) return
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

    getSession()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return

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

        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single<Profile>()

          if (!isMounted) return

          if (error) {
            setState(prev => ({ ...prev, error, isLoading: false }))
            return
          }

          setState({
            user: session.user,
            profile,
            role: profile.role,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          if (!isMounted) return
          setState(prev => ({ ...prev, error: error as Error, isLoading: false }))
        }
      })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = createClient()
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Fetch profile immediately after sign in
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single<Profile>()

        if (profileError) throw profileError

        setState({
          user: data.user,
          profile,
          role: profile.role,
          isLoading: false,
          error: null,
        })
      }

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
    const supabase = createClient()
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

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
    const supabase = createClient()
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
    const supabase = createClient()
    try {
      if (!state.user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', state.user.id)

      if (error) throw error

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
