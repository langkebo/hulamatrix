import { matrixClientService } from './client'

export async function startRecording(): Promise<MediaRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  return recorder
}

export async function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  const chunks: BlobPart[] = []
  return new Promise((resolve) => {
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
    recorder.stop()
  })
}

export async function sendVoiceMessage(
  roomId: string,
  audioBlob: Blob,
  options?: { duration?: number; waveform?: number[] }
): Promise<string> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix 客户端未初始化')

  // Type for Matrix client with uploadContent and sendEvent methods
  const clientWithMethods = client as {
    uploadContent: (
      blob: Blob,
      opts: { name: string; type: string }
    ) => Promise<{
      content_uri?: string
      uri?: string
    }>
    sendEvent: (roomId: string, type: string, content: unknown) => { event_id?: string } | string
  }

  const upload = await clientWithMethods.uploadContent(audioBlob, {
    name: 'voice.webm',
    type: audioBlob.type || 'audio/webm'
  })
  const url = upload?.content_uri || upload?.uri

  const content = {
    msgtype: 'm.audio',
    body: 'voice.webm',
    url,
    info: {
      mimetype: audioBlob.type || 'audio/webm',
      size: audioBlob.size || 0,
      duration: options?.duration || 0,
      waveform: options?.waveform || []
    }
  }
  const res = await clientWithMethods.sendEvent(roomId, 'm.room.message', content)
  const eventId = typeof res === 'string' ? res : res?.event_id
  return String(eventId || '')
}

export async function playVoiceMessage(url: string): Promise<HTMLAudioElement> {
  const audio = new Audio(url)
  await audio.play()
  return audio
}

export async function transcribeVoiceMessage(_blob: Blob): Promise<string | null> {
  return null
}
