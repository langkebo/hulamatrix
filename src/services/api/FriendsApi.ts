/**
 * Friends API Service
 * Replaces deprecated ImRequestUtils friends-related functions
 */

import MatrixClientService from '../matrix/MatrixClientService'
import type {
  SearchFriendParams,
  SendFriendRequestParams,
  FriendResponse,
  DeleteFriendParams,
  ModifyFriendRemarkParams,
  GetFriendPageParams
} from './types'

class FriendsApiService {
  /**
   * Search for friends by keyword
   * @deprecated Mock function - needs Matrix User Directory API implementation
   */
  async searchFriend(params: SearchFriendParams): Promise<FriendResponse> {
    console.warn('[FriendsApiService] searchFriend called with:', params)
    const _client = MatrixClientService.getInstance().getClient()

    // TODO: Implement with Matrix User Directory API
    // const result = await client.searchUserDirectory({
    //   searchTerm: params.keyword
    // })

    return { code: 200, data: { friends: [] } }
  }

  /**
   * Search for groups by keyword
   * @deprecated Mock function - needs Matrix Room Directory API implementation
   */
  async searchGroup(params: SearchFriendParams): Promise<FriendResponse> {
    console.warn('[FriendsApiService] searchGroup called with:', params)
    const _client = MatrixClientService.getInstance().getClient()

    // TODO: Implement with Matrix Room Directory API
    // const result = await client.publicRooms({
    //   filter: { generic_search_term: params.keyword }
    // })

    return { code: 200, data: { groups: [] } }
  }

  /**
   * Send friend request
   * @deprecated Mock function - needs Matrix Enhanced API implementation
   */
  async sendAddFriendRequest(params: SendFriendRequestParams): Promise<{ success: boolean }> {
    console.warn('[FriendsApiService] sendAddFriendRequest called with:', params)
    const _friendManager = MatrixClientService.getInstance().getFriendSystemManager()

    // TODO: Implement with Enhanced Friend API
    // await friendManager.sendFriendRequest(params.userId, params.message)

    return { success: true }
  }

  /**
   * Delete friend
   * @deprecated Mock function - needs Matrix Room API implementation
   */
  async deleteFriend(params: DeleteFriendParams): Promise<{ success: boolean }> {
    console.log('[FriendsApiService] deleteFriend called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // TODO: Implement with Matrix Room API - leave the direct message room
      // await client.leave(params.userId)
      return { success: true }
    } catch (error) {
      console.error('[FriendsApiService] deleteFriend failed:', error)
      return { success: false }
    }
  }

  /**
   * Modify friend remark
   * @deprecated Mock function - needs backend implementation
   */
  async modifyFriendRemark(params: ModifyFriendRemarkParams): Promise<{ success: boolean }> {
    console.log('[FriendsApiService] modifyFriendRemark called with:', params)
    // TODO: Implement with backend API
    return { success: true }
  }

  /**
   * Get friend list with pagination
   * @deprecated Mock function - needs backend implementation
   */
  async getFriendPage(
    params: GetFriendPageParams
  ): Promise<{ success: boolean; data?: { list: unknown[]; total: number } }> {
    console.log('[FriendsApiService] getFriendPage called with:', params)
    // TODO: Implement with backend API
    return { success: true, data: { list: [], total: 0 } }
  }
}

export default new FriendsApiService()
