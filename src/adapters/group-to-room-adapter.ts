/**
 * 群功能到房间功能的适配器
 * 提供向后兼容的API，内部使用Matrix房间功能
 */

import { inject, onUnmounted } from 'vue'
import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'
import { createRoomService, type RoomService } from '@/services/roomService'
import { setRoomSearchClient } from '@/services/roomSearchService'
import {
  searchJoinedRooms,
  searchPublicRooms,
  getRoomSearchSuggestions,
  saveRoomSearchHistory
} from '@/services/roomSearchService'
import type { GroupDetailReq, GroupListReq, CreateRoomOptions } from '@/services/types'
import { RoleEnum } from '@/enums'

/**
 * 群成员类型
 */
interface GroupMember {
  uid: string
  name: string
  avatar: string
  account: string
  roleId: number
  activeStatus: number
  lastOptTime: number
  locPlace: string
  powerLevel: number
  membership: string
  joinedAt?: number
  lastActive?: number
  [key: string]: unknown
}

/**
 * 群到房的适配器类
 * 将群API调用转换为房间API调用
 */
export class GroupToRoomAdapter {
  private roomService: RoomService | null
  private client: MatrixClient
  private initialized: boolean

  constructor(client: MatrixClient) {
    this.client = client
    this.roomService = null
    this.initialized = false
  }

  /**
   * 显式初始化服务 - 满足测试需求
   */
  init(): void {
    if (this.initialized) return
    this.roomService = createRoomService(this.client)
    setRoomSearchClient(this.client)
    this.initialized = true
  }

  private async ensureServicesInitialized(): Promise<void> {
    if (this.initialized && this.roomService) return
    this.init()
  }

  // ===== 群详情相关 =====

  /**
   * 获取群详情（转换为房间详情）
   */
  async getGroupDetail(roomId: string): Promise<GroupDetailReq> {
    await this.ensureServicesInitialized()
    try {
      if (!this.roomService) {
        throw new Error('RoomService not initialized')
      }
      const roomDetail = await this.roomService.getRoomInfo(roomId)

      // 转换角色ID
      let roleId = RoleEnum.NORMAL
      if (roomDetail.myPowerLevel >= 100) {
        roleId = RoleEnum.LORD
      } else if (roomDetail.myPowerLevel >= 50) {
        roleId = RoleEnum.ADMIN
      }

      return {
        avatar: roomDetail.avatar || '',
        groupName: roomDetail.name,
        onlineNum: roomDetail.onlineCount,
        roleId,
        roomId: roomDetail.roomId,
        account: roomDetail.roomId, // Matrix 房间没有独立的账号概念
        memberNum: roomDetail.memberCount,
        remark: roomDetail.topic || '',
        myName: '', // 需要从 member 信息中获取
        allowScanEnter: roomDetail.joinRule === 'public'
      }
    } catch (error) {
      logger.error(`[GroupToRoomAdapter] Failed to get group detail for ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 获取群列表
   */
  async getGroupList(): Promise<GroupListReq[]> {
    await this.ensureServicesInitialized()
    try {
      // 获取用户加入的所有房间
      type MatrixRoom = {
        roomId: string
        getJoinedMembers?: () => unknown[]
        isSpaceRoom?: () => boolean
      }
      const clientWithGetRooms = this.client as { getRooms?: () => MatrixRoom[] } | null
      const rooms = clientWithGetRooms?.getRooms?.() || []
      const groupRooms = rooms.filter((room) => {
        // 过滤出群聊房间（不是1对1聊天）
        const members = room.getJoinedMembers?.() || []
        return members.length > 2 || room.isSpaceRoom?.()
      })

      const groupList: GroupListReq[] = []

      for (const room of groupRooms) {
        try {
          if (!this.roomService) {
            throw new Error('RoomService not initialized')
          }
          const roomInfo = await this.roomService.getRoomInfo(room.roomId)
          groupList.push({
            groupId: room.roomId,
            roomId: room.roomId,
            roomName: roomInfo.name,
            avatar: roomInfo.avatar || '',
            remark: roomInfo.topic || ''
          })
        } catch (error) {
          logger.warn(`[GroupToRoomAdapter] Failed to get info for room ${room.roomId}:`, error)
        }
      }

      return groupList
    } catch (error) {
      logger.error('[GroupToRoomAdapter] Failed to get group list:', error)
      throw error
    }
  }

  // ===== 群管理相关 =====

  /**
   * 创建群（转换为创建房间）
   */
  async createGroup(options: {
    name: string
    avatar?: string
    description?: string
    members?: string[]
    isPublic?: boolean
  }): Promise<string> {
    await this.ensureServicesInitialized()
    try {
      const roomOptions: CreateRoomOptions = {
        name: options.name,
        ...(options.description && { topic: options.description }),
        isPrivate: !options.isPublic,
        invite: options.members || [],
        ...(options.avatar && { avatar: options.avatar }),
        encryption: true, // 默认启用加密
        preset: options.isPublic ? 'public_chat' : 'private_chat'
      }

      if (!this.roomService) {
        throw new Error('RoomService not initialized')
      }
      return await this.roomService.createRoom(roomOptions)
    } catch (error) {
      logger.error('[GroupToRoomAdapter] Failed to create group:', error)
      throw error
    }
  }

  /**
   * 邀请用户进群
   */
  async inviteToGroup(roomId: string, userId: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.inviteUser(roomId, userId)
  }

  /**
   * 设置群管理员
   */
  async setGroupAdmin(roomId: string, userId: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.setUserPowerLevel(roomId, userId, 50)
  }

  /**
   * 取消群管理员
   */
  async unsetGroupAdmin(roomId: string, userId: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.setUserPowerLevel(roomId, userId, 0)
  }

  /**
   * 转让群主
   */
  async transferGroupOwner(roomId: string, newOwnerId: string): Promise<void> {
    await this.ensureServicesInitialized()
    try {
      if (!this.roomService) {
        throw new Error('RoomService not initialized')
      }
      const roomInfo = await this.roomService.getRoomInfo(roomId)
      if (roomInfo.myPowerLevel < 100) {
        throw new Error('Only group owner can transfer ownership')
      }

      // 将新主人设为管理员
      await this.roomService.setUserPowerLevel(roomId, newOwnerId, 100) // OWNER权限
      // 将自己降级为管理员
      const clientWithGetUserId = this.client as { getUserId?: () => string } | null
      const currentUserId = clientWithGetUserId?.getUserId?.() || ''
      if (currentUserId) {
        await this.roomService.setUserPowerLevel(roomId, currentUserId, 50) // ADMIN权限
      }
    } catch (error) {
      logger.error(`[GroupToRoomAdapter] Failed to transfer group owner for ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 踢出群聊
   */
  async kickFromGroup(roomId: string, userId: string, reason?: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.kickUser(roomId, userId, reason)
  }

  /**
   * 退出群聊
   */
  async leaveGroup(roomId: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.leaveRoom(roomId)
  }

  /**
   * 设置群公告
   */
  async setGroupAnnouncement(roomId: string, announcement: string): Promise<void> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.setRoomAnnouncement(roomId, announcement)
  }

  /**
   * 获取群公告
   */
  async getGroupAnnouncement(roomId: string): Promise<string> {
    await this.ensureServicesInitialized()
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    return this.roomService.getRoomAnnouncement(roomId)
  }

  // ===== 群成员相关 =====

  /**
   * 获取群成员列表
   */
  async getGroupMembers(roomId: string): Promise<GroupMember[]> {
    await this.ensureServicesInitialized()
    try {
      if (!this.roomService) {
        throw new Error('RoomService not initialized')
      }
      const roomMembers = await this.roomService.getRoomMembers(roomId)

      // 转换为原有格式
      return roomMembers.map(
        (member): GroupMember => ({
          uid: member.userId,
          name: member.displayName,
          avatar: member.avatarUrl || '',
          account: member.userId,
          roleId: this.powerLevelToRoleId(member.powerLevel),
          activeStatus: member.membership === 'join' ? 1 : 2, // 根据成员状态判断在线状态
          lastOptTime: member.lastActive || Date.now(),
          locPlace: member.avatarUrl || '',
          powerLevel: member.powerLevel,
          membership: member.membership,
          joinedAt: member.joinedAt,
          lastActive: member.lastActive
        })
      )
    } catch (error) {
      logger.error(`[GroupToRoomAdapter] Failed to get group members for ${roomId}:`, error)
      throw error
    }
  }

  /**
   * 获取群成员统计
   */
  async getGroupStats(roomId: string): Promise<{
    totalNum: number
    onlineNum: number
    adminCount: number
    memberCount: number
  }> {
    await this.ensureServicesInitialized()
    try {
      // 直接调用服务方法，确保没有中间层缓存或合并逻辑
      if (!this.roomService) {
        throw new Error('RoomService not initialized')
      }

      // 每次都直接调用，不做任何缓存
      const stats = await this.roomService.getRoomStats(roomId)

      return {
        totalNum: stats.totalMembers,
        onlineNum: stats.onlineMembers,
        adminCount: stats.adminCount + stats.moderatorCount, // 群主+管理员
        memberCount: stats.memberCount + stats.guestCount // 普通成员+访客
      }
    } catch (error) {
      logger.error(`[GroupToRoomAdapter] Failed to get group stats for ${roomId}:`, error)
      throw error
    }
  }

  // ===== 权限级别转换 =====

  /**
   * 权限等级转换为角色ID
   */
  private powerLevelToRoleId(powerLevel: number): number {
    if (powerLevel >= 100) return RoleEnum.LORD
    if (powerLevel >= 50) return RoleEnum.ADMIN
    return RoleEnum.NORMAL
  }

  // ===== 事件监听 =====

  /**
   * 监听群成员变化
   */
  onMemberChanged(callback: (data: { roomId: string; userId: string; membership: string }) => void): void {
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    // 使用类型断言来处理事件监听器的参数类型
    this.roomService.addEventListener('room:member_changed', callback as (...args: unknown[]) => void)
  }

  /**
   * 监听群信息变化
   */
  onGroupInfoChanged(callback: (data: { roomId: string; type: string; content: unknown }) => void): void {
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    this.roomService.addEventListener('room:state_changed', callback as (...args: unknown[]) => void)
  }

  /**
   * 监听群创建事件
   */
  onGroupCreated(callback: (data: { roomId: string }) => void): void {
    if (!this.roomService) {
      throw new Error('RoomService not initialized')
    }
    this.roomService.addEventListener('room:created', callback as (...args: unknown[]) => void)
  }

  // ===== 搜索功能 =====

  /**
   * 搜索已加入的群
   */
  async searchGroups(
    options: {
      query?: string
      limit?: number
      roomTypes?: ('public' | 'private' | 'direct')[]
      memberCountRange?: {
        min?: number
        max?: number
      }
      sortBy?: 'name' | 'member_count' | 'activity'
    } = {}
  ): Promise<GroupListReq[]> {
    try {
      // 定义搜索选项类型
      interface RoomSearchOptions {
        includeJoined?: boolean
        includeInvited?: boolean
        includeLeft?: boolean
        query?: string
        limit?: number
        roomTypes?: ('public' | 'private' | 'direct')[]
        memberCountRange?: {
          min?: number
          max?: number
        }
        sortBy?: 'name' | 'member_count' | 'activity'
      }

      const searchOptions: RoomSearchOptions = {
        includeJoined: true,
        includeInvited: true,
        includeLeft: false
      }

      if (options.query !== undefined) searchOptions.query = options.query
      if (options.limit !== undefined) searchOptions.limit = options.limit
      if (options.roomTypes) searchOptions.roomTypes = options.roomTypes
      if (options.memberCountRange) searchOptions.memberCountRange = options.memberCountRange
      if (options.sortBy) searchOptions.sortBy = options.sortBy

      const results = await searchJoinedRooms(searchOptions)

      // 转换为 GroupListReq 格式
      return results.map((room) => ({
        groupId: room.roomId,
        roomId: room.roomId,
        roomName: room.highlightedName || room.name,
        avatar: room.avatarUrl || '',
        remark: room.highlightedTopic || room.topic || ''
      }))
    } catch (error) {
      logger.error('[GroupToRoomAdapter] Failed to search groups:', error)
      throw error
    }
  }

  /**
   * 搜索公开群
   */
  async searchPublicGroups(options: { query?: string; limit?: number; server?: string } = {}): Promise<GroupListReq[]> {
    try {
      // 定义公开房间搜索选项类型
      interface PublicRoomSearchOptions {
        query?: string
        limit?: number
        server?: string
      }

      const searchOptions: PublicRoomSearchOptions = {}

      if (options.query !== undefined) searchOptions.query = options.query
      if (options.limit !== undefined) searchOptions.limit = options.limit
      if (options.server) searchOptions.server = options.server

      const results = await searchPublicRooms(searchOptions)

      // 转换为 GroupListReq 格式
      return results.map((room) => ({
        groupId: room.roomId,
        roomId: room.roomId,
        roomName: room.highlightedName || room.name,
        avatar: room.avatarUrl || '',
        remark: room.highlightedTopic || room.topic || ''
      }))
    } catch (error) {
      logger.error('[GroupToRoomAdapter] Failed to search public groups:', error)
      throw error
    }
  }

  /**
   * 获取群搜索建议
   */
  async getGroupSearchSuggestions(query: string, limit?: number): Promise<string[]> {
    try {
      const suggestions = await getRoomSearchSuggestions(query, limit)

      // 保存搜索历史
      if (query && query.trim().length >= 2) {
        saveRoomSearchHistory(query)
      }

      return suggestions
    } catch (error) {
      logger.error('[GroupToRoomAdapter] Failed to get search suggestions:', error)
      return []
    }
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.roomService) return
    this.roomService.removeEventListener(event, callback)
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    if (!this.roomService) return
    this.roomService.destroy()
  }
}

/**
 * 创建群到房的适配器
 * @param client Matrix客户端
 * @param autoInit 是否自动初始化服务，默认为true以匹配测试期望
 */
export function createGroupToRoomAdapter(client: MatrixClient, autoInit: boolean = true): GroupToRoomAdapter {
  const adapter = new GroupToRoomAdapter(client)
  if (autoInit) {
    adapter.init()
  }
  return adapter
}

/**
 * 注入适配器的 Composable
 */
export function useGroupToRoomAdapter() {
  const matrixAuthStore = inject<{ client?: MatrixClient }>('matrixAuthStore')
  if (!matrixAuthStore || !matrixAuthStore.client) {
    throw new Error('Matrix client not available')
  }

  const adapter = createGroupToRoomAdapter(matrixAuthStore.client)

  // 组件销毁时清理
  onUnmounted(() => {
    adapter.destroy()
  })

  return adapter
}
