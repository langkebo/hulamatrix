/**
 * User Profile Service
 *
 * 使用 Matrix SDK 管理用户资料（昵称、头像等）
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { setDisplayName, setAvatarUrl } from '@/utils/matrixClientUtils'
import { mediaService } from '@/services/mediaService'
import { logger } from '@/utils/logger'

/**
 * 用户资料服务
 */
export const userProfileService = {
  /**
   * 更新用户昵称
   * @param displayName 新昵称
   */
  async setDisplayName(displayName: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await setDisplayName(client, displayName)
      logger.info('[UserProfile] Display name updated successfully')
    } catch (error) {
      logger.error('[UserProfile] Failed to set display name:', error)
      throw error
    }
  },

  /**
   * 上传并设置用户头像
   * @param file 头像文件
   * @returns 上传后的 MXC URL
   */
  async setAvatar(file: File | Blob): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 1. 上传媒体文件
      const uploadResult = await mediaService.uploadMedia(file, {
        filename: 'avatar',
        contentType: file instanceof File ? file.type : 'image/jpeg'
      })

      const mxcUrl = uploadResult.contentUri

      // 2. 设置头像 URL
      await setAvatarUrl(client, mxcUrl)

      logger.info('[UserProfile] Avatar updated successfully:', { mxcUrl })
      return mxcUrl
    } catch (error) {
      logger.error('[UserProfile] Failed to set avatar:', error)
      throw error
    }
  },

  /**
   * 设置头像 URL（已上传的 MXC URL）
   * @param mxcUrl Matrix 内容 URI (mxc://...)
   */
  async setAvatarUrl(mxcUrl: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await setAvatarUrl(client, mxcUrl)
      logger.info('[UserProfile] Avatar URL updated successfully:', { mxcUrl })
    } catch (error) {
      logger.error('[UserProfile] Failed to set avatar URL:', error)
      throw error
    }
  }
}
