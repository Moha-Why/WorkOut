'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register'

export function PWARegister() {
  useEffect(() => {
    // Register service worker
    registerServiceWorker()
  }, [])

  return null
}
