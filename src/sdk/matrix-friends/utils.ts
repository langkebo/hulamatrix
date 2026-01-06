/**
 * Matrix Friends API 工具函数
 */

/**
 * 构建查询字符串
 */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

/**
 * 检查响应是否成功
 */
export function checkResponse(response: Response): void {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
}

/**
 * 解析 JSON 响应
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    return {} as T
  }
  return JSON.parse(text) as T
}

/**
 * 格式化用户 ID
 */
export function formatUserId(userId: string): string {
  if (!userId.startsWith('@')) {
    throw new Error('Invalid user ID: must start with @')
  }
  return userId
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
