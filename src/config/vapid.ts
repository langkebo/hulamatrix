/* ==========================================================================
   VAPID (Voluntary Application Server Identification) Configuration
   For Web Push notification authentication
   ========================================================================== */

/**
 * VAPID configuration
 *
 * To generate VAPID keys:
 * 1. Install web-push: `npm install -g web-push`
 * 2. Generate keys: `web-push generate-vapid-keys`
 * 3. Copy the public and private keys below
 *
 * Or use the online generator: https://vapidkeys.com/
 */
export interface VapidConfig {
  /** VAPID public key (URL-safe base64 encoded) */
  publicKey: string
  /** VAPID private key (URL-safe base64 encoded) - NEVER expose to client */
  privateKey: string
  /** Subject (contact email or URL) */
  subject: string
}

/**
 * Default VAPID configuration
 *
 * IMPORTANT: Replace these with your own VAPID keys!
 *
 * For development, you can use these test keys (DO NOT use in production):
 * - Public: BEl62iUYgUivxIkv69yViEuiBIa-Ib47Jq9j3z4s0Lp8fNnJCmYpMF0T3pFHj27hBtHge4vqLZEFf6QhLy8-gDWY
 * - Private: 6B8lXx0kNh2ZNVanVmXtB6fY-FkqCJWtFJtJRu6TfNVbJI0X7WwMx3Vf0xT0pXrJ3hBvC8ZfF0qV7xY6T5R3wF5K
 */
export const DEFAULT_VAPID_CONFIG: VapidConfig = {
  // Development/test keys - REPLACE FOR PRODUCTION
  publicKey:
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib47Jq9j3z4s0Lp8fNnJCmYpMF0T3pFHj27hBtHge4vqLZEFf6QhLy8-gDWY',
  privateKey: import.meta.env.VITE_VAPID_PRIVATE_KEY || '', // Never expose to client
  subject: import.meta.env.VITE_VAPID_SUBJECT || 'mailto:admin@hulamatrix.com'
}

/**
 * Get VAPID public key for client-side push subscription
 */
export function getVapidPublicKey(): string {
  return DEFAULT_VAPID_CONFIG.publicKey
}

/**
 * Get VAPID subject for server-side push sending
 */
export function getVapidSubject(): string {
  return DEFAULT_VAPID_CONFIG.subject
}

/**
 * Validate VAPID configuration
 */
export function validateVapidConfig(config: VapidConfig): boolean {
  // Check if keys are valid URL-safe base64
  const urlSafeBase64Regex = /^[A-Za-z0-9_-]+$/

  const validPublicKey = Boolean(
    config.publicKey && urlSafeBase64Regex.test(config.publicKey) && config.publicKey.length === 87
  )

  const validPrivateKey = Boolean(
    config.privateKey && urlSafeBase64Regex.test(config.privateKey) && config.privateKey.length === 43
  )

  const validSubject = Boolean(
    config.subject && (config.subject.startsWith('mailto:') || config.subject.startsWith('https://'))
  )

  if (!validPublicKey) {
    console.error('[VAPID] Invalid public key - must be 87 characters of URL-safe base64')
  }

  if (!validPrivateKey) {
    console.error('[VAPID] Invalid private key - must be 43 characters of URL-safe base64')
  }

  if (!validSubject) {
    console.error('[VAPID] Invalid subject - must start with mailto: or https://')
  }

  return validPublicKey && validPrivateKey && validSubject
}

/**
 * Generate VAPID keys (server-side only, requires crypto)
 * NOTE: This should be done server-side, never in the browser!
 */
export async function generateVapidKeys(): Promise<VapidConfig> {
  // This should only be called server-side (e.g., in a Node.js environment)
  // For browser environments, use an external tool or server endpoint

  if (typeof window !== 'undefined') {
    throw new Error('VAPID key generation should be done server-side')
  }

  // Dynamic import for Node.js crypto
  const { randomBytes, createPublicKey } = await import('crypto')

  // Generate P-256 curve key pair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveBits']
  )

  // Export keys
  const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  // Convert to URL-safe base64
  const publicKey = bufferToBase64Url(publicKeyBuffer)
  const privateKey = bufferToBase64Url(privateKeyBuffer)

  return {
    publicKey,
    privateKey,
    subject: 'mailto:admin@hulamatrix.com'
  }
}

/**
 * Convert buffer to URL-safe base64
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Server-side push notification sender (for reference - implement on server)
 */
export interface PushNotificationPayload {
  /** Subscription endpoint */
  endpoint: string
  /** Push keys */
  keys: {
    p256dh: string
    auth: string
  }
  /** Notification data */
  data: {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    data?: Record<string, unknown>
  }
  /** VAPID details */
  vapid: {
    subject: string
    publicKey: string
    privateKey: string
  }
}

/**
 * Example server-side push sending function
 * NOTE: This is for reference only - implement on your push server
 */
export async function sendPushNotification(_payload: PushNotificationPayload): Promise<void> {
  // This would be implemented on the server using web-push library
  // Example:
  //
  // const webpush = require('web-push')
  // webpush.setVapidDetails(
  //   payload.vapid.subject,
  //   payload.vapid.publicKey,
  //   payload.vapid.privateKey
  // )
  // await webpush.sendNotification(
  //   {
  //     endpoint: payload.endpoint,
  //     keys: payload.keys
  //   },
  //   JSON.stringify(payload.data)
  // )
  //
  throw new Error('sendPushNotification must be implemented server-side')
}

/**
 * Development helper to check if VAPID is configured
 */
export function checkVapidConfiguration(): {
  configured: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (!DEFAULT_VAPID_CONFIG.publicKey) {
    issues.push('VAPID public key is missing')
  }

  if (!DEFAULT_VAPID_CONFIG.privateKey) {
    issues.push('VAPID private key is missing (server-side)')
  }

  if (!DEFAULT_VAPID_CONFIG.subject) {
    issues.push('VAPID subject is missing')
  }

  if (issues.length > 0) {
    console.warn('[VAPID] Configuration issues:', issues)
  }

  return {
    configured: issues.length === 0,
    issues
  }
}

// Log configuration status in development
if (import.meta.env.DEV) {
  const vapidStatus = checkVapidConfiguration()
  console.log('[VAPID] Configuration status:', vapidStatus)
}
