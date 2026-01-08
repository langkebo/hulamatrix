/**
 * Call Recording - Recording functionality for Matrix calls
 * Handles starting, stopping, pausing, and resuming call recordings
 */

import { logger } from '@/utils/logger'
import type { CallRecordingData } from './types'
import type { MatrixCallManager } from './call-manager'

export interface RecordingOptions {
  /** MIME type for recording */
  mimeType?: string
  /** Audio bitrate (bps) */
  audioBitsPerSecond?: number
  /** Video bitrate (bps) */
  videoBitsPerSecond?: number
}

/**
 * Call Recording Manager
 */
export class CallRecordingManager {
  private callRecorders = new Map<string, CallRecordingData>()

  constructor(private callManager: MatrixCallManager) {}

  /**
   * Start recording a call
   */
  async startRecording(callId: string, options?: RecordingOptions): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    if (call.isRecording) {
      logger.warn('[Recording] Call is already being recorded', { callId })
      return
    }

    try {
      // Collect all streams to record
      const streams = this.callManager.getMediaStreams()
      const tracksToRecord: MediaStreamTrack[] = []

      if (streams.localAudio) {
        tracksToRecord.push(...streams.localAudio.getAudioTracks())
      }
      if (streams.localVideo) {
        tracksToRecord.push(...streams.localVideo.getVideoTracks())
      }
      if (streams.remoteAudio) {
        tracksToRecord.push(...streams.remoteAudio.getAudioTracks())
      }
      if (streams.remoteVideo) {
        tracksToRecord.push(...streams.remoteVideo.getVideoTracks())
      }

      if (tracksToRecord.length === 0) {
        throw new Error('No media streams to record')
      }

      // Create combined stream
      const combinedStream = new MediaStream(tracksToRecord)

      // Determine MIME type
      const supportedTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'audio/webm']

      let mimeType = options?.mimeType || ''
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        logger.warn('[Recording] Unsupported MIME type, falling back', { mimeType })
        mimeType = ''
      }

      if (!mimeType) {
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type
            break
          }
        }
      }

      if (!mimeType) {
        throw new Error('No supported MIME type found for MediaRecorder')
      }

      // Create MediaRecorder
      const recorderOptions: MediaRecorderOptions = {}
      if (options?.audioBitsPerSecond || options?.videoBitsPerSecond) {
        recorderOptions.audioBitsPerSecond = options.audioBitsPerSecond
        recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        ...recorderOptions
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.start(1000) // Collect data every second

      // Store recording data
      this.callRecorders.set(callId, {
        recorder,
        chunks,
        startTime: Date.now()
      })

      call.isRecording = true
      logger.info('[Recording] Recording started', { callId, mimeType })
    } catch (error) {
      logger.error('[Recording] Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stopRecording(callId: string): Promise<Blob> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const recordingData = this.callRecorders.get(callId)
    if (!recordingData || !call.isRecording) {
      throw new Error('No active recording for this call')
    }

    return new Promise((resolve, reject) => {
      const { recorder, chunks } = recordingData

      recorder.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType })
          this.callRecorders.delete(callId)
          call.isRecording = false
          logger.info('[Recording] Recording stopped', {
            callId,
            size: blob.size,
            type: blob.type
          })
          resolve(blob)
        } catch (error) {
          logger.error('[Recording] Failed to create recording blob:', error)
          reject(error)
        }
      }

      recorder.onerror = (event) => {
        logger.error('[Recording] Recorder error:', event)
        reject(new Error('MediaRecorder error'))
      }

      try {
        recorder.stop()
      } catch (error) {
        logger.error('[Recording] Failed to stop recorder:', error)
        reject(error)
      }
    })
  }

  /**
   * Pause recording
   */
  async pauseRecording(callId: string): Promise<void> {
    const recordingData = this.callRecorders.get(callId)
    if (!recordingData) {
      throw new Error('No active recording for this call')
    }

    const { recorder } = recordingData
    if (recorder.state === 'recording') {
      recorder.pause()
      logger.debug('[Recording] Recording paused', { callId })
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(callId: string): Promise<void> {
    const recordingData = this.callRecorders.get(callId)
    if (!recordingData) {
      throw new Error('No active recording for this call')
    }

    const { recorder } = recordingData
    if (recorder.state === 'paused') {
      recorder.resume()
      logger.debug('[Recording] Recording resumed', { callId })
    }
  }
}
