// Service Worker for Workout Platform PWA
const CACHE_VERSION = 'v2.2.0'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`
const VIDEO_CACHE = `videos-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`
const NEXT_CACHE = `next-${CACHE_VERSION}`

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/offline.html',
  '/manifest.json',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('static-') ||
              cacheName.startsWith('dynamic-') ||
              cacheName.startsWith('videos-') ||
              cacheName.startsWith('images-') ||
              cacheName.startsWith('next-')
            ) && cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== VIDEO_CACHE &&
              cacheName !== IMAGE_CACHE &&
              cacheName !== NEXT_CACHE
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )
  return self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return
  }

  // Next.js chunks - Network first, cache fallback for offline support
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(NEXT_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(async () => {
          // Offline - try to serve from cache
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          // If it's a JS chunk we don't have, redirect to offline page
          if (request.destination === 'script') {
            console.log('[SW] Missing chunk, will show offline page:', url.pathname)
            // Return empty script to prevent JS errors, let the page handle offline state
            return new Response('', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            })
          }
          return new Response('Offline', { status: 503 })
        })
    )
    return
  }

  // Skip Supabase requests - let them go directly to network
  if (url.hostname.includes('supabase')) {
    return
  }

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone()
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response('Offline', { status: 503 })
          })
        })
    )
    return
  }

  // Image requests - Cache first
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(request).then((response) => {
          const responseClone = response.clone()
          caches.open(IMAGE_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
      })
    )
    return
  }

  // Video requests - Cache first (for offline videos)
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('vimeo.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(request).then((response) => {
          // Don't cache video embeds, just pass through
          return response
        })
      })
    )
    return
  }

  // Static assets & pages - Cache first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }

        const responseClone = response.clone()
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseClone)
        })

        return response
      }).catch(async () => {
        // Offline fallback
        if (request.destination === 'document') {
          // Try the Next.js offline page first, then fall back to static HTML
          const offlinePage = await caches.match('/offline')
          if (offlinePage) {
            return offlinePage
          }
          // Fall back to static HTML offline page
          const staticOffline = await caches.match('/offline.html')
          if (staticOffline) {
            return staticOffline
          }
          return new Response('Offline', { status: 503 })
        }
        return new Response('Offline', { status: 503 })
      })
    })
  )
})

// Background sync for offline progress
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)

  if (event.tag === 'sync-progress') {
    event.waitUntil(
      // Notify the app to sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_REQUESTED',
          })
        })
      })
    )
  }
})

// Handle messages from app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data.type === 'CACHE_WORKOUT') {
    // Cache workout data
    const { workout, exercises } = event.data.payload
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        // Cache workout metadata
        return Promise.all([
          cache.put(
            new Request(`/api/workouts/${workout.id}`),
            new Response(JSON.stringify({ workout, exercises }))
          ),
        ])
      })
    )
  }
})

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Workout Reminder'
  const options = {
    body: data.body || 'Time for your workout!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: data.url || '/',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  )
})
