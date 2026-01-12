'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

export function RoleGuard({ children, allowedRoles, redirectTo }: RoleGuardProps) {
  const { role, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && role && !allowedRoles.includes(role)) {
      // Redirect to appropriate dashboard based on current role
      const defaultRedirect = redirectTo || (
        role === 'admin' ? '/admin' :
        role === 'coach' ? '/coach' :
        '/user'
      )
      router.push(defaultRedirect)
    }
  }, [role, isLoading, allowedRoles, router, redirectTo])

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
      </div>
    )
  }

  // Show access denied if role doesn't match
  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
