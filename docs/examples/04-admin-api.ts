import { SynapseEnhancedClient } from 'matrix-js-sdk'

const client = new SynapseEnhancedClient({
  baseUrl: 'https://matrix.example.com',
  accessToken: 'your-access-token'
})

async function adminExample() {
  const stats = await client.admin.getStatistics()
  console.log(`Total users: ${stats.total_users}`)
  console.log(`Active users: ${stats.active_users}`)
  console.log(`Total rooms: ${stats.total_rooms}`)

  const rooms = await client.admin.getRooms({
    page: 1,
    limit: 10
  })

  console.log(`Retrieved ${rooms.items.length} rooms`)

  const users = await client.admin.getUsers({
    page: 1,
    limit: 10
  })

  console.log(`Retrieved ${users.items.length} users`)
}

adminExample()
