import { matrixClientService } from '@/integrations/matrix/client'
import { handleError } from '@/utils/error-handler'

// Type for Matrix client with event handling methods
type MatrixClientWithEvents = {
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

export function setupMatrixEventBus() {
  const client = matrixClientService.getClient() as MatrixClientWithEvents | null
  if (!client) return

  // Listen for sync state changes
  client.on('sync', (...args: unknown[]) => {
    const state = args[0] as string
    const data = args[2] as { error?: Error } | undefined
    if (state === 'ERROR') {
      handleError(data?.error || new Error('sync error'), { operation: 'sync' })
    }
  })

  // Listen for session logout
  client.on('Session.logged_out', () => {
    handleError(new Error('logged out'), { operation: 'auth' })
  })

  // Listen for decryption failures
  client.on('crypto.failed_to_decrypt', (...args: unknown[]) => {
    const ev = args[0] as { error?: Error } | undefined
    handleError(ev?.error || new Error('decryption failed'), { operation: 'decrypt' })
  })

  // Listen for timeline errors
  client.on('Event.timeline', (...args: unknown[]) => {
    const room = args[1] as { roomId?: string } | undefined
    const data2 = args[4] as { err?: Error } | undefined
    if (data2?.err) {
      handleError(data2.err, { roomId: room?.roomId, operation: 'timeline' })
    }
  })
}
