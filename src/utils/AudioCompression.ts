import { logger } from '@/utils/logger'

// 可选依赖：@breezystack/lamejs 未安装时降级为 WAV 导出

/** Lamejs Mp3Encoder 类类型 */
interface Mp3EncoderConstructor {
  new (
    channels: number,
    sampleRate: number,
    bitRate: number
  ): {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array
    flush(): Int8Array
  }
}

/** Lamejs 库类型 */
interface LamejsLibrary {
  Mp3Encoder: Mp3EncoderConstructor
}

/** GlobalThis 扩展类型 */
interface GlobalThisWithLamejs {
  lamejs?: LamejsLibrary
}

/**
 * 音频压缩配置接口
 */
export interface AudioCompressionConfig {
  /** 声道数：1为单声道，2为立体声 */
  channels?: number
  /** 采样率 (Hz) */
  sampleRate?: number
  /** MP3比特率 (kbps) */
  bitRate?: number
}

/**
 * 默认音频压缩配置
 */
const DEFAULT_CONFIG: Required<AudioCompressionConfig> = {
  channels: 1, // 单声道可以减小文件大小
  sampleRate: 22050, // 降低采样率以减小文件大小
  bitRate: 64 // 较低的比特率以减小文件大小
}

/**
 * 将WAV音频数据转换为压缩的MP3格式
 * @param audioBuffer - 音频缓冲区数据
 * @param config - 压缩配置
 * @returns 压缩后的MP3 Blob
 */
export async function compressAudioToMp3(audioBuffer: ArrayBuffer, config: AudioCompressionConfig = {}): Promise<Blob> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  try {
    // 创建AudioContext来处理音频数据
    const audioContext = new AudioContext()
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

    // 重采样到目标采样率
    const resampledBuffer = await resampleAudio(decodedAudio, finalConfig.sampleRate)

    // 转换为Int16Array格式
    const samples = convertToInt16Array(resampledBuffer, finalConfig.channels)

    // 如果全局提供了 lamejs，则使用 MP3 编码，否则降级为 WAV
    const globalWithLamejs = globalThis as unknown as GlobalThisWithLamejs
    const hasMp3 = !!globalWithLamejs?.lamejs?.Mp3Encoder
    let blob: Blob
    if (hasMp3) {
      const mp3Data = encodeToMp3(samples, finalConfig)
      const uint8Arrays = mp3Data.map((data) => new Uint8Array(data))
      blob = new Blob(uint8Arrays, { type: 'audio/mp3' })
    } else {
      blob = writeWav(samples, finalConfig.sampleRate, finalConfig.channels)
    }

    // 清理AudioContext
    await audioContext.close()

    return blob
  } catch (error) {
    logger.error('音频压缩失败:', error)
    throw new Error('音频压缩失败')
  }
}

/**
 * 重采样音频到目标采样率
 */
async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer
  }

  const audioContext = new AudioContext({ sampleRate: targetSampleRate })
  const resampledBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    Math.floor((audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate),
    targetSampleRate
  )

  // 简单的线性插值重采样
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel)
    const outputData = resampledBuffer.getChannelData(channel)
    const ratio = inputData.length / outputData.length

    for (let i = 0; i < outputData.length; i++) {
      const index = i * ratio
      const indexFloor = Math.floor(index)
      const indexCeil = Math.min(indexFloor + 1, inputData.length - 1)
      const fraction = index - indexFloor

      outputData[i] = (inputData[indexFloor] ?? 0) * (1 - fraction) + (inputData[indexCeil] ?? 0) * fraction
    }
  }

  await audioContext.close()
  return resampledBuffer
}

/**
 * 将AudioBuffer转换为Int16Array格式
 */
function convertToInt16Array(audioBuffer: AudioBuffer, targetChannels: number): Int16Array {
  const length = audioBuffer.length
  const samples = new Int16Array(length * targetChannels)
  const AMPLIFY = 10 // 10倍响度

  if (targetChannels === 1) {
    // 转换为单声道
    const channelData = audioBuffer.numberOfChannels > 1 ? mixToMono(audioBuffer) : audioBuffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      const sample = (channelData[i] ?? 0) * AMPLIFY
      samples[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff
    }
  } else {
    // 保持立体声
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel

    for (let i = 0; i < length; i++) {
      const l = (leftChannel[i] ?? 0) * AMPLIFY
      const r = (rightChannel[i] ?? 0) * AMPLIFY
      samples[i * 2] = Math.max(-1, Math.min(1, l)) * 0x7fff
      samples[i * 2 + 1] = Math.max(-1, Math.min(1, r)) * 0x7fff
    }
  }

  return samples
}

/**
 * 将多声道音频混合为单声道
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length
  const monoData = new Float32Array(length)
  const numberOfChannels = audioBuffer.numberOfChannels

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i] ?? 0
    }
    monoData[i] = sum / numberOfChannels
  }

  return monoData
}

/**
 * 使用lamejs将音频数据编码为MP3
 */
function encodeToMp3(samples: Int16Array, config: Required<AudioCompressionConfig>): Int8Array[] {
  const globalWithLamejs = globalThis as unknown as GlobalThisWithLamejs
  const Mp3Encoder = globalWithLamejs?.lamejs?.Mp3Encoder
  if (!Mp3Encoder) {
    throw new Error('lamejs not available')
  }

  const mp3encoder = new Mp3Encoder(config.channels, config.sampleRate, config.bitRate)
  const mp3Data: Int8Array[] = []
  const sampleBlockSize = 1152 // lamejs推荐的块大小

  // 分块编码
  for (let i = 0; i < samples.length; i += sampleBlockSize * config.channels) {
    let sampleChunk: Int16Array

    if (config.channels === 1) {
      // 单声道
      sampleChunk = samples.subarray(i, i + sampleBlockSize)
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf)
      }
    } else {
      // 立体声
      const leftChunk = new Int16Array(sampleBlockSize)
      const rightChunk = new Int16Array(sampleBlockSize)

      for (let j = 0; j < sampleBlockSize && i + j * 2 + 1 < samples.length; j++) {
        leftChunk[j] = samples[i + j * 2] ?? 0
        rightChunk[j] = samples[i + j * 2 + 1] ?? 0
      }

      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf)
      }
    }
  }

  // 完成编码
  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf)
  }

  return mp3Data
}

/**
 * 将 Int16 PCM 写入 WAV
 */
function writeWav(samples: Int16Array, sampleRate: number, channels: number): Blob {
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM
  view.setUint16(20, 1, true) // format = 1
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i] ?? 0, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * 获取音频文件的基本信息
 */
export async function getAudioInfo(audioBuffer: ArrayBuffer): Promise<{
  duration: number
  sampleRate: number
  channels: number
  size: number
}> {
  const audioContext = new AudioContext()
  const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

  const info = {
    duration: decodedAudio.duration,
    sampleRate: decodedAudio.sampleRate,
    channels: decodedAudio.numberOfChannels,
    size: audioBuffer.byteLength
  }

  await audioContext.close()
  return info
}

/**
 * 计算压缩比
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100)
}
