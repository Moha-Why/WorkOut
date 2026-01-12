'use client'

import { Card, CardContent } from '@/components/ui/Card'

export default function CoachProgramsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600 mb-4">Program builder coming soon</p>
          <p className="text-sm text-gray-500">
            Create multi-week training programs with drag-and-drop interface
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
