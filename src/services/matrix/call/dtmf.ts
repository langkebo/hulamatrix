/**
 * DTMF (Dual-Tone Multi-Frequency) - Send tones during calls
 * Handles sending DTMF tones through WebRTC or Matrix events
 */

import { logger } from '@/utils/logger'
import type { MatrixCallManager } from './call-manager'

/**
 * DTMF Manager
 */
export class DTMFManager {
  private peerConnections: Map<string, RTCPeerConnection>

  constructor(
    private callManager: MatrixCallManager,
    peerConnections: Map<string, RTCPeerConnection>
  ) {
    this.peerConnections = peerConnections
  }

  /**
   * Send DTMF tone
   */
  async sendDtmf(callId: string, tone: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const validTones = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', 'A', 'B', 'C', 'D']
    const upperTone = tone.toUpperCase()

    if (!validTones.includes(upperTone)) {
      throw new Error(`Invalid DTMF tone: ${tone}`)
    }

    const pc = this.peerConnections.get(callId)
    if (!pc) {
      logger.warn('[DTMF] No peer connection for DTMF')
      await this.sendDtmfAsEvent(callId, upperTone)
      return
    }

    // Try to send DTMF via RTP (WebRTC)
    const senders = pc.getSenders()
    const audioSender = senders.find((s) => s.track?.kind === 'audio')

    if (!audioSender) {
      logger.warn('[DTMF] No audio sender for DTMF')
      await this.sendDtmfAsEvent(callId, upperTone)
      return
    }

    // Check if DTMF is supported (createDTMFSender may not be available in all browsers)
    // TypeScript doesn't have this in the standard types, so we use any
    const sender = audioSender as unknown as { createDTMFSender?: () => RTCDTMFSender | null }
    const dtmfSender = sender.createDTMFSender?.()
    if (!dtmfSender) {
      logger.warn('[DTMF] DTMF sender not supported')
      await this.sendDtmfAsEvent(callId, upperTone)
      return
    }

    try {
      // RTCDTMFSender has insertDTMF method, not a dtmf property
      dtmfSender.insertDTMF(upperTone, 200, 50) // duration: 200ms, interToneGap: 50ms
      logger.debug('[DTMF] DTMF tone sent via RTP', { callId, tone: upperTone })
    } catch (error) {
      logger.warn('[DTMF] Failed to send DTMF via RTP, falling back to event:', error)
      await this.sendDtmfAsEvent(callId, upperTone)
    }
  }

  /**
   * Send DTMF as Matrix event (fallback)
   */
  async sendDtmfAsEvent(callId: string, tone: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    try {
      // This would need access to sendCallEvent from call manager
      // For now, we'll emit a custom event
      window.dispatchEvent(
        new CustomEvent('matrixCallDtmf', {
          detail: {
            callId,
            tone,
            roomId: call.roomId
          }
        })
      )

      logger.debug('[DTMF] DTMF tone sent via event', { callId, tone })
    } catch (error) {
      logger.error('[DTMF] Failed to send DTMF event:', error)
      throw error
    }
  }
}
