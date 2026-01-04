/* ==========================================================================
   HuLaMatrix Service Worker
   Handles Web Push notifications and offline caching
   ========================================================================== */

// Service worker version - increment to force update
const SW_VERSION = '1.0.0'

// Cache name with version
const CACHE_NAME = `hulamatrix-cache-v${SW_VERSION}`

// URLs to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + SW_VERSION)

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching static assets')
      // Add each URL individually to handle failures gracefully
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => {
          return cache.add(url).catch((error) => {
            console.warn('[SW] Failed to cache:', url, error.message)
            // Don't fail the entire installation if one asset fails
            return Promise.resolve()
          })
        })
      )
    })
  )

  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + SW_VERSION)

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && cacheName.startsWith('hulamatrix-cache-')) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )

  // Take control of all clients immediately
  return self.clients.claim()
})

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // API requests - network only, no caching
  if (url.pathname.startsWith('/_matrix') || url.pathname.startsWith('/_synapse')) {
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('[SW] API request failed:', error)
        // Return a custom offline response for API requests
        return new Response(
          JSON.stringify({
            error: 'offline',
            message: 'Network request failed - device is offline'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      })
    )
    return
  }

  // For other requests - network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before using it
        const responseClone = response.clone()

        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }

        return response
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', request.url)
            return cachedResponse
          }

          // Return a custom offline page
          return caches.match('/index.html')
        })
      })
  )
})

/* ==========================================================================
   Push Notification Handling
   ========================================================================== */

// Push event - received push message from server
self.addEventListener('push', (event) => {
  console.log('[SW] Push received')

  let notificationData = {
    title: 'HuLaMatrix',
    body: 'You have a new message',
    icon: '/favicon.ico',
    badge: '/badge-icon.png',
    tag: 'default',
    data: {},
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/open.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close.png'
      }
    ]
  }

  // Parse push data
  if (event.data) {
    try {
      const pushData = event.data.json()
      notificationData = {
        ...notificationData,
        ...pushData
      }
    } catch (error) {
      console.error('[SW] Failed to parse push data:', error)
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag || `push-${Date.now()}`,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: notificationData.data.urgent || false,
      silent: notificationData.data.silent || false
    })
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag)

  event.notification.close()

  const action = event.action
  const data = event.notification.data || {}

  if (action === 'close') {
    // User clicked close button
    return
  }

  // Default or open action - focus or open the app
  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus()
          }
        }

        // No existing window - open new one
        if (clients.openWindow) {
          // Navigate to specific room if provided
          let url = self.location.origin
          if (data.roomId) {
            url = `${self.location.origin}/#room/${data.roomId}`
          }

          return clients.openWindow(url)
        }
      })
  )
})

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag)

  // Optional: Track notification dismissal analytics
  const data = event.notification.data || {}
  if (data.eventId) {
    // Could send to analytics server
    console.log('[SW] Notification dismissed for event:', data.eventId)
  }
})

/* ==========================================================================
   Background Sync (for offline message queue)
   ========================================================================== */

// Sync event - handle background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)

  if (event.tag === 'background-sync-messages') {
    event.waitUntil(doBackgroundSync())
  }
})

// Perform background sync
async function doBackgroundSync() {
  try {
    // Get all pending messages from IndexedDB
    const pendingMessages = await getPendingMessages()

    console.log('[SW] Syncing', pendingMessages.length, 'pending messages')

    // Send each pending message
    for (const msg of pendingMessages) {
      try {
        await sendMessage(msg)
        // Remove from queue on success
        await removePendingMessage(msg.id)
      } catch (error) {
        console.error('[SW] Failed to send message:', error)
        // Keep in queue for retry
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Get pending messages from IndexedDB
async function getPendingMessages() {
  // This would integrate with your offline queue
  // For now, return empty array
  return []
}

// Send message to server
async function sendMessage(msg) {
  const response = await fetch(msg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${msg.token}`
    },
    body: JSON.stringify(msg.payload)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

// Remove pending message from IndexedDB
async function removePendingMessage(id) {
  // This would integrate with your offline queue
  console.log('[SW] Removed pending message:', id)
}

/* ==========================================================================
   Message Handling (from client)
   ========================================================================== */

// Handle messages from client
self.addEventListener('message', (event) => {
  console.log('[SW] Message received from client:', event.data)

  const { action, data } = event.data

  switch (action) {
    case 'skip-waiting':
      self.skipWaiting()
      break

    case 'get-version':
      event.ports[0].postMessage({ version: SW_VERSION })
      break

    case 'clear-cache':
      clearCache().then(() => {
        event.ports[0].postMessage({ success: true })
      })
      break

    default:
      console.warn('[SW] Unknown action:', action)
  }
})

// Clear all caches
async function clearCache() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map((name) => caches.delete(name)))
  console.log('[SW] All caches cleared')
}

/* ==========================================================================
   Periodic Sync (optional, for periodic background updates)
   ========================================================================== */

// Periodic sync event (requires permission)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag)

  if (event.tag === 'periodic-sync-notifications') {
    event.waitUntil(checkForUpdates())
  }
})

// Check for updates
async function checkForUpdates() {
  try {
    // Could check for new messages, updates, etc.
    console.log('[SW] Checking for updates...')
  } catch (error) {
    console.error('[SW] Update check failed:', error)
  }
}

console.log('[SW] Service worker loaded v' + SW_VERSION)
