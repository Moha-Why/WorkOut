'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { InstallPWAPrompt } from '@/components/offline/InstallPWAPrompt'
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
  const [isOffline, setIsOffline] = useState(false)

  // Check offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine)
    }

    // Set initial state
    updateOnlineStatus()

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // If offline, redirect to offline page instead of login
      if (isOffline) {
        router.push('/offline')
      } else {
        router.push('/login')
      }
    }
  }, [isAuthenticated, isLoading, isOffline, router])

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
      <InstallPWAPrompt />
    </div>
  )
}
