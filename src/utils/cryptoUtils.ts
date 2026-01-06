/**
 * Cryptography Utilities
 * Provides E2EE (End-to-End Encryption) utilities for PrivateChat
 *
 * @module utils/cryptoUtils
 */

import type {
  AESGCMConfig,
  ECDHConfig,
  EncryptionResult,
  DecryptionParams,
  KeyDerivationParams,
  KeyDerivationResult,
  SessionKeyInfo,
  WrappedSessionKey,
  HashResult,
  RandomValueOptions,
  RandomValueResult
} from '@/types/crypto'
import { KeyGenerationError, EncryptionError, DecryptionError, KeyDerivationError } from '@/types/crypto'

// =============================================================================
// Constants
// =============================================================================

/** Default AES-GCM configuration */
const DEFAULT_AES_GCM_CONFIG: AESGCMConfig = {
  name: 'AES-GCM',
  length: 256
}

/** Default ECDH configuration */
const _DEFAULT_ECDH_CONFIG: ECDHConfig = {
  name: 'ECDH',
  namedCurve: 'P-256'
}

/** Default IV length for AES-GCM (96 bits = 12 bytes) */
const DEFAULT_IV_LENGTH = 12

/** Default salt length for PBKDF2 (128 bits = 16 bytes) */
const _DEFAULT_SALT_LENGTH = 16

/** Default iterations for PBKDF2 */
const DEFAULT_PBKDF2_ITERATIONS = 100000

// =============================================================================
// Key Generation
// =============================================================================

/**
 * Generate a random AES-GCM key
 *
 * @param keySize - Key size in bits (128, 192, or 256)
 * @param extractable - Whether the key should be extractable
 * @returns Promise<CryptoKey>
 *
 * @example
 * ```typescript
 * const key = await generateAESKey(256)
 * ```
 */
export async function generateAESKey(keySize: 128 | 192 | 256 = 256, extractable = false): Promise<CryptoKey> {
  try {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: keySize
      },
      extractable,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    throw new KeyGenerationError(
      `Failed to generate AES key: ${error instanceof Error ? error.message : String(error)}`,
      'generateAESKey'
    )
  }
}

/**
 * Generate an ECDH key pair for key exchange
 *
 * @param namedCurve - Named curve (default: 'P-256')
 * @param extractable - Whether the keys should be extractable
 * @returns Promise<CryptoKeyPair>
 *
 * @example
 * ```typescript
 * const keyPair = await generateECDHKeyPair()
 * const publicKey = keyPair.publicKey
 * ```
 */
export async function generateECDHKeyPair(
  namedCurve: 'P-256' | 'P-384' | 'P-521' = 'P-256',
  extractable = false
): Promise<CryptoKeyPair> {
  try {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve
      },
      extractable,
      ['deriveKey', 'deriveBits']
    )
  } catch (error) {
    throw new KeyGenerationError(
      `Failed to generate ECDH key pair: ${error instanceof Error ? error.message : String(error)}`,
      'generateECDHKeyPair'
    )
  }
}

/**
 * Generate a key from a password using PBKDF2
 *
 * @param params - Key derivation parameters
 * @returns Promise<KeyDerivationResult>
 *
 * @example
 * ```typescript
 * const result = await deriveKeyFromPassword({
 *   password: 'my-secure-password',
 *   salt: new Uint8Array(16)
 * })
 * ```
 */
export async function deriveKeyFromPassword(params: KeyDerivationParams): Promise<KeyDerivationResult> {
  const { password, salt, iterations = DEFAULT_PBKDF2_ITERATIONS, keyLength = 256 } = params

  try {
    // Import password as key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derive key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as ArrayBuffer,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: keyLength },
      false,
      ['encrypt', 'decrypt']
    )

    return {
      key,
      salt,
      iterations
    }
  } catch (error) {
    throw new KeyDerivationError(
      `Failed to derive key from password: ${error instanceof Error ? error.message : String(error)}`,
      'deriveKeyFromPassword'
    )
  }
}

/**
 * Derive a shared key using ECDH
 *
 * @param privateKey - Private key
 * @param publicKey - Public key
 * @returns Promise<CryptoKey>
 */
export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  try {
    return await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey
      },
      privateKey,
      DEFAULT_AES_GCM_CONFIG,
      false,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    throw new KeyDerivationError(
      `Failed to derive shared key: ${error instanceof Error ? error.message : String(error)}`,
      'deriveSharedKey'
    )
  }
}

// =============================================================================
// Encryption/Decryption
// =============================================================================

/**
 * Encrypt data using AES-GCM
 *
 * @param data - Data to encrypt
 * @param key - Encryption key
 * @param options - Encryption options
 * @returns Promise<EncryptionResult>
 *
 * @example
 * ```typescript
 * const key = await generateAESKey()
 * const result = await encrypt(
 *   new TextEncoder().encode('Hello, World!'),
 *   key
 * )
 * ```
 */
export async function encrypt(
  data: Uint8Array,
  key: CryptoKey,
  options: { iv?: Uint8Array; aad?: Uint8Array } = {}
): Promise<EncryptionResult> {
  const iv = options.iv || generateRandomBytes(DEFAULT_IV_LENGTH)

  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBuffer
      },
      key,
      data as unknown as ArrayBuffer
    )

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv,
      aad: options.aad
    }
  } catch (error) {
    throw new EncryptionError(
      `Failed to encrypt data: ${error instanceof Error ? error.message : String(error)}`,
      'encrypt'
    )
  }
}

/**
 * Decrypt data using AES-GCM
 *
 * @param params - Decryption parameters
 * @param key - Decryption key
 * @returns Promise<Uint8Array>
 *
 * @example
 * ```typescript
 * const decrypted = await decrypt(
 *   { ciphertext, iv },
 *   key
 * )
 * ```
 */
export async function decrypt(params: DecryptionParams, key: CryptoKey): Promise<Uint8Array> {
  const { ciphertext, iv } = params

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBuffer
      },
      key,
      ciphertext as unknown as ArrayBuffer
    )

    return new Uint8Array(decrypted)
  } catch (error) {
    throw new DecryptionError(
      `Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`,
      'decrypt'
    )
  }
}

/**
 * Encrypt a string message
 *
 * @param message - Message to encrypt
 * @param key - Encryption key
 * @param options - Encryption options
 * @returns Promise<EncryptionResult>
 */
export async function encryptMessage(
  message: string,
  key: CryptoKey,
  options?: { iv?: Uint8Array; aad?: Uint8Array }
): Promise<EncryptionResult> {
  const data = new TextEncoder().encode(message)
  return encrypt(data, key, options)
}

/**
 * Decrypt a message to string
 *
 * @param params - Decryption parameters
 * @param key - Decryption key
 * @returns Promise<string>
 */
export async function decryptMessage(params: DecryptionParams, key: CryptoKey): Promise<string> {
  const decrypted = await decrypt(params, key)
  return new TextDecoder().decode(decrypted)
}

// =============================================================================
// Session Key Management
// =============================================================================

/**
 * Generate a session key with metadata
 *
 * @param sessionId - Session ID
 * @param participants - Participant user IDs
 * @param expiresIn - Expiration time in milliseconds (optional)
 * @returns Promise<SessionKeyInfo & { key: CryptoKey }>
 */
export async function generateSessionKey(
  sessionId: string,
  participants: string[],
  expiresIn?: number
): Promise<SessionKeyInfo & { key: CryptoKey }> {
  const key = await generateAESKey()
  const now = Date.now()

  return {
    keyId: generateKeyId(),
    sessionId,
    createdAt: now,
    expiresAt: expiresIn ? now + expiresIn : undefined,
    participants,
    status: 'active',
    key
  }
}

/**
 * Wrap a session key for a recipient
 *
 * @param sessionKey - Session key to wrap
 * @param recipientPublicKey - Recipient's public key
 * @param recipientId - Recipient's user ID
 * @returns Promise<WrappedSessionKey>
 */
export async function wrapSessionKey(
  sessionKey: CryptoKey,
  recipientPublicKey: CryptoKey,
  recipientId: string
): Promise<WrappedSessionKey> {
  // Export session key
  const rawKey = await crypto.subtle.exportKey('raw', sessionKey)

  // Derive shared key using ECDH
  const ephemeralKeyPair = await generateECDHKeyPair()
  const sharedKey = await deriveSharedKey(ephemeralKeyPair.privateKey, recipientPublicKey)

  // Encrypt session key with shared key
  const iv = generateRandomBytes(DEFAULT_IV_LENGTH)
  const encrypted = await encrypt(new Uint8Array(rawKey), sharedKey, { iv })

  return {
    keyId: generateKeyId(),
    recipientId,
    encryptedKey: encrypted.ciphertext,
    algorithm: 'AES-GCM-256',
    iv,
    timestamp: Date.now()
  }
}

/**
 * Unwrap a session key
 *
 * @param wrappedKey - Wrapped session key
 * @param privateKey - Recipient's private key
 * @param senderPublicKey - Sender's public key
 * @returns Promise<CryptoKey>
 */
export async function unwrapSessionKey(
  wrappedKey: WrappedSessionKey,
  privateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<CryptoKey> {
  // Derive shared key
  const sharedKey = await deriveSharedKey(privateKey, senderPublicKey)

  // Decrypt session key
  const decrypted = await decrypt(
    {
      ciphertext: wrappedKey.encryptedKey,
      iv: wrappedKey.iv
    },
    sharedKey
  )

  // Import session key
  return await crypto.subtle.importKey('raw', decrypted as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ])
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Compute hash of data
 *
 * @param data - Data to hash
 * @param algorithm - Hash algorithm
 * @returns Promise<HashResult>
 */
export async function computeHash(
  data: Uint8Array | string,
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'
): Promise<HashResult> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

  const hashBuffer = await crypto.subtle.digest(algorithm, bytes as unknown as ArrayBuffer)
  const hashArray = new Uint8Array(hashBuffer)

  // Convert to hex and base64
  const hex = bufferToHex(hashArray)
  const base64 = bufferToBase64(hashArray)

  return {
    hash: hashArray,
    algorithm,
    hex,
    base64
  }
}

// =============================================================================
// Random Number Generation
// =============================================================================

/**
 * Generate cryptographically secure random bytes
 *
 * @param length - Number of bytes to generate
 * @returns Uint8Array
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Generate random value with encoding
 *
 * @param options - Random value options
 * @returns RandomValueResult
 */
export function generateRandomValue(options: RandomValueOptions): RandomValueResult {
  const bytes = generateRandomBytes(options.length)
  const result: RandomValueResult = { bytes }

  if (options.encoding === 'hex' || !options.encoding) {
    result.hex = bufferToHex(bytes)
  }

  if (options.encoding === 'base64') {
    result.base64 = bufferToBase64(bytes)
  }

  return result
}

/**
 * Generate a random key ID
 *
 * @returns Random key ID string
 */
export function generateKeyId(): string {
  const bytes = generateRandomBytes(16)
  return bufferToHex(bytes)
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert buffer to hex string
 *
 * @param buffer - Buffer to convert
 * @returns Hex string
 */
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to buffer
 *
 * @param hex - Hex string
 * @returns Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

/**
 * Convert buffer to base64 string
 *
 * @param buffer - Buffer to convert
 * @returns Base64 string
 */
export function bufferToBase64(buffer: Uint8Array): string {
  const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary)
}

/**
 * Convert base64 string to buffer
 *
 * @param base64 - Base64 string
 * @returns Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert string to Uint8Array
 *
 * @param str - String to convert
 * @returns Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Convert Uint8Array to string
 *
 * @param bytes - Bytes to convert
 * @returns String
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * Concatenate multiple Uint8Arrays
 *
 * @param arrays - Arrays to concatenate
 * @returns Concatenated Uint8Array
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Compare two Uint8Arrays in constant time
 *
 * @param a - First array
 * @param b - Second array
 * @returns Whether arrays are equal
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }

  return result === 0
}
