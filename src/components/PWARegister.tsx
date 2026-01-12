'use client'

import { useEffect } from 'react'
import { registerServiceWorker, setupAutoSync } from '@/lib/pwa/register'

export function PWARegister() {
  useEffect(() => {
    // Register service worker
    registerServiceWorker()

    // Setup offline sync
    const { setupAutoSync: setupSync } = require('@/lib/offline/sync')
    setupSync()
  }, [])

  return null
}
