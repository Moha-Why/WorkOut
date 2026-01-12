'use client'

import { useAuth } from '@/hooks/useAuth'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

export function Header() {
  const { profile, signOut } = useAuth()
  const { isOnline, hasPendingItems, sync } = useOfflineSync()
  const [showMenu, setShowMenu] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Workout</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Sync status */}
          <div className="hidden md:flex items-center gap-2">
            {!isOnline && (
              <Badge variant="warning" className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-600" />
                Offline
              </Badge>
            )}
            {hasPendingItems && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sync()}
                className="text-xs"
              >
                Sync Now
              </Button>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center font-medium">
                {profile?.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.name}
                </p>
                <p className="text-xs text-gray-600 capitalize">
                  {profile?.role}
                </p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900">
                      {profile?.name}
                    </p>
                    <p className="text-xs text-gray-600">{profile?.email}</p>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
