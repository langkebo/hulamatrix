/**
 * PrivateChat Storage Encryption
 * 存储加密工具 - 用于加密存储会话密钥等敏感数据
 *
 * @module services/privateChatStorage/encryption
 */

import { bufferToBase64, base64ToBuffer, stringToBytes } from '@/utils/cryptoUtils'

/**
 * 加密的密钥数据
 */
export interface EncryptedKeyData {
  /**
   * 会话 ID
   */
  session_id: string

  /**
   * 加密后的密钥（Base64）
   */
  encrypted_key: string

  /**
   * 初始化向量（Base64）
   */
  iv: string

  /**
   * 加密算法
   */
  algorithm: string

  /**
   * 创建时间戳
   */
  created_at: number

  /**
   * 密钥 ID（可选）
   */
  key_id?: string
}

/**
 * 密钥加密密钥 (KEK) 元数据
 */
export interface KEKMetadata {
  /**
   * KEK 源类型
   */
  source: 'password' | 'accessToken' | 'hardware' | 'derived'

  /**
   * 盐值（Base64）
   */
  salt: string

  /**
   * 迭代次数
   */
  iterations: number

  /**
   * 算法
   */
  algorithm: string

  /**
   * 创建时间
   */
  created_at: number

  /**
   * 过期时间（可选）
   */
  expires_at?: number
}

/**
 * 加密结果
 */
export interface EncryptionResult {
  /**
   * 加密后的数据（Base64）
   */
  encrypted: string

  /**
   * 初始化向量（Base64）
   */
  iv: string

  /**
   * 认证标签（Base64）
   */
  tag: string

  /**
   * 加密时间戳
   */
  timestamp: number
}

/**
 * 解密参数
 */
export interface DecryptionParams {
  /**
   * 加密的数据（Base64）
   */
  encrypted: string

  /**
   * 初始化向量（Base64）
   */
  iv: string

  /**
   * 认证标签（Base64）
   */
  tag?: string
}

/**
 * 存储加密错误
 */
export class StorageEncryptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation?: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'StorageEncryptionError'
  }
}

/**
 * 存储加密类
 * 用于加密存储敏感数据（如会话密钥）
 */
export class StorageEncryption {
  private kek: CryptoKey | null = null
  private kekMetadata: KEKMetadata | null = null
  private readonly DEFAULT_ITERATIONS = 100000
  private readonly DEFAULT_SALT = 'foxchat-private-chat-kek-salt'

  /**
   * 从密码派生密钥加密密钥 (KEK)
   *
   * @param password - 密码
   * @param salt - 盐值（可选）
   * @param iterations - 迭代次数
   * @returns Promise<CryptoKey>
   */
  async deriveKEKFromPassword(
    password: string,
    salt?: string,
    iterations = this.DEFAULT_ITERATIONS
  ): Promise<CryptoKey> {
    try {
      const passwordBuffer = stringToBytes(password)
      const saltBuffer = stringToBytes(salt || this.DEFAULT_SALT)

      // 导入密码作为密钥材料
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer.buffer as unknown as ArrayBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      // 派生 KEK
      this.kek = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuffer.buffer as unknown as ArrayBuffer,
          iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, // 不可导出，增加安全性
        ['encrypt', 'decrypt']
      )

      // 保存元数据
      this.kekMetadata = {
        source: 'password',
        salt: bufferToBase64(saltBuffer),
        iterations,
        algorithm: 'AES-GCM-256',
        created_at: Date.now()
      }

      return this.kek
    } catch (error) {
      throw new StorageEncryptionError(
        'Failed to derive KEK from password',
        'KEK_DERIVATION_FAILED',
        'deriveKEKFromPassword',
        error
      )
    }
  }

  /**
   * 从 Matrix 访问令牌派生 KEK（简化方案）
   *
   * @param accessToken - Matrix 访问令牌
   * @returns Promise<CryptoKey>
   */
  async deriveKEKFromAccessToken(accessToken: string): Promise<CryptoKey> {
    // 使用访问令牌的前 32 字节作为密码
    const password = accessToken.substring(0, 32)
    return this.deriveKEKFromPassword(password, this.DEFAULT_SALT)
  }

  /**
   * 从随机数据派生 KEK（用于临时加密）
   *
   * @returns Promise<{ kek: CryptoKey; metadata: KEKMetadata }>
   */
  async deriveRandomKEK(): Promise<{ kek: CryptoKey; metadata: KEKMetadata }> {
    try {
      // 生成随机密钥材料
      const keyMaterial = crypto.getRandomValues(new Uint8Array(32))

      // 导入为密钥
      this.kek = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt'
      ])

      const salt = crypto.getRandomValues(new Uint8Array(16))

      this.kekMetadata = {
        source: 'derived',
        salt: bufferToBase64(salt),
        iterations: 1,
        algorithm: 'AES-GCM-256',
        created_at: Date.now()
      }

      return {
        kek: this.kek,
        metadata: this.kekMetadata
      }
    } catch (error) {
      throw new StorageEncryptionError(
        'Failed to derive random KEK',
        'RANDOM_KEK_DERIVATION_FAILED',
        'deriveRandomKEK',
        error
      )
    }
  }

  /**
   * 加密会话密钥用于存储
   *
   * @param sessionKey - 会话密钥
   * @param sessionId - 会话 ID
   * @returns Promise<EncryptedKeyData>
   */
  async encryptSessionKey(sessionKey: CryptoKey, sessionId: string): Promise<EncryptedKeyData> {
    this.ensureKEKInitialized()

    try {
      // 导出会话密钥的原始字节
      const rawKey = await crypto.subtle.exportKey('raw', sessionKey)

      // 生成随机 IV (12 字节用于 AES-GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12))

      // 使用 KEK 加密
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.kek!, rawKey)

      return {
        session_id: sessionId,
        encrypted_key: bufferToBase64(new Uint8Array(encrypted)),
        iv: bufferToBase64(iv),
        algorithm: 'aes-gcm-256',
        created_at: Date.now(),
        key_id: `${sessionId}-${Date.now()}`
      }
    } catch (error) {
      throw new StorageEncryptionError(
        'Failed to encrypt session key',
        'SESSION_KEY_ENCRYPTION_FAILED',
        'encryptSessionKey',
        error
      )
    }
  }

  /**
   * 解密存储的会话密钥
   *
   * @param encryptedKeyData - 加密的密钥数据
   * @returns Promise<CryptoKey>
   */
  async decryptSessionKey(encryptedKeyData: EncryptedKeyData): Promise<CryptoKey> {
    this.ensureKEKInitialized()

    try {
      const encrypted = base64ToBuffer(encryptedKeyData.encrypted_key)
      const iv = base64ToBuffer(encryptedKeyData.iv)

      // 解密
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as unknown as ArrayBuffer },
        this.kek!,
        encrypted.buffer as unknown as ArrayBuffer
      )

      // 导入为 CryptoKey
      return await crypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt'
      ])
    } catch (error) {
      throw new StorageEncryptionError(
        'Failed to decrypt session key',
        'SESSION_KEY_DECRYPTION_FAILED',
        'decryptSessionKey',
        error
      )
    }
  }

  /**
   * 加密数据
   *
   * @param data - 要加密的数据（字符串）
   * @param iv - 初始化向量（可选，不提供则随机生成）
   * @returns Promise<EncryptionResult>
   */
  async encryptData(data: string, iv?: Uint8Array): Promise<EncryptionResult> {
    this.ensureKEKInitialized()

    try {
      // 使用提供的 IV 或生成随机 IV
      const actualIv = iv || crypto.getRandomValues(new Uint8Array(12))

      // 编码数据
      const encoder = new TextEncoder()
      const dataBytes = encoder.encode(data)

      // 加密
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: actualIv.buffer as unknown as ArrayBuffer },
        this.kek!,
        dataBytes.buffer as unknown as ArrayBuffer
      )

      const encryptedArray = new Uint8Array(encrypted)

      // AES-GCM 的认证标签在最后 16 字节
      const ciphertext = encryptedArray.slice(0, -16)
      const tag = encryptedArray.slice(-16)

      return {
        encrypted: bufferToBase64(ciphertext),
        iv: bufferToBase64(actualIv),
        tag: bufferToBase64(tag),
        timestamp: Date.now()
      }
    } catch (error) {
      throw new StorageEncryptionError('Failed to encrypt data', 'DATA_ENCRYPTION_FAILED', 'encryptData', error)
    }
  }

  /**
   * 解密数据
   *
   * @param params - 解密参数
   * @returns Promise<string>
   */
  async decryptData(params: DecryptionParams): Promise<string> {
    this.ensureKEKInitialized()

    try {
      const ciphertext = base64ToBuffer(params.encrypted)
      const iv = base64ToBuffer(params.iv)
      const tagBytes = params.tag ? base64ToBuffer(params.tag) : new Uint8Array(0)

      // 组合密文和认证标签
      const combined = new Uint8Array(ciphertext.length + tagBytes.length)
      combined.set(ciphertext)
      combined.set(tagBytes, ciphertext.length)

      // 解密
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as unknown as ArrayBuffer },
        this.kek!,
        combined.buffer as unknown as ArrayBuffer
      )

      // 解码
      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      throw new StorageEncryptionError('Failed to decrypt data', 'DATA_DECRYPTION_FAILED', 'decryptData', error)
    }
  }

  /**
   * 加密对象（JSON 序列化后加密）
   *
   * @param obj - 要加密的对象
   * @returns Promise<EncryptionResult>
   */
  async encryptObject<T = Record<string, unknown>>(obj: T): Promise<EncryptionResult> {
    const jsonString = JSON.stringify(obj)
    return this.encryptData(jsonString)
  }

  /**
   * 解密对象（解密后反序列化）
   *
   * @param params - 解密参数
   * @returns Promise<T>
   */
  async decryptObject<T = Record<string, unknown>>(params: DecryptionParams): Promise<T> {
    const jsonString = await this.decryptData(params)
    return JSON.parse(jsonString) as T
  }

  /**
   * 生成加密密钥哈希（用于验证）
   *
   * @param key - 密钥
   * @returns Promise<string> - Base64 编码的哈希值
   */
  async hashKey(key: CryptoKey): Promise<string> {
    try {
      const rawKey = await crypto.subtle.exportKey('raw', key)
      const hash = await crypto.subtle.digest('SHA-256', rawKey)
      return bufferToBase64(new Uint8Array(hash))
    } catch (error) {
      throw new StorageEncryptionError('Failed to hash key', 'KEY_HASH_FAILED', 'hashKey', error)
    }
  }

  /**
   * 获取 KEK 元数据
   *
   * @returns KEKMetadata | null
   */
  getKEKMetadata(): KEKMetadata | null {
    return this.kekMetadata
  }

  /**
   * 检查 KEK 是否已初始化
   *
   * @returns boolean
   */
  isKEKInitialized(): boolean {
    return this.kek !== null
  }

  /**
   * 清除 KEK（安全清理）
   */
  clearKEK(): void {
    this.kek = null
    this.kekMetadata = null
  }

  /**
   * 确保 KEK 已初始化
   *
   * @throws StorageEncryptionError
   */
  private ensureKEKInitialized(): void {
    if (!this.kek) {
      throw new StorageEncryptionError(
        'KEK not initialized. Call deriveKEKFromPassword() or deriveKEKFromAccessToken() first.',
        'KEK_NOT_INITIALIZED'
      )
    }
  }
}

/**
 * 创建存储加密实例
 *
 * @param passwordOrToken - 密码或访问令牌
 * @param source - 密钥来源
 * @returns Promise<StorageEncryption>
 */
export async function createStorageEncryption(
  passwordOrToken: string,
  source: 'password' | 'accessToken' = 'password'
): Promise<StorageEncryption> {
  const encryption = new StorageEncryption()

  if (source === 'password') {
    await encryption.deriveKEKFromPassword(passwordOrToken)
  } else {
    await encryption.deriveKEKFromAccessToken(passwordOrToken)
  }

  return encryption
}

/**
 * 创建随机 KEK 的存储加密实例
 *
 * @returns Promise<StorageEncryption>
 */
export async function createRandomStorageEncryption(): Promise<StorageEncryption> {
  const encryption = new StorageEncryption()
  await encryption.deriveRandomKEK()
  return encryption
}
