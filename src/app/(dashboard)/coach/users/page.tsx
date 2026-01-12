'use client'

import { Card, CardContent } from '@/components/ui/Card'

export default function CoachUsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">My Users</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600 mb-4">User management coming soon</p>
          <p className="text-sm text-gray-500">
            View your clients, assign programs, and track their progress
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
