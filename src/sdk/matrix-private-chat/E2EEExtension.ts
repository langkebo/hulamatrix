/**
 * Matrix PrivateChat E2EE Extension
 * 实现端到端加密功能
 *
 * @module sdk/matrix-private-chat/E2EEExtension
 */

import { EventEmitter } from 'node:events'
import type { E2EEApi, EncryptedContent, SessionKeyMetadata, MatrixClientLike } from './types'
import { encryptMessage, decryptMessage, generateSessionKey } from '@/utils/cryptoUtils'

/**
 * E2EE 扩展实现类
 */
export class PrivateChatE2EEExtension extends EventEmitter implements E2EEApi {
  private readonly sessionKeys: Map<string, CryptoKey> = new Map()
  private readonly sessionKeyMetadata: Map<string, SessionKeyMetadata> = new Map()
  private readonly keyRotationInterval: number = 24 * 60 * 60 * 1000 // 24小时
  private readonly keyExpirationTime: number = 7 * 24 * 60 * 60 * 1000 // 7天
  private initialized = false

  constructor(_client: MatrixClientLike) {
    super()
    // Client is stored but not directly used in the current implementation
    // It's reserved for future use
  }

  /**
   * 初始化 E2EE
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.emit('e2ee.initializing')
    this.initialized = true
    this.emit('e2ee.initialized')

    // 启动密钥轮换定时器
    this.startKeyRotationTimer()
  }

  /**
   * 协商会话密钥
   *
   * @param sessionId - 会话 ID
   * @param participants - 参与者列表
   * @returns Promise<CryptoKey>
   */
  async negotiateSessionKey(sessionId: string, participants: string[]): Promise<CryptoKey> {
    this.ensureInitialized()

    // 检查是否已有会话密钥
    const existingKey = this.sessionKeys.get(sessionId)
    const existingMetadata = this.sessionKeyMetadata.get(sessionId)

    // 如果密钥存在且未过期，直接返回
    if (existingKey && existingMetadata && existingMetadata.status === 'active') {
      const now = Date.now()
      if (!existingMetadata.expires_at || existingMetadata.expires_at > now) {
        this.emit('sessionKey.reused', { sessionId, keyId: existingMetadata.key_id })
        return existingKey
      }
    }

    // 生成新的会话密钥
    const sessionKeyResult = await generateSessionKey(sessionId, participants, Date.now() + this.keyExpirationTime)

    // 存储密钥和元数据
    this.sessionKeys.set(sessionId, sessionKeyResult.key)
    this.sessionKeyMetadata.set(sessionId, {
      session_id: sessionId,
      key_id: sessionKeyResult.keyId,
      created_at: sessionKeyResult.createdAt,
      expires_at: sessionKeyResult.expiresAt,
      participants,
      status: 'active'
    })

    this.emit('sessionKey.negotiated', {
      sessionId,
      keyId: sessionKeyResult.keyId,
      participants
    })

    return sessionKeyResult.key
  }

  /**
   * 加密消息
   *
   * @param sessionId - 会话 ID
   * @param content - 消息内容
   * @returns Promise<EncryptedContent>
   */
  async encryptMessage(sessionId: string, content: string): Promise<EncryptedContent> {
    this.ensureInitialized()

    // 获取或协商会话密钥
    const key = await this.getSessionKey(sessionId)
    const metadata = this.sessionKeyMetadata.get(sessionId)!

    // 加密消息
    const encrypted = await encryptMessage(content, key)

    // 转换为 EncryptedContent 格式
    const result: EncryptedContent = {
      algorithm: 'aes-gcm-256',
      key_id: metadata.key_id,
      ciphertext: this.bufferToBase64(encrypted.ciphertext),
      iv: this.bufferToBase64(encrypted.iv),
      tag: encrypted.tag ? this.bufferToBase64(encrypted.tag) : '',
      timestamp: Date.now()
    }

    this.emit('message.encrypted', {
      sessionId,
      keyId: metadata.key_id,
      timestamp: result.timestamp
    })

    return result
  }

  /**
   * 解密消息
   *
   * @param sessionId - 会话 ID
   * @param encryptedContent - 加密内容
   * @returns Promise<string>
   */
  async decryptMessage(sessionId: string, encryptedContent: EncryptedContent): Promise<string> {
    this.ensureInitialized()

    // 验证算法
    if (encryptedContent.algorithm !== 'aes-gcm-256') {
      throw new Error(`Unsupported algorithm: ${encryptedContent.algorithm}`)
    }

    // 获取会话密钥
    const key = await this.getSessionKey(encryptedContent.key_id || sessionId)

    // 转换加密内容
    const ciphertext = this.base64ToBuffer(encryptedContent.ciphertext)
    const iv = this.base64ToBuffer(encryptedContent.iv)
    const tag = encryptedContent.tag ? this.base64ToBuffer(encryptedContent.tag) : undefined

    // 解密消息
    const decrypted = await decryptMessage(
      {
        ciphertext,
        iv,
        ...(tag && { tag })
      },
      key
    )

    this.emit('message.decrypted', {
      sessionId,
      keyId: encryptedContent.key_id || this.sessionKeyMetadata.get(sessionId)?.key_id,
      timestamp: encryptedContent.timestamp
    })

    return decrypted
  }

  /**
   * 轮换会话密钥
   *
   * @param sessionId - 会话 ID
   * @returns Promise<void>
   */
  async rotateSessionKey(sessionId: string): Promise<void> {
    this.ensureInitialized()

    const existingMetadata = this.sessionKeyMetadata.get(sessionId)
    if (!existingMetadata) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // 标记旧密钥为已轮换
    existingMetadata.status = 'rotated'

    // 生成新密钥
    const oldKeyId = existingMetadata.key_id
    const _newKey = await this.negotiateSessionKey(sessionId, existingMetadata.participants)

    this.emit('sessionKey.rotated', {
      sessionId,
      oldKeyId,
      newKeyId: this.sessionKeyMetadata.get(sessionId)!.key_id
    })

    // 清理旧密钥（保留一段时间以支持延迟消息）
    setTimeout(
      () => {
        this.cleanupSessionKey(sessionId, oldKeyId)
      },
      5 * 60 * 1000
    ) // 5分钟后清理
  }

  /**
   * 清理会话密钥
   *
   * @param sessionId - 会话 ID
   * @param keyId - 密钥 ID（可选，如果不提供则清理当前密钥）
   * @returns Promise<void>
   */
  async cleanupSessionKey(sessionId: string, keyId?: string): Promise<void> {
    const targetKeyId = keyId || this.sessionKeyMetadata.get(sessionId)?.key_id

    if (targetKeyId) {
      // 查找并删除对应的密钥
      for (const [id, metadata] of this.sessionKeyMetadata.entries()) {
        if (metadata.session_id === sessionId && metadata.key_id === targetKeyId) {
          this.sessionKeyMetadata.delete(id)
          this.sessionKeys.delete(sessionId)

          this.emit('sessionKey.cleaned', {
            sessionId,
            keyId: targetKeyId
          })

          break
        }
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('E2EE not initialized. Call initialize() first.')
    }
  }

  /**
   * 获取会话密钥
   *
   * @param sessionIdOrKeyId - 会话 ID 或密钥 ID
   * @returns Promise<CryptoKey>
   */
  private async getSessionKey(sessionIdOrKeyId: string): Promise<CryptoKey> {
    // 首先尝试直接获取
    let key = this.sessionKeys.get(sessionIdOrKeyId)

    // 如果没找到，尝试通过 keyId 查找
    if (!key) {
      for (const [sessionId, metadata] of this.sessionKeyMetadata.entries()) {
        if (metadata.key_id === sessionIdOrKeyId) {
          key = this.sessionKeys.get(sessionId)
          break
        }
      }
    }

    if (!key) {
      throw new Error(`Session key not found: ${sessionIdOrKeyId}`)
    }

    // 检查密钥是否过期
    const metadata = this.sessionKeyMetadata.get(sessionIdOrKeyId)
    if (metadata && metadata.expires_at && metadata.expires_at < Date.now()) {
      // 密钥已过期，触发轮换
      await this.rotateSessionKey(metadata.session_id)
      // 返回新密钥
      return this.sessionKeys.get(metadata.session_id)!
    }

    return key
  }

  /**
   * 启动密钥轮换定时器
   */
  private startKeyRotationTimer(): void {
    // 每小时检查一次是否有密钥需要轮换
    setInterval(
      async () => {
        const now = Date.now()
        const rotationThreshold = now + this.keyRotationInterval

        for (const [sessionId, metadata] of this.sessionKeyMetadata.entries()) {
          if (metadata.status === 'active' && metadata.expires_at && metadata.expires_at < rotationThreshold) {
            try {
              await this.rotateSessionKey(sessionId)
            } catch (error) {
              this.emit('error', {
                type: 'keyRotationFailed',
                sessionId,
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }
        }
      },
      60 * 60 * 1000 // 每小时
    )
  }

  /**
   * Buffer 转 Base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join('')
    return btoa(binary)
  }

  /**
   * Base64 转 Buffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.sessionKeys.clear()
    this.sessionKeyMetadata.clear()
    this.initialized = false
    this.removeAllListeners()
  }
}

/**
 * 创建 E2EE 扩展实例
 *
 * @param client - Matrix 客户端
 * @returns E2EE 扩展实例
 */
export function createE2EEExtension(client: MatrixClientLike): PrivateChatE2EEExtension {
  return new PrivateChatE2EEExtension(client)
}
