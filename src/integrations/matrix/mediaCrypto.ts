function b64ToArray(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export type EncryptedFile = {
  url: string
  iv: string
  key: { k: string; alg: string; key_ops?: string[]; kty?: string }
  hashes?: { sha256?: string }
}

// Web Crypto API types for TypeScript
type AesCtrKeyAlgorithm = {
  name: 'AES-CTR'
}
type AesCtrParams = {
  name: 'AES-CTR'
  counter: Uint8Array
  length: number
}

export async function decryptEncryptedFile(cipher: Uint8Array, file: EncryptedFile): Promise<Uint8Array> {
  const iv = b64ToArray(file.iv)
  const k = b64ToArray(file.key.k)

  const key = await crypto.subtle.importKey(
    'raw',
    k.buffer as ArrayBuffer,
    { name: 'AES-CTR' } as AesCtrKeyAlgorithm,
    false,
    ['decrypt']
  )

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: iv, length: 64 } as AesCtrParams,
    key,
    cipher.buffer as ArrayBuffer
  )

  return new Uint8Array(plain)
}

export async function sha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0
    bin += String.fromCharCode(b)
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
