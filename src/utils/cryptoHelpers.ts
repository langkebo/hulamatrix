/**
 * 加密辅助工具函数
 * 提供便捷的加密/解密、哈希、随机数等功能的封装
 *
 * @module utils/cryptoHelpers
 */

import {
  generateAESKey,
  encryptMessage,
  decryptMessage,
  computeHash,
  generateRandomBytes,
  bufferToHex,
  hexToBuffer,
  bufferToBase64,
  base64ToBuffer,
  stringToBytes,
  bytesToString
} from './cryptoUtils'

// =============================================================================
// 字符串加密/解密（便捷封装）
// =============================================================================

/**
 * 加密字符串为 Base64 格式
 *
 * @param plaintext - 明文字符串
 * @param key - 加密密钥
 * @returns Base64 格式的加密数据（包含 iv 和 ciphertext）
 *
 * @example
 * ```typescript
 * const key = await generateAESKey()
 * const encrypted = await encryptStringToBase64('Hello', key)
 * const decrypted = await decryptStringFromBase64(encrypted, key)
 * ```
 */
export async function encryptStringToBase64(plaintext: string, key: CryptoKey): Promise<string> {
  const encrypted = await encryptMessage(plaintext, key)
  return JSON.stringify({
    iv: bufferToBase64(encrypted.iv),
    ciphertext: bufferToBase64(encrypted.ciphertext),
    ...(encrypted.tag && { tag: bufferToBase64(encrypted.tag) })
  })
}

/**
 * 从 Base64 格式解密字符串
 *
 * @param base64Data - Base64 格式的加密数据
 * @param key - 解密密钥
 * @returns 解密后的字符串
 */
export async function decryptStringFromBase64(base64Data: string, key: CryptoKey): Promise<string> {
  const data = JSON.parse(base64Data) as {
    iv: string
    ciphertext: string
    tag?: string
  }

  return await decryptMessage(
    {
      iv: base64ToBuffer(data.iv),
      ciphertext: base64ToBuffer(data.ciphertext),
      ...(data.tag && { tag: base64ToBuffer(data.tag) })
    },
    key
  )
}

/**
 * 使用密码加密字符串（自动派生密钥）
 *
 * @param plaintext - 明文字符串
 * @param password - 密码
 * @param salt - 盐值（如果不提供则随机生成）
 * @returns 包含加密数据、盐值和 IV 的对象
 */
export async function encryptWithPassword(
  plaintext: string,
  password: string,
  salt?: Uint8Array
): Promise<{
  encrypted: string
  salt: string
  iv: string
}> {
  // 生成或使用提供的盐值
  const actualSalt = salt || generateRandomBytes(16)

  // 从密码派生密钥（使用 PBKDF2）
  const passwordBuffer = new TextEncoder().encode(password)
  const passwordKey = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey'
  ])

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: actualSalt as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  // 加密数据
  const encrypted = await encryptMessage(plaintext, derivedKey)

  return {
    encrypted: bufferToBase64(encrypted.ciphertext),
    salt: bufferToBase64(actualSalt),
    iv: bufferToBase64(encrypted.iv)
  }
}

/**
 * 使用密码解密字符串
 *
 * @param encryptedData - 加密数据对象
 * @param password - 密码
 * @returns 解密后的字符串
 */
export async function decryptWithPassword(
  encryptedData: { encrypted: string; salt: string; iv: string },
  password: string
): Promise<string> {
  // 从密码派生密钥
  const passwordBuffer = new TextEncoder().encode(password)
  const passwordKey = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey'
  ])

  const salt = base64ToBuffer(encryptedData.salt)

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  // 解密数据
  const ciphertext = base64ToBuffer(encryptedData.encrypted)
  const iv = base64ToBuffer(encryptedData.iv)

  return await decryptMessage({ ciphertext, iv }, derivedKey)
}

// =============================================================================
// 哈希函数（便捷封装）
// =============================================================================

/**
 * 计算字符串的 SHA-256 哈希值（十六进制）
 *
 * @param data - 输入字符串
 * @returns 十六进制哈希值
 */
export async function sha256(data: string): Promise<string> {
  const result = await computeHash(data, 'SHA-256')
  return result.hex
}

/**
 * 计算字符串的 SHA-384 哈希值（十六进制）
 *
 * @param data - 输入字符串
 * @returns 十六进制哈希值
 */
export async function sha384(data: string): Promise<string> {
  const result = await computeHash(data, 'SHA-384')
  return result.hex
}

/**
 * 计算字符串的 SHA-512 哈希值（十六进制）
 *
 * @param data - 输入字符串
 * @returns 十六进制哈希值
 */
export async function sha512(data: string): Promise<string> {
  const result = await computeHash(data, 'SHA-512')
  return result.hex
}

/**
 * 计算 HMAC（基于哈希的消息认证码）
 *
 * @param data - 消息数据
 * @param key - 密钥
 * @param algorithm - 哈希算法
 * @returns 十六进制 HMAC 值
 */
export async function hmac(
  data: string,
  key: string | Uint8Array,
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const keyData = typeof key === 'string' ? stringToBytes(key) : key
  const messageData = stringToBytes(data)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData.buffer as ArrayBuffer)
  return bufferToHex(new Uint8Array(signature))
}

/**
 * 计算 PBKDF2 派生密钥
 *
 * @param password - 密码
 * @param salt - 盐值
 * @param iterations - 迭代次数
 * @param keyLength - 派生密钥长度（位）
 * @returns 派生密钥
 */
export async function pbkdf2(password: string, salt: string, iterations = 100000, keyLength = 256): Promise<CryptoKey> {
  const passwordBuffer = stringToBytes(password)
  const saltBuffer = stringToBytes(salt)

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer.buffer as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: keyLength },
    false,
    ['encrypt', 'decrypt']
  )
}

// =============================================================================
// 随机数生成（便捷封装）
// =============================================================================

/**
 * 生成安全的随机整数（包含边界）
 *
 * @param min - 最小值
 * @param max - 最大值
 * @returns 随机整数
 */
export function secureRandomInt(min: number, max: number): number {
  if (min >= max) {
    throw new Error('min must be less than max')
  }

  const range = max - min
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return min + (array[0] % range)
}

/**
 * 生成安全的随机浮点数 [0, 1)
 *
 * @returns 0 到 1 之间的随机浮点数
 */
export function secureRandomFloat(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] / 0xffffffff
}

/**
 * 生成安全的随机字符串
 *
 * @param length - 字符串长度
 * @param charset - 可选字符集
 * @returns 随机字符串
 */
export function secureRandomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length]
  }

  return result
}

/**
 * 生成 UUID v4
 *
 * @returns UUID 字符串
 */
export function generateUUID(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)

  // 设置版本号为 4
  array[6] = (array[6] & 0x0f) | 0x40
  // 设置变体号为 RFC 4122
  array[8] = (array[8] & 0x3f) | 0x80

  const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-')
}

/**
 * 生成 NanoID（类似 UUID 但更短）
 *
 * @param size - ID 大小（默认 21）
 * @returns NanoID 字符串
 */
export function generateNanoID(size = 21): string {
  const alphabet = 'ModuleSymbhas_allPractical_evalegis_t_'
  const array = new Uint8Array(size)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < size; i++) {
    result += alphabet[array[i] % alphabet.length]
  }

  return result
}

// =============================================================================
// 密钥生成（便捷封装）
// =============================================================================

/**
 * 生成随机密钥并导出为 Base64
 *
 * @param keySize - 密钥大小（位）
 * @returns Base64 编码的密钥
 */
export async function generateKeyBase64(keySize: 128 | 192 | 256 = 256): Promise<string> {
  const key = await generateAESKey(keySize, true)
  const rawKey = await crypto.subtle.exportKey('raw', key)
  return bufferToBase64(new Uint8Array(rawKey))
}

/**
 * 从 Base64 导入密钥
 *
 * @param base64Key - Base64 编码的密钥
 * @returns CryptoKey 对象
 */
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const keyBytes = base64ToBuffer(base64Key)
  return await crypto.subtle.importKey('raw', keyBytes as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ])
}

// =============================================================================
// 数据编码/解码（便捷封装）
// =============================================================================

/**
 * 将对象编码为 JSON 后加密
 *
 * @param obj - 要加密的对象
 * @param key - 加密密钥
 * @returns Base64 格式的加密数据
 */
export async function encryptObject<T = Record<string, unknown>>(obj: T, key: CryptoKey): Promise<string> {
  const jsonString = JSON.stringify(obj)
  return await encryptStringToBase64(jsonString, key)
}

/**
 * 解密并解析为对象
 *
 * @param base64Data - Base64 格式的加密数据
 * @param key - 解密密钥
 * @returns 解析后的对象
 */
export async function decryptObject<T = Record<string, unknown>>(base64Data: string, key: CryptoKey): Promise<T> {
  const jsonString = await decryptStringFromBase64(base64Data, key)
  return JSON.parse(jsonString) as T
}

/**
 * UTF-8 字符串转 Base64
 *
 * @param str - UTF-8 字符串
 * @returns Base64 编码的字符串
 */
export function stringToBase64(str: string): string {
  return bufferToBase64(stringToBytes(str))
}

/**
 * Base64 转 UTF-8 字符串
 *
 * @param base64 - Base64 编码的字符串
 * @returns UTF-8 字符串
 */
export function base64ToString(base64: string): string {
  return bytesToString(base64ToBuffer(base64))
}

/**
 * UTF-8 字符串转十六进制
 *
 * @param str - UTF-8 字符串
 * @returns 十六进制编码的字符串
 */
export function stringToHex(str: string): string {
  return bufferToHex(stringToBytes(str))
}

/**
 * 十六进制转 UTF-8 字符串
 *
 * @param hex - 十六进制编码的字符串
 * @returns UTF-8 字符串
 */
export function hexToString(hex: string): string {
  return bytesToString(hexToBuffer(hex))
}

// =============================================================================
// 密码强度检测
// =============================================================================

/**
 * 检测密码强度
 *
 * @param password - 密码
 * @returns 密码强度对象
 */
export function checkPasswordStrength(password: string): {
  score: number // 0-4
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very strong'
  suggestions: string[]
} {
  const suggestions: string[] = []
  let score = 0

  // 长度检查
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // 复杂度检查
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  // 生成建议
  if (password.length < 8) {
    suggestions.push('密码长度应至少为 8 个字符')
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    suggestions.push('密码应包含大小写字母')
  }
  if (!/\d/.test(password)) {
    suggestions.push('密码应包含数字')
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    suggestions.push('密码应包含特殊字符')
  }

  // 限制最高分为 4
  score = Math.min(score, 4)

  const strengthMap = ['weak', 'fair', 'good', 'strong', 'very strong'] as const

  return {
    score,
    strength: strengthMap[score],
    suggestions
  }
}

// =============================================================================
// 数据完整性验证
// =============================================================================

/**
 * 为数据添加校验和
 *
 * @param data - 原始数据
 * @returns 包含校验和的数据
 */
export async function addChecksum(data: string): Promise<string> {
  const hash = await sha256(data)
  return `${data}.${hash.substring(0, 16)}`
}

/**
 * 验证数据校验和
 *
 * @param dataWithChecksum - 包含校验和的数据
 * @returns 数据是否有效
 */
export async function verifyChecksum(dataWithChecksum: string): Promise<boolean> {
  const lastDotIndex = dataWithChecksum.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return false
  }

  const data = dataWithChecksum.substring(0, lastDotIndex)
  const checksum = dataWithChecksum.substring(lastDotIndex + 1)

  const computedHash = await sha256(data)
  return computedHash.substring(0, 16) === checksum
}

// =============================================================================
// 常量时间比较（防止时序攻击）
// =============================================================================

/**
 * 常量时间字符串比较（防止时序攻击）
 *
 * @param a - 字符串 A
 * @param b - 字符串 B
 * @returns 是否相等
 */
export function constantTimeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  const bufferA = stringToBytes(a)
  const bufferB = stringToBytes(b)

  let result = 0
  for (let i = 0; i < bufferA.length; i++) {
    result |= bufferA[i] ^ bufferB[i]
  }

  return result === 0
}

// =============================================================================
// 导出所有函数
// =============================================================================

export {
  // 核心加密函数
  generateAESKey,
  encrypt,
  decrypt,
  encryptMessage,
  decryptMessage,
  computeHash,
  generateRandomBytes,
  // 缓冲区转换
  bufferToHex,
  hexToBuffer,
  bufferToBase64,
  base64ToBuffer,
  stringToBytes,
  bytesToString
} from './cryptoUtils'
