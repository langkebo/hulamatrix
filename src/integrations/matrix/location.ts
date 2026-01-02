import { matrixClientService } from './client'

export async function shareLocation(
  roomId: string,
  coords: GeolocationCoordinates,
  description?: string
): Promise<string> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix 客户端未初始化')

  const content = {
    msgtype: 'm.text',
    body: description || '我的位置',
    'm.location': { uri: `geo:${coords.latitude},${coords.longitude}`, description: description || '我的位置' },
    'org.matrix.msc3488.location': {
      uri: `geo:${coords.latitude},${coords.longitude}`,
      description: description || '我的位置'
    }
  }

  // Type for Matrix client with sendEvent method
  const clientWithSend = client as {
    sendEvent: (roomId: string, type: string, content: unknown) => { event_id?: string } | string
  }

  const res = await clientWithSend.sendEvent(roomId, 'm.room.message', content)
  const eventId = typeof res === 'string' ? res : res?.event_id
  return String(eventId || '')
}
