'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading, role } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-accent" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-bg-hover">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  )
}
