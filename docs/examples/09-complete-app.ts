/**
 * 完整的 TypeScript 应用示例
 *
 * 本文档展示了一个完整的 TypeScript 应用，使用 Matrix JS SDK Enhanced Module
 */

import { SynapseEnhancedClient, type IFriend, type IFriendRequest } from 'matrix-js-sdk'

interface AppConfig {
  baseUrl: string
  accessToken: string
  apiPrefix?: string
}

class MatrixApp {
  private client: SynapseEnhancedClient

  public constructor(config: AppConfig) {
    this.client = new SynapseEnhancedClient({
      baseUrl: config.baseUrl,
      accessToken: config.accessToken,
      apiPrefix: config.apiPrefix || '/_synapse/client',
      timeout: 30000
    })
  }

  public async displayFriends(): Promise<void> {
    try {
      const friends: IFriend[] = await this.client.friends.getFriends({
        page: 1,
        limit: 20
      })

      console.log('=== Friends List ===')
      friends.forEach((friend) => {
        console.log(`• ${friend.displayName || friend.userId}`)
        console.log(`  ID: ${friend.userId}`)
        console.log(`  Status: ${friend.status || 'unknown'}`)
        console.log(`  Category: ${friend.categoryId || 'uncategorized'}`)
        console.log(`  Remark: ${friend.remark || 'N/A'}`)
        console.log()
      })
    } catch (error) {
      console.error('Failed to fetch friends:', error)
    }
  }

  public async displayFriendRequests(): Promise<void> {
    try {
      const requests: IFriendRequest[] = await this.client.friends.getReceivedRequests()

      console.log('=== Pending Friend Requests ===')
      if (requests.length === 0) {
        console.log('No pending requests')
      } else {
        requests.forEach((request) => {
          console.log(`• From: ${request.displayName || request.userId}`)
          console.log(`  ID: ${request.userId}`)
          console.log(`  Message: ${request.message || 'No message'}`)
          console.log(`  Created: ${request.createdAt}`)
          console.log()
        })
      }
    } catch (error) {
      console.error('Failed to fetch friend requests:', error)
    }
  }

  public async displayCategories(): Promise<void> {
    try {
      const categories = await this.client.friends.getCategories()

      console.log('=== Friend Categories ===')
      categories.forEach((category) => {
        console.log(`• ${category.name}`)
        console.log(`  ID: ${category.id}`)
        console.log(`  Friends: ${category.friend_count || 0}`)
        console.log()
      })
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  public async displayBlockedUsers(): Promise<void> {
    try {
      const blockedUsers = await this.client.friends.getBlockedUsers()

      console.log('=== Blocked Users ===')
      if (blockedUsers.length === 0) {
        console.log('No blocked users')
      } else {
        blockedUsers.forEach((user) => {
          console.log(`• ${user.userId}`)
          console.log(`  Reason: ${user.reason || 'N/A'}`)
          console.log(`  Blocked at: ${user.blockedAt || 'N/A'}`)
          console.log()
        })
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error)
    }
  }

  public async displayMutualFriends(targetUserId: string): Promise<void> {
    try {
      const result = await this.client.friends.getMutualFriends(targetUserId, 1, 20)

      console.log(`=== Mutual Friends with ${targetUserId} ===`)
      console.log(`Total: ${result.pagination.total}`)
      console.log()
      result.items.forEach((friend) => {
        console.log(`• ${friend.displayName || friend.userId}`)
        console.log(`  Mutual connections: ${friend.mutualCount || 0}`)
        console.log()
      })
    } catch (error) {
      console.error('Failed to fetch mutual friends:', error)
    }
  }

  public async displayRecentFriends(): Promise<void> {
    try {
      const recentFriends = await this.client.friends.getRecentFriends(10)

      console.log('=== Recently Interacted Friends ===')
      recentFriends.forEach((friend) => {
        console.log(`• ${friend.displayName || friend.userId}`)
        console.log(`  Last interaction: ${friend.lastInteraction || 'N/A'}`)
        console.log(`  Interaction count: ${friend.interactionCount || 0}`)
        console.log()
      })
    } catch (error) {
      console.error('Failed to fetch recent friends:', error)
    }
  }

  public async displayFriendStats(targetUserId: string): Promise<void> {
    try {
      const stats = await this.client.friends.getFriendInteractionStats(targetUserId)

      console.log(`=== Friend Statistics for ${targetUserId} ===`)
      console.log(`Total interactions: ${stats.totalInteractions}`)
      console.log(`Messages: ${stats.messagesCount}`)
      console.log(`Friend requests: ${stats.friendRequestsCount}`)
      console.log(`Room joins: ${stats.roomJoinsCount}`)
      console.log(`Last interaction: ${stats.lastInteraction || 'N/A'}`)
    } catch (error) {
      console.error('Failed to fetch friend stats:', error)
    }
  }

  public async displayRequestTemplates(): Promise<void> {
    try {
      const templates = await this.client.friends.getRequestTemplates()

      console.log('=== Friend Request Templates ===')
      templates.forEach((template) => {
        console.log(`• ${template.name}`)
        console.log(`  Message: ${template.message}`)
        console.log(`  Category: ${template.categoryId || 'default'}`)
        console.log(`  Created: ${template.createdAt || 'N/A'}`)
        console.log()
      })
    } catch (error) {
      console.error('Failed to fetch request templates:', error)
    }
  }
}

async function main() {
  const config: AppConfig = {
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token',
    apiPrefix: '/_synapse/client'
  }

  const app = new MatrixApp(config)

  await app.displayFriends()
  await app.displayFriendRequests()
  await app.displayCategories()
  await app.displayBlockedUsers()
  await app.displayMutualFriends('@target:example.com')
  await app.displayRecentFriends()
  await app.displayFriendStats('@target:example.com')
  await app.displayRequestTemplates()
}

main()
