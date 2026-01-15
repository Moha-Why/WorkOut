'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export default function AccessDeniedPage() {
  const router = useRouter()
  const { role } = useAuth()

  const getHomePath = () => {
    if (role === 'admin') return '/admin'
    if (role === 'coach') return '/coach'
    return '/user'
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
            <p className="text-gray-400 mt-2">
              You don't have permission to access this page
            </p>
          </div>

          <p className="text-gray-500 mb-8">
            This page requires specific permissions that your account doesn't have.
            Please contact your administrator if you believe this is an error.
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={() => router.push(getHomePath())} className="w-full">
              Go to My Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
