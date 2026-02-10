/**
 * 批量操作和流式 API 使用示例
 *
 * 本文档展示了如何使用批量操作和流式 API
 */

import { SynapseEnhancedClient, type IFriendEvent } from 'matrix-js-sdk'

const client = new SynapseEnhancedClient({
  baseUrl: 'https://matrix.example.com',
  accessToken: 'your-access-token',
  apiPrefix: '/_synapse/client',
  timeout: 30000
})

async function exampleGetFriendsBatch() {
  try {
    const userIds = ['@user1:example.com', '@user2:example.com', '@user3:example.com']

    const friendsMap = await client.friends.getFriendsBatch(userIds)

    console.log('Batch get friends result:')
    friendsMap.forEach((friend, userId) => {
      if (friend) {
        console.log(`✓ ${userId}: ${friend.displayName}`)
      } else {
        console.log(`✗ ${userId}: Not found or not a friend`)
      }
    })
  } catch (error) {
    console.error('Failed to get friends batch:', error)
  }
}

async function exampleSendFriendRequestsBatch() {
  try {
    const requests = [
      { user_id: '@user1:example.com', message: "Hi, let's be friends!" },
      { user_id: '@user2:example.com', message: 'Hello!' },
      { user_id: '@user3:example.com', message: 'Would you like to connect?' }
    ]

    const results = await client.friends.sendFriendRequestsBatch(requests)

    console.log('Batch send friend requests result:')
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${requests[index].user_id}: ${result.status}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })
  } catch (error) {
    console.error('Failed to send friend requests batch:', error)
  }
}

async function exampleUpdateRemarksBatch() {
  try {
    const remarks = new Map<string, string>([
      ['@user1:example.com', 'Colleague'],
      ['@user2:example.com', 'Family'],
      ['@user3:example.com', 'Friend']
    ])

    const results = await client.friends.updateRemarksBatch(remarks)

    console.log('Batch update remarks result:')
    results.forEach((success, userId) => {
      console.log(`${success ? '✓' : '✗'} ${userId}: ${success ? 'Updated' : 'Failed'}`)
    })
  } catch (error) {
    console.error('Failed to update remarks batch:', error)
  }
}

async function exampleStreamFriends() {
  try {
    console.log('Streaming friends...')
    console.log()

    let count = 0
    for await (const friend of client.friends.streamFriends({ limit: 50 })) {
      console.log(`${count + 1}. ${friend.displayName || friend.friendId}`)
      console.log(`   ID: ${friend.friendId}`)
      console.log(`   Status: ${friend.status}`)
      console.log()

      count++

      if (count >= 10) {
        console.log('... (showing first 10 friends)')
        break
      }
    }
  } catch (error) {
    console.error('Failed to stream friends:', error)
  }
}

async function exampleStreamFriendsByCategory() {
  try {
    console.log("Streaming friends by category 'work'...")
    console.log()

    for await (const friend of client.friends.streamFriends({ category: 'work', limit: 20 })) {
      console.log(`• ${friend.displayName || friend.friendId}`)
      console.log(`  Category: ${friend.categoryName || 'N/A'}`)
      console.log()
    }
  } catch (error) {
    console.error('Failed to stream friends by category:', error)
  }
}

async function exampleSubscribeToFriendEvents() {
  try {
    console.log('Subscribing to friend events...')
    console.log()

    const unsubscribe = client.friends.subscribeToFriendEvents((event: IFriendEvent) => {
      console.log(`[Event] ${event.type}`)
      console.log(`  User: ${event.userId}`)
      console.log(`  Time: ${event.timestamp}`)
      if (event.data) {
        console.log(`  Data: ${JSON.stringify(event.data)}`)
      }
      console.log()
    })

    console.log('Listening for events (press Ctrl+C to stop)...')

    setTimeout(() => {
      console.log('\nUnsubscribing from friend events...')
      unsubscribe()
      console.log('Done.')
    }, 30000)
  } catch (error) {
    console.error('Failed to subscribe to friend events:', error)
  }
}

async function exampleCombinedBatchAndStream() {
  try {
    console.log('=== Combined Batch and Stream Example ===')
    console.log()

    const userIds = ['@user1:example.com', '@user2:example.com']

    console.log('Step 1: Get friends batch')
    const friendsMap = await client.friends.getFriendsBatch(userIds)
    console.log(`Found ${friendsMap.size} friends\n`)

    console.log('Step 2: Stream all friends')
    let streamCount = 0
    for await (const friend of client.friends.streamFriends({ limit: 5 })) {
      console.log(`  ${streamCount + 1}. ${friend.displayName || friend.friendId}`)
      streamCount++
    }
    console.log(`\nTotal friends streamed: ${streamCount}`)
  } catch (error) {
    console.error('Failed in combined example:', error)
  }
}

async function main() {
  await exampleGetFriendsBatch()
  console.log()

  await exampleSendFriendRequestsBatch()
  console.log()

  await exampleUpdateRemarksBatch()
  console.log()

  await exampleStreamFriends()
  console.log()

  await exampleStreamFriendsByCategory()
  console.log()

  await exampleSubscribeToFriendEvents()
  console.log()

  await exampleCombinedBatchAndStream()
}

main()
