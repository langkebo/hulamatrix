import { logger, toError } from '@/utils/logger'
/// <reference lib="webworker" />

// 检测浏览器特征
const detectBrowserFeatures = async (): Promise<Record<string, boolean>> => {
  const features: Record<string, boolean> = {}

  const checks = {
    webgl: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!canvas.getContext('webgl')
      } catch {
        return false
      }
    },
    canvas: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!canvas.getContext('2d')
      } catch {
        return false
      }
    },
    audio: async () => {
      try {
        const workerSelf = self as typeof self & { webkitAudioContext?: typeof AudioContext }
        return !!(workerSelf.AudioContext || workerSelf.webkitAudioContext)
      } catch {
        return false
      }
    }
  }

  const results = await Promise.all(
    Object.entries(checks).map(async ([key, check]) => {
      try {
        const result = await check()
        return [key, result]
      } catch {
        return [key, false]
      }
    })
  )

  results.forEach(([key, value]) => {
    features[key as string] = value as boolean
  })

  return features
}

// 生成设备指纹
const generateFingerprint = async (data: {
  deviceInfo: Record<string, unknown>
  browserFingerprint: string
}): Promise<string> => {
  try {
    const totalStart = performance.now()

    // 2. 浏览器特征检测
    const featureStart = performance.now()
    const browserFeatures = await detectBrowserFeatures()
    const featureTime = performance.now() - featureStart

    // 3. 组合所有特征
    const hashStart = performance.now()
    const combinedFingerprint = JSON.stringify({
      browserFingerprint: data.browserFingerprint,
      deviceInfo: data.deviceInfo,
      browserFeatures,
      timestamp: Date.now()
    })

    // 4. 使用 SHA-256 生成最终指纹
    const fingerprintBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combinedFingerprint))

    const fingerprint = Array.from(new Uint8Array(fingerprintBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hashTime = performance.now() - hashStart

    const totalTime = performance.now() - totalStart
    logger.debug('Worker: 指纹生成耗时', { featureTime, hashTime, totalTime })

    return fingerprint
  } catch (error) {
    logger.error('Worker: ❌ 生成设备指纹失败:', toError(error))
    return ''
  }
}

// 监听主线程消息
self.onmessage = async (e) => {
  const { type, deviceInfo, browserFingerprint } = e.data

  if (type === 'generateFingerprint') {
    const fingerprint = await generateFingerprint({ deviceInfo, browserFingerprint })
    self.postMessage({ type: 'fingerprintGenerated', fingerprint })
  }
}
