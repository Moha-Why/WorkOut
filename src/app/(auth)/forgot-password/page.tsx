'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to send reset email',
      })
    } else {
      setMessage({
        type: 'success',
        text: 'Password reset email sent! Check your inbox.',
      })
      setEmail('')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 text-center mb-6">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-error/10 text-error border border-error/30'
                }`}
              >
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-bg-hover text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent placeholder:text-gray-500"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <div className="text-center text-sm">
              <Link
                href="/login"
                className="text-gray-400 hover:text-accent transition-colors"
              >
                ← Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
