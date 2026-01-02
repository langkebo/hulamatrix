/**
 * 安全哈希工具
 * 使用Web Crypto API的SHA-256等强哈希算法
 */

/**
 * 使用SHA-256算法计算字符串的哈希值
 * @param data 要哈希的字符串
 * @returns 哈希值的十六进制字符串
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 使用SHA-512算法计算字符串的哈希值
 * @param data 要哈希的字符串
 * @returns 哈希值的十六进制字符串
 */
export async function sha512(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 使用HMAC-SHA256计算消息认证码
 * @param data 消息数据
 * @param secret 密钥
 * @returns HMAC值的十六进制字符串
 */
export async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成密码的强哈希（使用SHA-256+盐值）
 * @param password 密码
 * @param salt 盐值（可选，如果不提供则随机生成）
 * @returns 包含盐值和哈希的对象
 */
export async function hashPassword(password: string, salt?: string): Promise<{ salt: string; hash: string }> {
  if (!salt) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    salt = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  const saltedPassword = password + salt
  const hash = await sha256(saltedPassword)

  return { salt, hash }
}

/**
 * 验证密码
 * @param password 待验证的密码
 * @param salt 存储的盐值
 * @param hash 存储的哈希值
 * @returns 密码是否正确
 */
export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, salt)
  return hash === computedHash
}
