import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'
import { getMatrixBaseUrl, getMatrixTokens } from '@/utils/matrixEnv'
import { AutoDiscovery } from 'matrix-js-sdk'

export async function useMatrixDevSync() {
  const dev = import.meta.env.VITE_MATRIX_DEV_SYNC === 'true'
  if (!dev) return
  const baseUrl = getMatrixBaseUrl()
  const { accessToken: token, userId } = getMatrixTokens()

  if (!baseUrl) return

  try {
    const resp = await fetch(`${baseUrl}/_matrix/client/versions`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
    if (resp.ok) {
      const data = await resp.json()
      logger.info('[matrix] versions:', data)
    } else {
      logger.warn('[matrix] versions endpoint returned non-200:', resp.status)
    }
  } catch (e) {
    logger.error('[matrix] versions probe failed:', e)
  }

  if (token && userId) {
    await matrixClientService.initialize({ baseUrl, accessToken: token, userId })
    const client = matrixClientService.getClient()
    if (client?.on) {
      const onMethod = client.on as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined
      onMethod?.('sync', (...args: unknown[]) => {
        const state = args[0] as string
        logger.info('[matrix] sync:', state)
      })
      onMethod?.('Room.timeline', (...args: unknown[]) => {
        const event = args[0] as { getType: () => string }
        const room = args[1] as { roomId: string } | undefined
        const toStartOfTimeline = args[2] as boolean | undefined
        if (toStartOfTimeline) return
        logger.info('[matrix] event:', { type: event.getType(), roomId: room?.roomId })
      })
    }
    await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
    return () => {
      matrixClientService.stopClient()
    }
  } else {
    try {
      const result = await AutoDiscovery.findClientConfig(baseUrl)
      logger.info('[matrix] autodiscovery:', result)
      const temp = await import('matrix-js-sdk')
      const tempClient = temp.createClient({ baseUrl })
      // loginFlows is a Matrix SDK method for getting available login types
      const clientWithLoginFlows = tempClient as unknown as { loginFlows: () => Promise<unknown> }
      const flows = await clientWithLoginFlows.loginFlows()
      logger.info('[matrix] login flows:', flows)
      return () => {}
    } catch (e) {
      logger.error('[matrix] discovery error:', e)
      return () => {}
    }
  }
}
