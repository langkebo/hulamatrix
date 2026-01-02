import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utils/AdminApi', () => {
  return {
    listUsers: vi.fn(async () => [{ id: 'u1', name: 'Alice', roleId: 'r1' }]),
    updateUser: vi.fn(async () => {}),
    listRoles: vi.fn(async () => [{ id: 'r1', name: 'Admin' }]),
    setUserRole: vi.fn(async () => {}),
    getSystemConfigs: vi.fn(async () => ({ baseUrl: 'https://matrix.example.com', enableEncryption: true })),
    updateSystemConfig: vi.fn(async () => {})
  }
})

describe('admin store', () => {
  it('fetches users and updates role', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
    const { useAdminStore } = await import('@/stores/admin')
    const store = useAdminStore()
    await store.fetchUsers()
    expect(store.users.length).toBe(1)
    await store.fetchRoles()
    await store.setRole('u1', 'r1')
    expect(store.users[0].roleId).toBe('r1')
  })

  it('fetches and updates system configs', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
    const { useAdminStore } = await import('@/stores/admin')
    const store = useAdminStore()
    await store.fetchConfigs()
    expect(store.configs.baseUrl).toContain('matrix.example.com')
    await store.updateConfig('enableEncryption', false)
    expect(store.configs.enableEncryption).toBe(false)
  })
})
