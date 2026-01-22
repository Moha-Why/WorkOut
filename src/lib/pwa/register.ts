'use client'

// Register service worker for PWA functionality
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service workers not supported')
    return
  }

  // Skip service worker registration in development to avoid redirect issues
  if (process.env.NODE_ENV === 'development') {
    console.log('Service Worker registration skipped in development')
    return
  }

  // Register immediately instead of waiting for window.load
  // This ensures SW is available for offline support sooner
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      console.log('Service Worker registered:', registration.scope)

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        console.log('Service Worker update found')

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('New Service Worker installed, prompting update')
              // Notify user about update
              if (
                confirm(
                  'New version available! Click OK to update and reload.'
                )
              ) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
                window.location.reload()
              }
            }
          })
        }
      })

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed')
      })

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from SW:', event.data)

        if (event.data.type === 'SYNC_REQUESTED') {
          // Trigger sync in the app
          const syncEvent = new CustomEvent('sw-sync-requested')
          window.dispatchEvent(syncEvent)
        }
      })

      // Register background sync (if supported)
      if ('sync' in registration) {
        console.log('Background Sync supported')
      }

      return registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  // If document is already loaded, register immediately
  // Otherwise wait for DOMContentLoaded (not load, which is too late)
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW()
  } else {
    document.addEventListener('DOMContentLoaded', registerSW)
  }
}

// Check if app is installed as PWA
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

// Prompt user to install PWA
export function promptPWAInstall() {
  if (typeof window === 'undefined') return

  let deferredPrompt: any = null

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e

    // Show custom install prompt UI
    const installEvent = new CustomEvent('pwa-install-available', {
      detail: { prompt: deferredPrompt },
    })
    window.dispatchEvent(installEvent)
  })

  return {
    install: async () => {
      if (!deferredPrompt) {
        return false
      }

      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      console.log(`User response to install prompt: ${outcome}`)
      deferredPrompt = null

      return outcome === 'accepted'
    },
  }
}

// Request background sync
export async function requestBackgroundSync(tag: string = 'sync-progress') {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready
      await (registration as any).sync.register(tag)
      console.log('Background sync registered:', tag)
      return true
    } catch (error) {
      console.error('Background sync registration failed:', error)
      return false
    }
  }
  return false
}

// Send message to service worker
export async function sendMessageToSW(message: any) {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    registration.active?.postMessage(message)
  }
}

// Cache workout for offline use
export async function cacheWorkoutInSW(workout: any, exercises: any[]) {
  await sendMessageToSW({
    type: 'CACHE_WORKOUT',
    payload: { workout, exercises },
  })
}
