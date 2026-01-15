'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading, role } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login')
      } else {
        // Redirect based on role
        if (role === 'user') {
          router.push('/user')
        } else if (role === 'coach') {
          router.push('/coach/exercises')
        } else if (role === 'admin') {
          router.push('/admin/coaches')
        }
      }
    }
  }, [isAuthenticated, isLoading, role, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-accent" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
