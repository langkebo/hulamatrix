import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as AdminApi from '@/utils/AdminApi'
import type { ConfigValue } from '@/utils/AdminApi'

/**
 * 用户信息
 */
interface User {
  id: string
  username?: string
  displayName?: string
  roleId?: string
  [key: string]: unknown
}

/**
 * 角色信息
 */
interface Role {
  id: string
  name: string
  description?: string
  permissions?: string[]
  [key: string]: unknown
}

export const useAdminStore = defineStore('admin', () => {
  const users = ref<User[]>([])
  const roles = ref<Role[]>([])
  const configs = ref<Record<string, unknown>>({})

  const loading = ref(false)

  const fetchUsers = async () => {
    loading.value = true
    try {
      users.value = await AdminApi.listUsers()
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (id: string, patch: Partial<User>) => {
    await AdminApi.updateUser(id, patch as Record<string, ConfigValue>)
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...patch }
  }

  const fetchRoles = async () => {
    roles.value = await AdminApi.listRoles()
  }

  const setRole = async (userId: string, roleId: string) => {
    await AdminApi.setUserRole(userId, roleId)
    const u = users.value.find((x) => x.id === userId)
    if (u) u.roleId = roleId
  }

  const fetchConfigs = async () => {
    configs.value = await AdminApi.getSystemConfigs()
  }

  const updateConfig = async (key: string, value: unknown) => {
    await AdminApi.updateSystemConfig(key, value as ConfigValue)
    configs.value[key] = value
  }

  return {
    users,
    roles,
    configs,
    loading,
    fetchUsers,
    updateUser,
    fetchRoles,
    setRole,
    fetchConfigs,
    updateConfig
  }
})
