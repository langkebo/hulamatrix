import { matrixClientService } from '@/integrations/matrix/client'

/**
 * 设置会话置顶
 * @param roomId 房间ID
 * @param top 是否置顶
 */
export async function sdkSetSessionTop(roomId: string, top: boolean): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  // ✅ 检查 client.credentials 是否存在（setRoomTag 内部会使用）
  if (!client.credentials) {
    throw new Error('Matrix client not authenticated (no credentials)')
  }

  // 使用 m.tag 事件设置置顶
  // m.favourite 标签通常用于表示置顶
  const tag = 'm.favourite'
  if (top) {
    const setRoomTagMethod = client.setRoomTag as
      | ((roomId: string, tag: string, opts: { order: number }) => Promise<unknown>)
      | undefined
    await setRoomTagMethod?.(roomId, tag, { order: 0 })
  } else {
    const deleteRoomTagMethod = client.deleteRoomTag as ((roomId: string, tag: string) => Promise<unknown>) | undefined
    await deleteRoomTagMethod?.(roomId, tag)
  }
}

/**
 * 离开房间 (对应退出群聊/删除会话)
 * @param roomId 房间ID
 */
export async function sdkLeaveRoom(roomId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')
  const leaveMethod = client.leave as ((roomId: string) => Promise<unknown>) | undefined
  await leaveMethod?.(roomId)
}

/**
 * 更新房间名称
 * @param roomId 房间ID
 * @param name 名称
 */
export async function sdkUpdateRoomName(roomId: string, name: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')
  const setRoomNameMethod = client.setRoomName as ((roomId: string, name: string) => Promise<unknown>) | undefined
  await setRoomNameMethod?.(roomId, name)
}

/**
 * 更新房间头像
 * @param roomId 房间ID
 * @param avatarUrl 头像URL (MXC URI)
 */
export async function sdkUpdateRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')
  const sendEventMethod = client.sendEvent as
    | ((roomId: string, eventType: string, content: Record<string, unknown>, stateKey?: string) => Promise<unknown>)
    | undefined
  await sendEventMethod?.(roomId, 'm.room.avatar', { url: avatarUrl }, '')
}

/**
 * 邀请成员加入房间
 * @param roomId 房间ID
 * @param userIds 用户ID列表
 */
export async function sdkInviteToRoom(roomId: string, userIds: string[]): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  // 并行邀请
  const inviteMethod = client.invite as ((roomId: string, userId: string) => Promise<unknown>) | undefined
  await Promise.all(userIds.map((userId) => inviteMethod?.(roomId, userId)))
}

/**
 * 从房间移除成员 (踢人)
 * @param roomId 房间ID
 * @param userIds 用户ID列表
 * @param reason 原因
 */
export async function sdkKickFromRoom(roomId: string, userIds: string[], reason?: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  const kickMethod = client.kick as ((roomId: string, userId: string, reason?: string) => Promise<unknown>) | undefined
  await Promise.all(userIds.map((userId) => kickMethod?.(roomId, userId, reason)))
}

/**
 * 设置成员权限级别 (管理员/群主)
 * @param roomId 房间ID
 * @param userId 用户ID
 * @param level 权限级别 (0: 普通, 50: 管理员, 100: 群主)
 */
export async function sdkSetPowerLevel(roomId: string, userId: string, level: number): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  const getRoomMethod = client.getRoom as
    | ((roomId: string) => {
        currentState: {
          getStateEvents: (type: string, stateKey: string) => { getContent: () => { users: Record<string, number> } }
        }
      } | null)
    | undefined
  const room = getRoomMethod?.(roomId)
  if (!room) throw new Error(`Room ${roomId} not found`)

  const powerLevelsEvent = room.currentState.getStateEvents('m.room.power_levels', '')
  if (!powerLevelsEvent) throw new Error('Power levels event not found')

  const content = { ...powerLevelsEvent.getContent() }
  content.users = { ...content.users, [userId]: level }

  const setPowerLevelMethod = client.setPowerLevel as
    | ((roomId: string, userId: string, level: number) => Promise<unknown>)
    | undefined
  await setPowerLevelMethod?.(roomId, userId, level)
}

/**
 * 创建群聊
 * @param userIds 初始成员ID列表
 * @param name 群名称 (可选)
 * @returns 创建的房间ID
 */
export async function sdkCreateRoom(userIds: string[], name?: string): Promise<{ roomId: string }> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')

  const createRoomMethod = client.createRoom as
    | ((opts: {
        name?: string
        invite?: string[]
        preset?: string
        visibility?: string
      }) => Promise<{ room_id?: string } | undefined>)
    | undefined
  const response = await createRoomMethod?.({
    name,
    invite: userIds,
    preset: 'private_chat', // 默认为私有群聊
    visibility: 'private'
  })

  return { roomId: response?.room_id || '' }
}
