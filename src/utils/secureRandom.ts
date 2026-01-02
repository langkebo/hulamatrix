/**
 * 安全随机数生成工具
 * 使用Web Crypto API生成密码学安全的随机数
 */

/**
 * 生成指定范围内的安全随机整数
 * @param min 最小值（包含）
 * @param max 最大值（不包含）
 * @returns 随机整数
 */
export function secureRandomInt(min: number, max: number): number {
  if (min >= max) {
    throw new Error('min must be less than max')
  }

  const range = max - min
  const maxValidRange = Math.floor(0xffffffff / range) * range

  let randomValue
  do {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    randomValue = array[0]
  } while ((randomValue ?? 0) >= maxValidRange)

  return min + ((randomValue ?? 0) % range)
}

/**
 * 生成0-1之间的安全随机浮点数
 * @returns 0到1之间的随机浮点数
 */
export function secureRandomFloat(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return (array[0] ?? 0) / 0xffffffff
}

/**
 * 从数组中随机选择一个元素
 * @param array 源数组
 * @returns 随机选择的元素
 */
export function secureRandomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot choose from empty array')
  }
  const index = secureRandomInt(0, array.length)
  return array[index] as T
}

/**
 * 生成指定长度的随机字符串（仅包含安全字符）
 * @param length 字符串长度
 * @param charset 可选字符集
 * @returns 随机字符串
 */
export function secureRandomString(
  length: number,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    result += charset[(array[0] ?? 0) % charset.length]
  }
  return result
}

/**
 * 生成随机的UUID v4
 * @returns UUID字符串
 */
export function generateUUID(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)

  // 设置版本号为4
  array[6] = ((array[6] ?? 0) & 0x0f) | 0x40
  // 设置变体号为RFC 4122
  array[8] = ((array[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
  return [hex.substr(0, 8), hex.substr(8, 4), hex.substr(12, 4), hex.substr(16, 4), hex.substr(20, 12)].join('-')
}
