/**
 * Enhanced Friends API 使用示例
 *
 * 本文档展示了如何使用 Enhanced Friends API 的高级功能
 */

import { SynapseEnhancedClient } from 'matrix-js-sdk'

const client = new SynapseEnhancedClient({
  baseUrl: 'https://matrix.example.com',
  accessToken: 'your-access-token',
  apiPrefix: '/_synapse/client',
  timeout: 30000
})

async function exampleGetMutualFriends() {
  try {
    const result = await client.friends.getMutualFriends('@target:example.com', 1, 20)

    console.log(`Found ${result.pagination.total} mutual friends:`)
    result.items.forEach((friend) => {
      console.log(`- ${friend.displayName || friend.userId} (${friend.mutualCount} mutual connections)`)
    })
  } catch (error) {
    console.error('Failed to get mutual friends:', error)
  }
}

async function exampleGetRecentFriends() {
  try {
    const recentFriends = await client.friends.getRecentFriends(10)

    console.log('Recently interacted friends:')
    recentFriends.forEach((friend) => {
      console.log(`- ${friend.displayName || friend.userId} (last interaction: ${friend.lastInteraction})`)
    })
  } catch (error) {
    console.error('Failed to get recent friends:', error)
  }
}

async function exampleGetFriendInteractions() {
  try {
    const result = await client.friends.getFriendInteractions('@target:example.com', 1, 20)

    console.log(`Found ${result.pagination.total} interactions:`)
    result.items.forEach((interaction) => {
      console.log(`- [${interaction.interactionType}] ${interaction.content} (${interaction.createdAt})`)
    })
  } catch (error) {
    console.error('Failed to get friend interactions:', error)
  }
}

async function exampleGetFriendInteractionStats() {
  try {
    const stats = await client.friends.getFriendInteractionStats('@target:example.com')

    console.log('Friend interaction statistics:')
    console.log(`- Total interactions: ${stats.totalInteractions}`)
    console.log(`- Messages: ${stats.messagesCount}`)
    console.log(`- Friend requests: ${stats.friendRequestsCount}`)
    console.log(`- Room joins: ${stats.roomJoinsCount}`)
    console.log(`- Last interaction: ${stats.lastInteraction}`)
  } catch (error) {
    console.error('Failed to get friend interaction stats:', error)
  }
}

async function exampleSearchBlockedUsers() {
  try {
    const result = await client.friends.searchBlockedUsers('test', 1, 20)

    console.log(`Found ${result.pagination.total} blocked users:`)
    result.items.forEach((user) => {
      console.log(`- ${user.userId} (reason: ${user.reason || 'N/A'}, blocked at: ${user.blockedAt})`)
    })
  } catch (error) {
    console.error('Failed to search blocked users:', error)
  }
}

async function exampleGetRequestTemplates() {
  try {
    const templates = await client.friends.getRequestTemplates()

    console.log(`Found ${templates.length} friend request templates:`)
    templates.forEach((template) => {
      console.log(`- [${template.name}] ${template.message} (category: ${template.categoryId || 'default'})`)
    })
  } catch (error) {
    console.error('Failed to get request templates:', error)
  }
}

async function exampleVerifyFriendship() {
  try {
    const verification = await client.friends.verifyFriendship('@target:example.com')

    console.log('Friendship verification result:')
    console.log(`- Verified: ${verification.verified}`)
    console.log(`- Relationship type: ${verification.relationshipType || 'N/A'}`)
    console.log(`- Since: ${verification.since || 'N/A'}`)
  } catch (error) {
    console.error('Failed to verify friendship:', error)
  }
}

async function main() {
  await exampleGetMutualFriends()
  await exampleGetRecentFriends()
  await exampleGetFriendInteractions()
  await exampleGetFriendInteractionStats()
  await exampleSearchBlockedUsers()
  await exampleGetRequestTemplates()
  await exampleVerifyFriendship()
}

main()
