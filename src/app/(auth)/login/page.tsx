'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const { success, error } = await signIn(
          formData.email,
          formData.password
        )

        if (success) {
          router.push('/')
        } else {
          setError(error?.message || 'Login failed')
        }
      } else {
        // Signup
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters')
          setIsLoading(false)
          return
        }

        const { success, error } = await signUp(
          formData.email,
          formData.password,
          formData.name
        )

        if (success) {
          setMode('login')
          setError('Account created! Please log in.')
          setFormData({ email: formData.email, password: '', name: '', confirmPassword: '' })
        } else {
          setError(error?.message || 'Signup failed')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Workout</h1>
          <p className="text-gray-400">Your personal training platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Enter your credentials to access your account'
                : 'Sign up to start your fitness journey'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (signup only) */}
              {mode === 'signup' && (
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              )}

              {/* Email */}
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />

              {/* Password */}
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />

              {/* Confirm Password (signup only) */}
              {mode === 'signup' && (
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                />
              )}

              {/* Forgot Password Link (login only) */}
              {mode === 'login' && (
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-gray-400 hover:text-accent hover:underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div
                  className={`p-3 rounded-lg text-sm border ${
                    error.includes('created')
                      ? 'bg-success/10 text-success border-success/30'
                      : 'bg-error/10 text-error border-error/30'
                  }`}
                >
                  {error}
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            {/* Toggle mode */}
            <div className="mt-6 text-center text-sm">
              <span className="text-gray-400">
                {mode === 'login'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </span>{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setError(null)
                }}
                className="font-medium text-accent hover:text-accent-hover hover:underline transition-colors"
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* PWA Install prompt */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Install this app for offline access</p>
        </div>
      </div>
    </div>
  )
}
