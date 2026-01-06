/**
 * Cryptography Type Definitions
 * For E2EE (End-to-End Encryption) support
 */

// =============================================================================
// Crypto Key Types
// =============================================================================

/**
 * Supported crypto algorithms
 */
export type CryptoAlgorithm = 'AES-GCM' | 'AES-CBC' | 'RSA-OAEP' | 'ECDH' | 'PBKDF2' | 'HKDF'

/**
 * AES-GCM configuration
 */
export interface AESGCMConfig {
  /** Algorithm name */
  name: 'AES-GCM'
  /** Key length in bits (256 for AES-256) */
  length: 128 | 192 | 256
}

/**
 * ECDH key configuration
 */
export interface ECDHConfig {
  /** Algorithm name */
  name: 'ECDH'
  /** Named curve */
  namedCurve: 'P-256' | 'P-384' | 'P-521'
}

/**
 * PBKDF2 configuration
 */
export interface PBKDF2Config {
  /** Algorithm name */
  name: 'PBKDF2'
  /** Hash function */
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512'
  /** Iterations */
  iterations: number
}

/**
 * HKDF configuration
 */
export interface HKDFConfig {
  /** Algorithm name */
  name: 'HKDF'
  /** Hash function */
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512'
}

/**
 * Crypto key pair (public/private)
 */
export interface CryptoKeyPair {
  /** Public key */
  publicKey: CryptoKey
  /** Private key */
  privateKey: CryptoKey
}

/**
 * Extractable crypto key data
 */
export interface ExportedKey {
  /** Key format */
  format: 'jwk' | 'raw' | 'spki' | 'pkcs8'
  /** Key data */
  data: JsonWebKey | Uint8Array
  /** Algorithm */
  algorithm: CryptoAlgorithm
}

// =============================================================================
// Encryption/Decryption Types
// =============================================================================

/**
 * Encryption result
 */
export interface EncryptionResult {
  /** Ciphertext (encrypted data) */
  ciphertext: Uint8Array
  /** Initialization vector */
  iv: Uint8Array
  /** Authentication tag (for authenticated encryption) */
  tag?: Uint8Array
  /** Salt (if applicable) */
  salt?: Uint8Array
  /** Additional authenticated data */
  aad?: Uint8Array
}

/**
 * Decryption parameters
 */
export interface DecryptionParams {
  /** Ciphertext to decrypt */
  ciphertext: Uint8Array
  /** Initialization vector */
  iv: Uint8Array
  /** Authentication tag (if applicable) */
  tag?: Uint8Array
  /** Salt (if applicable) */
  salt?: Uint8Array
  /** Additional authenticated data */
  aad?: Uint8Array
}

/**
 * Encryption options
 */
export interface EncryptionOptions {
  /** Additional authenticated data */
  aad?: Uint8Array
  /** Key size */
  keySize?: 128 | 192 | 256
  /** IV length */
  ivLength?: number
}

// =============================================================================
// Key Derivation Types
// =============================================================================

/**
 * Key derivation parameters
 */
export interface KeyDerivationParams {
  /** Password or passphrase */
  password: string
  /** Salt */
  salt: Uint8Array
  /** Number of iterations */
  iterations?: number
  /** Desired key length */
  keyLength?: number
}

/**
 * Key derivation result
 */
export interface KeyDerivationResult {
  /** Derived key */
  key: CryptoKey
  /** Salt used */
  salt: Uint8Array
  /** Iterations performed */
  iterations: number
}

// =============================================================================
// Session Key Types (for PrivateChat E2EE)
// =============================================================================

/**
 * Session key information
 */
export interface SessionKeyInfo {
  /** Key ID */
  keyId: string
  /** Session ID */
  sessionId: string
  /** Creation timestamp */
  createdAt: number
  /** Expiration timestamp */
  expiresAt?: number
  /** Participants in the session */
  participants: string[]
  /** Key status */
  status: 'active' | 'rotated' | 'expired' | 'revoked'
}

/**
 * Wrapped session key (encrypted)
 */
export interface WrappedSessionKey {
  /** Key ID */
  keyId: string
  /** Recipient user ID */
  recipientId: string
  /** Encrypted key data */
  encryptedKey: Uint8Array
  /** Encryption algorithm */
  algorithm: string
  /** Initialization vector */
  iv: Uint8Array
  /** Timestamp */
  timestamp: number
}

/**
 * Session key rotation result
 */
export interface SessionKeyRotationResult {
  /** Old key ID */
  oldKeyId: string
  /** New key ID */
  newKeyId: string
  /** Rotation timestamp */
  rotatedAt: number
  /** Number of participants updated */
  participantsUpdated: number
  /** Number of participants failed */
  participantsFailed: number
}

// =============================================================================
// Signature Types
// =============================================================================

/**
 * Signing algorithm
 */
export type SigningAlgorithm = 'Ed25519' | 'RSA-PSS' | 'ECDSA'

/**
 * Signature result
 */
export interface SignatureResult {
  /** Signature value */
  signature: Uint8Array
  /** Algorithm used */
  algorithm: SigningAlgorithm
  /** Signing timestamp */
  timestamp: number
}

/**
 * Signature verification params
 */
export interface SignatureVerificationParams {
  /** Signature to verify */
  signature: Uint8Array
  /** Data that was signed */
  data: Uint8Array
  /** Public key to verify against */
  publicKey: CryptoKey
  /** Algorithm used for signing */
  algorithm: SigningAlgorithm
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  /** Whether signature is valid */
  valid: boolean
  /** Verification timestamp */
  verifiedAt: number
  /** Error message if verification failed */
  error?: string
}

// =============================================================================
// Hash Types
// =============================================================================

/**
 * Hash algorithm
 */
export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

/**
 * Hash result
 */
export interface HashResult {
  /** Hash value */
  hash: Uint8Array
  /** Algorithm used */
  algorithm: HashAlgorithm
  /** Hex string representation */
  hex: string
  /** Base64 string representation */
  base64: string
}

// =============================================================================
// Random Number Generation Types
// =============================================================================

/**
 * Random value generation options
 */
export interface RandomValueOptions {
  /** Length in bytes */
  length: number
  /** Encoding */
  encoding?: 'raw' | 'hex' | 'base64'
}

/**
 * Random value result
 */
export interface RandomValueResult {
  /** Random bytes */
  bytes: Uint8Array
  /** Hex string (if requested) */
  hex?: string
  /** Base64 string (if requested) */
  base64?: string
}

// =============================================================================
// Certificate Types (for future use)
// =============================================================================

/**
 * Certificate information
 */
export interface CertificateInfo {
  /** Subject distinguished name */
  subject: string
  /** Issuer distinguished name */
  issuer: string
  /** Valid from */
  validFrom: number
  /** Valid until */
  validUntil: number
  /** Public key */
  publicKey: CryptoKey
  /** Certificate fingerprint */
  fingerprint: string
}

// =============================================================================
// Crypto Error Types
// =============================================================================

/**
 * Base crypto error
 */
export class CryptoError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation?: string
  ) {
    super(message)
    this.name = 'CryptoError'
  }
}

/**
 * Key generation error
 */
export class KeyGenerationError extends CryptoError {
  constructor(message: string, operation?: string) {
    super(message, 'KEY_GENERATION_ERROR', operation)
    this.name = 'KeyGenerationError'
  }
}

/**
 * Encryption error
 */
export class EncryptionError extends CryptoError {
  constructor(message: string, operation?: string) {
    super(message, 'ENCRYPTION_ERROR', operation)
    this.name = 'EncryptionError'
  }
}

/**
 * Decryption error
 */
export class DecryptionError extends CryptoError {
  constructor(message: string, operation?: string) {
    super(message, 'DECRYPTION_ERROR', operation)
    this.name = 'DecryptionError'
  }
}

/**
 * Key derivation error
 */
export class KeyDerivationError extends CryptoError {
  constructor(message: string, operation?: string) {
    super(message, 'KEY_DERIVATION_ERROR', operation)
    this.name = 'KeyDerivationError'
  }
}

/**
 * Signature verification error
 */
export class SignatureError extends CryptoError {
  constructor(message: string, operation?: string) {
    super(message, 'SIGNATURE_ERROR', operation)
    this.name = 'SignatureError'
  }
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Type guard for CryptoKey
 */
export function isCryptoKey(value: unknown): value is CryptoKey {
  return value instanceof CryptoKey
}

/**
 * Type guard for CryptoKeyPair
 */
export function isCryptoKeyPair(value: unknown): value is CryptoKeyPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    'publicKey' in value &&
    'privateKey' in value &&
    isCryptoKey((value as CryptoKeyPair).publicKey) &&
    isCryptoKey((value as CryptoKeyPair).privateKey)
  )
}

/**
 * Extract key type from CryptoKey
 */
export type ExtractKeyType<T extends CryptoKey> = T extends CryptoKey ? T['type'] : never

/**
 * Make a key extractable or non-extractable
 */
export type KeyExtractable<T extends boolean, K extends CryptoKey> = T extends true
  ? K & { extractable: true }
  : K & { extractable: false }

/**
 * Key usage type
 */
export type KeyUsage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'

/**
 * Key usages for different operations
 */
export interface KeyUsages {
  /** Encryption operations */
  encryption?: Array<'encrypt' | 'decrypt'>
  /** Signature operations */
  signing?: Array<'sign' | 'verify'>
  /** Derivation operations */
  derivation?: Array<'deriveKey' | 'deriveBits'>
  /** Wrapping operations */
  wrapping?: Array<'wrapKey' | 'unwrapKey'>
}
