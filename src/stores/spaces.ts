import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'
import type {
  SpaceInfo,
  SpaceRoomInfo,
  SpaceMemberInfo,
  SpaceHierarchyNode,
  SpaceNotificationSettings
} from '@/types/space'
import MatrixSpacesService from '@/services/matrix/MatrixSpacesService'

const matrixSpacesService = MatrixSpacesService.getInstance()

export const useSpacesStore = defineStore(
  StoresEnum.SPACES,
  () => {
    const spaces = ref<SpaceInfo[]>([])
    const currentSpace = ref<SpaceInfo | null>(null)
    const spaceRooms = ref<SpaceRoomInfo[]>([])
    const spaceMembers = ref<SpaceMemberInfo[]>([])
    const spaceHierarchy = ref<SpaceHierarchyNode[]>([])
    const publicSpaces = ref<SpaceInfo[]>([])
    const notificationSettings = ref<Map<string, SpaceNotificationSettings>>(new Map())
    const loading = ref(false)
    const error = ref<string | null>(null)

    const sortedSpaces = computed(() => {
      return [...spaces.value].sort((a, b) => {
        if (a.lastActive && b.lastActive) {
          return b.lastActive - a.lastActive
        }
        return a.name.localeCompare(b.name)
      })
    })

    async function fetchSpaces(forceRefresh = false): Promise<void> {
      loading.value = true
      error.value = null

      try {
        const spaceList = await matrixSpacesService.getSpaceList(forceRefresh)
        spaces.value = spaceList
      } catch (e) {
        error.value = 'Failed to load spaces'
        console.error('[useSpacesStore] Failed to fetch spaces:', e)
      } finally {
        loading.value = false
      }
    }

    async function createSpace(params: { name: string; topic?: string; isPublic?: boolean }): Promise<string | null> {
      loading.value = true
      error.value = null

      try {
        const spaceId = await matrixSpacesService.createSpace(params)
        if (spaceId) {
          await fetchSpaces()
        }
        return spaceId
      } catch (e) {
        error.value = 'Failed to create space'
        console.error('[useSpacesStore] Failed to create space:', e)
        return null
      } finally {
        loading.value = false
      }
    }

    async function fetchSpaceRooms(spaceId: string, forceRefresh = false): Promise<void> {
      loading.value = true
      error.value = null

      try {
        const rooms = await matrixSpacesService.getSpaceRooms(spaceId, forceRefresh)
        spaceRooms.value = rooms
      } catch (e) {
        error.value = 'Failed to load space rooms'
        console.error('[useSpacesStore] Failed to fetch space rooms:', e)
      } finally {
        loading.value = false
      }
    }

    async function fetchSpaceMembers(spaceId: string, forceRefresh = false): Promise<void> {
      loading.value = true
      error.value = null

      try {
        const members = await matrixSpacesService.getSpaceMembers(spaceId, forceRefresh)
        spaceMembers.value = members
      } catch (e) {
        error.value = 'Failed to load space members'
        console.error('[useSpacesStore] Failed to fetch space members:', e)
      } finally {
        loading.value = false
      }
    }

    async function fetchSpaceHierarchy(spaceId: string, maxDepth = 3, forceRefresh = false): Promise<void> {
      loading.value = true
      error.value = null

      try {
        const hierarchy = await matrixSpacesService.getSpaceHierarchy(spaceId, maxDepth, forceRefresh)
        spaceHierarchy.value = hierarchy
      } catch (e) {
        error.value = 'Failed to load space hierarchy'
        console.error('[useSpacesStore] Failed to fetch space hierarchy:', e)
      } finally {
        loading.value = false
      }
    }

    async function searchPublicSpaces(query: string, limit = 20): Promise<SpaceInfo[]> {
      loading.value = true
      error.value = null

      try {
        const spaces = await matrixSpacesService.searchPublicSpaces(query, limit)
        return spaces
      } catch (e) {
        error.value = 'Failed to search public spaces'
        console.error('[useSpacesStore] Failed to search public spaces:', e)
        return []
      } finally {
        loading.value = false
      }
    }

    async function fetchPublicSpaces(limit = 50, forceRefresh = false): Promise<void> {
      loading.value = true
      error.value = null

      try {
        const spaces = await matrixSpacesService.getPublicSpaces(limit)
        if (forceRefresh || publicSpaces.value.length === 0) {
          publicSpaces.value = spaces
        }
      } catch (e) {
        error.value = 'Failed to load public spaces'
        console.error('[useSpacesStore] Failed to fetch public spaces:', e)
      } finally {
        loading.value = false
      }
    }

    async function createInviteLink(spaceId: string, expiresIn?: number): Promise<string | null> {
      loading.value = true
      error.value = null

      try {
        const link = await matrixSpacesService.createSpaceInviteLink(spaceId, expiresIn)
        return link
      } catch (e) {
        error.value = 'Failed to create invite link'
        console.error('[useSpacesStore] Failed to create invite link:', e)
        return null
      } finally {
        loading.value = false
      }
    }

    async function getInviteLinks(spaceId: string): Promise<any[]> {
      loading.value = true
      error.value = null

      try {
        return await matrixSpacesService.getSpaceInviteLinks(spaceId)
      } catch (e) {
        error.value = 'Failed to fetch invite links'
        console.error('[useSpacesStore] Failed to fetch invite links:', e)
        return []
      } finally {
        loading.value = false
      }
    }

    async function revokeInviteLink(spaceId: string, inviteCode: string): Promise<boolean> {
      loading.value = true
      error.value = null

      try {
        return await matrixSpacesService.revokeSpaceInviteLink(spaceId, inviteCode)
      } catch (e) {
        error.value = 'Failed to revoke invite link'
        console.error('[useSpacesStore] Failed to revoke invite link:', e)
        return false
      } finally {
        loading.value = false
      }
    }

    async function fetchNotificationSettings(spaceId: string): Promise<SpaceNotificationSettings | null> {
      loading.value = true
      error.value = null

      try {
        const settings = await matrixSpacesService.getSpaceNotificationSettings(spaceId)
        if (settings) {
          notificationSettings.value.set(spaceId, settings)
        }
        return settings
      } catch (e) {
        error.value = 'Failed to fetch notification settings'
        console.error('[useSpacesStore] Failed to fetch notification settings:', e)
        return null
      } finally {
        loading.value = false
      }
    }

    async function updateNotificationSettings(
      spaceId: string,
      settings: Partial<SpaceNotificationSettings>
    ): Promise<boolean> {
      loading.value = true
      error.value = null

      try {
        const success = await matrixSpacesService.updateSpaceNotificationSettings(spaceId, settings)
        if (success) {
          const current = notificationSettings.value.get(spaceId)
          if (current) {
            notificationSettings.value.set(spaceId, { ...current, ...settings })
          }
        }
        return success
      } catch (e) {
        error.value = 'Failed to update notification settings'
        console.error('[useSpacesStore] Failed to update notification settings:', e)
        return false
      } finally {
        loading.value = false
      }
    }

    async function setSpaceMuted(spaceId: string, muted: boolean): Promise<boolean> {
      return await updateNotificationSettings(spaceId, {
        enabled: !muted,
        level: muted ? 'none' : 'all'
      })
    }

    async function setNotificationLevel(spaceId: string, level: 'all' | 'mentions' | 'none'): Promise<boolean> {
      return await updateNotificationSettings(spaceId, {
        level,
        enabled: level !== 'none'
      })
    }

    async function searchJoinedSpaces(query: string): Promise<SpaceInfo[]> {
      loading.value = true
      error.value = null

      try {
        return await matrixSpacesService.searchJoinedSpaces(query)
      } catch (e) {
        error.value = 'Failed to search joined spaces'
        console.error('[useSpacesStore] Failed to search joined spaces:', e)
        return []
      } finally {
        loading.value = false
      }
    }

    async function searchAllSpaces(query: string, includePublic = true, limit = 20): Promise<SpaceInfo[]> {
      loading.value = true
      error.value = null

      try {
        return await matrixSpacesService.searchSpaces(query, includePublic, limit)
      } catch (e) {
        error.value = 'Failed to search spaces'
        console.error('[useSpacesStore] Failed to search spaces:', e)
        return []
      } finally {
        loading.value = false
      }
    }

    async function addRoomToSpace(spaceId: string, roomId: string): Promise<boolean> {
      const success = await matrixSpacesService.addRoomToSpace(spaceId, roomId)
      if (success) {
        await fetchSpaceRooms(spaceId)
      }
      return success
    }

    async function removeRoomFromSpace(spaceId: string, roomId: string): Promise<boolean> {
      const success = await matrixSpacesService.removeRoomFromSpace(spaceId, roomId)
      if (success) {
        await fetchSpaceRooms(spaceId)
      }
      return success
    }

    async function leaveSpace(spaceId: string): Promise<boolean> {
      const success = await matrixSpacesService.leaveSpace(spaceId)
      if (success) {
        await fetchSpaces()
        if (currentSpace.value?.roomId === spaceId) {
          currentSpace.value = null
        }
      }
      return success
    }

    async function joinSpace(spaceId: string): Promise<boolean> {
      const success = await matrixSpacesService.joinSpace(spaceId)
      if (success) {
        await fetchSpaces()
      }
      return success
    }

    async function inviteUser(spaceId: string, userId: string): Promise<boolean> {
      return matrixSpacesService.inviteUserToSpace(spaceId, userId)
    }

    async function kickUser(spaceId: string, userId: string, reason?: string): Promise<boolean> {
      return matrixSpacesService.kickUserFromSpace(spaceId, userId, reason)
    }

    async function updateSpaceInfo(
      spaceId: string,
      updates: { name?: string; topic?: string; avatar?: string }
    ): Promise<boolean> {
      const success = await matrixSpacesService.updateSpaceInfo(spaceId, updates.name, updates.topic, updates.avatar)
      if (success) {
        await fetchSpaces()
        const space = spaces.value.find((s) => s.roomId === spaceId)
        if (space) {
          currentSpace.value = space
        }
      }
      return success
    }

    function setCurrentSpace(space: SpaceInfo | null): void {
      currentSpace.value = space
    }

    function clearError(): void {
      error.value = null
    }

    return {
      spaces,
      currentSpace,
      spaceRooms,
      spaceMembers,
      spaceHierarchy,
      publicSpaces,
      notificationSettings,
      loading,
      error,
      sortedSpaces,
      fetchSpaces,
      createSpace,
      fetchSpaceRooms,
      fetchSpaceMembers,
      fetchSpaceHierarchy,
      searchPublicSpaces,
      fetchPublicSpaces,
      createInviteLink,
      getInviteLinks,
      revokeInviteLink,
      fetchNotificationSettings,
      updateNotificationSettings,
      setSpaceMuted,
      setNotificationLevel,
      searchJoinedSpaces,
      searchAllSpaces,
      addRoomToSpace,
      removeRoomFromSpace,
      leaveSpace,
      joinSpace,
      inviteUser,
      kickUser,
      updateSpaceInfo,
      setCurrentSpace,
      clearError
    }
  },
  {
    persist: false
  }
)
