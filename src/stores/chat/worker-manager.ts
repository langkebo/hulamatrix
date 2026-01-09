/**
 * Chat Store - Worker Manager
 * Handles background worker for timers
 */

import { logger } from '@/utils/logger'
import type { TimerWorker } from './types'

/**
 * Worker manager
 */
export class ChatWorkerManager {
  /** Timer worker instance */
  private worker: TimerWorker

  /** Worker support flag */
  private workerSupported: boolean

  constructor() {
    this.workerSupported = typeof Worker !== 'undefined' && typeof window !== 'undefined'

    // Create worker (with fallback for non-browser environments)
    this.worker = this.workerSupported
      ? new Worker(new URL('../../workers/timer.worker.ts', import.meta.url))
      : {
          postMessage: () => {},
          terminate: () => {},
          onmessage: null,
          onerror: null
        }

    // Setup error handler
    if (this.worker.onerror) {
      this.worker.onerror = (error) => {
        logger.error('[ChatWorker] Worker error:', error)
      }
    }
  }

  /**
   * Post message to worker
   */
  postMessage(data: unknown): void {
    this.worker.postMessage(data)
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker.terminate) {
      this.worker.terminate()
      logger.info('[ChatWorker] Worker terminated')
    }
  }

  /**
   * Set message handler
   */
  onMessage(handler: (event: MessageEvent<unknown>) => void): void {
    this.worker.onmessage = handler
  }

  /**
   * Set error handler
   */
  onError(handler: (event: ErrorEvent) => void): void {
    this.worker.onerror = handler
  }

  /**
   * Check if worker is supported
   */
  isSupported(): boolean {
    return this.workerSupported
  }
}
