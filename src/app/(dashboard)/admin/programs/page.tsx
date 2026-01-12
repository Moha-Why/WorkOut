'use client'

import { Card, CardContent } from '@/components/ui/Card'

export default function AdminProgramsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">All Programs</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600 mb-4">Program overview coming soon</p>
          <p className="text-sm text-gray-500">
            View all programs across the platform
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
