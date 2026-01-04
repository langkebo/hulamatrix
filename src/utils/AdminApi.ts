import { handleError, ErrorAction } from '@/utils/error-handler'

/** 通用 JSON 值类型 */
type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue }

/** 用户信息接口 */
export interface AdminUser {
  id: string
  username?: string
  displayname?: string
  avatar_url?: string
  admin?: boolean
  deactivated?: boolean
  [key: string]: JsonValue
}

/** 角色信息接口 */
export interface AdminRole {
  id: string
  name: string
  description?: string
  [key: string]: JsonValue
}

/** 系统配置值类型 */
export type ConfigValue = string | number | boolean | JsonValue[] | { [key: string]: JsonValue }

async function requestWithErrorHandling<T>(
  input: RequestInfo,
  init: RequestInit,
  options: {
    operation: string
    defaultValue: T
    payload?: Record<string, JsonValue>
  }
): Promise<T> {
  try {
    const resp = await fetch(input, init)
    if (!resp.ok) {
      const err = Object.assign(new Error(`HTTP ${resp.status} ${resp.statusText}`), {
        status: resp.status,
        statusText: resp.statusText
      })
      handleError(
        err,
        {
          component: 'AdminApi',
          operation: options.operation,
          url: typeof input === 'string' ? input : undefined,
          additionalData: {
            method: init?.method || 'GET',
            payload: options.payload
          }
        },
        ErrorAction.RETRY
      )
      return options.defaultValue
    }
    const contentType = resp.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      return (await resp.json()) as T
    }
    return options.defaultValue
  } catch (error) {
    handleError(
      error as Error,
      {
        component: 'AdminApi',
        operation: options.operation,
        url: typeof input === 'string' ? input : undefined,
        additionalData: {
          method: init?.method || 'GET',
          payload: options.payload
        }
      },
      ErrorAction.RETRY
    )
    return options.defaultValue
  }
}

export const listUsers = async (): Promise<AdminUser[]> => {
  return requestWithErrorHandling<AdminUser[]>(
    '/api/admin/users',
    { method: 'GET' },
    {
      operation: 'listUsers',
      defaultValue: []
    }
  )
}

export const updateUser = async (id: string, patch: Record<string, ConfigValue>): Promise<void> => {
  await requestWithErrorHandling<void>(
    `/api/admin/users/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    },
    {
      operation: 'updateUser',
      defaultValue: undefined,
      payload: { id, patchSummary: Object.keys(patch) }
    }
  )
}

export const listRoles = async (): Promise<AdminRole[]> => {
  return requestWithErrorHandling<AdminRole[]>(
    '/api/admin/roles',
    { method: 'GET' },
    {
      operation: 'listRoles',
      defaultValue: []
    }
  )
}

export const setUserRole = async (userId: string, roleId: string): Promise<void> => {
  await requestWithErrorHandling<void>(
    `/api/admin/users/${userId}/role`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId })
    },
    {
      operation: 'setUserRole',
      defaultValue: undefined,
      payload: { userId, roleId }
    }
  )
}

export const getSystemConfigs = async (): Promise<Record<string, ConfigValue>> => {
  return requestWithErrorHandling<Record<string, ConfigValue>>(
    '/api/admin/configs',
    { method: 'GET' },
    {
      operation: 'getSystemConfigs',
      defaultValue: {}
    }
  )
}

export const updateSystemConfig = async (key: string, value: ConfigValue): Promise<void> => {
  await requestWithErrorHandling<void>(
    `/api/admin/configs/${key}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    },
    {
      operation: 'updateSystemConfig',
      defaultValue: undefined,
      payload: { key, valueType: typeof value }
    }
  )
}
