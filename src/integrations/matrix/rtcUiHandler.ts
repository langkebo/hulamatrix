import { useRtcStore } from '@/stores/rtc'
import type { MatrixCallEvent } from '@/types/matrix'

export function handleRtcCallEvent(event: MatrixCallEvent): void {
  const rtc = useRtcStore()
  switch (event.type) {
    case 'invite': {
      const contentWithOffer = event.content as typeof event.content & { offer?: { sdp?: string } }
      const isVideo = !!contentWithOffer?.offer?.sdp?.includes('m=video')
      rtc.setIncoming(event.roomId, event.sender, isVideo ? 'video' : 'audio')
      break
    }
    case 'answer':
      rtc.setOngoing(event.roomId)
      break
    case 'hangup':
    case 'reject':
      rtc.setEnded(event.roomId)
      break
    case 'candidates':
    case 'select_answer':
      break
  }
}
