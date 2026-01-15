'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register'

export function PWARegister() {
  useEffect(() => {
    // Register service worker
    registerServiceWorker()

    // Setup offline sync
    const { setupAutoSync } = require('@/lib/offline/sync')
    setupAutoSync()
  }, [])

  return null
}
