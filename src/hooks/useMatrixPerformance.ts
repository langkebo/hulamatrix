/**
 * Matrix Performance Tracking Hook
 */

import { ref } from 'vue'
import { usePerformanceMonitor } from '@/utils/extended-performance-monitor'

export interface MatrixPerformanceMetrics {
  syncDuration: number
  syncEventCount: number
  encryptionTime: number
  decryptionTime: number
  messageSendTime: number
  messageReceiveTime: number
  roomLoadTime: number
  mediaUploadTime: number
  mediaDownloadTime: number
}

export function useMatrixPerformance() {
  const perfMonitor = usePerformanceMonitor()
  const metrics = ref<MatrixPerformanceMetrics>({
    syncDuration: 0,
    syncEventCount: 0,
    encryptionTime: 0,
    decryptionTime: 0,
    messageSendTime: 0,
    messageReceiveTime: 0,
    roomLoadTime: 0,
    mediaUploadTime: 0,
    mediaDownloadTime: 0
  })

  /**
   * 测量同步性能
   */
  const measureSync = async <T>(syncFn: () => Promise<T>): Promise<T> => {
    const result = await perfMonitor.measureAsync('matrixSync', syncFn)

    // 更新指标
    metrics.value.syncDuration = (perfMonitor.getMetrics().syncDuration || 0) as number

    return result
  }

  /**
   * 测量事件处理性能
   */
  const measureEventProcessing = async <T>(eventCount: number, processFn: () => Promise<T>): Promise<T> => {
    const start = performance.now()

    try {
      const result = await processFn()

      const duration = performance.now() - start
      const eventsPerSecond = eventCount / (duration / 1000)

      // 更新指标
      metrics.value.syncEventCount += eventCount
      perfMonitor.trackMetric('matrixEventsPerSecond', eventsPerSecond)

      return result
    } catch (error) {
      const duration = performance.now() - start
      perfMonitor.trackMetric('matrixEventProcessingError', duration)
      throw error
    }
  }

  /**
   * 测量加密性能
   */
  const measureEncryption = async <T>(encryptFn: () => Promise<T>): Promise<T> => {
    const result = await perfMonitor.measureAsync('matrixEncryption', encryptFn)

    // 更新指标
    metrics.value.encryptionTime = (perfMonitor.getMetrics().encryptionTime || 0) as number

    return result
  }

  /**
   * 测量解密性能
   */
  const measureDecryption = async <T>(decryptFn: () => Promise<T>): Promise<T> => {
    const result = await perfMonitor.measureAsync('matrixDecryption', decryptFn)

    // 更新指标
    metrics.value.decryptionTime = (perfMonitor.getMetrics().decryptionTime || 0) as number

    return result
  }

  /**
   * 测量消息发送性能
   */
  const measureMessageSend = async <T>(sendFn: () => Promise<T>): Promise<T> => {
    const result = await perfMonitor.measureAsync('matrixMessageSend', sendFn)

    // 更新指标
    metrics.value.messageSendTime = (perfMonitor.getMetrics().messageSendTime || 0) as number

    return result
  }

  /**
   * 测量消息接收性能
   */
  const measureMessageReceive = (message: unknown) => {
    const start = performance.now()

    // 处理消息...
    const processedMessage = message

    const duration = performance.now() - start

    // 更新指标
    metrics.value.messageReceiveTime = duration
    perfMonitor.trackMetric('messageRenderTime', duration)

    return processedMessage
  }

  /**
   * 测量房间加载性能
   */
  const measureRoomLoad = async <T>(roomId: string, loadFn: () => Promise<T>): Promise<T> => {
    const result = await perfMonitor.measureAsync(`matrixRoomLoad_${roomId}`, loadFn)

    // 更新指标
    metrics.value.roomLoadTime = (perfMonitor.getMetrics().roomLoadTime || 0) as number

    return result
  }

  /**
   * 测量媒体上传性能
   */
  const measureMediaUpload = async (file: File, uploadFn: () => Promise<string>): Promise<string> => {
    // Track file size for performance analysis
    perfMonitor.trackMetric('mediaUploadSize', file.size)

    const result = await perfMonitor.measureAsync('matrixMediaUpload', uploadFn)

    // 计算上传速度
    const uploadSpeed = file.size / (metrics.value.mediaUploadTime / 1000)
    perfMonitor.trackMetric('mediaUploadSpeed', uploadSpeed)

    // 更新指标
    metrics.value.mediaUploadTime = (perfMonitor.getMetrics().mediaUploadTime || 0) as number

    return result
  }

  /**
   * 测量媒体下载性能
   */
  const measureMediaDownload = async (url: string, downloadFn: () => Promise<Blob>): Promise<Blob> => {
    const result = await perfMonitor.measureAsync(`matrixMediaDownload_${url}`, downloadFn)

    // 计算下载速度（如果知道大小）
    if (result.size) {
      const downloadSpeed = result.size / (metrics.value.mediaDownloadTime / 1000)
      perfMonitor.trackMetric('mediaDownloadSpeed', downloadSpeed)
    }

    // 更新指标
    metrics.value.mediaDownloadTime = (perfMonitor.getMetrics().mediaDownloadTime || 0) as number

    return result
  }

  /**
   * 测量数据库操作性能
   */
  const measureDatabaseOperation = async <T>(operation: string, dbFn: () => Promise<T>): Promise<T> => {
    return await perfMonitor.measureAsync(`matrixDB_${operation}`, dbFn)
  }

  /**
   * 测量缓存性能
   */
  const measureCacheOperation = <T>(operation: 'hit' | 'miss' | 'set', cacheFn: () => T): T => {
    const start = performance.now()

    try {
      const result = cacheFn()
      const duration = performance.now() - start

      // Track cache metrics
      perfMonitor.trackMetric(`matrixCache_${operation}`, duration)

      return result
    } catch (error) {
      const duration = performance.now() - start
      perfMonitor.trackMetric('matrixCacheError', duration)
      throw error
    }
  }

  /**
   * 获取性能摘要
   */
  const getPerformanceSummary = () => {
    return {
      sync: {
        duration: metrics.value.syncDuration,
        eventsProcessed: metrics.value.syncEventCount,
        eventsPerSecond:
          metrics.value.syncDuration > 0
            ? (metrics.value.syncEventCount / (metrics.value.syncDuration / 1000)).toFixed(2)
            : '0'
      },
      encryption: {
        encryptionTime: metrics.value.encryptionTime,
        decryptionTime: metrics.value.decryptionTime
      },
      messaging: {
        sendTime: metrics.value.messageSendTime,
        receiveTime: metrics.value.messageReceiveTime
      },
      media: {
        uploadTime: metrics.value.mediaUploadTime,
        downloadTime: metrics.value.mediaDownloadTime
      },
      roomLoad: {
        loadTime: metrics.value.roomLoadTime
      }
    }
  }

  /**
   * 重置所有指标
   */
  const resetMetrics = () => {
    metrics.value = {
      syncDuration: 0,
      syncEventCount: 0,
      encryptionTime: 0,
      decryptionTime: 0,
      messageSendTime: 0,
      messageReceiveTime: 0,
      roomLoadTime: 0,
      mediaUploadTime: 0,
      mediaDownloadTime: 0
    }
  }

  /**
   * 导出性能数据
   */
  const exportMetrics = () => {
    return {
      timestamp: Date.now(),
      matrix: metrics.value,
      summary: getPerformanceSummary(),
      system: perfMonitor.getMetrics()
    }
  }

  return {
    metrics,
    measureSync,
    measureEventProcessing,
    measureEncryption,
    measureDecryption,
    measureMessageSend,
    measureMessageReceive,
    measureRoomLoad,
    measureMediaUpload,
    measureMediaDownload,
    measureDatabaseOperation,
    measureCacheOperation,
    getPerformanceSummary,
    resetMetrics,
    exportMetrics
  }
}
